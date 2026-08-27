import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { authedApiRequest } from '../lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { brand } = useBrand()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState('')

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
    fetchOrders()
  }, [fetchOrders])

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

  async function handleViewCredentials(orderId: string) {
    setModalOpen(true)
    setLoadingCredentials(true)
    setCredentialsError('')
    setCredentials(null)

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

  function handleCopyCredentials(text: string) {
    navigator.clipboard.writeText(text)
  }

  function getWhatsAppUrl(orderId: string) {
    const number = brand.support.whatsappNumber
    const text = encodeURIComponent(`Issue with Order #${orderId}`)
    return `https://wa.me/${number}?text=${text}`
  }

  function getStatusBadge(status: Order['status']) {
    const base = 'badge border-brutal font-bold text-xs'
    switch (status) {
      case 'PENDING':
        return `${base} bg-warning text-neutral`
      case 'PAID':
        return `${base} bg-info text-neutral`
      case 'DELIVERED':
        return `${base} bg-success text-neutral`
      case 'REJECTED':
        return `${base} bg-error text-neutral`
      case 'REFUNDED':
        return `${base} bg-base-300 text-neutral`
      default:
        return `${base} bg-base-300 text-neutral`
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1
          className="text-3xl font-black uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          My Orders
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral/60">
            {user?.email}
          </span>
          <button
            className="btn btn-sm btn-primary border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
            onClick={() => signOut()}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['ALL', 'PENDING', 'PAID', 'DELIVERED', 'REJECTED'] as FilterTab[]).map(
          (tab) => (
            <button
              key={tab}
              className={`btn btn-sm border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-xs ${
                activeTab === tab
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className="badge badge-sm border-brutal bg-base-300 text-neutral font-mono ml-1">
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral/50 font-bold">No orders found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="card bg-base-200 border-brutal-thick shadow-pop-pink rounded-md p-5"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3
                    className="font-black text-lg uppercase tracking-tight text-neutral"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {order.productName}
                  </h3>
                  <p className="text-xs font-bold text-neutral/60">
                    {order.productCategory}
                  </p>
                </div>
                <span className={getStatusBadge(order.status)}>
                  {order.status}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs font-bold text-neutral/70">
                <span className="font-mono">
                  ${order.amount}
                </span>
                <span className="font-mono">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
                <span className="font-mono text-neutral/40">
                  #{order.id.slice(0, 8)}
                </span>
              </div>

              <div className="flex gap-2">
                {order.status === 'DELIVERED' && (
                  <button
                    className="btn btn-sm btn-primary border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
                    onClick={() => handleViewCredentials(order.id)}
                  >
                    View Credentials
                  </button>
                )}
                <a
                  href={getWhatsAppUrl(order.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
                >
                  Report Issue
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials Modal */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box border-brutal-thick shadow-brutal-lg rounded-md">
            <h3
              className="font-black text-lg uppercase text-neutral mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Credentials
            </h3>

            {loadingCredentials ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : credentialsError ? (
              <div className="alert alert-error border-brutal shadow-brutal-sm font-bold text-xs">
                <span>{credentialsError}</span>
              </div>
            ) : credentials ? (
              <div className="flex flex-col gap-4">
                <div className="bg-neutral border-brutal-thick shadow-pop-lime rounded-md p-4">
                  <pre className="font-mono text-sm text-primary font-bold bg-black/50 p-3 select-all whitespace-pre-wrap">
                    {credentials.credentials}
                  </pre>
                </div>

                {credentials.instructions && (
                  <div>
                    <p className="text-xs font-bold text-neutral/60 mb-1 uppercase">
                      Instructions
                    </p>
                    <p className="text-sm font-bold text-neutral">
                      {credentials.instructions}
                    </p>
                  </div>
                )}

                <button
                  className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
                  onClick={() =>
                    handleCopyCredentials(credentials.credentials)
                  }
                >
                  Copy to Clipboard
                </button>
              </div>
            ) : null}

            <div className="modal-action">
              <button
                className="btn border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  )
}
