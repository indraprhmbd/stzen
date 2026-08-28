import { createMiddleware } from 'hono/factory'
import { ForbiddenError } from '../errors/http'

// ─── Role Guard Middleware ───────────────────────────────────────────────────
// Reusable role check. Usage: router.use('*', requireRole('admin'))

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user')
    // Supabase JWT: top-level `role` = Postgres role ("authenticated")
    // App role lives in `app_metadata.role`
    const appRole = (user as any)?.app_metadata?.role ?? (user as any)?.role ?? ''
    if (!user || !roles.includes(appRole)) {
      throw new ForbiddenError('Insufficient permissions')
    }
    await next()
  })
}
