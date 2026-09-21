import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { type AuthEnv } from '../../shared/middleware/auth'
import { warrantyService } from '../orders/warranty.service'

const ClaimSchema = z.object({
  orderId: z.string().min(1),
  note: z.string().max(500).optional(),
})

type AdminWarrantyEnv = AuthEnv

export const adminWarrantyRoutes = new Hono<AdminWarrantyEnv>()

  .post('/', zValidator('json', ClaimSchema), async (c) => {
    const user = c.get('user')
    const { orderId, note } = c.req.valid('json')
    const result = await warrantyService.recordClaim(orderId, note ?? null, {
      sub: user.sub,
      email: user.email ?? null,
    })
    return c.json(result, 201)
  })

  .get('/:orderId', async (c) => {
    const result = await warrantyService.getClaims(c.req.param('orderId'))
    return c.json(result)
  })
