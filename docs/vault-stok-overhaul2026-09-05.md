# Vault Stok Overhaul, Unlock Gate, Rotate, In Place Edit

**Date:** 2026-09-05
**Scope:** 1 migration, ~6 server files, ~4 client files, 0 buyer changes
**Status:** Built 2026-09-05, server + client tsc 0 errors, awaiting tunnel smoke test

## Context

Stok tab splits vault management across a collapsible summary tree plus a stepped import card (`StockPanel.tsx`). No plaintext list, no per cred actions, no path for reported failed creds. Buyer reports go to WhatsApp (`Dashboard.tsx:270`), admin has no revoke or replace tool. Delivered creds are immutable once SOLD.

Buyer credential view reads `orders.vaultItemId` live and decrypts on each open (`credentials.routes.ts:30,60-72`). Rotating a cred is a pointer swap, buyer sees the fix on the same card.

## Decisions

| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Decrypt cost model | Paginate 50, decrypt per page server side | Unlock ceremony for perf | WebCrypto AES-GCM `subtle.decrypt` runs 5-50us per short string, 100 creds in single digit ms. Key import cached in module scope. Cost is DB plus transport, not crypto |
| Unlock gate | Soft one click, 10 min HMAC token | Password step-up, no gate | User picked soft gate. Honest label: KEK lives in server env so any authed admin request can decrypt, gate bounds casual exposure only. Token is HMAC of user id plus expiry with server secret, decrypt endpoints require it, client auto relocks with countdown, unlock and relock audited |
| Revoke scope | Cabut plus ganti (rotate) plus cabut saja | Revoke only | Reported failed cred needs replacement path. Rotate revokes old item, allocates next AVAILABLE via `allocate_credential`, repoints `orders.vaultItemId`. Cabut saja covers empty stock, buyer route 409s with contact admin message |
| Revoked status | New `REVOKED` value on `vault_status` enum | Reuse REJECTED, delete row | Delete destroys audit trail, REJECTED is order domain. Raw SQL `ALTER TYPE vault_status ADD VALUE 'REVOKED'`, Drizzle cannot diff enum values |
| Cred fix | In place edit dialog, re-encrypt overwrite | Delete plus re-add | User explicit, typo fix keeps row identity. Audit `vault:update` |
| Delete rule | AVAILABLE only, confirm dialog | Delete anything | SOLD rows belong to buyer history, REVOKED rows belong to incident trail |
| Buyer surface | Zero changes | New status card | Live read already handles swap. One guard: credentials route 409s when item is REVOKED |

## Implementation

### Migration

`server/db/migrations/0002_vault_revoked.sql`: `ALTER TYPE vault_status ADD VALUE 'REVOKED'`. Additive, no backfill, existing rows untouched.

### Server

`vault.service.ts`: cache `CryptoKey` in module scope. Add `listByVariant(variantId, page, q)` returning metadata plus plaintext after unlock check by caller, `updateCredential(id, text)` encrypt overwrite, `deleteAvailable(id)` refusing non AVAILABLE with `ConflictError`, `revoke(id)` setting REVOKED, `replace(orderId)` in one transaction (revoke old, allocate new, repoint order). All write audit rows via `appendAudit`.

New unlock token in `shared/lib/unlockToken.ts`: HMAC SHA-256 over `userId.expiry` with server secret, 10 min TTL, constant time compare. Middleware `requireUnlock` on decrypt endpoints. `POST /admin/vault/unlock` mints, no secret required (soft gate).

Routes in `admin.vault.routes.ts`, mounted in `admin.routes.ts`: `GET /admin/vault` paginated plus search (unlock required), `PUT /:id`, `DELETE /:id`, `POST /:id/revoke`, `POST /admin/orders/:id/replace`, `POST /admin/vault/unlock`.

`credentials.routes.ts`: guard `vaultItem.status === 'REVOKED'` throws 409 credential revoked message before decrypt.

Build time check: confirm `allocate_credential` filters `status = AVAILABLE` so REVOKED never reallocates.

### Client

Delete `StockPanel.tsx`. New `VaultList.tsx` plus reworked `useStockImport.ts`: unlock button plus countdown banner, variant picker kept, toolbar (search, count chips Tersedia/Terkirim/Dicabut, Tambah paste import, Muat ulang), single list with per row actions (copy, Edit, delete for AVAILABLE; Cabut plus ganti, Cabut saja for SOLD). Edit reuses soft dialog pattern. ProductsPage stok tab renders VaultList.

## Verification

- `server/tsconfig.json` tsc exit 0
- `client/tsconfig.json` tsc exit 0
- Migration applied via Supabase MCP: `ALTER TYPE vault_status ADD VALUE IF NOT EXISTS 'REVOKED'`
- `allocate_credential` function (migration 0000, line 31): confirmed `WHERE vi.status = 'AVAILABLE'`, REVOKED never reallocates
- Dead code: `StockPanel.tsx` + `useStockImport.ts` no longer imported, safe to delete later
- Hono typed client paths verified: `vault.unlock.$post`, `vault.$get`, `vault[':id'].$put`, `vault[':id'].$delete`, `vault[':id'].revoke.$post`, `vault.replace[':orderId'].$post`

## Open Questions

- Visual sign off on single screen density after tunnel restart
- Whether WhatsApp report should deep link order id into admin search (out of scope, noted)
