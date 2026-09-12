# Route-Level Lazy Loading

**Date:** 2026-08-28
**Scope:** 2 files modified
**Status:** Implemented

## Problem

All 5 pages statically imported in `App.tsx` - entire app loads on first visit regardless of route. No code splitting, no `React.lazy`, no vendor chunking.

## Current State

| Issue | Detail |
|---|---|
| Static imports | `App.tsx` imports all pages eagerly |
| No Suspense | Zero React.lazy/Suspense usage |
| No manual chunks | `vite.config.ts` bare - no vendor splitting |
| Bundle | All pages + deps in initial load |

## Changes

### 1. `App.tsx` - React.lazy + Suspense
- Replace static page imports with `React.lazy(() => import('./pages/X'))`
- Wrap `<Routes>` in `<Suspense fallback={<PageLoader />}>`
- `PageLoader`: centered spinner for route chunk loading (not data fetching)

### 2. `vite.config.ts` - Manual chunks
- Split vendor libs: `react`, `react-dom`, `react-router-dom`, `supabase`
- Dedicated cacheable chunks per vendor group

## Not Touched

- Individual page loading states (`useState(true)`) - data-fetching concern, separate from code splitting
- SkeletonCard, CopyToast - component-level concerns

## Result

| Before | After |
|---|---|
| First visit loads all 5 pages | First visit loads only visited page |
| Single vendor bundle | Vendors split into cacheable chunks |
| ~536KB JS | Smaller initial, lazy-loaded on demand |
