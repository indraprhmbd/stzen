import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCopy } from '../hooks/useCopy'
import SearchOverlay from './SearchOverlay'

export default function Header() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const { t, lang, toggle } = useCopy()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const leftLinks = [
    { to: '/', label: t.nav.home },
    { to: '/products', label: t.nav.shop },
    { to: '/dashboard', label: t.nav.myOrders },
  ]

  const rightLinks = [
    { to: '/faq', label: t.footer.faq },
  ]

  const pillBase = `border-2 border-black font-black text-[10px] uppercase px-3 py-1.5 transition-all`

  function pillActive(isActive: boolean) {
    return isActive ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white'
  }

  return (
    <>
      <header
        className={`
          fixed top-0 left-0 right-0 z-50 transition-all
          ${scrolled
            ? 'bg-white border-b-[3px] border-black shadow-comic-sm'
            : 'bg-transparent border-b-0'
          }
        `}
      >
        <div className="w-full max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            {/* ═══ MOBILE: logo + search ═══ */}
            <div className="flex md:hidden items-center justify-between w-full">
              <Link to="/" className="flex items-center">
                <img src="/logo.svg" alt="ST.ZEN" className="h-7 w-auto" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-8 h-8 border-2 border-black bg-white text-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                  aria-label="Search"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                </button>
                <button
                  onClick={toggle}
                  className="h-8 px-2 border-2 border-black bg-white text-black font-black text-[10px] flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  aria-label="Switch language"
                >
                  {lang === 'id' ? 'EN' : 'ID'}
                </button>
              </div>
            </div>

            {/* ═══ DESKTOP: pills layout ═══ */}
            {/* Left: nav pills */}
            <nav className="hidden md:flex items-center gap-2">
              {leftLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`${pillBase} ${pillActive(location.pathname === link.to)}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Center: logo (desktop only) */}
            <Link to="/" className="hidden md:block absolute left-1/2 -translate-x-1/2">
              <img src="/logo.svg" alt="ST.ZEN" className="h-8 w-auto hover:translate-x-[1px] hover:translate-y-[1px] transition-all" />
            </Link>

            {/* Right: nav pills + auth (desktop only) */}
            <div className="hidden md:flex items-center gap-2 relative">
              {rightLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`${pillBase} ${pillActive(location.pathname === link.to)}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {link.label}
                </Link>
              ))}

              {user ? (
                <div ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="w-8 h-8 border-2 border-black bg-primary text-black font-black text-xs flex items-center justify-center hover:bg-black hover:text-primary transition-all"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
                  </button>

                  {menuOpen && (
                    <div onPointerDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-52 bg-white border-2 border-black shadow-comic z-50">
                      <div className="px-3 py-2 border-b-2 border-black bg-neutral">
                        <p className="font-black text-[9px] uppercase text-primary truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {user.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                          {t.nav.myOrders}
                        </Link>
                        <Link to="/how-to-order" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                          {t.footer.howToOrder}
                        </Link>
                      </div>
                      <div className="border-t-2 border-black">
                        <button onClick={() => { signOut(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                          {t.auth.signOut}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className={`${pillBase} bg-primary text-black hover:bg-black hover:text-primary`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {t.auth.signIn}
                </Link>
              )}

              <button
                onClick={toggle}
                className={`${pillBase} bg-white text-black hover:bg-black hover:text-white`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                aria-label="Switch language"
              >
                {lang === 'id' ? 'EN' : 'ID'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
