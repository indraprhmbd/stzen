import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
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
      <div className="flex justify-between items-center mb-6 border-b-[3px] border-neutral pb-2">
        <h1
          className="font-black text-3xl uppercase tracking-tight text-neutral"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          MY ACTIVE PURCHASES
        </h1>
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

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Order List */}
        <div className={`${selectedOrder && credentials ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
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
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`
                    cursor-pointer transition-all
                    ${selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''}
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
              <div className="bg-neutral border-[4px] border-secondary shadow-pop-pink rounded-sm p-6">
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
              </div>
            ) : credentialsError ? (
              <div className="bg-neutral border-[4px] border-error shadow-brutal rounded-sm p-6">
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
              <div className="bg-base-200 border-[3px] border-neutral shadow-brutal p-6">
                <p className="text-neutral/50 font-bold text-center">
                  Select a delivered order to view credentials
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
