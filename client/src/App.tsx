import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { BrandProvider } from './hooks/useBrand'
import { RequireAdmin } from './components/RequireAdmin'
import { ErrorBoundary } from './components/ErrorBoundary'

const Catalog = lazy(() => import('./pages/Catalog'))
const ProductList = lazy(() => import('./pages/ProductList'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const HowToOrder = lazy(() => import('./pages/HowToOrder'))
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
  const UpdatePassword = lazy(() => import('./pages/UpdatePassword'))
  const Dashboard = lazy(() => import('./pages/Dashboard'))
  const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Profile = lazy(() => import('./pages/Profile'))
// Admin shell stays out of the main bundle - loads only on /admin visits.
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const History = lazy(() => import('./pages/admin/History'))
const Reminders = lazy(() => import('./pages/admin/Reminders'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Account = lazy(() => import('./pages/admin/Account'))
const Guide = lazy(() => import('./pages/admin/Guide'))

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
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Catalog />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/how-to-order" element={<HowToOrder />} />
          <Route path="/payment-methods" element={<PaymentMethods />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/payment/return" element={<PaymentReturn />} />

          {/* Admin - concealed scope. RequireAdmin alone: no session or
              wrong role renders the generic 404, never redirects. No
              RequireAuth wrapper here, it would leak /admin via /login. */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Overview />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="history" element={<History />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
            <Route path="guide" element={<Guide />} />
          </Route>

          {/* Catch-all: same generic 404 the concealed admin scope renders */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrandProvider>
  )
}

export default App
