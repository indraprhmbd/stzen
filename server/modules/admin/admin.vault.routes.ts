import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { type AuthEnv } from '../../shared/middleware/auth'
import { requireRole } from '../../shared/middleware/require-role'
import { ForbiddenError } from '../../shared/errors/http'
import { vaultService } from '../vault/vault.service'
import { mintUnlockToken, verifyUnlockToken } from '../../shared/lib/unlockToken'

// ─── Admin Vault Routes ─────────────────────────────────────────────────────
// Plaintext credential management behind a soft unlock gate. List, edit,
// delete, revoke, rotate. Every mutation audited, raw creds never logged.

const ListQuerySchema = z.object({
  variant: z.string().min(1),
  page: z.coerce.number().int().min(0).optional().default(0),
  q: z.string().optional(),
  sort: z.string().optional(),
  sortDir: z.string().optional(),
})

const CredentialSchema = z.object({
  credential: z.string().min(1).max(5000),
})

const ReplaceSchema = z.object({
  credential: z.string().max(5000).optional(),
  fallbackVariantId: z.string().optional(),
})

async function unlockGuard(c: { req: { header: (n: string) => string | undefined }; get: (k: 'user') => { sub: string } }) {
  const user = c.get('user')
  const token = c.req.header('X-Vault-Token') ?? ''
  if (!(await verifyUnlockToken(user.sub, token))) {
    throw new ForbiddenError('Vault terkunci, buka kunci dulu')
  }
}

export const adminVaultRoutes = new Hono<AuthEnv>()
  // Auth is enforced globally in app.ts; this only adds the role check.
  .use('*', requireRole('admin'))

  // POST /unlock — soft gate, one click, 10 minute token
  .post('/unlock', async (c) => {
    const user = c.get('user')
    const { token, expiresAt } = await mintUnlockToken(user.sub)
    return c.json({ token, expiresAt })
  })

  // GET / — paginated plaintext list for one variant (unlock required)
  .get('/', zValidator('query', ListQuerySchema), async (c) => {
    await unlockGuard(c)
    const q = c.req.valid('query')
    return c.json(await vaultService.listByVariant(q.variant, q.page, q.q, q.sort, q.sortDir))
  })

  // PUT /:id — in place edit, re-encrypt overwrite (unlock required)
  .put('/:id', zValidator('json', CredentialSchema), async (c) => {
    await unlockGuard(c)
    const user = c.get('user')
    const { credential } = c.req.valid('json')
    return c.json(await vaultService.updateCredential(c.req.param('id'), credential.trim(), { sub: user.sub, email: user.email }))
  })

  // DELETE /:id — AVAILABLE only (unlock required)
  .delete('/:id', async (c) => {
    await unlockGuard(c)
    const user = c.get('user')
    return c.json(await vaultService.deleteAvailable(c.req.param('id'), { sub: user.sub, email: user.email }))
  })

  // POST /:id/revoke — SOLD to REVOKED, no replacement (unlock required)
  .post('/:id/revoke', async (c) => {
    await unlockGuard(c)
    const user = c.get('user')
    return c.json(await vaultService.revoke(c.req.param('id'), { sub: user.sub, email: user.email }))
  })

  // POST /replace/:orderId — rotate: revoke delivered, allocate next
  // AVAILABLE, repoint order. Buyer sees new cred on the same card.
  // No unlock guard needed: endpoint only touches SOLD→REVOKED and
  // AVAILABLE→SOLD, never exposes plaintext.
  .post('/replace/:orderId', zValidator('json', ReplaceSchema), async (c) => {
    const user = c.get('user')
    const { credential, fallbackVariantId } = c.req.valid('json')
    return c.json(await vaultService.replace(c.req.param('orderId'), { sub: user.sub, email: user.email }, { credential: credential ?? null, fallbackVariantId: fallbackVariantId ?? null }))
  })
