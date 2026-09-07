import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { supabaseAdmin } from '../../shared/db'
import { type AuthEnv } from '../../shared/middleware/auth'
import { getEnv } from '../../shared/lib/runtime-env'

// ─── Types ───────────────────────────────────────────────────────────────────

type CallbackEnv = AuthEnv

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionCookie(c: { req: { url: string } }, accessToken: string): string {
  // Secure only over HTTPS. Hardcoding it breaks http://localhost and
  // Pages preview logins (browsers drop Secure cookies on HTTP).
  const https = new URL(c.req.url).protocol === 'https:' || getEnv('ENV') === 'production'
  return `sb_access_token=${accessToken}; HttpOnly;${https ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=3600`
}

function isSafeNext(next: string | undefined): boolean {
  if (!next || next === '/dashboard') return true
  if (next.startsWith('//') || next.startsWith('http://') || next.startsWith('https://')) return false
  try {
    const url = new URL(next, 'http://localhost')
    return url.origin === 'http://localhost'
  } catch {
    return false
  }
}

// ─── Callback Route ──────────────────────────────────────────────────────────
// Handles OAuth redirects (Google, etc.) from Supabase Auth.
// Validates the session server-side, ensures profile exists, then redirects
// to the frontend with a short-lived token or just sets a session cookie.

export const authRoutes = new Hono<CallbackEnv>()

// GET /api/v1/auth/callback?code=...&state=...
// Supabase OAuth redirects here with a code. We exchange it for a session.
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code')
  let next = c.req.query('next') || '/dashboard'

  if (!code) {
    throw new HTTPException(400, { message: 'Missing authorization code' })
  }

  if (!isSafeNext(next)) {
    next = '/dashboard'
  }

  const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    throw new HTTPException(401, { message: 'Invalid or expired code' })
  }

  const user = data.session.user

  // Ensure profile exists (upsert)
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .limit(1)

  if (!existing || existing.length === 0) {
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        role: 'customer',
      })

    if (insertError) throw new Error(insertError.message)
  }

  // Set HTTP-only session cookie
  const cookie = sessionCookie(c, data.session.access_token)

  return c.newResponse(null, {
    status: 302,
    headers: {
      Location: next,
      'Set-Cookie': cookie,
    },
  })
})

// POST /api/v1/auth/callback - alternative for non-browser clients
authRoutes.post('/callback', async (c) => {
  const body = await c.req.json<{ code?: string; next?: string }>()
  const code = body.code
  let next = body.next || '/dashboard'

  if (!code) {
    throw new HTTPException(400, { message: 'Missing authorization code' })
  }

  if (!isSafeNext(next)) {
    next = '/dashboard'
  }

  const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    throw new HTTPException(401, { message: 'Invalid or expired code' })
  }

  const user = data.session.user

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .limit(1)

  if (!existing || existing.length === 0) {
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        role: 'customer',
      })

    if (insertError) throw new Error(insertError.message)
  }

  const cookie = sessionCookie(c, data.session.access_token)

  return c.json({ ok: true, user: { id: user.id, email: user.email } }, 302, {
    'Set-Cookie': cookie,
    Location: next,
  })
})
