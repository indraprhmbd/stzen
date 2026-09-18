// SumoPod QRIS floor: the gateway rejects invoices below Rp10.000, so the
// automated rail is only offered (and accepted) at or above this amount.
// Manual orders have no floor. Single source: settings.public surfaces this
// to the storefront dialog; services enforce it fail-closed.
export const SUMOPOD_MIN_AMOUNT_IDR = 10_000

export function isAutoPayAllowed(priceIdr: number, sumopodConfigured: boolean): boolean {
  return sumopodConfigured && Number.isFinite(priceIdr) && priceIdr >= SUMOPOD_MIN_AMOUNT_IDR
}

// Buyer-pays-fee: SumoPod dashboard passes 0.7% + Rp300 on to the buyer.
// Our invoice stays base price (revenue stats = net), gateway collects
// total. These helpers are for display + webhook tolerance only.
export const SUMOPOD_FEE_PCT = 0.007
export const SUMOPOD_FEE_FIXED_IDR = 300

/** Fee in IDR, ceil on the percentage so we never under-collect. */
export function qrisFee(priceIdr: number): number {
  return Math.ceil(priceIdr * SUMOPOD_FEE_PCT) + SUMOPOD_FEE_FIXED_IDR
}

/** Total the buyer actually pays on QRIS (base + fee). */
export function qrisTotal(priceIdr: number): number {
  return priceIdr + qrisFee(priceIdr)
}

/** True when callback amount matches base OR base+fee (gateway passthrough). */
export function isQrisAmountMatch(baseIdr: number, callbackIdr: number): boolean {
  return callbackIdr === baseIdr || callbackIdr === qrisTotal(baseIdr)
}
