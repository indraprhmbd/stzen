# Bulk CSV import: compact plan

Per-tabbulk import for Basis, Varian, and Stok. Same reusable dialog shell, separate field contracts and pipelines. Slice A builds shared core plus Basis.

## Contracts

Basis create columns:

- `name`, required, max 200
- `category`, required, max 100
- `overview`, optional, max 200, single line
- `badge`, optional, max 50
- `price`, optional digits-only, default 0
- `is_active`, optional boolean, default true

Unsupported v1 headers fail closed:

- `description`
- `instructions`

Varian and Stok contracts follow the approved plan. Varian defers `description`; Stok uses `variant_ref,credential`.

## Pipeline

1. Copy header-only template or download header plus samples.
2. Upload file or paste CSV.
3. Client performs instant structural checks.
4. Server preview parses, normalizes, validates, and returns decisions.
5. Commit stays disabled until blocking errors are zero.
6. Server re-parses and revalidates the same CSV on commit.
7. One insert statement per commit, no row-by-row database writes.
8. One audit summary row per commit.

## Limits

- 500 rows per request.
- 1MB CSV text per request.
- Comma-first parsing, semicolon/tab fallback.
- UTF-8 BOM stripped.
- Duplicate or unknown headers rejected.
- Embedded newlines rejected in single-line v1 fields.

## Idempotency

- Client sends one UUID batch key per commit click.
- Server claims the key.
- Success stores the summary in audit diff.
- Retry returns the stored summary.
- Pre-write failure releases the claim.
- Post-write failure keeps the claim and reports already processed.

## Design

Admin-only `.admin-soft` and `ad-*` tokens. Reuse `DataTable`, `StatusChip`, toasts, dialogs, and confirm patterns. No storefront comic styling.

## Slices

- A: shared core, Basis API/UI, tests.
- B: Varian adapter and wiring.
- C: Stok adapter and wiring.
- Phase 2: updates, multiline text, larger batch infrastructure.
