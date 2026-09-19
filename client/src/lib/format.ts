// Shared Intl number formatters. Module-level Intl.NumberFormat instances
// (creation is expensive; ~25 call sites previously did toLocaleString per
// render). Locale-cached so OrderCard can switch id-ID/en-US by UI language.
const cache = new Map<string, Intl.NumberFormat>()

function nf(locale: string): Intl.NumberFormat {
  let f = cache.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale)
    cache.set(locale, f)
  }
  return f
}

/** Grouped number, Indonesian default. Nullish/non-finite collapse to 0
 * (old inline Number(x).toLocaleString rendered "NaN" — 0 is safer UI). */
export function formatIdNumber(value: number | string | null | undefined, locale: string = 'id-ID'): string {
  const n = typeof value === 'number' ? value : Number(value)
  return nf(locale).format(Number.isFinite(n) ? n : 0)
}
