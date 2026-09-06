import type { ErrorHandler } from 'hono'
import { AppError } from './http'
import { HTTPException } from 'hono/http-exception'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status as any)
  }

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status as any)
  }

  console.error('[server] unhandled:', err)
  return c.json({ error: 'Internal server error' }, 500)
}
