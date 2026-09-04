# Draft: Per-Variant Overview/Description + Detail Cleanup (2026-09-04)

Locked: variant-wins fallback (`variant ?? induk`), features list deleted,
overview under name, description in accordion only.

## Content model
- `products.overview text null` (new), `products.description` (exists, public)
- `product_variants.overview text null` (new), `product_variants.description text null` (new)
- Resolution server-side in `getById`: effective = variant ?? induk per field.
- Empty overview → hero paragraph omitted; empty description → accordion omitted.

## DB
```sql
alter table products add column if not exists overview text;
alter table product_variants add column if not exists overview text;
alter table product_variants add column if not exists description text;
```
+ matching Drizzle columns in `server/db/schema.ts`.

## Server
- `products.service.ts getById`: select new cols (+induk overview/description
  in base lookup), resolve fallback, return `overview`/`description`.
  Keeps stripping `productId`; `instructions` stays post-delivery only.
- `products.schema.ts`: `overview` max 200 optional on create/update.
- `admin.variants.routes.ts`: zod create/update accept both; GET selects both;
  insert/update persist both.

## Client
- `ProductDetail.tsx`: hero renders `overview`; accordion renders `description`
  only; delete `t.products.features` block (false for on-demand).
- `copy.ts`: remove `features` key + both arrays (ID/EN).
- `admin/Products.tsx`: induk modal Overview input; variant modal Overview input
  + Deskripsi textarea ("kosongkan = ikut induk" hint).

## Verification
`tsc` + detail matrix (variant-only / induk-only / both / neither), accordion
hidden when empty, admin round-trip per level, related/search unaffected.
