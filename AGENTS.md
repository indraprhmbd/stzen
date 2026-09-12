# AGENT CODING CONVENTIONS & CONSTRAINTS (AGENTS.md)

## Stack Standards
- **Backend API:** Hono Framework (Edge worker runtime / Node)
- **Frontend SPA:** React (Vite) + DaisyUI v5 (CSS Utility Classes)
- **Database & ORM:** Supabase PostgreSQL + Drizzle ORM
- **Authentication:** Supabase Auth (JWT verification via Hono middleware)
- **Language:** TypeScript strict mode enabled full-stack

## Mandatory Security & Execution Rules
1. **Never Store Plaintext Credentials:** All raw account strings (`email:pass | Profile PIN | Instructions`) MUST be encrypted at rest using AES-256-GCM before database insertion (`vault_items`). Decrypt ONLY inside authenticated Hono handlers for the verified order owner.
2. **Atomic Inventory Allocation:** NEVER query available stock and allocate in JavaScript memory. Always execute the database-level RPC function `allocate_credential(product_id, order_id)` utilizing `FOR UPDATE SKIP LOCKED` to prevent double-selling race conditions.
3. **Database Connection Pooling:** Connect Drizzle through Supabase's Transaction Pooler (Port 6543 / PgBouncer) for serverless compatibility and connection safety.
4. **Row Level Security (RLS):** Enforce strict database policies. Server connects as `postgres` superuser (bypasses RLS); RLS protects direct client access via anon/authenticated keys. Default-deny: no UPDATE/DELETE policy exists without a shipped feature using it.
   - **profiles:** `authenticated` can SELECT own row (`auth.uid() = id`). NO update policy (client never self-edits; admin writes go through dashboard/service_role). anon blocked.
   - **Role source of truth:** `app_metadata.role` in the JWT (set via dashboard, unreadable by users). NEVER authorize on `profiles.role`; it is display-only and must stay unwritable by its owner.
   - **products / product_variants:** `anon` + `authenticated` can SELECT `is_active = true` (public catalog).
   - **orders:** `authenticated` can SELECT/INSERT own orders (`user_id = auth.uid()`). anon blocked.
   - **vault_items / audit_logs:** NO policies - completely blocked for anon/authenticated. Server superuser only.
5. **UI Styling:** Use native DaisyUI utility components (`btn`, `btn-primary`, `badge`, `card`, `table`, `modal`). Do NOT write custom CSS overrides or unneeded Tailwind abstractions.
6. **End-to-End Type Safety:** Export Hono API router types (`AppType`) and consume them on the React client via `hono/client` (`hc<AppType>`).

## Git Convention

### Commit Strategy
- **Commit per epic.** Each epic (feature sprint) gets one commit when all its files are verified.
- **Commit message format:** `<type>(<scope>): <description>`
- **Types:** `feat`, `fix`, `chore`, `docs`
- **Scope:** `server`, `client`, `docs`, `root`
- **Description:** Imperative mood, lowercase, no period, max 72 chars

### Examples
```
feat(server): add admin CRUD routes with AES-256-GCM encryption
feat(client): add admin product management UI
docs(epic2): add AES encryption and admin CRUD decision record
chore(root): add git convention to AGENTS.md
```

### Branch Strategy
- Work on `main` until deployment branching is needed
- Feature branches: `epic/<number>-<short-name>` (e.g., `epic/2-aes-encryption`)

## API Versioning

### Pattern: URL Path Versioning
All business routes live under `/api/v1`. Infrastructure endpoints (`/api/health`) are unversioned.

```
/api/health              (unversioned)
/api/v1/me               (v1)
/api/v1/admin/*          (v1)
/api/v1/products/*       (v1)
/api/v1/orders/*         (v1)
```

### Adding a New Version
1. Create `server/routes/v2.ts` with breaking changes
2. Mount in `server/index.ts`: `app.route('/api/v2', v2Routes)`
3. V1 continues working, receives security fixes only
4. Deprecation notice: 6 months after v2 launch, v1 enters maintenance mode

### Route File Convention
- One file per feature domain: `admin.ts`, `products.ts`, `orders.ts`
- Version router (`v1.ts`, `v2.ts`) composes feature routes
- Main `index.ts` only handles middleware, version mounting, and server startup

## Modular Monolith Architecture

### Directory Structure
```
server/
  app.ts                          # createApp() factory + AppType export
  index.ts                        # Entrypoint: createApp + serve (minimal)
  shared/                         # Cross-module kernel
    db/                           # Drizzle client + schema re-exports
    middleware/                    # auth, require-role
    errors/                       # AppError classes + global handler
    lib/                          # crypto, db-helpers
  modules/                        # Feature modules (self-contained)
    products/                     # routes, service, schema, types, index
    orders/
    checkout/
    vault/
    admin/
```

### Module Convention
Each module has up to 5 files:
- `*.routes.ts` - Hono sub-app with HTTP handlers (thin, delegate to service)
- `*.service.ts` - Business logic + DB queries (testable without HTTP)
- `*.schema.ts` - Zod validation schemas
- `*.types.ts` - TypeScript types (exported for cross-module use)
- `index.ts` - Public API: re-exports routes + service

### Import Rules
1. **Modules import from `shared/` only.** Never import from another module's internal files.
2. **Cross-module data access** goes through the target module's service (e.g., `checkoutService` calls `productsService.getById()`).
3. **Shared kernel imports from `db/schema.ts`.** Modules re-export types from there.
4. **`app.ts` composes all modules.** No module imports from `app.ts`.

### Service Layer Pattern
```typescript
// Handler (thin)
route.post('/', zValidator('json', Schema), async (c) => {
  const data = c.req.valid('json')
  const result = await myService.doWork(data)
  return c.json(result)
})

// Service (business logic)
export const myService = {
  async doWork(data: Input) {
    // DB queries, validation, state transitions
    // Throw AppError subclasses on failure
  }
}
```

### Error Handling
- Throw `NotFoundError`, `ConflictError`, `ForbiddenError`, etc. from `shared/errors/http.ts`
- Global `app.onError(errorHandler)` catches all and returns consistent JSON
- Never return `c.json({ error: ... }, status)` from services - throw instead

### Order State Machine
Centralized in `orders.service.ts`:
```
PENDING  -> PAID (approve), REJECTED (reject)
PAID     -> DELIVERED (deliver)
REJECTED -> (terminal)
DELIVERED -> (terminal)
```
Adding new states requires updating `VALID_TRANSITIONS` and `ACTION_TO_STATUS` in one file.

### Adding a New Module
1. Create `server/modules/<name>/` with routes, service, types, index
2. Import shared kernel from `../../shared/`
3. Mount in `server/app.ts`: `app.route('/api/v1/<name>', <name>Routes)`
4. Export `AppType` is auto-updated via `ReturnType<typeof createApp>`

## UI Design System: "Zen" Neubrutalism

### Anti-AI Design Rules (MANDATORY)

1. **NEVER** use `rounded-xl`, `rounded-2xl`, or `rounded-full` on cards or containers. Use `rounded-sm` or `rounded-md` max.
2. **NEVER** use subtle shadows (`shadow-md`, `shadow-lg`, `shadow-indigo-500/10`). Always use `.shadow-brutal` or `.shadow-pop-*`.
3. **NEVER** use subtle background gradients (`bg-gradient-to-r from-purple-500 to-indigo-500`). Use flat, solid high-contrast fills.
4. **NEVER** place plain text on raw background without high-contrast outlines or solid bounding boxes.

### Required Utility Classes

- **Borders:** `.border-brutal` (3px), `.border-brutal-thick` (4px)
- **Shadows:** `.shadow-brutal-sm` (2px), `.shadow-brutal` (4px), `.shadow-brutal-lg` (7px)
- **Pop Shadows:** `.shadow-pop-pink`, `.shadow-pop-lime`, `.shadow-pop-coral`
- **Buttons:** `.btn-brutal-interactive` (push-button physics: translate on hover/active)
- **Text:** `.text-stroke-black` (2.5px), `.text-stroke-thin` (1.5px)

### Typography

- **Headers:** Space Grotesk (700/900), uppercase, high tracking
- **Body:** Plus Jakarta Sans (600-800)
- **Credentials/Code:** JetBrains Mono (700)

### Component Specs

**Primary Button:**
```html
<button class="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase">
  ACTION TEXT
</button>
```

**Product Card:**
```html
<div class="card bg-base-200 border-brutal-thick shadow-pop-pink rounded-md p-5">
```

**Input Field:**
```html
<input class="input input-bordered bg-base-100 border-brutal font-mono text-xs shadow-brutal-sm rounded-sm" />
```

**Credential Terminal:**
```html
<div class="bg-neutral border-brutal-thick shadow-pop-lime rounded-md p-4">
  <pre class="font-mono text-sm text-primary font-bold bg-black/50 p-3 select-all">...</pre>
</div>
```
