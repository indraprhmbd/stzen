import { Routes, Route } from 'react-router-dom'
import { BrandProvider } from './hooks/useBrand'
import Catalog from './pages/Catalog'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import AdminOrders from './pages/AdminOrders'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'

function App() {
  return (
    <BrandProvider>
      <div className="min-h-screen bg-base-100">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Catalog />} />
          <Route path="/login" element={<Login />} />

          {/* Protected (any authenticated user) */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          {/* Protected (admin only) */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminOrders />
                </RequireAdmin>
              </RequireAuth>
            }
          />
        </Routes>
      </div>
    </BrandProvider>
  )
}

export default App
