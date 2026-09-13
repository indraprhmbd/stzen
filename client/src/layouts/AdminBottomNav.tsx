import { NavLink, useLocation } from 'react-router-dom'
import { Dashboard, Cube, ShoppingBag, ClockRotateRight, Settings, Book, User } from 'iconoir-react'

// ─── Admin Bottom Nav (mobile) ──────────────────────────────────────────────
// 7 sections pinned with horizontal scroll. Solid white bar, active tab ink
// plus dot. Akun is the dedicated admin account menu (password, sessions,
// back to store) - same page as the desktop sidebar entry.
const tabs = [
  { to: '/admin', label: 'Ringkasan', Icon: Dashboard, end: true },
  { to: '/admin/products', label: 'Produk', Icon: Cube, end: false },
  { to: '/admin/orders', label: 'Pesanan', Icon: ShoppingBag, end: false },
  { to: '/admin/history', label: 'Riwayat', Icon: ClockRotateRight, end: false },
  { to: '/admin/settings', label: 'Pengaturan', Icon: Settings, end: false },
  { to: '/admin/guide', label: 'Panduan', Icon: Book, end: false },
  { to: '/admin/account', label: 'Akun', Icon: User, end: false },
]

export default function AdminBottomNav() {
  const { pathname } = useLocation()

  // Tapping the already-active tab scrolls to top (same-route taps do not
  // navigate, so without this the tap feels dead on long pages).
  function handleTap(to: string, end: boolean) {
    const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e8ed] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.Icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              onClick={() => handleTap(tab.to, tab.end)}
              className={({ isActive }) =>
                `flex-none basis-1/5 shrink-0 flex flex-col items-center justify-center gap-1 h-14 transition-colors ${
                  isActive ? 'text-[#1d1d1f]' : 'text-[#aeaeb2]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon width={22} height={22} strokeWidth={isActive ? 2 : 1.5} />
                  <span className={`text-[10px] leading-none tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
