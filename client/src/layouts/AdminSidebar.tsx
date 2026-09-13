import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Dashboard, Cube, ShoppingBag, ClockRotateRight, Settings, Book, User, Shop, SidebarCollapse, LogOut } from 'iconoir-react'

const items = [
  { to: '/admin', label: 'Ringkasan', Icon: Dashboard, end: true },
  { to: '/admin/products', label: 'Produk', Icon: Cube, end: false },
  { to: '/admin/orders', label: 'Pesanan', Icon: ShoppingBag, end: false },
  { to: '/admin/history', label: 'Riwayat', Icon: ClockRotateRight, end: false },
  { to: '/admin/settings', label: 'Pengaturan', Icon: Settings, end: false },
  { to: '/admin/guide', label: 'Panduan', Icon: Book, end: false },
  { to: '/admin/account', label: 'Akun', Icon: User, end: false },
]

export default function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, signOut } = useAuth()
  const width = collapsed ? 'w-[68px]' : 'w-60'
  return (
    <aside className={`${width} min-h-full bg-white border-r border-[#e8e8ed] flex flex-col shrink-0 transition-all duration-200`}>
      <div className={`min-h-14 flex items-center border-b border-[#f1f1f4] py-2 ${collapsed ? 'flex-col justify-center gap-1.5 px-2' : 'gap-2.5 px-4'}`}>
        <div className="w-8 h-8 rounded-[9px] bg-[#f5f5f7] grid place-items-center shrink-0">
          <img src="/logo.svg" alt="st.zen" className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-none">
            <div className="font-semibold text-sm tracking-tight text-[#1d1d1f]">ST.ZEN</div>
            <div className="text-[10px] tracking-widest text-[#6e6e73] font-medium mt-0.5">ADMIN</div>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          className={`grid place-items-center rounded-[9px] text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] ${collapsed ? 'w-8 h-8' : 'w-8 h-8 ml-auto'}`}
        >
          <SidebarCollapse width={18} height={18} strokeWidth={1.5} className={collapsed ? 'scale-x-[-1]' : ''} />
        </button>
      </div>

      <nav className="flex-1 p-2.5 flex flex-col gap-0.5 mt-1">
        {!collapsed && <div className="text-[10px] font-semibold tracking-widest text-[#aeaeb2] px-3 mb-1">MENU</div>}
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `ad-navlink ${isActive ? 'ad-navlink-active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <Icon width={20} height={20} strokeWidth={1.5} />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2.5 border-t border-[#f1f1f4] flex flex-col gap-1">
        {collapsed ? (
          <button onClick={() => signOut()} title="Keluar" aria-label="Keluar" className="grid place-items-center py-2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
            <LogOut width={18} height={18} strokeWidth={1.5} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white grid place-items-center text-xs font-semibold shrink-0">
              {(user?.email?.[0] ?? 'A').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[13px] font-medium text-[#1d1d1f] truncate">{user?.email}</div>
              <div className="text-[11px] text-[#6e6e73]">Administrator</div>
            </div>
            <button onClick={() => signOut()} title="Keluar" aria-label="Keluar" className="grid w-8 h-8 place-items-center rounded-[9px] text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
              <LogOut width={17} height={17} strokeWidth={1.5} />
            </button>
          </div>
        )}
        <a href="/" title={collapsed ? 'Kembali ke Toko' : undefined} className={`ad-navlink ${collapsed ? 'justify-center px-2' : ''}`}>
          <Shop width={18} height={18} strokeWidth={1.5} />
          {!collapsed && 'Kembali ke Toko'}
        </a>
      </div>
    </aside>
  )
}
