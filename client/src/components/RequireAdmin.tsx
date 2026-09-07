import { useAuth } from '../hooks/useAuth'
import NotFound from '../pages/NotFound'

// Concealed scope: denial renders the generic 404 page, never redirects.
// A redirect to /login or /dashboard would confirm /admin exists.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!user) {
    return <NotFound />
  }

  // Check admin role in app_metadata (server-controlled, not user-editable)
  if (user.app_metadata?.role !== 'admin') {
    return <NotFound />
  }

  return <>{children}</>
}
