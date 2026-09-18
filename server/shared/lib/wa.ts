// ─── Indonesian WhatsApp normalization ──────────────────────────────────────
// Single authority for buyer WA numbers. Accepts 08.., +62.., 62.. with
// spaces/dashes; stores digits-only 62... Returns null when the input is
// not a plausible Indonesian mobile number.

export function normalizeWaNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  if (!/^62[89]\d{7,12}$/.test(digits)) return null
  return digits
}
