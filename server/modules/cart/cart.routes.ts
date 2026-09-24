// ─── Cart Routes ───────────────────────────────────────────────────────────
// Mounted PUBLIC (see app.ts allowlist): guests carry the cart_token cookie,
// authed users carry a JWT. Every handler re-derives ownership per request -
// a forged owner claim buys nothing because userId only comes from a
// verified JWT and guestHash only from the HttpOnly cookie hash.
// Merge is the one authed-only route: it moves guest lines into the user
// cart and burns the guest token.

import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { type AuthEnv, authMiddleware } from '../../shared/middleware/auth'
import { getEnv } from '../../shared/lib/runtime-env'
import {
  cartService,
  GUEST_COOKIE_NAME,
  MAX_LINE_QTY,
  type CartOwner,
} from './cart.service'

type CartEnv = AuthEnv

function guestCookieHeader(c: { req: { url: string } }, token: string, maxAge: number): string {
  // Same protocol gating as the auth session cookie: Secure only over HTTPS
  // so http://localhost and Pages preview guests keep their cart.
  const https = new URL(c.req.url).protocol === 'https:' || getEnv('ENV') === 'production'
  return `${GUEST_COOKIE_NAME}=${token}; HttpOnly;${https ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

const PutItemSchema = z
  .object({
    variantPublicId: z.string().min(1).max(32),
    quantity: z.number().int().min(1).max(MAX_LINE_QTY),
    expectedVersion: z.number().int().min(0),
  })
  .strict()

const VersionQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
})

export const cartRoutes = new Hono<CartEnv>()
  // Optional auth: verified JWT sets c.get('user'); absent header stays
  // guest; present-but-invalid still 401s via authMiddleware.
  .use('*', async (c, next) => {
    if (c.req.header('Authorization')) return authMiddleware(c, next)
    return next()
  })

  // GET / - cart view, prices recomputed from live variants
  .get('/', async (c) => {
    const user = c.get('user') as AuthEnv['Variables']['user'] | undefined
    if (user?.sub) return c.json(await cartService.getCartView({ userId: user.sub }))
    const raw = getCookie(c, GUEST_COOKIE_NAME)
    if (!raw) {
      return c.json({ cartId: null, version: 0, items: [], subtotal: 0, itemCount: 0 })
    }
    const owner: CartOwner = { guestHash: await cartService.hashGuestToken(raw) }
    return c.json(await cartService.getCartView(owner))
  })

  // PUT /items - desired-state quantity set (creates guest cart + cookie)
  .put('/items', zValidator('json', PutItemSchema), async (c) => {
    const { variantPublicId, quantity, expectedVersion } = c.req.valid('json')
    const user = c.get('user') as AuthEnv['Variables']['user'] | undefined
    if (user?.sub) {
      return c.json(await cartService.putItem({ userId: user.sub }, variantPublicId, quantity, expectedVersion))
    }
    let raw = getCookie(c, GUEST_COOKIE_NAME)
    let fresh = false
    if (!raw) {
      raw = cartService.newGuestToken()
      fresh = true
    }
    const owner: CartOwner = { guestHash: await cartService.hashGuestToken(raw) }
    const view = await cartService.putItem(owner, variantPublicId, quantity, expectedVersion)
    if (!fresh) return c.json(view)
    c.header('Set-Cookie', guestCookieHeader(c, raw, 2_592_000))
    return c.json(view, 201)
  })

  // DELETE /items/:publicId?expectedVersion= - remove one line
  .delete('/items/:publicId', zValidator('query', VersionQuerySchema), async (c) => {
    const { expectedVersion } = c.req.valid('query')
    const publicId = c.req.param('publicId')
    const user = c.get('user') as AuthEnv['Variables']['user'] | undefined
    const owner = await resolveOwner(c, user?.sub)
    return c.json(await cartService.removeItem(owner, publicId, expectedVersion))
  })

  // DELETE /?expectedVersion= - empty the cart
  .delete('/', zValidator('query', VersionQuerySchema), async (c) => {
    const { expectedVersion } = c.req.valid('query')
    const user = c.get('user') as AuthEnv['Variables']['user'] | undefined
    const owner = await resolveOwner(c, user?.sub)
    return c.json(await cartService.clearCart(owner, expectedVersion))
  })

  // POST /merge - authed only: fold cookie guest cart into the user cart,
  // burn the guest token so it can never merge twice. Chained (not a
  // separate statement) so /merge stays in AppType for hono/client.
  .post('/merge', authMiddleware, async (c) => {
    const user = c.get('user')
    const raw = getCookie(c, GUEST_COOKIE_NAME)
    if (!raw) return c.json(await cartService.getCartView({ userId: user.sub }))
    const view = await cartService.mergeGuestToUser(
      await cartService.hashGuestToken(raw),
      user.sub
    )
    c.header('Set-Cookie', guestCookieHeader(c, '', 0))
    return c.json(view)
  })

function resolveOwner(c: Parameters<typeof getCookie>[0], sub: string | undefined): Promise<CartOwner> {
  if (sub) return Promise.resolve({ userId: sub })
  const raw = getCookie(c, GUEST_COOKIE_NAME)
  if (!raw) throw new HTTPException(404, { message: 'Cart not found or unavailable' })
  return cartService.hashGuestToken(raw).then((guestHash) => ({ guestHash }))
}
