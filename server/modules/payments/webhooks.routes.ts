import { Hono } from 'hono'
import { paymentsService } from './payments.service'

// ─── Webhook Routes (PUBLIC) ─────────────────────────────────────────────────
// No authMiddleware — gateways call these directly, they can't send a
// Supabase JWT. Each provider verifies its own signature inside
// parseWebhook(c) before anything is trusted. Mounted with its own lenient
// rate limit in app.ts (separate from the authed /payments limit).
//
// Body is read exactly once, inside provider.parseWebhook — never call
// c.req.json() here first, it consumes the stream and breaks raw-body
// signature checks (form-encoded providers use c.req.parseBody(), JSON/Svix
// providers use c.req.text()).

export const webhooksRoutes = new Hono()
  .post('/:provider', async (c) => {
  const result = await paymentsService.handleWebhook(c.req.param('provider'), c)
  return c.json(result)
})
