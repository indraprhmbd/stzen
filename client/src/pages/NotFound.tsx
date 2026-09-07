import { Link } from 'react-router-dom'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

// Generic 404 page on the auth layout (halftone bg, white brutal card).
// Rendered for unknown routes AND for concealed admin denials
// (RequireAdmin). Copy stays generic on purpose: nothing here may confirm
// or deny the existence of any particular route.
export default function NotFound() {
  const { t } = useCopy()
  const brand = useBrand()

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md mx-auto">
        <img src="/logo.svg" alt={brand.name} className="auth-logo" />

        <div className="auth-card">
          <div className="p-6">
            <h1
              className="auth-title"
              style={{ fontSize: '4.5rem', lineHeight: 1, letterSpacing: '0.02em' }}
            >
              404
            </h1>
            <h2 className="auth-title" style={{ fontSize: '1.125rem', marginTop: '0.5rem' }}>
              {t.notFound.title}
            </h2>
            <p className="auth-subtitle">{t.notFound.subtitle}</p>

            <div className="flex flex-col gap-3">
              <Link to="/" className="auth-btn">
                {t.notFound.home}
              </Link>
              <Link to="/login" className="auth-btn auth-btn-secondary">
                {t.notFound.login}
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="auth-link">
            {t.auth.backToStore}
          </Link>
        </div>
      </div>
    </div>
  )
}
