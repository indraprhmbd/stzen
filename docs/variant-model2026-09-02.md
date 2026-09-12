# Variant Model - Composite Name, Auto SKU

**Date:** 2026-09-02
**Scope:** 30+ products, 5-6 parents, variants differ by duration, account type, conditions, price per variant, stock independent, variant behaves like product
**Status:** Approved, implementing

## Decision
Parent `products` 5-6 rows category style, child `product_variants` 30+ rows purchasable. Variant name composite, sku auto.

## Schema
* `products` base `id uuid, public_id 12, name, description, category, is_active, deleted_at` 5-6 rows, grouping only
* `product_variants` `id uuid, public_id 12 unique, product_id uuid FK products.id SET NULL, sku text unique, name text composite, price integer, badge, duration_months int, account_type text, conditions text, is_active, deleted_at`
* `vault_items` move `product_id` -> `variant_id uuid SET NULL` stock per variant
* `orders` add `variant_id uuid SET NULL, variant_name_snapshot, variant_sku_snapshot, price_at_purchase integer, duration_snapshot int, account_type_snapshot, conditions_snapshot, base_name_snapshot` at checkout

## Composite Name
`name = baseName + " - " + duration + " Bulan" + " - " + accountType` if provided. Example `Netflix Premium 4K - 1 Bulan - Private`. Server composes if client sends parts, fallback to explicit name.

## Auto SKU
`sku = BASE3 + "-" + DURATION + "M-" + TYPE3 + "-" + nanoid4` uppercase. Example `NET-1M-PRI-A3X9`. Generated server side via `generateSku(baseName, duration, accountType)` using `generatePublicId` 4 chars. Unique index ensures no collision retry.

## Flow
* Storefront `listActive` returns variants flattened join products for category filter, card shows variant composite name, badge, price, stock per variant
* Checkout takes `variantPublicId`, resolves internal variant, checks `getStockCount(variantId)`, creates `orders` with snapshot fields
* Admin `/admin/products` two tables parents 5 rows + variants 30 rows search sku/name, filter parent, `Tambah Varian` modal selects Induk, inputs duration, tipe akun, kondisi, harga, auto preview sku and composite name
* Vault import `POST /variants/:publicId/stock` per variant
* History `audit_logs` snapshot keeps variant sku and name denormalized

## Steps
1. Migration `product_variants` create + `vault_items variant_id` + `orders` snapshots backfill 8 products -> 8 variants 1:1
2. `schema.ts` add `productVariants`, alter `vaultItems`, `orders`
3. `shared/lib/sku.ts` generateSku, `shared/lib/publicId.ts` existing
4. Services `listActive` variants, `checkout` variant, `stock` per variant
5. Client `Catalog` `ProductCard` `Admin Products` variant table
6. Build verify
