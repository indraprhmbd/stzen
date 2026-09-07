# Payments Fragile Flow Hardening

## Context

Lanjut Bayar chain: client posts `{ productId }` (`ProductDetail.tsx:107`), server freezes `amount` from DB (`checkout.service.ts:59`), invoices `order.amount` from DB (`payments.service.ts:50`), webhook reconciles callback amount vs order (`payments.service.ts:79`). Snyk SAST on checkout plus payments reports 0 issues. Snyk SCA reports 10 issues, all `undici@7.29.0` transitive through `@cloudflare/vite-plugin@1.54.4` to miniflare (CVE-2026-84961 critical plus 5 high), dev-only local emulation, absent from the Worker bundle. Price tampering through request interception is impossible on the current shape (no price field exists anywhere in the request path), but four adjacent gaps let malformed or replayed gateway traffic through.

## Decisions

Server re-derivation stays the single pricing authority (OWASP Business Logic Cheat Sheet rule: accept identifiers, compute money). Chose per-provider `amountRequired` flag over provider-status reconcile fetch because the fetch adds gateway latency plus new secret scope on every webhook, while the flag closes the hole at zero cost. Chose unique index plus insert-first claim over in-memory dedup because Workers isolates share nothing and Postgres unique violations are the only airtight concurrent guard. Chose conditional delete over locking reads because one conditional statement removes the TOCTOU window with no lock plumbing. Provider reconcile fetch rejected (latency, scope). Single-secret webhook auth kept, rotation stays procedural (grace-set verification deferred, SumoPod sandbox phase).

## Implementation

### Gap table

| ID | Location | Flaw | Fix |
|----|----------|------|-----|
| G1 | `payments.service.ts:79`, `providers/sumopod.ts:161` | Amount guard skipped when `data.amount` missing (`undefined` passes) | `amountRequired: true` for sumopod, missing or mismatch is 409 |
| G2 | `payments.service.ts:68`, token mode | Static-token deliveries without event id skip dedup, replay forever | Token mode requires event id, dedup path mandatory |
| G3 | `checkout.routes.ts:25`, `payments.service.ts:69`, `audit.ts:47` | Idempotency check-then-act, no unique constraint, concurrent duplicates both process | `0008_audit_idempotency_unique.sql` plus insert-first claim |
| G4 | `orders.service.ts:104` | Delete checks PENDING then deletes unconditionally, webhook `claimPaid` can land between | Conditional delete `.eq('status','PENDING')`, require returned row or 409 |
| G5 | `checkout.schema.ts:5` | Non-strict object silently ignores injected fields | `.strict()` fail-closed |

### Patterns

Insert-first claim (webhook plus checkout):

```typescript
const { error: claimError } = await supabaseAdmin
  .from('audit_logs')
  .insert({ action: 'webhook:claim', idempotency_key: key })
if (claimError?.code === '23505') return { status: 'duplicate', skipped: true }
```

Atomic delete:

```typescript
const { data: deleted, error } = await supabaseAdmin
  .from('orders')
  .delete()
  .eq('public_id', publicId)
  .eq('status', 'PENDING')
  .is('payment_ref', null)
  .select('public_id')
if (error || !deleted?.length) throw new ConflictError('Order no longer cancellable')
```

Non-issues confirmed (no change): IDR hardcoded (no currency confusion), fixed qty 1 (no negative or overflow qty), integer amounts (no float rounding), `claimPaid` conditional update (`orders.service.ts:183`), `transitionStatus` re-reads state per call, gateway 409 on duplicate `order_id` fires before `setProviderRef` overwrite, audit captures price plus outcome, per-feature rate limits (auth 20, checkout 30, payments 30, webhooks 120 per minute).

### Verification

Adversarial cases: forged price field rejected (400 plus DB amount wins), webhook amount mismatch 409, missing amount 409, duplicate event id single fulfill, concurrent double checkout one row per key, delete versus fulfill race keeps exactly one outcome, wrong secret 401 or 403, unknown event 400. Snyk stays on demand through the agent session, no CI integration (decision: avoid freemium seat and org call limits). Re-run SAST on touched payment modules plus SCA at medium threshold before each payments-related merge.

## Open Questions

SumoPod production contract may differ from sandbox on `data.amount` presence. Confirm on first production webhook, keep `amountRequired` strict until proven otherwise. Webhook secret rotation stays manual (single secret, no grace set). Checkout URL persistence (return existing invoice link on re-initiate instead of gateway 409 surfacing) deferred to payments UX pass.
