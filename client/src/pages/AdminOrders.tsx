import { useState, useEffect, useCallback } from 'react'
import { authedApiRequest } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Tray } from '@phosphor-icons/react'
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
      const result = (await data.json()) as unknown as { orders: AdminOrder[] }
      setOrders(result.orders ?? [])
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
        return { label: 'PENDING', className: 'bg-warning text-white', dot: 'bg-warning' }
      case 'PAID':
        return { label: 'PAID', className: 'bg-info text-white', dot: 'bg-info' }
      case 'DELIVERED':
        return { label: 'DELIVERED', className: 'bg-primary-container text-black', dot: 'bg-primary-container' }
      case 'REJECTED':
        return { label: 'REJECTED', className: 'bg-error text-white', dot: 'bg-error' }
      case 'REFUNDED':
        return { label: 'REFUNDED', className: 'bg-surface-container-highest text-on-surface', dot: 'bg-surface-container-highest' }
      default:
        return { label: status, className: 'bg-surface-container-highest text-on-surface', dot: 'bg-surface-container-highest' }
    }
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <div className="bg-surface-container border-[3px] border-on-surface shadow-3d-subtle p-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 bg-tertiary" />
              <div>
                <h1
                  className="font-black text-2xl md:text-3xl uppercase tracking-tight text-on-surface"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  ADMIN ORDERS
                </h1>
                <p className="text-xs font-bold text-on-surface-variant mt-0.5">
                  Manage customer orders and fulfillment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="bg-surface-container-high border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-bold uppercase text-xs text-on-surface px-3 py-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={() => navigate('/admin')}
              >
                PRODUCTS
              </button>
              <button
                className="bg-primary-container text-black border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs px-3 py-1.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                onClick={() => signOut()}
              >
                SIGN OUT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['ALL', 'PENDING', 'PAID', 'DELIVERED', 'REJECTED'] as FilterTab[]).map(
          (tab) => {
            const tabColors: Record<string, string> = {
              ALL: 'bg-on-surface text-primary-container',
              PENDING: 'bg-warning text-white',
              PAID: 'bg-info text-white',
              DELIVERED: 'bg-primary-container text-black',
              REJECTED: 'bg-error text-white',
            }
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                className={`
                  border-[3px] border-on-surface font-bold uppercase text-xs px-3 py-1.5
                  transition-all
                  ${isActive
                    ? `${tabColors[tab]} shadow-brutal translate-x-[1px] translate-y-[1px]`
                    : 'bg-surface-container text-on-surface shadow-brutal-sm hover:-translate-x-[1px] hover:-translate-y-[1px]'
                  }
                `}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
          }
        )}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-surface-container border-[3px] border-on-surface shadow-brutal p-8">
          <span className="text-on-surface-variant/30 mb-2 flex justify-center"><Tray size={40} weight="duotone" /></span>
          <p className="text-on-surface-variant/50 font-bold">No orders found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status)
            return (
              <div
                key={order.id}
                className="bg-surface-container border-[3px] border-on-surface shadow-brutal p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3
                      className="font-black text-base uppercase tracking-tight text-on-surface"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {order.productName}
                    </h3>
                    <p className="text-xs font-bold text-on-surface-variant font-mono mt-0.5">
                      User: {order.userId.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                    <span className={`badge border-[2px] border-on-surface font-bold text-[10px] ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs font-bold text-on-surface-variant">
                  <span className="bg-surface-container-high px-2 py-0.5 font-mono text-on-surface border border-on-surface/20">
                    ${order.amount}
                  </span>
                  <span className="font-mono">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-on-surface-variant/40 text-[10px]">
                    #{order.id.slice(0, 8)}
                  </span>
                  {order.paidAt && (
                    <span className="font-mono text-on-surface-variant/40 text-[10px]">
                      Paid: {new Date(order.paidAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {order.status === 'PENDING' && (
                    <>
                      <button
                        className="bg-primary-container text-black border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-3 py-1.5"
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
                        className="bg-error text-white border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-3 py-1.5"
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
                      className="bg-secondary-container text-black border-[3px] border-on-surface shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-3 py-1.5"
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
