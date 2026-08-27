import { useState, useEffect, useCallback } from 'react'
import { authedApiRequest } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

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
      await fetchOrders()
    } catch (err: any) {
      console.error(`Failed to ${action} order:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  function getStatusConfig(status: AdminOrder['status']) {
    switch (status) {
      case 'PENDING':
        return { label: 'PENDING', className: 'bg-warning text-neutral' }
      case 'PAID':
        return { label: 'PAID', className: 'bg-info text-neutral' }
      case 'DELIVERED':
        return { label: 'DELIVERED', className: 'bg-success text-neutral' }
      case 'REJECTED':
        return { label: 'REJECTED', className: 'bg-error text-neutral' }
      case 'REFUNDED':
        return { label: 'REFUNDED', className: 'bg-base-300 text-neutral' }
      default:
        return { label: status, className: 'bg-base-300 text-neutral' }
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b-[3px] border-neutral pb-2">
        <h1
          className="font-black text-3xl uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          ADMIN ORDERS
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="bg-base-100 border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-xs text-neutral px-3 py-1.5"
            onClick={() => navigate('/admin')}
          >
            PRODUCTS
          </button>
          <button
            className="bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-3 py-1.5"
            onClick={() => signOut()}
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['ALL', 'PENDING', 'PAID', 'DELIVERED', 'REJECTED'] as FilterTab[]).map(
          (tab) => (
            <button
              key={tab}
              className={`
                border-[3px] border-neutral font-bold uppercase text-xs px-3 py-1.5
                transition-all
                ${activeTab === tab
                  ? 'bg-primary text-primary-content shadow-brutal'
                  : 'bg-base-100 text-neutral shadow-brutal-sm hover:-translate-x-[1px] hover:-translate-y-[1px]'
                }
              `}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className="ml-1.5 font-mono text-[10px] opacity-70">
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
        <div className="text-center py-12 bg-base-200 border-[3px] border-neutral shadow-brutal p-8">
          <span className="material-symbols-outlined text-4xl text-neutral/30 mb-2">inbox</span>
          <p className="text-neutral/50 font-bold">No orders found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status)
            return (
              <div
                key={order.id}
                className="bg-base-200 border-[3px] border-neutral shadow-brutal p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3
                      className="font-black text-lg uppercase tracking-tight text-neutral"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {order.productName}
                    </h3>
                    <p className="text-xs font-bold text-neutral/60 font-mono mt-0.5">
                      User: {order.userId.slice(0, 8)}...
                    </p>
                  </div>
                  <span className={`badge border-[2px] border-neutral font-bold text-[10px] ${statusConfig.className}`}>
                    {statusConfig.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs font-bold text-neutral/70">
                  <span className="font-mono text-neutral">
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
                        className="bg-success border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-3 py-1.5"
                        disabled={actionLoading === order.id}
                        onClick={() => handleAction(order.id, 'approve')}
                      >
                        {actionLoading === order.id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          'APPROVE'
                        )}
                      </button>
                      <button
                        className="bg-error border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-3 py-1.5"
                        disabled={actionLoading === order.id}
                        onClick={() => handleAction(order.id, 'reject')}
                      >
                        {actionLoading === order.id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          'REJECT'
                        )}
                      </button>
                    </>
                  )}
                  {order.status === 'PAID' && (
                    <button
                      className="bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-3 py-1.5"
                      disabled={actionLoading === order.id}
                      onClick={() => handleAction(order.id, 'deliver')}
                    >
                      {actionLoading === order.id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'DELIVER'
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
