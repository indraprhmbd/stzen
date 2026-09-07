import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getEnv } from '../lib/runtime-env'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthEnv {
  Variables: {
    user: JWTPayload & {
      sub: string
      email?: string
      role?: string
      app_metadata?: Record<string, any>
    }
  }
}

// ─── JWKS Client ────────────────────────────────────────────────────────────
// Lazy-initialized — one JWKS fetch per cold start, cached in memory

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksUrl = ''

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const supabaseUrl = getEnv('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is required')
  if (!jwks || jwksUrl !== supabaseUrl) {
    jwksUrl = supabaseUrl
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    )
  }
  return jwks
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Missing or invalid Authorization header',
    })
  }

  const token = authHeader.slice(7)

  try {
    const supabaseUrl = getEnv('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL required')

    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${supabaseUrl}/auth/v1`,
    })

    // Set verified user on context — downstream handlers use c.get('user')
    c.set('user', payload as JWTPayload & { sub: string; email?: string; role?: string })

    await next()
  } catch (error) {
    throw new HTTPException(401, {
      message: 'Invalid or expired JWT token',
      cause: error,
    })
  }
})
