# Payment Gateway Scaffold (Provider-Agnostic) — 2026-09-04

## Decisions (locked)

- Duitku flavor: **Pop redirect** (`paymentUrl`). No `duitku.js` popup.
- Two fulfillment flows on paid webhook:
  1. **Vault stock → auto-`DELIVERED`.** Webhook `PAID` runs `allocate_credential` RPC, then flips straight to `DELIVERED`. Credentials immediately viewable.
  2. **On-demand → manual admin ingest.** Webhook stops at `PAID`. Admin approves/delivers from admin Orders (existing actions), generating/providing credentials at deliver time.
- Proof-of-transfer upload deferred indefinitely (gateway replaces manual verify).
- No provider SDKs. Direct `fetch`, zero new dependencies (repo convention).
- Secrets live in `server/.env` only. Never `settings` table, never client, never git.

## Research grounding (Sep 2026)

- Hono (Context7 `/honojs/hono`): webhook signature checks must use raw body via `c.req.text()` — never `c.req.json()` (re-serialization breaks signatures). Body reads once; clone `c.req.raw` if parsed twice. Duitku callbacks are form-encoded → `c.req.parseBody()`.
- Duitku Pop docs (`docs.duitku.com/pop/en/`): sandbox `https://api-sandbox.duitku.com/api/merchant/createInvoice` → `{ reference, paymentUrl }`. Callback POST fields include `merchantCode, amount, merchantOrderId, resultCode (00/01), reference, signature` where `signature = HMAC_SHA256(merchantCode+amount+merchantOrderId, apiKey)`. Min 10.000 IDR. Local callback testing needs ngrok tunnel + dashboard URL update.
- SumoPod (`api-pay-sandbox.sumopod.com/api/v1`, sandbox pre-KYC): `createPayment(order_id, amount IDR, expires_in_hours, success_return_url, cancel_return_url)` → `payment_link_url` (`pay.sumopod.com/link/…`). Webhooks Svix-style (`svix-id/timestamp/signature` + raw body, `whsec_` secret) or static token (`whtok_`). Events `payment.completed/failed/expired`. Only unofficial SDKs exist — integrate direct.
- ⚠️ Open: Duitku createInvoice request signature is MD5, absent from `crypto.subtle`. Options: tiny vendored MD5 helper (recommended, keeps Web Crypto purity) or `node:crypto` (breaks edge runtime). Decide at provider build time.

## Env (`server/.env`, documented in `.env.example`)

```bash
PAYMENT_ACTIVE_PROVIDER=manual            # manual | duitku | sumopod
PAYMENT_APP_BASE_URL=http://localhost:3000  # builds callback/return URLs
PAYMENT_DEFAULT_EXPIRY_MINUTES=60
# Duitku (sandbox defaults in .env.example)
PAYMENT_DUITKU_MERCHANT_CODE=
PAYMENT_DUITKU_API_KEY=
PAYMENT_DUITKU_BASE_URL=https://api-sandbox.duitku.com
# SumoPod (sandbox defaults in .env.example)
PAYMENT_SUMOPOD_API_KEY=
PAYMENT_SUMOPOD_BASE_URL=https://api-pay-sandbox.sumopod.com/api/v1
PAYMENT_SUMOPOD_WEBHOOK_SECRET=           # whsec_… (Svix mode)
PAYMENT_SUMOPOD_WEBHOOK_TOKEN=            # whtok_… (token mode)
```

## Files

```
server/modules/payments/
  payments.types.ts      # PaymentProvider interface:
                         #   createInvoice(order) → { checkoutUrl, providerRef }
                         #   parseWebhook(c) → { providerRef, outcome: 'paid'|'failed'|'expired', amount }
  payments.service.ts    # registry by PAYMENT_ACTIVE_PROVIDER, initiatePayment,
                         # handleWebhook (idempotent: skip if already PAID, audit every event)
  payments.routes.ts     # POST /api/v1/payments/:orderId/initiate (authed, returns checkoutUrl)
  webhooks.routes.ts     # POST /api/v1/webhooks/:provider (PUBLIC, no auth middleware,
                         # own lenient rate limit, raw-body read)
  providers/manual.ts    # current flow as a provider (PENDING, no redirect) — proves interface
  providers/duitku.ts    # STUB shaped by Pop docs, TODOs marked — fill on sandbox access
  providers/sumopod.ts   # STUB shaped by SDK research, TODOs marked — fill on sandbox access
server/shared/lib/hmac.ts  # HMAC-SHA256 sign/verify via crypto.subtle (no new deps)
migration: orders.payment_provider text null (+ index); paymentRef reused for gateway invoice ID
app.ts: mount both routes; webhook route outside auth
```

## Flows

1. Checkout → `PENDING` (unchanged) → client calls initiate → redirect to `checkoutUrl` (Pop) or `payment_link_url` (SumoPod).
2. Provider callback → verify signature → `markPaid` (new `orders.service` method through existing `VALID_TRANSITIONS`) → branch:
   - vault variant → `allocate_credential` RPC → auto-`DELIVERED` → credentials viewable;
   - on-demand variant → stop at `PAID`, await admin ingest via existing approve/deliver actions.
   - Every webhook event appended to audit with provider event ID as idempotency key.
3. `returnUrl` → client `/payment/return` → polls new authed `GET /payments/:orderId/status` → shows PAID/DELIVERED state.
4. Manual provider keeps today's blind-approve path working until gateways land.

## Phases

- A. Types + service + registry + manual provider + env docs + migration. No behavior change.
- B. Webhook routes + HMAC lib + `markPaid` + allocate-on-paid with vault/on-demand branch (non-deferrable core).
- C. Duitku stub wired with TODOs → activate on sandbox keys.
- D. SumoPod stub wired with TODOs → activate on sandbox key.
- E. Client: redirect checkout, Pay button on `PENDING` orders, return page.

## Provider handoff checklist (needed per gateway)

- Sandbox API key / merchant code, base URL, exact auth header shape.
- Callback field list + signature formula + sample payload.
- Expiry semantics, min/max amounts, supported methods (QRIS/VA/e-wallet).
- ngrok (or staging) public URL registered as callback/return URL.
