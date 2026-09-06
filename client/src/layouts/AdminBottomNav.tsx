import { NavLink } from 'react-router-dom'
import { Dashboard, Cube, ShoppingBag, ClockRotateRight, Settings } from 'iconoir-react'

// ─── Admin Bottom Nav (mobile) ──────────────────────────────────────────────
// 5 sections pinned to 1/4 width each with horizontal scroll, same pattern as
// before. Solid white bar, active tab ink plus dot.
const tabs = [
  { to: '/admin', label: 'Ringkasan', Icon: Dashboard, end: true },
  { to: '/admin/products', label: 'Produk', Icon: Cube, end: false },
  { to: '/admin/orders', label: 'Pesanan', Icon: ShoppingBag, end: false },
  { to: '/admin/history', label: 'Riwayat', Icon: ClockRotateRight, end: false },
  { to: '/admin/settings', label: 'Pengaturan', Icon: Settings, end: false },
]

export default function AdminBottomNav() {
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
              className={({ isActive }) =>
                `flex-none basis-1/4 shrink-0 flex flex-col items-center justify-center gap-1 h-14 transition-colors ${
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
