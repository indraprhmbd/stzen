import { createMiddleware } from 'hono/factory'
import { ForbiddenError } from '../errors/http'

// ─── Role Guard Middleware ───────────────────────────────────────────────────
// Reusable role check. Usage: router.use('*', requireRole('admin'))

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role ?? '')) {
      throw new ForbiddenError('Insufficient permissions')
    }
    await next()
  })
}
