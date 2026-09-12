# My Orders - Guest Access Rework

**Date:** 2026-08-28
**Scope:** 2 files modified
**Status:** Implemented

## Problem

`/dashboard` route wrapped in `RequireAuth` → redirects unauthenticated users to `/login`. User wants guests to access the page and see a login prompt instead of being blocked.

## Current Security Layers

| Layer | File | Status |
|---|---|---|
| Route guard | `RequireAuth` in App.tsx | Blocks page access |
| Server JWT | `authMiddleware` | Returns 401 if no token |
| Service ownership | `WHERE user_id = userId` | Enforced |
| DB RLS | Not implemented | Gap - out of scope |

## Changes

### 1. `App.tsx` - Remove route guard
- Remove `<RequireAuth>` wrapper from `/dashboard` route
- Page now accessible to all visitors

### 2. `Dashboard.tsx` - Auth-conditional rendering
- Check `session` from `useAuth()`
- If `!session`: show login prompt card with CTA link to `/login`. No API call attempted.
- If `session`: fetch and render orders as before (existing behavior)

## Security Notes

- Server API still returns 401 for unauthenticated requests - no data leakage
- `authedApiRequest` throws cleanly when no session - no crash
- RLS gap exists but is separate concern (see future security hardening task)
- Order ownership enforced at service layer (`orders.service.ts:33,60`)
