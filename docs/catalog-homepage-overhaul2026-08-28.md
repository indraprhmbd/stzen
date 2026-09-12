# Catalog Homepage Overhaul

**Date:** 2026-08-28
**Scope:** `client/src/pages/Catalog.tsx`, `client/src/components/ProductCard.tsx`
**Status:** Implemented

## Problem

Homepage feels generic and boring despite having the right color palette (green/lime/pink brutalism). Root causes:

- Uniform visual weight: every element uses `border-[3px] shadow-brutal` - nothing stands out
- Too much blank space: hero is 300px tall with centered text, cards have generous padding
- Featured bento layout (8col + 4col asymmetric) adds visual complexity without value
- Newsletter section is filler - adds height without purpose
- Cards: 2 variants (featured/regular) with large padding, "Price" label, accent bars

## Decisions

1. **Hero → compact horizontal banner** (left-aligned, ~100px tall) - straight to the point
2. **Remove featured/asymmetric bento** - uniform 4-col grid, simpler
3. **Remove newsletter** - filler removed
4. **Cards → single compact variant** - tighter padding, no accent bar, no "Price" label, `rounded-md` (6px)
5. **FilterBar always visible** - not conditional on product count
6. **Section header simplified** - "ALL PRODUCTS", no "VIEW ALL" link

## Changes

### Catalog.tsx

- Hero: `min-h-[100px]` (was 240-300px), left-aligned flex row, logo + name/tagline left, CTA right, bottom border only
- Grid: `grid-cols-2 md:grid-cols-4 gap-2` (was 12-col bento with `gap-3`)
- Delete: `showFeatured`, `restProducts` logic, featured bento grid, newsletter section
- Section header: "ALL PRODUCTS" (was "LATEST DROPS" + "VIEW ALL")
- FilterBar: always rendered above grid

### ProductCard.tsx

- Delete: featured variant block, `featured` prop
- Single card: `p-2.5`, `rounded-md` (6px), no accent bar, no "Price" label, `text-[9px] line-clamp-1` description, `font-extrabold text-xs` title
- Bottom strip: price + BUY button, `pt-2`
- Hover: subtle lift only (`-translate-y-0.5`)

## Visual Summary

| Element | Before | After |
|---|---|---|
| Hero | 300px centered, watermark bg | 100px left-aligned horizontal |
| Grid | 12-col bento (8+4) | 4-col uniform |
| Cards | 2 variants | 1 variant, compact |
| Card padding | `p-3 md:p-4` | `p-2.5` |
| Card corners | Sharp (0px) | `rounded-md` (6px) |
| Card gap | `gap-3` | `gap-2` |
| Card top bar | `h-1 bg-on-surface` | Removed |
| "Price" label | Shown | Removed |
| Section header | "LATEST DROPS" + "VIEW ALL" | "ALL PRODUCTS" |
| FilterBar | Conditional | Always visible |
| Newsletter | 120px section | Removed |
