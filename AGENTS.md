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
4. **Row Level Security (RLS):** Enforce strict database policies so profiles and orders are queryable only by `auth.uid() = user_id`.
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
