# Admin Table Pagination

## Context

Admin tables hand-roll pagination footers per page. `DataTable` covers headers, body, empty state, and mobile labels only. History ships hardcoded `limit = 20` (`History.tsx:38`) with inline prev/next. Server parses limit with bare `parseInt` capped at 100 (`admin.history.routes.ts:27`), so `?limit=abc` yields `NaN` range and a PostgREST 400. No reusable pagination component exists.

## Decisions

Per-page options `[10, 25, 50, 75, 100]`, default 10 (user call). ALL rejected: audit table grows unbounded and a ceiling-free fetch is a self-inflicted slow query. Shared `TablePagination` component over per-page footers because Products, Orders, and Vault already speak limit plus offset and adopt later with zero API change. Zod query validation over manual parse because the NaN-range edge is reachable from the URL bar today. Default limit 20 to 10 server-side because History is the only caller, no compat risk. No i18n because admin copy is Indonesian-hardcoded throughout.

## Implementation

Server (`admin.history.routes.ts`): zod schema `limit: z.coerce.number().int().min(1).max(100).default(10)`, `offset: z.coerce.number().int().min(0).default(0)` through existing `zValidator` (invalid input fails closed 400). Range call unchanged.

Client (`components/admin/TablePagination.tsx`, new): props `{ total, limit, offset, onLimitChange, onOffsetChange }`. Renders total count, per-page `ad-input` select, prev/next `ad-btn` with `NavArrowLeft` and `NavArrowRight` from `iconoir-react`. Disabled states match current History logic (`offset === 0`, `offset + limit >= total`).

Client (`History.tsx`): `limit` state default 10, query sends it, offset resets on limit, type, actor, q, and sort change (extends existing reset effect). `SkeletonRows` capped at 10 rows regardless of page size.

## Open Questions

Adoption order for Products, Orders, and Vault footers onto `TablePagination` unplanned. Server offset cap for deep admin pages deferred to pagination performance epic (cancelled 2026-09-07, revived on slow-log evidence only).
