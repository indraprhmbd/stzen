import { authedApiRequest } from './api'

// ─── Payment Helpers (SumoPod sandbox) ──────────────────────────────────────
// initiatePayment mints a gateway invoice for a PENDING order and returns the
// redirect URL (null for providers with no redirect, e.g. manual).
// Throws with the server's error message on failure - callers show it.

export async function initiatePayment(orderId: string): Promise<string | null> {
  const res = await authedApiRequest((c) =>
    c.api.v1.payments[':orderId'].initiate.$post({ param: { orderId } })
  )
  const data = (await res.json()) as unknown as { checkoutUrl?: string | null; error?: string }
  if (!res.ok) throw new Error(data.error || 'Gagal membuat pembayaran')
  return data.checkoutUrl ?? null
}

export async function fetchOrderStatus(orderId: string): Promise<{ status: string; paidAt: string | null }> {
  const res = await authedApiRequest((c) =>
    c.api.v1.payments[':orderId'].status.$get({ param: { orderId } })
  )
  const data = (await res.json()) as unknown as { status: string; paidAt: string | null; error?: string }
  if (!res.ok) throw new Error(data.error || 'Gagal memuat status')
  return { status: data.status, paidAt: data.paidAt }
}

// deleteOrder cancels the buyer's own dead PENDING row (server blocks invoiced
// or non-PENDING orders with 409). Used for auto-cleanup after a failed
// initiate and the dashboard BATALKAN button.
export async function deleteOrder(orderId: string): Promise<void> {
  const res = await authedApiRequest((c) =>
    c.api.v1.orders[':id'].$delete({ param: { id: orderId } })
  )
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as unknown as { error?: string } | null
    throw new Error(data?.error || 'Gagal membatalkan order')
  }
}
