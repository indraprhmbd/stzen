# Draft: Order-System Hardening P0+P1 (2026-09-04)

Grounding: postgres-best-practices skill (RLS/locking/index rules), supabase skill
(SECURITY DEFINER traps), live advisor lints, live grant inspection, Sep-2026
webhook/idempotency consensus (Stripe/Spree patterns: raw-body HMAC +
constant-time compare, atomic idempotency claim, amount verification, 2xx fast).

## P0

### 1. Revoke direct RPC execution (migration)
`allocate_credential(uuid,uuid)` and `handle_new_user()` are EXECUTE-grantable by
`anon`/`authenticated`/`PUBLIC` via `/rest/v1/rpc` (verified live). Only
RLS-deny-all stands in front of `allocate_credential` today.
```sql
revoke execute on function public.allocate_credential(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
```
Trigger firing does not require EXECUTE grants — signup flow unaffected.
(Index is P1 item 5, rides the same migration.)

### 2. Checkout idempotency (`server/modules/checkout/checkout.routes.ts`)
`POST /` ignores `Idempotency-Key` → double-click/retry mints duplicate PENDING
orders. Same mechanism as admin routes: lookup `findAuditByIdempotencyKey`,
return prior on hit, store result with `diff: order` on miss. Client
(`ProductDetail.handleBuy`): generate ONE key per buy-intent, reuse across
retries (never per-attempt — that defeats the purpose).

### 3. Atomic webhook claim (`server/modules/orders/orders.service.ts`,
   `server/modules/payments/payments.service.ts`)
`handleWebhook` read-check-allocate spans statements: concurrent retries can
double-allocate (two SOLD credentials, `vault_item_id` last-wins, one burned).
Fix without tx-threading refactor: new `claimPaid(publicId)` — single
`UPDATE ... WHERE status='PENDING' RETURNING`; zero rows = lost race → return
`{ skipped: true }` after re-read. `fulfillPaidOrder` uses it instead of
`transitionStatus(approve)`.

## P1

### 4. Webhook amount guard (`payments.service.handleWebhook`)
After lookup, before fulfill: `if (parsed.amount != null &&
Number(parsed.amount) !== Number(order.amount)) throw ConflictError`. Providers
already return `amount`; enforcement was missing.

### 5. Queue index — included in migration above.

### 6. Audible audit failures (checkout.routes, admin.orders.routes, payments.service)
`.catch(() => {})` → `.catch((e) => console.error('[audit]', ...))`. Audit is
the money-movement paper trail; silent gaps are unacceptable.

## Accepted risks (no action)
Checkout stock check advisory-only (deliver guard + STOK_HABIS is the real
lock); DELIVERED terminal (manual ops for post-delivery issues); in-memory
ratelimit single-instance only; RPC+service double-write of `vault_item_id`
harmless. HMAC already constant-time; credentials never logged; pricing
server-side. Dashboard leaked-password toggle is manual (no code).

## Verification
Revoke: re-run routine_privileges query → only postgres/service_role remain.
Idempotency: double-POST same key → one order, second returns original.
Race: parallel webhook replays → one allocation, second `skipped:true`.
Amount: mismatched callback → 409, order stays PENDING.
`tsc` scoped (user runs, no shell here) + `vite build`.
