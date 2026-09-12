# Homepage Full Rework Plan

**Date:** 2026-08-28
**Scope:** 8 files (2 new, 6 modified)
**Decisions:** Fake social proof, client-side search, featured = `badge !== null`, sort by created_at

---

## Section 1: Hero Rework

**Current:** Compact 100px horizontal banner (logo + tagline + CTA button)

**New:**
- Massive 2-line display title: `UNLOCKED DIGITAL VAULT // INSTANT DISPATCH` (Rubik Mono One)
- Floating status pill above title: `🟢 1,420+ ACCOUNTS AUTO-DELIVERED TODAY` (pulsing green dot)
- Search bar embedded in hero card with `Ctrl+K` shortcut hint
- CSS grid/dot background pattern on the green backdrop

**Layout:**
```
[status pill - floating top-left]
[                    ]
[  HUGE TITLE LINE 1  ]
[  HUGE TITLE LINE 2  ]
[  search bar ........]
[                    ]
```

---

## Section 2: Marquee Ticker

**Position:** Between Hero and How It Works

**Content:** `INSTANT DELIVERY ⚡ AES-256 VAULT ENCRYPTION 🔒 AUTO-DISPATCH IN <5 SECONDS ⚡ 24/7 SUPPORT 💬` - repeating, CSS-only infinite scroll animation (translateX keyframe, no JS)

---

## Section 3: Catalog & Card Architecture

### 3a. Asymmetric Grid
- Featured items (`badge !== null`): `col-span-2` on md+, larger card
- Standard items: `col-span-1`
- Featured cards get colored top accent bar + expanded description + feature chips

### 3b. Card Anatomy
**Standard card (current, refined):**
- Header: category pill left, stock pill right (`⚡ 4 LEFT` coral vs `SOLD OUT` muted)
- Body: name (bold), description (line-clamp-2), price large
- CTA: full-width button

**Featured card (new, 2-col span):**
- Same structure but larger padding, description not truncated, feature chips row
- Colored top accent bar matching category

### 3c. Sticky Filter Bar
- `sticky top-16` (below header), `backdrop-blur-md bg-surface/80`
- Add sort dropdown: `Newest`, `Lowest Price`, `In Stock Only`
- Add grid/list view toggle (icon buttons)

### 3d. Search
- State: `searchQuery` in Catalog.tsx
- Client-side filter: `products.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))`
- Search bar inside hero, filters products in real-time
- Clear button when query active

---

## Section 4: Testimonials Redesign

- Each card gets a `✓ VERIFIED BUYER` badge (green pill)
- Star rating row (hardcoded 5 stars per testimonial)
- Quote icon `"` decoration at top

---

## Section 5: Micro-Interactions

### 5a. Skeleton Loaders
- Replace `<span className="loading loading-spinner">` with skeleton cards matching ProductCard shape
- Pulsing animation on `bg-surface-container-high` placeholders
- 8 skeleton cards in grid (matching 4-col layout)

### 5b. Copy Toast
- New component: `CopyToast.tsx` - fixed bottom-center toast
- Triggers on copy-to-clipboard (credentials, any future copy action)
- Auto-dismiss after 2s
- Brutalist style: `bg-on-surface text-primary-container border-[3px]`

### 5c. Hover Enhancements
- Cards: `hover:-translate-y-1 hover:shadow-3d-subtle` (already partial,加强)
- Buttons: already have `btn-brutal-interactive`

---

## Files Changed

| File | Action | Changes |
|---|---|---|
| `config/copy.ts` | Modify | Add hero2, marquee, search, sort, skeleton, toast strings |
| `pages/Catalog.tsx` | Modify | Hero rework, search state, marquee, asymmetric grid, sticky filter, skeleton loading |
| `components/ProductCard.tsx` | Modify | Featured variant (2-col), stock pill, feature chips, refined layout |
| `components/FilterBar.tsx` | Modify | Sticky positioning, sort dropdown, view toggle |
| `app.css` | Modify | Add marquee keyframe, skeleton pulse, grid bg pattern |
| `components/SkeletonCard.tsx` | **New** | Skeleton loader matching card shape |
| `components/CopyToast.tsx` | **New** | Toast notification component |
| `components/Marquee.tsx` | **New** | Infinite scrolling ticker |

---

## Visual Summary

| Section | Before | After |
|---|---|---|
| Hero | 100px compact banner | Tall hero with massive type + search + status pill |
| Marquee | none | Infinite scrolling ticker between hero and content |
| Grid | Uniform 4-col | Asymmetric: featured=2col, standard=1col |
| Cards | Small, uniform | Featured=expanded with chips, Standard=refined |
| Filter | Static pills | Sticky + blur + sort + view toggle |
| Loading | Spinner | Skeleton cards matching layout |
| Testimonials | Basic quote cards | Verified buyer badges + stars |
| Copy feedback | none | Toast notification |
