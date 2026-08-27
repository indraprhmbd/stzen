import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
    return <Navigate to="/login" replace />
  }

  // Check admin role in app_metadata (server-controlled, not user-editable)
  if (user.app_metadata?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
