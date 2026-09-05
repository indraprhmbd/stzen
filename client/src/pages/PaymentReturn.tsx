import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { fetchOrderStatus } from '../lib/pay'
import { useToast } from '../hooks/useToast'
import { useCopy } from '../hooks/useCopy'
import ToastStack from '../components/Toast'

// ─── Payment Return ─────────────────────────────────────────────────────────
// Gateway landing after QRIS pay/cancel: /payment/return?order=<publicId>[&cancelled=1].
// Polls order status until terminal (PAID/DELIVERED/REJECTED) or 2 min timeout.
// Webhook usually lands within seconds; polling covers the slow path.

const POLL_MS = 3000
const MAX_TRIES = 40

export default function PaymentReturn() {
  const [params] = useSearchParams()
  const orderId = params.get('order') ?? ''
  const cancelled = params.get('cancelled') === '1'
  const [status, setStatus] = useState<string | null>(cancelled ? 'CANCELLED' : null)
  const [error, setError] = useState('')
  const { toasts, showToast, dismissToast } = useToast()
  const { t } = useCopy()
  const notified = useRef(false)

  useEffect(() => {
    if (cancelled && !notified.current) {
      notified.current = true
      showToast(t.payment.cancelled, 'error')
    }
  }, [cancelled, showToast, t])

  useEffect(() => {
    if (!orderId || cancelled) return
    let alive = true
    let tries = 0
    const id = setInterval(async () => {
      tries++
      try {
        const s = await fetchOrderStatus(orderId)
        if (!alive) return
        setStatus(s.status)
        if (s.status !== 'PENDING') {
          clearInterval(id)
          if (!notified.current) {
            notified.current = true
            if (s.status === 'PAID' || s.status === 'DELIVERED') {
              showToast(t.dashboard.paymentVerified, 'success')
            } else {
              showToast(t.dashboard.paymentFailed, 'error')
            }
          }
        } else if (tries >= MAX_TRIES) {
          clearInterval(id)
        }
      } catch (e: any) {
        if (!alive) return
        if (tries >= MAX_TRIES) {
          setError(e?.message || 'Gagal memuat status')
          clearInterval(id)
        }
      }
    }, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [orderId, cancelled, showToast, t])

  const done = status === 'PAID' || status === 'DELIVERED'
  const failed = status === 'REJECTED' || status === 'REFUNDED' || status === 'CANCELLED'

  return (
    <Layout>
      <div className="max-w-md mx-auto py-10">
        <div className="bg-white border-comic shadow-comic p-6 text-center">
          <h1
            className="font-black text-xl uppercase tracking-tight mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {cancelled ? t.payment.cancelled : done ? t.payment.paid : failed ? t.payment.failed : t.payment.waiting}
          </h1>

          {orderId && (
            <p className="font-mono text-xs text-zinc-500 mb-4">Order #{orderId.slice(0, 8).toUpperCase()}</p>
          )}

          {!cancelled && !done && !failed && !error && (
            <div className="py-4">
              <span className="loading loading-spinner loading-lg" />
              <p className="text-xs font-bold text-zinc-600 mt-3">
                {t.payment.waitingHint}
              </p>
            </div>
          )}

          {done && (
            <p className="text-sm font-bold mb-4">
              {status === 'DELIVERED'
                ? t.payment.deliveredHint
                : t.payment.paidHint}
            </p>
          )}

          {(failed || error) && (
            <p className="text-sm font-bold text-red-600 mb-4">
              {error || t.payment.failedHint}
            </p>
          )}

          <Link
            to="/dashboard"
            className="btn btn-primary border-comic shadow-comic btn-comic-interactive font-black uppercase text-xs mt-2"
          >
            {t.payment.toDashboard}
          </Link>        </div>
      </div>
      <ToastStack toasts={toasts} onDone={dismissToast} />
    </Layout>
  )
}
