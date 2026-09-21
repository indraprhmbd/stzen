import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCopy } from '../hooks/useCopy'
import SearchOverlay from './SearchOverlay'
import { useRafScroll } from '../hooks/useRafScroll'
import SignOutDialog, { openSignOutDialog } from './SignOutDialog'

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const { t, lang, toggle } = useCopy()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useRafScroll((y) => setScrolled(y > 10))

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
                    className="w-8 h-8 border-2 border-black bg-primary text-black font-black text-xs flex items-center justify-center hover:bg-black hover:text-white transition-all"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
                  </button>

                  {menuOpen && (
                    <div onPointerDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-52 bg-white border-2 border-black shadow-comic z-50">
                      <div className="px-3 py-2 border-b-2 border-black bg-neutral">
                        <p className="font-black text-[9px] uppercase text-white truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {user.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                          {t.nav.myOrders}
                        </Link>
                        {user.app_metadata?.role === 'admin' && (
                          <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            {t.nav.admin}
                          </Link>
                        )}
                        <Link to="/how-to-order" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                          {t.footer.howToOrder}
                        </Link>
                        <Link to="/syarat-ketentuan" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          {t.footer.terms}
                        </Link>
                        <Link to="/kebijakan-privasi" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          {t.footer.privacy}
                        </Link>
                        <Link to="/pengembalian-dana" className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-black hover:bg-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }} onClick={() => setMenuOpen(false)}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                          {t.footer.refunds}
                        </Link>
                      </div>
                      <div className="border-t-2 border-black">
                        <button onClick={() => { openSignOutDialog(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
                  className={`${pillBase} bg-primary text-black hover:bg-black hover:text-white`}
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
      <SignOutDialog />
    </>
  )
}
