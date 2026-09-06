import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Tray, Lock } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { usePublicSettings } from '../hooks/usePublicSettings'
import { useCopy } from '../hooks/useCopy'
import { authedApiRequest } from '../lib/api'
import { initiatePayment, deleteOrder } from '../lib/pay'
import { printReceipt } from '../lib/receipt'
import { useToast } from '../hooks/useToast'
import ToastStack from '../components/Toast'
import Layout from '../components/Layout'
import OrderCard from '../components/OrderCard'

interface Order {
  id: string
  userId: string
  productId: string
  vaultItemId: string | null
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  paymentRef: string | null
  amount: string
  createdAt: string
  paidAt: string | null
  productName: string
  productCategory: string
}

interface Credentials {
  credentials: string
  instructions: string | null
  productName: string
}

type FilterTab = 'ALL' | 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED'

export default function Dashboard() {
  const { user, session } = useAuth()
const brand = useBrand()
const support = usePublicSettings()
const { t } = useCopy()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const { toasts, showToast, dismissToast } = useToast()

  const fetchOrders = useCallback(async () => {
    try {
      const data = await authedApiRequest((c) => c.api.v1.orders.$get())
      const result = await data.json()
      setOrders(result as Order[])
    } catch {
      console.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchOrders()
    } else {
      setLoading(false)
    }
  }, [session, fetchOrders])

  // Orders mutate server-side after we leave (webhook fulfills while the buyer
  // is on the SumoPod page). Refetch on focus + poll while anything is PENDING
  // so BAYAR disappears the moment the order moves.
  useEffect(() => {
    if (!session) return
    const onFocus = () => fetchOrders()
    window.addEventListener('focus', onFocus)
    const id = setInterval(() => {
      setOrders((prev) => {
        if (prev.some((o) => o.status === 'PENDING')) fetchOrders()
        return prev
      })
    }, 10000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(id)
    }
  }, [session, fetchOrders])

  // Verification notifications: toast once when a previously-PENDING order
  // moves (webhook landed while polling). First population never fires.
  const prevStatuses = useRef<Record<string, string>>({})
  useEffect(() => {
    const prev = prevStatuses.current
    for (const o of orders) {
      const was = prev[o.id]
      if (was === 'PENDING' && o.status !== 'PENDING') {
        if (o.status === 'PAID') showToast(t.dashboard.paymentVerified, 'success')
        else if (o.status === 'DELIVERED') showToast(t.dashboard.accountDelivered, 'success')
        else showToast(t.dashboard.paymentFailed, 'error')
      }
      prev[o.id] = o.status
    }
  }, [orders, showToast, t])

  const filteredOrders =
    activeTab === 'ALL'
      ? orders
      : orders.filter((o) => o.status === activeTab)

  const tabCounts = {
    ALL: orders.length,
    PENDING: orders.filter((o) => o.status === 'PENDING').length,
    PAID: orders.filter((o) => o.status === 'PAID').length,
    DELIVERED: orders.filter((o) => o.status === 'DELIVERED').length,
    REJECTED: orders.filter((o) => o.status === 'REJECTED').length,
  }

  const tabKeys: FilterTab[] = ['ALL', 'PENDING', 'PAID', 'DELIVERED', 'REJECTED']
  const tabLabels = t.dashboard.tabs

  async function handlePay(orderId: string) {
    if (payingId) return
    setPayingId(orderId)
    try {
      const checkoutUrl = await initiatePayment(orderId)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        fetchOrders()
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal membuat pembayaran', 'error')
    } finally {
      setPayingId(null)
    }
  }

  async function handleCancel(orderId: string) {
    if (!window.confirm(t.dashboard.cancelConfirm)) return
    try {
      await deleteOrder(orderId)
      showToast(t.dashboard.orderCancelled, 'success')
      fetchOrders()
    } catch (e: any) {
      showToast(e?.message || 'Gagal membatalkan order', 'error')
    }
  }

  async function handleViewCredentials(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (order) setSelectedOrder(order)
    setLoadingCredentials(true)
    setCredentialsError('')
    setCredentials(null)
    ;(document.getElementById('credentials_modal') as HTMLDialogElement)?.showModal()
    try {
      const data = await authedApiRequest((c) =>
        c.api.v1.orders[':id'].credentials.$get({
          param: { id: orderId },
        })
      )
      const result = await data.json()
      setCredentials(result as Credentials)
    } catch (err: any) {
      setCredentialsError(err.message || 'Failed to load credentials')
    } finally {
      setLoadingCredentials(false)
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    showToast(t.common.copiedToClipboard, 'success')
  }

  function getWhatsAppUrl(orderId: string) {
    const number = support.whatsapp || brand.support.whatsappNumber
    const text = encodeURIComponent(`Issue with Order #${orderId}`)
    return `https://wa.me/${number}?text=${text}`
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="bg-surface-container border-[3px] border-on-surface shadow-3d-subtle p-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 bg-secondary-container" />
            <div>
              <h1
                className="font-black text-2xl md:text-3xl uppercase tracking-tight text-on-surface"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.dashboard.title}
              </h1>
              <p className="text-xs font-bold text-on-surface-variant mt-0.5">
                {t.dashboard.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!session && (
        <div className="text-center py-12 bg-surface-container border-[3px] border-on-surface shadow-brutal p-8">
          <span className="text-on-surface-variant/30 mb-3 flex justify-center"><Lock size={48} weight="duotone" /></span>
          <p className="font-bold text-on-surface mb-1">
            {user ? 'Loading your orders...' : 'Sign in to view your orders'}
          </p>
          <p className="text-xs text-on-surface-variant/60 mb-4">
            Access your purchase history, track deliveries, and view credentials.
          </p>
          {!user && (
            <Link
              to="/login"
              className="inline-block bg-primary-container text-black font-black text-xs uppercase border-[3px] border-black px-6 py-2.5 shadow-brutal-sm btn-brutal-interactive"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.auth.signIn}
            </Link>
          )}
        </div>
      )}

      {session && (
        <>
          <div className="sticky top-12 z-30 -mx-4 px-4 py-2 mb-4 flex gap-1.5 flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible">
            {tabKeys.map((tab, i) => {
              const tabColors: Record<string, string> = {
                ALL: 'bg-neutral text-primary',
                PENDING: 'bg-warning text-black',
                PAID: 'bg-info text-black',
                DELIVERED: 'bg-primary text-black',
                REJECTED: 'bg-error text-white',
              }
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  className={`shrink-0 border-[3px] border-on-surface font-bold uppercase text-[10px] px-2 py-1 md:text-xs md:px-3 md:py-1.5 transition-all ${isActive ? `${tabColors[tab]} shadow-brutal translate-x-[1px] translate-y-[1px]` : 'bg-surface-container text-on-surface shadow-brutal-sm hover:-translate-x-[1px] hover:-translate-y-[1px]'}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tabLabels[i]}
                  {tabCounts[tab] > 0 && <span className="ml-1 font-mono text-[9px] md:text-[10px] opacity-70">{tabCounts[tab]}</span>}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-surface-container border-[3px] border-on-surface shadow-brutal p-8">
              <span className="text-on-surface-variant/30 mb-2 flex justify-center"><Tray size={40} weight="duotone" /></span>
              <p className="text-on-surface-variant/50 font-bold">{t.dashboard.noOrders}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onViewCredentials={order.status === 'DELIVERED' ? () => handleViewCredentials(order.id) : undefined}
                  onPay={order.status === 'PENDING' ? () => handlePay(order.id) : undefined}
                  paying={payingId === order.id}
                  onCancel={order.status === 'PENDING' ? () => handleCancel(order.id) : undefined}
                  onReport={() => window.open(getWhatsAppUrl(order.id), '_blank')}
                  onReceipt={() => printReceipt(order)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Credentials Popup */}
      <dialog id="credentials_modal" className="modal">
        <div className="modal-box max-w-xl bg-neutral border-[3px] border-black shadow-brutal rounded-sm p-0 overflow-hidden">
          <div className="bg-zinc-900 text-white px-5 py-3 flex items-center justify-between border-b border-zinc-800">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-zinc-400">Vault Payload</div>
              <div className="text-sm font-bold">{selectedOrder?.productName ?? 'Kredensial'}</div>
            </div>
            <form method="dialog">
              <button className="btn btn-sm btn-ghost text-white">Tutup</button>
            </form>
          </div>

          <div className="p-5">
            {loadingCredentials ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            ) : credentialsError ? (
              <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-700">{credentialsError}</div>
            ) : credentials ? (
              <>
                <div className="bg-black border border-zinc-800 p-3">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 mb-2">Decrypted Payload</div>
                  <pre className="font-mono text-sm text-lime-300 whitespace-pre-wrap break-all select-all bg-black/0 p-0">{credentials.credentials}</pre>
                </div>
                {credentials.instructions && (
                  <div className="mt-3 bg-zinc-800 border border-zinc-700 p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                    {credentials.instructions}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleCopy(credentials.credentials)} className="flex-1 bg-primary-container text-black font-bold text-xs uppercase border-2 border-black py-2.5">
                    Salin
                  </button>
                  <button onClick={() => selectedOrder && window.open(getWhatsAppUrl(selectedOrder.id), '_blank')} className="flex-1 bg-white text-black font-bold text-xs uppercase border-2 border-black py-2.5">
                    Lapor
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-400 text-center py-6">Tidak ada data.</div>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <ToastStack toasts={toasts} onDone={dismissToast} />
    </Layout>
  )
}
