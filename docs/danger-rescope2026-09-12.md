# Danger Rescope: Soft-Delete-First

## Verdict

Deactivate-first wins. Industry consensus (2026): core catalog entities soft-delete,
hard delete only for transient data. Two local reasons force it here:

1. Buyer harm: product hard delete cascades `vault_items` (incl. SOLD) and nulls
   `orders.product_id`, and `credentials.routes.ts:49` 404s on nulled product_id.
   One delete locks every past buyer out of paid credentials, unrecoverable.
2. Tax law: UU KUP Pasal 28 ayat (11) keeps books + electronic records 10 years.
   PAID/DELIVERED/REFUNDED orders are bookkeeping evidence. The 90-day order
   purge conflicts and is dropped.

## Policy

- Products/variants: Nonaktifkan (`is_active=false`) is the primary action.
  Hard delete only with zero orders (any status) + zero vault rows.
- Orders: never hard-deleted. Stale-reject transitions stay, no row deletion.
- Vault SOLD/REVOKED: never hard-deleted while a referencing order exists.
- Vault AVAILABLE: only purgeable kind, export-gated (kept).
- Audit: untouchable (already).

## Commits

1. `fix(server)`: tier 2 blocks on sold/terminal/vault presence; drop
   `kind=orders` from export + purge (schema, service, routes).
2. `feat(client)`: ProductsPage delete becomes Nonaktifkan + Danger Zone
   pointer; DangerZone tier 2/3 copy updated, vault-only purge.
3. `fix(server)`: credentials endpoint falls back to order snapshots when the
   product row is gone instead of 404.
4. `docs(client)`: guide danger section + FAQ rewritten for the new policy.

## Verification

tsc + tests + dry-run + Snyk. Live matrix adds: product with DELIVERED
order refuses delete with message; deactivate hides it from catalog while
buyer creds still open. Staging only after local green.
