# Design System Implementation: "Zen" Neubrutalism

## Context

Two design documents govern the frontend:
- **BRANDING.md** - system layer: white-label architecture, brand config, theme engine, env overrides
- **DESIGN.md** - visual layer: "Zen" Raw Pop-Neubrutalism for THIS deployment

Current `app.css` follows BRANDING.md structure but uses generic dark theme. DESIGN.md's zenith theme + neubrutalist utilities are not implemented.

---

## Decisions

### Theme: Zenith Light (not dark)

DESIGN.md specifies light color scheme with high-contrast neubrutalist components. The existing dark theme in `app.css` will be replaced entirely.

### Anti-AI Design Rules

DESIGN.md §3 defines strict rules:
1. NEVER use `rounded-xl`, `rounded-2xl`, `rounded-full` on cards/containers
2. NEVER use subtle shadows (`shadow-md`, `shadow-lg`)
3. NEVER use background gradients
4. NEVER place plain text on raw background without high-contrast outlines

These will be added to AGENTS.md as mandatory coding constraints.

---

## Files to Modify

| File | Change |
|---|---|
| client/src/app.css | Replace theme with zenith + add neubrutalist utilities |
| client/index.html | Import Google Fonts (Space Grotesk, Plus Jakarta Sans, JetBrains Mono) |
| client/src/pages/Catalog.tsx | Apply DESIGN.md §3.B product card spec |
| client/src/pages/Admin.tsx | Apply DESIGN.md §3.D input spec + §3.A button spec |
| AGENTS.md | Add anti-AI design rules |

---

## Step 1: app.css - Zenith Theme + Utilities

Replace current content with DESIGN.md spec:
- Theme: zenith, light scheme, hex colors (#C5FE37, #FF5DA2, #FF7E36, #0D110F, #5EAA83, #4A8C69, #386E51)
- Border radii: 4px selector/field, 6px box
- Custom utilities: border-brutal, border-brutal-thick, shadow-brutal-sm/lg, shadow-pop-pink/lime/coral, btn-brutal-interactive, text-stroke-black/thin

## Step 2: index.html - Google Fonts

Add preconnect + font link for:
- Space Grotesk (700, 900) - headers
- Plus Jakarta Sans (600, 800, 900) - body
- JetBrains Mono (700) - credentials/code

## Step 3: Catalog.tsx - Neubrutalist Product Cards

Apply DESIGN.md §3.B:
- Card: `bg-base-200 border-brutal-thick shadow-pop-pink rounded-md`
- Badge: `bg-accent text-neutral font-black border-brutal -rotate-2 shadow-brutal-sm`
- Price: `font-black text-2xl text-primary text-stroke-thin`
- Button: `btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase`

## Step 4: Admin.tsx - Inputs + Buttons

Apply DESIGN.md §3.D for inputs, §3.A for buttons:
- Input: `input-bordered bg-base-100 border-brutal font-mono text-xs shadow-brutal-sm rounded-sm`
- Button: `btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase`

## Step 5: AGENTS.md - Anti-AI Rules

Add new section with DESIGN.md §3 rules as mandatory constraints.

---

## Verification

1. `npm run build --workspace=client` passes
2. Visual: cards have hard borders, pop shadows, tilted badges
3. Visual: buttons have push-button physics on click
4. Visual: fonts load correctly (Space Grotesk headers, Jakarta body, JetBrains mono)
