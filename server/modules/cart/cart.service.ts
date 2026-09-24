// ─── Cart Service ──────────────────────────────────────────────────────────
// Server-authoritative durable cart (Postgres, no Redis). Desired-state
// writes: PUT sets the exact quantity, never additive. Prices shown are
// always recomputed from live variant rows - the stored unit_price_snapshot
// is informational only; checkout_cart RPC recomputes money DB-side.
// Optimistic locking via carts.version: every mutation requires
// expectedVersion and bumps it, so concurrent tabs/retries fail closed
// with 409 instead of silently overwriting each other.

import { supabaseAdmin } from '../../shared/db'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/http'

export const GUEST_COOKIE_NAME = 'cart_token'
export const MAX_LINE_QTY = 10
const CART_TTL_MS = 7 * 24 * 3600 * 1000

export interface CartOwner {
  userId?: string
  guestHash?: string
}

export interface CartLine {
  variantPublicId: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  // Strike-through anchor: null when no discount. Display only - checkout
  // RPC charges unitPrice and ignores this field entirely.
  compareAtPrice: number | null
}

export interface CartView {
  cartId: string | null
  version: number
  items: CartLine[]
  subtotal: number
  itemCount: number
}

interface CartRow {
  id: string
  version: number
}

// ─── Guest token ─────────────────────────────────────────────────────────────
// Raw token lives only in the HttpOnly cookie. DB stores sha256 hex so a
// table read never yields a usable session.

export function newGuestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashGuestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`cart:${token}`)
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function freshExpiry(): string {
  return new Date(Date.now() + CART_TTL_MS).toISOString()
}

function nowIso(): string {
  return new Date().toISOString()
}

async function findActiveCart(owner: CartOwner): Promise<CartRow | null> {
  let query = supabaseAdmin
    .from('carts')
    .select('id, version')
    .eq('status', 'ACTIVE')
    .gt('expires_at', nowIso())
    .limit(1)
  query = owner.userId ? query.eq('user_id', owner.userId) : query.eq('guest_token_hash', owner.guestHash!)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data && data.length > 0 ? (data[0] as CartRow) : null
}

async function findOrCreateCart(owner: CartOwner): Promise<CartRow> {
  const existing = await findActiveCart(owner)
  if (existing) return existing
  // The partial unique index covers ACTIVE + CHECKOUT_PENDING regardless of
  // expiry, so an invisible row can still block the insert below. Reuse it
  // instead of colliding: expired carts reset to a clean slate, checkout-
  // pending carts reject (an order is mid-payment for that cart).
  let query = supabaseAdmin
    .from('carts')
    .select('id, version, status, expires_at')
    .in('status', ['ACTIVE', 'CHECKOUT_PENDING'])
    .limit(1)
  query = owner.userId ? query.eq('user_id', owner.userId) : query.eq('guest_token_hash', owner.guestHash!)
  const { data: stale, error: staleErr } = await query
  if (staleErr) throw new Error(staleErr.message)
  const blocked = stale && stale.length > 0 ? stale[0] as CartRow & { status: string; expires_at: string } : null
  if (blocked) {
    // CHECKOUT_PENDING blocks only while a SumoPod payment is actually in
    // flight for it. Manual-provider PENDING orders (admin approval queue),
    // failed/expired/rejected rows, and missing orders all mean the cart
    // contents already converted (or died) - reclaim instead of wedging
    // the buyer until cart expiry.
    let reclaim = blocked.status === 'ACTIVE'
    if (blocked.status === 'CHECKOUT_PENDING' && new Date(blocked.expires_at).getTime() > Date.now()) {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('payment_status, payment_provider')
        .eq('cart_id', blocked.id)
        .limit(1)
      const o = orders && orders.length > 0 ? orders[0] as { payment_status: string; payment_provider: string } : null
      const inFlight = !!o && o.payment_status === 'PENDING' && o.payment_provider === 'sumopod'
      if (inFlight) {
        throw new ConflictError('Checkout in progress for this cart', 'CHECKOUT_IN_PROGRESS')
      }
      reclaim = true
    } else if (blocked.status === 'CHECKOUT_PENDING') {
      reclaim = true // expired pending: abandon it
    }
    if (reclaim) {
      // Expired (or consumed) cart: reclaim the row, drop dead lines. The
      // converted order keeps its own order_units snapshots - untouched.
      await supabaseAdmin.from('cart_items').delete().eq('cart_id', blocked.id)
      const { data: reset, error: resetErr } = await supabaseAdmin
        .from('carts')
        .update({ status: 'ACTIVE', version: blocked.version + 1, expires_at: freshExpiry(), updated_at: nowIso() })
        .eq('id', blocked.id)
        .select('id, version')
        .limit(1)
      if (resetErr) throw new Error(resetErr.message)
      if (reset && reset.length > 0) return reset[0] as CartRow
    }
  }
  const payload = {
    user_id: owner.userId ?? null,
    guest_token_hash: owner.guestHash ?? null,
    expires_at: freshExpiry(),
  }
  const { data, error } = await supabaseAdmin.from('carts').insert(payload).select('id, version').limit(1)
  if (!error && data && data.length > 0) return data[0] as CartRow
  // Lost a create race under the partial unique index - the winner's row wins.
  if (error && (error as { code?: string }).code === '23505') {
    const winner = await findActiveCart(owner)
    if (winner) return winner
  }
  throw new Error(error?.message ?? 'Failed to create cart')
}

async function resolveVaultVariant(publicId: string): Promise<{ id: string; price: number }> {
  const { data, error } = await supabaseAdmin
    .from('product_variants')
    .select('id, price, fulfillment_type')
    .eq('public_id', publicId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
  if (error) throw new Error(error.message)
  const variant = data && data.length > 0 ? data[0] : null
  if (!variant) throw new NotFoundError('Product not found or unavailable')
  // Plan scope is vault variants only: on_demand/manual rows fail at checkout,
  // so they fail here too instead of stranding lines in the cart.
  if (variant.fulfillment_type !== 'vault') {
    throw new BadRequestError('Product cannot be added to cart')
  }
  return { id: variant.id as string, price: variant.price as number }
}

// Conditional version bump is the optimistic lock: 0 rows updated means a
// concurrent writer moved the cart first.
async function bumpVersion(cartId: string, expectedVersion: number): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('carts')
    .update({ version: expectedVersion + 1, expires_at: freshExpiry(), updated_at: nowIso() })
    .eq('id', cartId)
    .eq('version', expectedVersion)
    .select('version')
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new ConflictError('Cart changed, refresh and retry', 'VERSION_CONFLICT')
  }
  return expectedVersion + 1
}

export async function getCartView(owner: CartOwner): Promise<CartView> {
  const cart = await findActiveCart(owner)
  if (!cart) {
    return { cartId: null, version: 0, items: [], subtotal: 0, itemCount: 0 }
  }
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('cart_items')
    .select('quantity, variant_id')
    .eq('cart_id', cart.id)
  if (itemsError) throw new Error(itemsError.message)
  if (!items || items.length === 0) {
    return { cartId: cart.id, version: cart.version, items: [], subtotal: 0, itemCount: 0 }
  }
  const variantIds = [...new Set(items.map((item) => item.variant_id))]
  const { data: variants, error: variantsError } = await supabaseAdmin
    .from('product_variants')
    .select('id, public_id, name, price, compare_at_price, is_active')
    .in('id', variantIds)
  if (variantsError) throw new Error(variantsError.message)
  const byId = new Map((variants ?? []).map((v) => [v.id, v]))
  const lines: CartLine[] = []
  for (const item of items) {
    const variant = byId.get(item.variant_id)
    // Variant deactivated/deleted after being added: hidden from the view,
    // checkout RPC rejects it anyway. Never fail the whole cart read.
    if (!variant || !variant.is_active) continue
    const unitPrice = Number(variant.price)
    const rawCompare = variant.compare_at_price == null ? NaN : Number(variant.compare_at_price)
    lines.push({
      variantPublicId: variant.public_id as string,
      name: variant.name as string,
      quantity: item.quantity as number,
      unitPrice,
      lineTotal: unitPrice * (item.quantity as number),
      compareAtPrice: Number.isFinite(rawCompare) && rawCompare > unitPrice ? rawCompare : null,
    })
  }
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  return { cartId: cart.id, version: cart.version, items: lines, subtotal, itemCount }
}

function assertQuantity(quantity: unknown): asserts quantity is number {
  if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_LINE_QTY) {
    throw new BadRequestError(`Quantity must be 1-${MAX_LINE_QTY}`)
  }
}

export async function putItem(
  owner: CartOwner,
  variantPublicId: string,
  quantity: number,
  expectedVersion: number
): Promise<CartView> {
  assertQuantity(quantity)
  const variant = await resolveVaultVariant(variantPublicId)
  const cart = await findOrCreateCart(owner)
  if (cart.version !== expectedVersion) {
    throw new ConflictError('Cart changed, refresh and retry', 'VERSION_CONFLICT')
  }
  const { error: upsertError } = await supabaseAdmin.from('cart_items').upsert(
    {
      cart_id: cart.id,
      variant_id: variant.id,
      quantity,
      unit_price_snapshot: variant.price,
      updated_at: nowIso(),
    },
    { onConflict: 'cart_id,variant_id' }
  )
  if (upsertError) throw new Error(upsertError.message)
  await bumpVersion(cart.id, expectedVersion)
  return getCartView(owner)
}

export async function removeItem(
  owner: CartOwner,
  variantPublicId: string,
  expectedVersion: number
): Promise<CartView> {
  const cart = await findActiveCart(owner)
  if (!cart) throw new NotFoundError('Cart not found or unavailable')
  if (cart.version !== expectedVersion) {
    throw new ConflictError('Cart changed, refresh and retry', 'VERSION_CONFLICT')
  }
  const { data: variants, error: variantError } = await supabaseAdmin
    .from('product_variants')
    .select('id')
    .eq('public_id', variantPublicId)
    .limit(1)
  if (variantError) throw new Error(variantError.message)
  if (variants && variants.length > 0 && variants[0]) {
    const { error: deleteError } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('variant_id', variants[0].id as string)
    if (deleteError) throw new Error(deleteError.message)
  }
  await bumpVersion(cart.id, expectedVersion)
  return getCartView(owner)
}

export async function clearCart(owner: CartOwner, expectedVersion: number): Promise<CartView> {
  const cart = await findActiveCart(owner)
  if (!cart) throw new NotFoundError('Cart not found or unavailable')
  if (cart.version !== expectedVersion) {
    throw new ConflictError('Cart changed, refresh and retry', 'VERSION_CONFLICT')
  }
  const { error: deleteError } = await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart.id)
  if (deleteError) throw new Error(deleteError.message)
  await bumpVersion(cart.id, expectedVersion)
  return getCartView(owner)
}

// Guest-to-user merge on login. Sums quantities (capped), converts the guest
// cart so the token can never merge twice. Never copies user cart to guest.
export async function mergeGuestToUser(guestHash: string, userId: string): Promise<CartView> {
  const guestCart = await findActiveCart({ guestHash })
  if (!guestCart) return getCartView({ userId })
  const userCart = await findOrCreateCart({ userId })
  const { data: guestItems, error: guestError } = await supabaseAdmin
    .from('cart_items')
    .select('variant_id, quantity')
    .eq('cart_id', guestCart.id)
  if (guestError) throw new Error(guestError.message)
  if (guestItems && guestItems.length > 0) {
    const variantIds = [...new Set(guestItems.map((item) => item.variant_id))]
    const { data: userItems, error: userError } = await supabaseAdmin
      .from('cart_items')
      .select('variant_id, quantity')
      .eq('cart_id', userCart.id)
      .in('variant_id', variantIds)
    if (userError) throw new Error(userError.message)
    const userQty = new Map((userItems ?? []).map((item) => [item.variant_id, item.quantity as number]))
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('product_variants')
      .select('id, price')
      .in('id', variantIds)
    if (variantsError) throw new Error(variantsError.message)
    const priceById = new Map((variants ?? []).map((v) => [v.id, Number(v.price)]))
    for (const item of guestItems) {
      const summed = Math.min(MAX_LINE_QTY, (userQty.get(item.variant_id) ?? 0) + (item.quantity as number))
      const { error: upsertError } = await supabaseAdmin.from('cart_items').upsert(
        {
          cart_id: userCart.id,
          variant_id: item.variant_id,
          quantity: summed,
          unit_price_snapshot: priceById.get(item.variant_id) ?? 0,
          updated_at: nowIso(),
        },
        { onConflict: 'cart_id,variant_id' }
      )
      if (upsertError) throw new Error(upsertError.message)
    }
    await bumpVersion(userCart.id, userCart.version)
  }
  const { error: convertError } = await supabaseAdmin
    .from('carts')
    .update({ status: 'CONVERTED', updated_at: nowIso() })
    .eq('id', guestCart.id)
  if (convertError) throw new Error(convertError.message)
  return getCartView({ userId })
}

export const cartService = {
  getCartView,
  putItem,
  removeItem,
  clearCart,
  mergeGuestToUser,
  newGuestToken,
  hashGuestToken,
}
