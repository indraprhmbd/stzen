import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface PublicSettings {
  storeName: string
  announcement: string
  whatsapp: string
  telegram: string
  email: string
  paymentMethods: string[]
}

const EMPTY: PublicSettings = { storeName: '', announcement: '', whatsapp: '', telegram: '', email: '', paymentMethods: ['manual'] }
const TTL_MS = 60 * 1000

// Module-level cache shared across mounts: one fetch per minute max, with
// in-flight dedup so concurrent mounts do not fan out. Mirrors the server
// 60s TTL (shared/lib/settings.ts) and edge max-age.
let cached: { data: PublicSettings; ts: number } | null = null
let inflight: Promise<PublicSettings> | null = null

async function load(): Promise<PublicSettings> {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data
  if (!inflight) {
    inflight = api.api.settings.public
      .$get()
      .then((r) => r.json() as Promise<Partial<PublicSettings>>)
      .then((j) => ({ ...EMPTY, ...j, paymentMethods: Array.isArray((j as any).paymentMethods) ? (j as any).paymentMethods : EMPTY.paymentMethods }))
      .catch(() => EMPTY)
      .finally(() => {
        inflight = null
      })
      .then((data) => {
        cached = { data, ts: Date.now() }
        return data
      })
  }
  return inflight
}
export function usePublicSettings(): PublicSettings {
  const [data, setData] = useState<PublicSettings>(cached?.data ?? EMPTY)

  useEffect(() => {
    let cancelled = false
    void load().then((d) => {
      if (!cancelled) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return data
}

// Bypass the 60s cache: checkout revalidates rails on dialog open so an
// operator key change reflects without waiting out the TTL.
export async function refreshPublicSettings(): Promise<PublicSettings> {
  cached = null
  return load()
}
