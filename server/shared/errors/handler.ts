import type { ErrorHandler } from 'hono'
import { AppError } from './http'

// ─── Global Error Handler ───────────────────────────────────────────────────
// Mounted via app.onError(). Catches all thrown errors and returns consistent JSON.

export const errorHandler: ErrorHandler = (err, c) => {
  // Application errors — known failure modes
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status as any)
  }

  // Unknown errors — log and return generic message
  console.error('[server] unhandled:', err)
  return c.json({ error: 'Internal server error' }, 500)
}
