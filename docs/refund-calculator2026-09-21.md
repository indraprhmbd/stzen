# Refund Calculator + Warranty Claims (2026-09-21)

## Rule (source: _temp/Refund-calculator.md)

```
Refund = (Purchase Price × Remaining Duration ÷ Total Duration) × Service Fee
```

Service fee: usage < 7d → 0.8; else claims 0 → 0.7, 1–2 → 0.6, 3 → 0.5, >3 → 0.4.
Exactly 7d counts as "more than 1 week" (claim branch). Rupiah floored.

## Anchors (locked)

- Purchase Price = `orders.amount` (frozen snapshot, includes manual edits while PENDING).
- Total Duration = `duration_snapshot` + `duration_snapshot_unit` (day×1, week×7, month×30). NULL → preview 400s.
- Usage clock starts at `paid_at`. usedDays = ceil((now - paidAt) / day)? Floor? — use fractional days, tier compares raw days (< 7). Remaining = max(0, total - used).
- Claim count = rows in `warranty_claims` for the order (NOT audit-derived; survives 90d audit purge).

## Schema (0025)

- `warranty_claims` (id, order_id FK→orders(id) cascade, note, actor_id/email, claimed_at; index order_id; RLS on zero policies).
- `orders.refund_amount` integer NULL (applied result; NULL = never refunded).
- AuditAction += `warranty:claim`.

## Write paths

| Action | Effect |
|---|---|
| recordClaim | DELIVERED-only; inserts row + audit `warranty:claim` |
| refund-preview | GET, computes from live row + claim count; never trusts client math |
| refund apply | recompute server-side → write `refund_amount` → `transitionStatus(refund)` (stock release unchanged) → audit `order:refund` with amount diff |

## Client (admin Orders)

Kalkulator button on PAID/DELIVERED rows → dialog: price, total/used/remaining, claim count + log, tier + result, note + "Catat klaim", Terapkan → confirm → refund.

## Overview metrics

- `stats.refunds = { count, total }`: REFUNDED orders in range (`created_at >= cutoff`), total = Σ(`refund_amount` ?? `amount` — pre-feature refunds were always full, so fallback is exact).
- UI: red Refund tile (count + total, eye-mask like Omzet/Keuntungan); heroes become `sm:grid-cols-3`. Chart untouched (omzet+untung stay; refund is a tile-level number).

## Tests

refundCalc tiers + boundaries (6.9/7.0d, claims 0/1/2/3/4, used>total→0, NULL duration throws), service injected deps, route apply-recomputes (client number ignored).
