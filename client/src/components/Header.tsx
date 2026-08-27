import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'

export default function Header() {
  const { user, signOut } = useAuth()
  const brand = useBrand()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isAdmin = user?.app_metadata?.role === 'admin'

  const navLinks = [
    { to: '/', label: 'Catalog' },
    { to: '/dashboard', label: 'My Orders' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <header className="bg-base-100 border-b-[3px] border-neutral shadow-brutal sticky top-0 z-50">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary border-[2px] border-neutral shadow-brutal-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-neutral text-lg">lock</span>
            </div>
            <span
              className="font-black text-xl uppercase tracking-tighter text-neutral group-hover:text-primary transition-colors"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {brand.name}
            </span>
          </Link>

          {/* Center: Nav Links (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`
                    px-3 py-2 font-bold uppercase text-xs tracking-wide transition-all
                    ${link.to === '/admin' ? 'text-secondary' : 'text-neutral'}
                    ${isActive ? 'border-b-[4px] border-primary pb-1' : 'hover:text-primary'}
                  `}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right: Auth + Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                {isAdmin && (
                  <span className="badge bg-secondary border-[2px] border-neutral font-bold text-xs -rotate-1 shadow-brutal-sm">
                    ADMIN
                  </span>
                )}
                <span className="text-xs font-bold text-neutral/60 max-w-[120px] truncate">
                  {user.email}
                </span>
                <button
                  className="bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive px-3 py-1.5 font-black uppercase text-xs text-neutral"
                  onClick={() => signOut()}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:block bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive px-4 py-2 font-black uppercase text-xs text-neutral"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden bg-base-200 border-[2px] border-neutral shadow-brutal-sm p-1.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="material-symbols-outlined text-neutral text-lg">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-[3px] border-neutral py-3 flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`
                    px-3 py-2 font-bold uppercase text-xs tracking-wide
                    ${link.to === '/admin' ? 'text-secondary' : 'text-neutral'}
                    ${isActive ? 'bg-primary/20 border-l-[4px] border-primary' : ''}
                  `}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            })}
            <div className="border-t-[2px] border-neutral/20 mt-2 pt-2">
              {user ? (
                <div className="flex flex-col gap-2 px-3">
                  <span className="text-xs font-bold text-neutral/60 truncate">{user.email}</span>
                  <button
                    className="bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive px-3 py-2 font-black uppercase text-xs text-neutral text-left"
                    onClick={() => {
                      signOut()
                      setMobileMenuOpen(false)
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="block px-3 py-2 bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
