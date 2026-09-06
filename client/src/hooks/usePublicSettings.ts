import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { brandConfig } from '../config/brand.config'

// ─── Public Settings ──────────────────────────────────────────────────────────
// Storefront single source of truth for support contacts. Values come from
// the admin settings page (support.* keys); brand.config is fallback only
// (first paint / offline). Module-level promise: one fetch per page load
// no matter how many components subscribe.

export interface PublicSupport {
  whatsapp: string
  telegram: string
  email: string
}

const FALLBACK: PublicSupport = {
  whatsapp: brandConfig.support.whatsappNumber,
  telegram: brandConfig.support.telegramUsername,
  email: brandConfig.support.email,
}

let inflight: Promise<PublicSupport> | null = null

function fetchSupport(): Promise<PublicSupport> {
  if (!inflight) {
    inflight = api.api.settings.public.$get()
      .then((r) => r.json() as Promise<{ whatsapp?: string; telegram?: string; email?: string }>)
      .then((j) => ({
        whatsapp: j.whatsapp || FALLBACK.whatsapp,
        telegram: j.telegram || FALLBACK.telegram,
        email: j.email || FALLBACK.email,
      }))
      .catch(() => FALLBACK)
  }
  return inflight
}

export function usePublicSettings(): PublicSupport {
  const [support, setSupport] = useState<PublicSupport>(FALLBACK)
  useEffect(() => {
    fetchSupport().then(setSupport)
  }, [])
  return support
}
