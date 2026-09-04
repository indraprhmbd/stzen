import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'

const tabs = [
  { to: '/', icon: 'house', labelKey: 'home' as const },
  { to: '/products', icon: 'storefront', labelKey: 'shop' as const },
  { to: '/dashboard', icon: 'receipt_long', labelKey: 'myOrders' as const },
]

export default function BottomNav() {
  const location = useLocation()
  const { t } = useCopy()
  const [visible, setVisible] = useState(true)
  const [lastScroll, setLastScroll] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastScroll && y > 80) {
        setVisible(false)
      } else {
        setVisible(true)
      }
      setLastScroll(y)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [lastScroll])

  function isActive(to: string) {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 z-50 bg-white border-t-[3px] border-black
        transition-transform duration-200
        ${visible ? 'translate-y-0' : 'translate-y-full'}
        md:hidden
      `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`
                flex flex-col items-center justify-center gap-0.5 w-16 h-14
                transition-colors
                ${active ? 'text-primary' : 'text-black/50'}
              `}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${active ? 'fill-current' : ''}`}
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {tab.icon}
              </span>
              <span
                className="font-black text-[9px] uppercase leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.nav[tab.labelKey]}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
