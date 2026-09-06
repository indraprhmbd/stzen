import { supabaseAdmin } from '../db'

let cache: { values: Record<string, string>; ts: number } | null = null
const TTL_MS = 60 * 1000

async function loadAll(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.values

  const { data: rows, error } = await supabaseAdmin
    .from('settings')
    .select('key, value')

  if (error) throw new Error(error.message)

  const values: Record<string, string> = {}
  for (const r of rows || []) {
    values[r.key] = r.value
  }
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
