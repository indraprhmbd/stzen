# Epic 4: Auth UI + Both Dashboards

## Scope

Add Supabase Auth (Google OAuth + email/password fallback) and build both user and admin dashboards with proper route guards.

---

## Server Changes

### Credential Delivery Endpoint

**New file:** `server/modules/orders/credentials.routes.ts`

```
GET /api/v1/orders/:id/credentials
  Auth: authMiddleware (required)
  Logic:
    1. Get order by ID + userId (verify ownership)
    2. Check order.status === 'DELIVERED' (only delivered orders show credentials)
    3. Get vault_item by order.vaultItemId
    4. Decrypt credentialPayload via vaultService.decryptCredential()
    5. Return { credentials: string, instructions: string | null }
  Errors: 401 (no auth), 404 (order not found / not yours), 409 (order not delivered yet)
```

**Modified file:** `server/modules/orders/orders.routes.ts`
- Mount credentials sub-route: `orderRoutes.route('/:id/credentials', credentialsRoutes)`

No other server changes needed. Admin order management already works.

---

## Client Changes

### Supabase Client

**New file:** `client/src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Auth Hook

**New file:** `client/src/hooks/useAuth.ts`

```
Returns: { session, user, loading, signInWithGoogle, signInWithEmail, signOut }

- getSession() on mount (reads localStorage, no network)
- onAuthStateChange listener for real-time updates
- signInWithGoogle() -> supabase.auth.signInWithOAuth({ provider: 'google' })
- signInWithEmail(email, password) -> supabase.auth.signInWithPassword()
- signOut() -> supabase.auth.signOut()
```

### Route Guards

**New file:** `client/src/components/RequireAuth.tsx`
- If loading -> spinner
- If no session -> `<Navigate to="/login" replace />`
- If session -> render children

**New file:** `client/src/components/RequireAdmin.tsx`
- Uses `useAuth()` to get user
- Checks `user.app_metadata?.role === 'admin'`
- If not admin -> `<Navigate to="/dashboard" replace />`
- If admin -> render children

### Login Page

**New file:** `client/src/pages/Login.tsx`

Layout (neubrutalist):

```
+-----------------------------+
|       [BRAND NAME]          |
|     Tagline goes here       |
|                             |
|  +---------------------+    |
|  | Sign in with Google  |    |  <- Primary CTA (shadow-pop-lime)
|  +---------------------+    |
|                             |
|         -- OR --            |
|                             |
|  +---------------------+    |
|  | Email               |    |  <- Input field
|  +---------------------+    |
|  | Password            |    |  <- Input field
|  +---------------------+    |
|                             |
|  +---------------------+    |
|  | Sign In              |    |  <- Secondary CTA
|  +---------------------+    |
|                             |
|  Forgot password?           |  <- Link (deferred)
+-----------------------------+
```

- Google button: `btn btn-primary border-brutal shadow-brutal btn-brutal-interactive`
- Email/password: neubrutalist inputs from DESIGN.md
- Error display: `alert alert-error border-brutal`
- On success -> navigate to `/dashboard`

### User Dashboard

**New file:** `client/src/pages/Dashboard.tsx`

Layout:

```
+------------------------------------------+
|  MY ORDERS                    [Sign Out]  |
|                                          |
|  [All] [Pending] [Delivered] [Rejected]  |  <- Filter tabs
|                                          |
|  +------------------------------------+  |
|  | Netflix Premium                    |  |
|  | Status: DELIVERED  $12.99          |  |
|  | 2026-08-27                         |  |
|  | [View Credentials] [Report Issue]  |  |  <- View opens modal
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | ChatGPT Plus                        |  |
|  | Status: PENDING  $9.99             |  |
|  | 2026-08-26                         |  |
|  | [Report Issue]                     |  |  <- No View Credentials (not delivered)
|  +------------------------------------+  |
+------------------------------------------+
```

**Credential Modal:**

```
+-----------------------------+
|  CREDENTIALS            [X] |
|                             |
|  +---------------------+    |
|  | user@email.com      |    |  <- monospace display
|  | password123         |    |
|  +---------------------+    |
|                             |
|  Instructions:              |
|  Use this account for...    |
|                             |
|  [Copy to Clipboard]        |
+-----------------------------+
```

**WhatsApp Report:**
- `https://wa.me/<VITE_WHATSAPP_NUMBER>?text=Issue+with+Order+%23<order_id>`

### Admin Orders Page

**New file:** `client/src/pages/AdminOrders.tsx`

Layout:

```
+------------------------------------------+
|  ADMIN ORDERS                            |
|                                          |
|  [All] [Pending] [Paid] [Delivered]      |  <- Filter tabs
|                                          |
|  +------------------------------------+  |
|  | Order #abc123                      |  |
|  | User: user@email.com               |  |
|  | Product: Netflix Premium           |  |
|  | Amount: $12.99  Status: PENDING    |  |
|  | 2026-08-27                         |  |
|  | [Approve] [Reject]                 |  |  <- Only if PENDING
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | Order #def456                      |  |
|  | User: admin@email.com              |  |
|  | Product: ChatGPT Plus              |  |
|  | Amount: $9.99  Status: PAID        |  |
|  | 2026-08-26                         |  |
|  | [Deliver]                          |  |  <- Only if PAID
|  +------------------------------------+  |
+------------------------------------------+
```

### API Client Auth Injection

**Modified file:** `client/src/lib/api.ts`

```ts
// Add authed fetcher that injects Bearer token
export async function authedApiRequest<T>(
  fn: (client: typeof apiV1) => Promise<T>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const client = hc<AppType>(API_BASE, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  return fn(client.api.v1)
}
```

### App Router Wiring

**Modified file:** `client/src/App.tsx`

```tsx
<Routes>
  <Route path="/" element={<Catalog />} />
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={
    <RequireAuth><Dashboard /></RequireAuth>
  } />
  <Route path="/admin" element={
    <RequireAuth><RequireAdmin><AdminOrders /></RequireAdmin></RequireAuth>
  } />
</Routes>
```

---

## Dependency

```
npm install @supabase/supabase-js --workspace=client
```

## Environment Variables (already in .env.example)

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
VITE_WHATSAPP_NUMBER=6281234567890
```

---

## Implementation Order

1. Install `@supabase/supabase-js`
2. Create `supabase.ts` client
3. Create `useAuth.ts` hook
4. Create `RequireAuth.tsx` + `RequireAdmin.tsx`
5. Create `Login.tsx` (Google + email/password)
6. Update `api.ts` with auth injection
7. Create `credentials.routes.ts` (server)
8. Mount credentials route in `orders.routes.ts`
9. Create `Dashboard.tsx` (user)
10. Create `AdminOrders.tsx` (admin)
11. Update `App.tsx` with new routes
12. Verify build
13. Commit

## Auth Architecture

```
supabase.ts          -> createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
useAuth.ts           -> getSession() + onAuthStateChange listener
RequireAuth.tsx      -> if !session -> Navigate to /login
RequireAdmin.tsx     -> if user.app_metadata.role !== 'admin' -> Navigate to /
api.ts               -> authedFetch() injects Authorization: Bearer <token>
```

## Google OAuth Setup (Supabase Dashboard)

1. Create Google Cloud project -> enable Google+ API
2. Create OAuth credentials -> authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard -> Auth -> Providers -> Google -> paste Client ID + Secret
4. Add `http://localhost:5173` to Supabase redirect URLs for dev

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth state | Custom `useAuth()` hook | Simpler than Context, fewer files |
| API auth | Header injection wrapper | Each request fetches session, injects Bearer token |
| Route protection | `RequireAuth` / `RequireAdmin` components | Clean wrapper pattern |
| Credential delivery | New endpoint with decrypt | Server-side only, never send encrypted payload to client |
| Admin role | Manual seeding via Supabase dashboard | No invite flow needed now |
| Credential viewer | Modal popup | Terminal aesthetic deferred |
| Order filtering | Filter tabs (All/Pending/Delivered/Rejected) | Better UX than single list |
| Login | Google primary + email/password fallback | User preference |
