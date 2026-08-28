import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import { authedApiRequest } from '../lib/api'
import Layout from '../components/Layout'
import OrderCard from '../components/OrderCard'
import CredentialViewer from '../components/CredentialViewer'

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
  const brand = useBrand()
  const { t } = useCopy()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Credentials state
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

  const tabKeys: FilterTab[] = ['ALL', 'PENDING', 'PAID', 'DELIVERED', 'REJECTED']
  const tabLabels = t.dashboard.tabs

  async function handleViewCredentials(orderId: string) {
    const order = orders.find((o) => o.id === orderId)
    if (order) setSelectedOrder(order)

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

  return (
    <Layout>
      {/* Header */}
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

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabKeys.map((tab, i) => {
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
              {tabLabels[i]}
              {tabCounts[tab] > 0 && (
                <span className="ml-1.5 font-mono text-[10px] opacity-70">
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Order List */}
        <div className={`${selectedOrder && credentials ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-surface-container border-[3px] border-on-surface shadow-brutal p-8">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">inbox</span>
              <p className="text-on-surface-variant/50 font-bold">{t.dashboard.noOrders}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`
                    cursor-pointer transition-all
                    ${selectedOrder?.id === order.id ? 'ring-2 ring-secondary-container' : ''}
                  `}
                  onClick={() => order.status === 'DELIVERED' && handleViewCredentials(order.id)}
                >
                  <OrderCard
                    order={order}
                    onViewCredentials={order.status === 'DELIVERED' ? () => handleViewCredentials(order.id) : undefined}
                    onReport={() => window.open(getWhatsAppUrl(order.id), '_blank')}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Credential Viewer */}
        {selectedOrder && (
          <div className="lg:col-span-7">
            {loadingCredentials ? (
              <div className="bg-on-surface border-[4px] border-secondary-container shadow-3d-pop rounded-sm p-6">
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary-container"></span>
                </div>
              </div>
            ) : credentialsError ? (
              <div className="bg-on-surface border-[4px] border-error shadow-brutal rounded-sm p-6">
                <p className="font-bold text-error text-sm">{credentialsError}</p>
              </div>
            ) : credentials ? (
              <CredentialViewer
                credentials={credentials.credentials}
                instructions={credentials.instructions}
                onCopy={() => handleCopyCredentials(credentials.credentials)}
                onReport={() => window.open(getWhatsAppUrl(selectedOrder.id), '_blank')}
              />
            ) : (
              <div className="bg-surface-container border-[3px] border-on-surface shadow-brutal p-6">
                <p className="text-on-surface-variant/50 font-bold text-center">
                  {t.dashboard.selectOrder}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
