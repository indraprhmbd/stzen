# Epic 4 UI Overhaul: HTML Design → React Components

## Problem

Current UI doesn't look like a digital product store. User provided 3 HTML reference designs in `_temp/` that need to be converted to React components with consistent design tokens.

### Issues with HTML References

1. **Navbar shows Admin to everyone** - must be role-gated
2. **Wrong color palette** - uses Material Design 3 tokens, not our zenith theme
3. **Missing our design tokens** - doesn't use `border-brutal`, `shadow-pop-*`, `btn-brutal-interactive`
4. **No auth integration** - "Connect Wallet" placeholder
5. **Hardcoded data** - needs API integration

---

## Design Token Mapping

| HTML Class | Our Token | Usage |
|------------|-----------|-------|
| `bg-dark-sage` | `bg-base-200` | Card backgrounds |
| `bg-surface` | `bg-base-100` | Page background |
| `bg-surface-container` | `bg-base-300` | Inset panels |
| `bg-primary-container` | `bg-primary` | CTA buttons |
| `bg-secondary-container` | `bg-secondary` | Pink accents |
| `bg-retro-coral` | `bg-accent` | Badges |
| `text-on-background` | `text-neutral` | Primary text |
| `text-on-primary` | `text-primary-content` | Text on lime |
| `border-on-background` | `border-brutal` | Hard borders |
| `shadow-brutal` | `shadow-brutal` | Keep as-is |
| `shadow-3d-pop` | `shadow-pop-pink` | Featured cards |
| `shadow-3d-subtle` | `shadow-brutal` | Normal cards |

---

## Component Architecture

```
client/src/
  components/
    Layout.tsx          # Shared wrapper (Header + main + Footer)
    Header.tsx          # Role-aware nav
    Footer.tsx          # Footer with links
    ProductCard.tsx     # Product card with stock badge
    FilterBar.tsx       # Category filter pills
    CredentialViewer.tsx # Terminal-style credential display
    OrderCard.tsx       # Order info card for dashboard
  pages/
    Catalog.tsx         # Rewrite using new components
    Dashboard.tsx       # Rewrite using new components
    Admin.tsx           # Rewrite using new components
    Login.tsx           # Keep as-is (already neubrutalist)
```

---

## Component Specifications

### 1. Header.tsx - Role-Aware Navigation

Sticky header, `border-b-[3px]`, `shadow-brutal`

**Layout:**
- Left: Logo + Brand Name (uppercase, Space Grotesk)
- Center: Nav links (role-based)
  - Always: Catalog, My Orders
  - If admin: Admin
- Right: Search (desktop) + Auth Button
  - If not signed in: "Sign In" button
  - If signed in: User email + "Sign Out"
  - If admin: "Admin" badge

**Key difference from HTML:** Nav links are role-gated, not static.

**Classes:**
```
header: bg-base-100 border-b-[3px] border-neutral shadow-brutal sticky top-0 z-50
brand: font-black uppercase tracking-tighter text-neutral
nav-link: font-bold uppercase hover:text-primary transition-all
nav-link-active: text-primary border-b-[4px] border-primary pb-1
auth-btn: bg-primary border-[3px] border-neutral shadow-brutal btn-brutal-interactive
```

### 2. Footer.tsx - Consistent Footer

**Layout:**
- Left: Brand name
- Center: Links (Terms, Privacy, Refunds, Support)
- Right: Copyright + tagline

**Classes:**
```
footer: bg-base-300 border-t-[3px] border-neutral
brand: font-bold uppercase text-neutral
link: font-bold uppercase text-neutral/60 hover:text-primary underline-offset-4
copyright: font-bold uppercase text-neutral/60
```

### 3. ProductCard.tsx - Neubrutalist Product Card

**Layout:**
- Top: Badge + Icon (optional) + Featured ribbon (if featured)
- Middle: Name + Description + Price
- Bottom: Stock badge + Category badge + Buy button

**Classes:**
```
card: bg-base-200 border-[3px] border-neutral rounded-sm flex flex-col
card-featured: shadow-pop-pink -translate-y-2
card-normal: shadow-brutal
badge-stock: bg-accent font-bold border-[2px] border-neutral -rotate-2
badge-low-stock: bg-base-300
badge-out-of-stock: bg-error
name: font-black uppercase text-neutral
price: font-black text-primary text-stroke-thin
buy-btn: bg-primary border-[3px] border-neutral shadow-brutal btn-brutal-interactive font-black uppercase
```

**Personal touches:**
- Badge rotations vary: `-rotate-2`, `rotate-1`, `-rotate-1`
- Featured card has "HOT" ribbon: `bg-secondary absolute top-0 right-0`
- Icon scales on hover: `group-hover:scale-110`

### 4. FilterBar.tsx - Category Filters

**Layout:** Flex row of pill buttons

**Classes:**
```
active: bg-primary text-primary-content border-[3px] border-neutral shadow-brutal
inactive: bg-base-100 text-neutral border-[3px] border-neutral shadow-brutal-sm
hover: -translate-x-[2px] -translate-y-[2px] shadow-brutal
active: translate-x-[2px] translate-y-[2px] shadow-none
```

### 5. CredentialViewer.tsx - Terminal-Style Display

**Layout:**
- Top bar: Traffic lights (decorative) + Label
- Content: Credentials (monospace)
- Actions: Copy + Report Issue

**Classes:**
```
container: bg-neutral border-[4px] border-secondary shadow-pop-pink rounded-sm p-6
traffic-light: w-3 h-3 rounded-full border-2 border-neutral
label: font-mono text-xs text-primary uppercase tracking-widest
credentials: font-mono text-primary bg-neutral/50 p-3 border border-primary/40 select-all
copy-btn: bg-primary border-[3px] border-neutral shadow-brutal btn-brutal-interactive
report-btn: bg-secondary border-[3px] border-neutral shadow-brutal btn-brutal-interactive
```

**Personal touch:** Cursor blink animation on label:
```css
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.cursor-blink { animation: blink 1s step-end infinite; }
```

### 6. OrderCard.tsx - Order Info Card

**Layout:**
- Header: Product name + Status badge
- Body: Date, Order ID, Amount
- Actions: View Credentials (if delivered) + Report Issue

**Classes:**
```
card: bg-base-200 border-[3px] border-neutral shadow-brutal p-6
name: font-black uppercase text-neutral
status-active: bg-primary border-[2px] border-neutral
status-pending: bg-warning border-[2px] border-neutral
status-delivered: bg-success border-[2px] border-neutral
status-rejected: bg-error border-[2px] border-neutral
detail: font-bold text-neutral/60
value: font-mono font-bold text-neutral
```

### 7. Layout.tsx - Page Wrapper

```tsx
<div class="min-h-screen flex flex-col bg-base-100">
  <Header />
  <main class="flex-grow w-full max-w-7xl mx-auto px-4 py-8">
    {children}
  </main>
  <Footer />
</div>
```

---

## Page Rewrites

### Catalog.tsx

```tsx
<Layout>
  <FilterBar 
    categories={['all', ...categories]} 
    active={selectedCategory} 
    onChange={setSelectedCategory} 
  />
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {filteredProducts.map(product => (
      <ProductCard 
        key={product.id} 
        product={product} 
        featured={product.stockCount > 5}
        onBuy={() => handleBuyNow(product.id)}
      />
    ))}
  </div>
</Layout>
```

### Dashboard.tsx

```tsx
<Layout>
  <h1 class="font-black uppercase text-neutral tracking-tighter mb-6">
    MY ACTIVE PURCHASES
  </h1>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <div class="lg:col-span-5">
      <OrderCard 
        order={selectedOrder} 
        onViewCredentials={() => handleViewCredentials(selectedOrder.id)}
        onReport={() => handleReport(selectedOrder.id)}
      />
    </div>
    <div class="lg:col-span-7">
      {selectedOrder?.status === 'DELIVERED' && credentials && (
        <CredentialViewer 
          credentials={credentials.credentials} 
          instructions={credentials.instructions}
          onCopy={() => handleCopy(credentials.credentials)}
          onReport={() => handleReport(selectedOrder.id)}
        />
      )}
    </div>
  </div>
</Layout>
```

### Admin.tsx

```tsx
<Layout>
  <div class="mb-6 border-b-[3px] border-neutral pb-2">
    <h1 class="font-black uppercase text-neutral tracking-tighter">
      VAULT MANAGEMENT
    </h1>
    <p class="font-bold text-neutral/60 mt-1">
      Administer products and raw credential stock.
    </p>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
    <div class="md:col-span-5">
      {/* Product form - neubrutalist inputs */}
      <div class="bg-base-200 border-[3px] border-neutral shadow-brutal p-4">
        <h2 class="font-bold uppercase text-neutral border-b-[3px] border-neutral pb-2 mb-4">
          Product Management
        </h2>
        {/* Form fields */}
      </div>
    </div>
    <div class="md:col-span-7">
      {/* Bulk import - terminal-style textarea */}
      <div class="bg-base-100 border-[3px] border-neutral shadow-brutal p-4">
        <h2 class="font-bold uppercase text-neutral border-b-[3px] border-neutral pb-2 mb-4">
          Bulk Stock Import
        </h2>
        <div class="bg-neutral border-[3px] border-secondary p-3 min-h-[300px]">
          <label class="font-mono text-xs text-primary uppercase mb-2">
            RAW CREDENTIAL DATA [FORMAT: USER:PASS]
          </label>
          <textarea class="w-full h-full bg-transparent text-primary font-mono text-sm border-none focus:ring-0 resize-none" />
        </div>
      </div>
    </div>
  </div>
  <div class="mt-6 flex justify-end">
    <button class="bg-secondary border-[3px] border-neutral px-6 py-3 shadow-pop-pink btn-brutal-interactive font-bold uppercase">
      Push To Vault
    </button>
  </div>
</Layout>
```

---

## Personal Touches (Anti-AI Feel)

1. **Inconsistent badge rotations** - `-rotate-2`, `rotate-1`, `-rotate-1` (not uniform)
2. **Mixed border weights** - 3px main, 2px badges, 4px featured
3. **Varied shadow depths** - normal: `shadow-brutal`, featured: `shadow-pop-pink`
4. **Hand-drawn nav underline** - `border-b-4` on active, not perfect
5. **Terminal cursor blink** - `@keyframes blink` on credential label
6. **Status badge personality** - "LOW STOCK" uses accent, "OUT OF STOCK" uses error
7. **Imperfect spacing** - `gap-6` not `gap-8` everywhere, some `mb-4` some `mb-5`
8. **Hover micro-interaction** - cards shift 2px, buttons shift 4px
9. **Icon scale on hover** - `group-hover:scale-110` on product icons
10. **Footer year** - dynamic `new Date().getFullYear()`

---

## Implementation Order

1. Add Material Symbols CDN to `index.html` (if not present)
2. Create `Header.tsx` with role-aware nav
3. Create `Footer.tsx`
4. Create `Layout.tsx`
5. Create `ProductCard.tsx`
6. Create `FilterBar.tsx`
7. Create `CredentialViewer.tsx`
8. Create `OrderCard.tsx`
9. Rewrite `Catalog.tsx`
10. Rewrite `Dashboard.tsx`
11. Rewrite `Admin.tsx`
12. Verify build
13. Commit

---

## Open Questions

1. **Material Symbols** - keep CDN link or install as package?
2. **"Connect Wallet"** - replace with Sign In / user avatar?
3. **Search bar** - functional (filter products) or visual placeholder?
4. **Featured products** - admin-set flag or auto by stock level?
5. **Mobile nav** - hamburger menu or stack links vertically?

---

## References

- `_temp/user.html` - Catalog page reference
- `_temp/myorder.html` - Customer dashboard reference
- `_temp/admin.html` - Admin panel reference
- `_context/DESIGN.md` - Existing design system
- `client/src/app.css` - Current theme tokens
