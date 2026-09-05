# Variant Duration Unit, Day/Week/Month Support

**Date:** 2026-09-05
**Scope:** 1 migration, ~6 server files, ~3 client files
**Status:** Built 2026-09-05, server + client tsc 0 errors

## Context

`productVariants.durationMonths` is a bare integer. SKU generates `${n}M`, name appends `${n} Bulan`. Form label says "Durasi (bulan)" and only accepts whole numbers. Daily or weekly subscriptions (7 hari, 30 hari) have no representation. User needs to create variants with day/week granularity.

## Decisions

| Choice | Picked | Rejected | Why |
|---|---|---|---|
| Schema change | Add `durationUnit enum('day','week','month')` column, keep `durationMonths` as generic `duration` value | Rename column, free-text label, embedded JSON | Clean enum, backward compatible, existing integer values map to month |
| Backfill | Existing rows with non-null `durationMonths` get unit='month' | Leave null, default everywhere | Explicit beats implicit, queries stay simple |
| SKU format | `${n}D` / `${n}W` / `${n}M` | Keep `M` suffix for all | Short, distinct, URL-safe |
| Name format | `${n} Hari` / `${n} Minggu` / `${n} Bulan` | Keep `Bulan` for all | Human readable, matches Indonesian units |
| SKU regeneration | Only new variants, existing SKUs untouched | Regen all | Existing SKUs are live on product pages, changing breaks references |
| Order snapshot | Add `durationSnapshotUnit text` to orders | Embed unit in `durationSnapshot` int, derive from variant at display time | Immutable snapshot, no lookup needed |

## Implementation

### Migration

`server/db/migrations/0003_duration_unit.sql`:
1. `CREATE TYPE duration_unit AS ENUM ('day', 'week', 'month')`
2. `ALTER TABLE product_variants ADD COLUMN duration_unit duration_unit NOT NULL DEFAULT 'month'`
3. `UPDATE product_variants SET duration_unit = 'month' WHERE duration_months IS NOT NULL`
4. `ALTER TABLE orders ADD COLUMN duration_snapshot_unit text` (nullable, for new orders only)

### Server

`server/shared/lib/sku.ts`:
- `generateSku(baseName, duration, durationUnit, accountType)` suffix: `D`/`W`/`M`/`NA`
- `composeVariantName(baseName, duration, durationUnit, accountType, conditions)` label: `Hari`/`Minggu`/`Bulan`

`server/db/schema.ts`:
- Add `durationUnitEnum = pgEnum('duration_unit', ['day', 'week', 'month'])`
- Add `durationUnit: durationUnitEnum('duration_unit').notNull().default('month')` to `productVariants`
- Add `durationSnapshotUnit: text('duration_snapshot_unit')` to `orders`

`server/modules/admin/admin.variants.routes.ts`:
- `VariantCreateSchema`: add `durationUnit: z.enum(['day', 'week', 'month']).optional().default('month')`
- `VariantUpdateSchema`: add `durationUnit: z.enum(['day', 'week', 'month']).optional()`
- Create/update passes `durationUnit` to SKU and name generators
- **Regen rule**: only regenerate SKU/name when `durationMonths` or `durationUnit` is explicitly changed in the update payload, not when other fields change

`server/modules/orders/orders.service.ts`:
- `deliverWithCredential`: snapshot `durationSnapshotUnit` from variant alongside existing `durationSnapshot`

### Client

`client/src/features/products/components/VariantDialog.tsx`:
- Duration field: number input + unit select (Hari/Minggu/Bulan) side by side
- Preview: shows "Netflix Premium - 7 Hari" instead of "Netflix Premium - 7 Bulan"

`client/src/features/products/hooks/useVariantForm.ts`:
- Add `vDurationUnit` state (`'day' | 'week' | 'month'`), default `'month'`
- `openCreateVariant`: default to `'month'`
- `openEditVariant`: read from variant row
- Submit payload includes `durationUnit`

`client/src/features/products/types.ts`:
- Add `durationUnit: string` to Variant interface

## Verification

- `server/tsconfig.json` tsc exit 0
- `client/tsconfig.json` tsc exit 0
- Migration applied via Supabase MCP: `duration_unit` enum + column + backfill
- SKU regen OK per user (not launched, mockup data)
- Preview in dialog shows selected unit (Hari/Minggu/Bulan)

## Open Questions

- Duration unit badge pills on catalog cards (out of scope for this task, noted)
