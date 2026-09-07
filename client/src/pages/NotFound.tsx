import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'

// Generic 404 page. Rendered for unknown routes AND for concealed admin
// denials (RequireAdmin). Copy stays generic on purpose: nothing here may
// confirm or deny the existence of any particular route.
export default function NotFound() {
  const { t } = useCopy()

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="card bg-base-200 border-brutal-thick shadow-pop-pink rounded-md p-8 max-w-md w-full text-center">
        <h1 className="font-black text-7xl tracking-tight text-stroke-thin">404</h1>
        <h2 className="font-black text-xl uppercase mt-2">{t.notFound.title}</h2>
        <p className="mt-2 font-semibold">{t.notFound.subtitle}</p>
        <div className="flex gap-3 justify-center mt-6">
          <Link
            to="/"
            className="btn btn-primary border-brutal shadow-brutal btn-brutal-interactive font-black uppercase"
          >
            {t.notFound.home}
          </Link>
          <Link to="/login" className="btn border-brutal shadow-brutal btn-brutal-interactive font-black uppercase">
            {t.notFound.login}
          </Link>
        </div>
      </div>
    </div>
  )
}
