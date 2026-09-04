import type { MiddlewareHandler } from 'hono'

// ─── In-memory token bucket ─────────────────────────────────────────────────
// Zero-cost rate limiting for single-instance deploys. State is per-process,
// it does not share across instances. Upgrade path is a Redis-backed bucket.

interface Bucket {
  tokens: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(max: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('cf-connecting-ip') ||
      'unknown'
    const key = `${ip}:${c.req.routePath}`
    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      bucket = { tokens: max, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }
    if (bucket.tokens <= 0) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return c.json({ error: 'Terlalu banyak permintaan, coba lagi nanti' }, 429)
    }
    bucket.tokens -= 1
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k)
      }
      if (buckets.size > 10000) buckets.clear()
    }
    await next()
  }
}
