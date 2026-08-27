import { useState, useEffect, useCallback } from 'react'
import { authedApiRequest } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminOrder {
  id: string
  userId: string
  productId: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED' | 'REFUNDED'
  amount: string
  paymentRef: string | null
  createdAt: string
  paidAt: string | null
  productName: string
}

type FilterTab = 'ALL' | 'PENDING' | 'PAID' | 'DELIVERED' | 'REJECTED'

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminOrders() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchOrders = useCallback(async (status?: string) => {
    try {
      const query = status && status !== 'ALL' ? `?status=${status}` : ''
      const data = await authedApiRequest((c) =>
        c.api.v1.admin.orders.$get({ query: { status: status !== 'ALL' ? status : undefined } } as any)
      )
      const result = await data.json()
      setOrders(result as AdminOrder[])
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

  async function handleAction(orderId: string, action: 'approve' | 'reject' | 'deliver') {
    setActionLoading(orderId)
    try {
      await authedApiRequest((c) =>
        (c.api.v1.admin.orders as any)[`${orderId}/${action}`].$post({
          param: { id: orderId },
        })
      )
      // Refetch orders after action
      await fetchOrders()
    } catch (err: any) {
      console.error(`Failed to ${action} order:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  function getStatusBadge(status: AdminOrder['status']) {
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1
          className="text-3xl font-black uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Admin Orders
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-ghost border-brutal shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-xs"
            onClick={() => navigate('/admin')}
          >
            Products
          </button>
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
              className="card bg-base-200 border-brutal-thick shadow-pop-coral rounded-md p-5"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3
                    className="font-black text-lg uppercase tracking-tight text-neutral"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {order.productName}
                  </h3>
                  <p className="text-xs font-bold text-neutral/60 font-mono">
                    User: {order.userId.slice(0, 8)}...
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
                {order.paidAt && (
                  <span className="font-mono text-neutral/40">
                    Paid: {new Date(order.paidAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <>
                    <button
                      className="btn btn-sm btn-success border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
                      disabled={actionLoading === order.id}
                      onClick={() => handleAction(order.id, 'approve')}
                    >
                      {actionLoading === order.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Approve'
                      )}
                    </button>
                    <button
                      className="btn btn-sm btn-error border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
                      disabled={actionLoading === order.id}
                      onClick={() => handleAction(order.id, 'reject')}
                    >
                      {actionLoading === order.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Reject'
                      )}
                    </button>
                  </>
                )}
                {order.status === 'PAID' && (
                  <button
                    className="btn btn-sm btn-primary border-brutal shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs"
                    disabled={actionLoading === order.id}
                    onClick={() => handleAction(order.id, 'deliver')}
                  >
                    {actionLoading === order.id ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      'Deliver'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
