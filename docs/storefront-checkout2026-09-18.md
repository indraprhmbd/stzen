# Storefront dual-flow checkout (manual + SumoPod QRIS)

Date: 2026-09-18. Status: approved, implementing. Bulk dev, local first:
no staging deploy, no push until ordered.

## Goal

One `KONFIRMASI PESANAN` dialog on product detail serves two flows: automated
SumoPod QRIS (`LANJUT BAYAR`) and manual order (`TARUH PESANAN`). Account +
WA delivery-info form renders only on variants flagged by admin. Method locks
at order creation; retries cannot switch it. Full id/en i18n.

## Data model (migration 0018)

- `product_variants.requires_delivery_info BOOLEAN NOT NULL DEFAULT false`.
  Existing variants default off. Admin-only write (service_role); public
  detail exposes it as a boolean (select allowlist, same as other fields).
- `orders.customer_account TEXT NOT NULL DEFAULT ''`,
  `orders.wa_number TEXT NOT NULL DEFAULT ''`. Backfill-safe.
- Rule: contact columns required iff the variant's flag was on at purchase.
  Server reads the variant row; client flag never trusted.

## Server

- Admin variant CRUD: `requiresDeliveryInfo` boolean in
  `VariantCreateSchema` / `VariantUpdateSchema`, insert + update mapping,
  list-projection + `Variant` type, checkbox in variant modal. Default off.
- `productsService.getById`: select `requires_delivery_info`, map to
  `ProductWithStock.requiresDeliveryInfo` (product-only fallback: false).
- `CheckoutSchema` (strict, fail closed): `productId` +
  `paymentMethod: z.enum(['manual','sumopod'])` +
  optional `customerAccount` / `waNumber`.
- `checkout.service.createOrder(userId, publicId, opts)`:
  - Loads internal variant row (already does for stock gate).
  - Method allowlist: `manual` always; `sumopod` only when
    `PAYMENT_SUMOPOD_API_KEY` non-empty. Unknown/disabled -> 400.
  - Flag on: both fields mandatory. Account trim 3-120 chars.
    WA normalize server-side: strip non-digits, `08..` -> `62..`,
    `+62` -> `62`, require `^62[8-9]\d{7,12}$`, else 400. Stored normalized.
  - Flag off: fields ignored, stored `''`.
  - Sets `payment_provider = method` at create. This is the lock.
- `payments.service.initiatePayment`: provider from the order's stored
  `paymentProvider` (not env). `ConflictError` when the order already carries
  a provider ref from a different provider. Manual path unchanged
  (null URL -> dashboard).
- Methods surface: `GET settings.public` gains
  `paymentMethods: ['manual'] | ['manual','sumopod']` (sumopod iff API key
  set). 60s cache path unchanged; allowlist comment updated.
- `mapOrderRow` + admin list: expose `customerAccount`, `waNumber` for the
  admin Orders display (read-only).

## Client

- `copy.ts` `Copy.products` += method/account/WA/success keys, both langs.
  No hardcoded Indonesian in JSX.
- `ProductDetail.tsx` dialog: receipt (unchanged) -> method radio
  (server-gated via methods surface; section hidden when single method) ->
  delivery form only when `product.requiresDeliveryInfo` (both fields
  required, inline errors, `inputMode="tel"` on WA).
- CTA label follows method: LANJUT BAYAR (sumopod) / TARUH PESANAN (manual).
  On click `purchasing=true` freezes radio + inputs + backdrop.
  Failure -> unlock + error toast. Success manual -> WA deep-link state.
- Manual success: order ID + `wa.me/<support.whatsapp>` link with prefilled
  `Halo, konfirmasi pesanan manual <ID> (<produk>)` (i18n template) +
  dashboard button.
- Dashboard: PENDING + provider `manual` shows HUBUNGI WA CTA instead of
  BAYAR. SumoPod BAYAR unchanged (initiate reads stored provider).
- Admin Orders: account + WA shown read-only on the order row/detail.

## Verification (local)

- `npx tsc --noEmit -p server`, `npm test --workspace=server` (new: WA
  normalizer vectors, flag-on/flag-off checkout validation, method gating),
  `npx tsc --noEmit -p client`, `npm run build --workspace=client`,
  `lint-migrations`.
- Local smoke: flagged vs unflagged variants x manual vs QRIS; method radio
  frozen mid-request; EN toggle; WA link text; admin sees contact fields.
