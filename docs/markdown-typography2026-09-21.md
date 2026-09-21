# Markdown Description Typography (2026-09-21)

Follow-up to `markdown-descriptions2026-09-18.md` (render pipeline unchanged:
react-markdown 10 + remark-gfm, safe-by-default). This pass fixes TYPOGRAPHY
only — spacing rhythm, list indentation, emphasis contrast — inside the
existing component map. No new dependencies.

## Research (Context7, Sep 2026)

- Vertical rhythm: one spacing scale, `first:mt-0` / `last:mb-0` on blocks.
  Uniform `mb-1.5` everywhere = static gaps, no hierarchy (the complaint).
- Lists: `list-outside` + `ps-5` hanging indent. `list-inside` (current)
  wraps long lines UNDER the marker instead of under the text, and nested
  `ul` gets zero indent — bullets blur together.
- Ordered-list nesting ladder: decimal → lower-alpha → lower-roman.
- Emphasis: style `strong`/`em`/`del`/task `li` explicitly or weight
  contrast collapses inside an already-bold body.
- Measure: `max-w-prose` (≈65ch) optional; kept off for commerce copy
  (cards run full width by design).
- Tailwind Typography plugin (`prose`) evaluated and REJECTED for this
  theme: brutalist skin (black borders, uppercase grotesk headings, loud
  hr) would override ~60% of prose defaults — cheaper to own the map.

## Changes — `client/src/components/Markdown.tsx`

| Element | Before | After |
|---|---|---|
| h1/h2/h3 | `mt-3/2 … mb-1.5/1` | `mt-4 mb-2` (h1), `mt-4 mb-1.5` (h2), `mt-3 mb-1.5` (h3), all `first:mt-0` — heading pull stronger than paragraph gap |
| p | `mb-1.5` | `mb-2.5 last:mb-0` |
| ul/ol | `list-inside`, `mb-1.5` | `list-outside ps-5 mb-2.5 space-y-1 last:mb-0` + `marker:font-black marker:text-neutral/40` |
| nested ul/ol | (broken, no indent) | `li:ps-1`, ol ladder via CSS counters not needed — react-markdown nests `ol` with its own list-style; `ps-5` on nested lists gives the ladder |
| li | (unstyled) | `li` override: `marker` stays default disc, `pl-0`, `leading-relaxed`; task-list `input` keeps `readOnly mr-1.5 align-[-2px]` |
| strong/em/del | (unstyled) | `strong: font-extrabold text-neutral`, `em: italic`, `del: opacity-60` |
| hr | `my-1.5 border-t-2` | `my-4 border-t-2 border-dashed border-black/40` — separator, not wall |
| table | borders only | + `odd:bg-black/[0.03]` zebra rows, `th` keeps black bar |
| pre/code | unchanged | unchanged (already fine) |
| blockquote | `pl-2` | `pl-3 border-l-4 border-black/60 italic` |

Consumers untouched (`ProductDetail.tsx:456` renders `<Markdown/>` as-is).

## Verify

- `npx tsc --noEmit -p client`; `npm run build --workspace=client` (bundle
  budget unchanged — no new deps).
- Eyeball on ProductDetail: heading pull, list hanging indent, nested list
  indent, zebra table, soft hr.
