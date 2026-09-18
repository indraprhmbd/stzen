# Markdown Product Descriptions (2026-09-18)

## Goal
Admins write `products.description` / variant content in Markdown;
storefront renders it styled, safe, and lightweight. One reusable component.

## Decision (researched Sep 2026)
- `react-markdown` v10 (React 19-ready) + `remark-gfm`. Safe by default:
  AST-to-React-elements, no `dangerouslySetInnerHTML`, raw HTML escaped,
  `defaultUrlTransform` blocks `javascript:` etc.
- Deliberately NO `rehype-raw` (+~60kB, needs sanitize schema to stay safe).
  Embedded HTML is a future Phase 3, not this pass.
- Rejected: `markdown-to-jsx` (no plugin path), MDX (compile-time, wrong
  for DB strings), TanStack Markdown (thinner ecosystem).

## Component: `client/src/components/Markdown.tsx`
- Props: `{ source: string; className?: string }`. Memoized; module-level
  `remarkPlugins = [remarkGfm]` (stable ref, no re-parse churn).
- `components` map pins theme, matching existing Tags-link treatment:
  - `a`: `underline underline-offset-2 text-blue-700 hover:text-black`,
    external (`http…`) gets `target=_blank rel=noopener noreferrer`.
  - Headings `h1-h3` capped to theme sizes (Space Grotesk black, xs-sm).
  - `table` wrapped in `overflow-x-auto` div (mobile); `img` lazy + `max-w-full`.
  - Lists/code keep DaisyUI-adjacent bold styling, JetBrains Mono for code.
- Lazy-loaded via `React.lazy` + Suspense at call site (description sits
  below related products; parser never costs initial paint).

## Consumers
- Phase 1: `ProductDetail.tsx` description block (`product.description &&`).
- Phase 2 (later): live preview tab in admin product/variant modal + GFM hint.
- Backward compatible: plain-text descriptions are valid markdown, render
  unchanged. No DB migration.

## Verify
- `npx tsc --noEmit -p client`, `npm run build --workspace=client`.
- Live :8787 on a variant with `**bold**`, `- list`, `| table |`, `[link](https://…)`,
  `` `code` ``. Confirm no layout break on mobile (table scrolls).
