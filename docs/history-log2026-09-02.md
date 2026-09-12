# History Log - Immutable Order and Stock Import

**Date:** 2026-09-02
**Scope:** orders lifecycle + stock import, separate page, append only text snapshot
**Status:** Planned, approved

## Problem
Orders status overwrites `PENDING->PAID->DELIVERED`, stock imports overwrite counts. No trail. Need immutable history that survives product rename and order delete, readable without joins.

## Decision
Single `audit_logs` table, append only, denormalized text, no FK. Separate page `/admin/history`.

## Schema
```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  resource_type text not null, -- order, stock
  resource_public_id text,
  resource_name text,
  snapshot_text text not null,
  diff jsonb
);
create index audit_resource_idx on audit_logs(resource_type, resource_public_id, created_at desc);
create index audit_time_idx on audit_logs(created_at desc);
-- immutability
create rule audit_no_update as on update to audit_logs do instead nothing;
create rule audit_no_delete as on delete to audit_logs do instead nothing;
```

Text not linked: store `resource_name` and `snapshot_text` fully rendered at write, not join at read.

## Writes
Same transaction as mutation via `auditService.append`:

* `order:create` `Order Nx7aQp2zK9_A PENDING dibuat oleh admin@st.zen 02 Sep 2026 14:05`
* `order:approve` `Order Nx7aQp2zK9_A PENDING->PAID oleh admin@st.zen 02 Sep 2026 14:06`
* `order:reject` `order:deliver`
* `stock:import` `Stok 40 ditambah ke Netflix Premium 4K (S_5vPRCT) oleh admin@st.zen 02 Sep 2026 14:07`

Actor from `c.get('user')` `sub` and `email`. Timestamp UTC formatted `DD Mon YYYY HH:MM` id style.

## Reads
Separate page `/admin/history`:
* Filters `Semua, Pesanan, Stok`, date range, search `public_id` or `snapshot_text`
* Table `Waktu | Aktor | Aksi | Teks` paginated `20` per page
* No FK, text stays even if product deleted

## Not Touched
Products lifecycle deferred, customer, vault, RLS, encryption. No partition v1, no hash chain v1.

## Steps
1. Migration `audit_logs` table + rules + indexes
2. `server/shared/lib/audit.ts` `auditService.append`
3. Hook `ordersService.transitionStatus` and `admin stock import` to append
4. `GET /api/v1/admin/history` with filters, paginated
5. `client/src/pages/admin/History.tsx` separate page, `AdminSidebar` adds `Riwayat`, `App.tsx` route `/admin/history`
6. Build verify
