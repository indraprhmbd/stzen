import { NavLink } from 'react-router-dom'
import { House, Package, Receipt, ClockCounterClockwise, GearSix } from '@phosphor-icons/react'

// ─── Admin Bottom Nav (mobile) ──────────────────────────────────────────────
// Mirrors the storefront's BottomNav pattern for the admin dashboard. Unlike
// the storefront (3 items, all fit), admin has 5 sections — each item is
// pinned to exactly 1/4 of the bar's width (basis-1/4 shrink-0), so 4 are
// always visible and the 5th pushes the row to 125% width. overflow-x-auto
// then scrolls, starting flush left (no snap/centering), so nothing shifts
// on load and the 5th item is one swipe away.

const tabs = [
  { to: '/admin', label: 'Ringkasan', icon: House, end: true },
  { to: '/admin/products', label: 'Produk', icon: Package, end: false },
  { to: '/admin/orders', label: 'Pesanan', icon: Receipt, end: false },
  { to: '/admin/history', label: 'Riwayat', icon: ClockCounterClockwise, end: false },
  { to: '/admin/settings', label: 'Pengaturan', icon: GearSix, end: false },
]

export default function AdminBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-white/10 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex-none basis-1/4 shrink-0 flex flex-col items-center justify-center gap-0.5 h-14 transition-colors ${
                  isActive ? 'text-white' : 'text-white/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                  <span className="font-semibold text-[10px] uppercase tracking-wide leading-none">{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
