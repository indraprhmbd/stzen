import { sql } from 'drizzle-orm'
import { db } from '../db'

// ─── Settings Service ─────────────────────────────────────────────────────────
// Key/value store reads with a 60s in-memory TTL (same pattern as the 30s
// statusCounts cache in orders.service). Hot paths (unlock TTL, thresholds)
// must not add a query per request; writes invalidate synchronously.

let cache: { values: Record<string, string>; ts: number } | null = null
const TTL_MS = 60 * 1000

async function loadAll(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.values
  const rows = (await db.execute(sql`select key, value from settings`)) as unknown as any
  const list: { key: string; value: string }[] = Array.isArray(rows) ? rows : rows?.rows ?? []
  const values: Record<string, string> = {}
  for (const r of list) values[r.key] = r.value
  cache = { values, ts: Date.now() }
  return values
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const values = await loadAll()
  return values[key] ?? fallback
}

export async function getIntSetting(key: string, fallback: number, min: number, max: number): Promise<number> {
  const raw = await getSetting(key, '')
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function invalidateSettings(): void {
  cache = null
}
