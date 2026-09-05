import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { BrandProvider } from './hooks/useBrand'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'

const Catalog = lazy(() => import('./pages/Catalog'))
const ProductList = lazy(() => import('./pages/ProductList'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const HowToOrder = lazy(() => import('./pages/HowToOrder'))
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
// Admin shell stays out of the main bundle — loads only on /admin visits.
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const History = lazy(() => import('./pages/admin/History'))
const Settings = lazy(() => import('./pages/admin/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  )
}

function App() {
  return (
    <BrandProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Catalog />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/how-to-order" element={<HowToOrder />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/payment/return" element={<PaymentReturn />} />

          {/* Admin — POS shell */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              </RequireAuth>
            }
          >
            <Route index element={<Overview />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrandProvider>
  )
}

export default App
