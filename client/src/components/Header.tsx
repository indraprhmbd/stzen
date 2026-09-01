import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

export default function Header() {
  const { user, signOut } = useAuth()
  const brand = useBrand()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t, lang, toggle } = useCopy()

  const navLinks = [
    { to: '/', label: t.nav.shop },
    { to: '/dashboard', label: t.nav.myOrders },
  ]

  return (
    <header className="bg-surface border-b-[3px] border-on-surface sticky top-0 z-50 shadow-brutal">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center group">
              <img
                src="/logo.svg"
                alt={brand.name}
                className="h-9 w-9 md:h-10 md:w-10 hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`
                      font-black text-sm uppercase transition-all text-on-surface
                      ${isActive
                        ? 'border-b-4 border-primary pb-1 text-primary'
                        : 'hover:text-primary hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
                      }
                    `}
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Auth + Lang Toggle + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={toggle}
              className="border-[2px] border-on-surface font-extrabold text-[10px] uppercase px-2 py-1 btn-brutal-interactive shadow-brutal-sm rounded-sm text-on-surface"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {lang === 'id' ? 'EN' : 'ID'}
            </button>

            {/* Auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant max-w-[120px] truncate font-mono">
                  {user.email}
                </span>
                <button
                  className="bg-surface-container border-[3px] border-black shadow-brutal-sm btn-brutal-interactive px-3 py-1.5 font-black uppercase text-xs text-on-surface hover:bg-secondary-container hover:text-black transition-colors"
                  onClick={() => signOut()}
                >
                  {t.auth.signOut}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:block bg-primary-container text-black font-black text-xs uppercase border-[3px] border-black px-4 py-2 shadow-brutal-sm btn-brutal-interactive"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.auth.signIn}
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden bg-surface-container border-[2px] border-black shadow-brutal-sm p-1.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="material-symbols-outlined text-on-surface text-lg">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-[3px] border-on-surface py-3 flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`
                    px-3 py-2 font-black uppercase text-sm tracking-wide text-on-surface
                    ${isActive
                      ? 'bg-primary-container/20 border-l-[4px] border-primary text-primary'
                      : ''
                    }
                  `}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            })}
            <div className="border-t-[2px] border-on-surface/20 mt-2 pt-2">
              {user ? (
                <div className="flex flex-col gap-2 px-3">
                  <span className="text-xs font-bold text-on-surface-variant truncate font-mono">{user.email}</span>
                  <button
                    className="bg-surface-container border-[3px] border-black shadow-brutal-sm btn-brutal-interactive px-3 py-2 font-black uppercase text-xs text-on-surface text-left hover:bg-secondary-container transition-colors"
                    onClick={() => {
                      signOut()
                      setMobileMenuOpen(false)
                    }}
                  >
                    {t.auth.signOut}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="block px-3 py-2 bg-primary-container text-black font-black uppercase text-xs border-[3px] border-black shadow-brutal-sm btn-brutal-interactive"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t.auth.signIn}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
