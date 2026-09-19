# Tags Follow-Parent (badge → Tags, ikut induk)

## Decisions (user-confirmed)
- Empty variant tags = ikut induk (no per-variant hide option).
- CSV header becomes `tags` on BOTH basis and varian imports (`badge` kept as alias).
- Tags max 50 chars, `;`-separated, single line — same rule both levels.
- No migration. `products.price` stays dormant 0. DB/API column names stay `badge`; only user-facing copy says Tags.

## Semantics (mirrors overview/description link-preserving save)
- Variant tags empty OR identical to induk → store NULL → live fallback, no stale copies.
- Variant tags filled + different → override stored on `product_variants.badge`.
- Basis tags stored on `products.badge`, editable in Induk dialog (kills the silent round-trip trap: badge was written but never visible/editable).
- Server mappers: `badge: variant.badge ?? product.badge ?? null` (detail, card, list).

## Server
- `pickProductFields` + variant→product joins: add parent `badge` to selects.
- `VARIAN_BULK_COLUMNS`: add `{ header: 'tags', label: 'Tags', aliases: ['badge'] }` optional, single-line, max 50. Empty → null (inherit). Template samples include tags; kill the "badge belum didukung" note.
- `BASIS_BULK_COLUMNS`: rename `badge` → `tags` header + `badge` alias. Samples/notes updated.
- Tests: mapper fallback vectors (override / inherit / none), bulk tags validation + template parity both entities.

## Client
- VariantDialog Tags field: label `Tags`, hint `Pisahkan beberapa tags dengan ;`, `maxLength={50}`, placeholder = parent tags (or `TERLARIS;PROMO` when induk has none). Ikut-induk caption row below (reuse `mode()` with blank=false + `modeCaption`): `Ikut induk` when empty-or-equal, `Kustom, menimpa induk` otherwise, single `Ikuti induk` clear button when custom. Submit: empty-or-equal → null.
- IndukDialog: add Tags input (`maxLength={50}`, placeholder `TERLARIS;PROMO`, `;` hint). Wires existing `form.badge` state; submit already sends it.
- No `vBadgeBlank` flag (2-state only). No base-change refill needed (empty field shows live parent placeholder every render).

## Verify
server tsc 0, tests green, client tsc 0 + build green, dry-run `--env staging`, lint-migrations. Commit, no push/deploy.

## Smoke
- Varian with empty tags shows induk tags on storefront; editing induk tags updates all inheriting variants live.
- Varian CSV with tags column imports; without it inherits.
- Basis CSV uses `tags` header; old `badge` header still accepted via alias.
