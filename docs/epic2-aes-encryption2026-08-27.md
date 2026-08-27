# Epic 2: AES-256 Encryption & Admin CRUD System

## Context

Epic 1 delivered database schema, auth middleware, and project scaffolding. Epic 2 builds the first functional feature layer: credential encryption at rest and admin management UI. The admin must create products, manage stock, and bulk-import credentials. All credential payloads must be encrypted before database insertion using AES-256-GCM.

Constraints:
- Web Crypto API only (no node:crypto) for edge runtime compatibility
- PgBouncer transaction pooler (port 6543) with prepare:false
- Drizzle ORM 0.45.x (positional API, not v1.0 object form)
- DaisyUI v5 CSS utility classes only, no custom CSS

---

## Decisions

### AES-256-GCM Encryption

Chose Web Crypto API (crypto.subtle) over node:crypto because:
- Works in Node.js 19+, browsers, and edge runtimes identically
- No import required (globalThis.crypto available since Node.js 19)
- AES-GCM is the most portable symmetric algorithm across all JS runtimes

Chose 12-byte IV over 16-byte because:
- GCM standard recommends 12 bytes (NIST SP 800-38D)
- Shorter IV reduces overhead per encryption
- Random 12-byte IV collision probability is negligible (~2^48 encryptions before birthday bound)

Storage format: { iv: base64url, data: base64url }
- Base64url (not base64) avoids URL-encoding issues if credentials appear in URLs
- IV stored alongside ciphertext (required for decryption, not a security concern)

### Zod Validation

Chose @hono/zod-validator over manual c.req.json() + schema.parse() because:
- Type inference: c.req.valid('json') returns fully typed data
- Error handling: automatic 400 response on validation failure
- Single source of truth: Zod schema defines both runtime validation and TypeScript types

### Route Organization

Chose sub-app pattern (new Hono() per feature) over flat routes because:
- Each route file is independently testable
- Auth middleware applied once per sub-app, not per route
- Mounting via app.route() keeps main index.ts clean

### Bulk Stock Import

Chose textarea parsing (split by newline) over CSV/file upload because:
- Simpler UI (no file picker, no MIME type handling)
- Admin typically pastes from a text file or spreadsheet column
- Each line is one credential: email:password or profile:pin:instructions

---

## Implementation

### Files Created

| File | Purpose |
|---|---|
| server/utils/crypto.ts | AES-256-GCM encrypt/decrypt using Web Crypto API |
| server/lib/schemas.ts | Zod schemas for product CRUD and bulk stock import |
| server/routes/v1.ts | V1 router, mounts all versioned routes under /api/v1 |
| server/routes/admin.ts | Admin API routes (product CRUD + bulk import) |
| client/src/config/brand.config.ts | White-label brand identity config |
| client/src/hooks/useBrand.ts | React context hook for brand consumption |
| client/src/pages/Admin.tsx | Admin UI with product table, create modal, bulk loader |
| docs/epic2-aes-encryption2026-08-27.md | This document |

### Files Modified

| File | Change |
|---|---|
| server/package.json | Added @hono/zod-validator ^0.9.0 |
| server/index.ts | Refactored to use versioned routing: app.route('/api/v1', v1Routes) |
| client/src/app.css | Added brand theme palette overrides |

### API Versioning

Chose URL path versioning (/api/v1, /api/v2) over header or query parameter versioning because:
- Explicit and visible in logs, browser, and API docs
- No client-side complexity (headers require custom fetch config)
- Cache-friendly (CDNs cache by URL, not by header)
- Industry standard for REST APIs (GitHub, Stripe, Twilio all use path versioning)

Route structure:
```
/api/health              (unversioned, infrastructure)
/api/v1/me               (authenticated user profile)
/api/v1/admin/*          (admin CRUD + stock)
/api/v1/products/*       (Epic 3, public storefront)
/api/v1/orders/*         (Epic 4, customer dashboard)
/api/v1/checkout/*       (Epic 3, order creation)
/api/v1/webhooks/*       (Epic 3, payment gateway)
```

When v2 is needed: create server/routes/v2.ts, mount at /api/v2. V1 continues working. Deprecation policy: security fixes only for 6 months after v2 launch.

### Key Patterns

Crypto (server/utils/crypto.ts):
```typescript
const key = await crypto.subtle.importKey(
  'raw', base64Decode(secret), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
)
const iv = crypto.getRandomValues(new Uint8Array(12))
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
```

Admin route auth (server/routes/admin.ts):
```typescript
adminRoutes.use('*', authMiddleware)
adminRoutes.use('*', roleGuard('admin'))
```

Stock count query:
```typescript
db.select({ productId: vaultItems.productId, count: sql<number>`cast(count(*) as int)` })
  .from(vaultItems).where(eq(vaultItems.status, 'AVAILABLE')).groupBy(vaultItems.productId)
```

Bulk insert:
```typescript
db.insert(vaultItems).values(encryptedItems).returning()
```

---

## Open Questions

- Rate limiting for admin endpoints: not implemented yet. Needed if admin API is exposed beyond internal use.
- Product image upload: not in scope. Current schema has no image column. Add if brand requires product images.
- Undo/delete confirmation: Admin UI uses window.confirm() for delete. Replace with DaisyUI confirm modal if UX requires it.
