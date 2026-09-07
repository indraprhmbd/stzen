import { createMiddleware } from 'hono/factory'
import { ForbiddenError, NotFoundError } from '../errors/http'

// ─── Role Guard Middleware ───────────────────────────────────────────────────
// Reusable role check. Usage: router.use('*', requireRole('admin'))
//
// conceal: return 404 instead of 403 so unauthorized callers cannot tell the
// route exists (RFC 9110 allows 404 to hide a forbidden target). Use for
// unpublished scopes like /api/v1/admin/*. Default false: explicit 403 stays
// for resources the caller already knows exist (own orders, own team).

export interface RequireRoleOpts {
  conceal?: boolean
}

export function requireRole(...args: Array<string | RequireRoleOpts>) {
  let conceal = false
  let roles: string[] = args as string[]
  const last = args[args.length - 1]
  if (typeof last === 'object' && last !== null) {
    conceal = (last as RequireRoleOpts).conceal === true
    roles = (args.slice(0, -1) as string[])
  }

  return createMiddleware(async (c, next) => {
    const user = c.get('user')
    // Supabase JWT: top-level `role` = Postgres role ("authenticated")
    // App role lives in `app_metadata.role`
    const appRole = (user as any)?.app_metadata?.role ?? (user as any)?.role ?? ''
    if (!user || !roles.includes(appRole)) {
      if (conceal) {
        console.warn('[concealed_not_found]', {
          path: c.req.path,
          reason: !user ? 'no_user' : 'wrong_role',
        })
        throw new NotFoundError('Not found')
      }
      throw new ForbiddenError('Insufficient permissions')
    }
    await next()
  })
}
