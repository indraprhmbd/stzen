import { NavLink } from 'react-router-dom'
import { House, Package, Receipt, Storefront } from '@phosphor-icons/react'

export default function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  const width = collapsed ? 'w-16' : 'w-56'
  const linkBase = `flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-colors ${collapsed ? 'justify-center px-2' : ''}`
  const active = 'bg-white text-zinc-900'
  const inactive = 'text-white/60 hover:bg-white/10 hover:text-white'

  return (
    <aside className={`${width} min-h-full bg-[#0f172a] text-white flex flex-col shrink-0 transition-all duration-200`}>
      <div className={`h-14 flex items-center border-b border-white/10 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}>
        <div className="w-8 h-8 rounded bg-white grid place-items-center shrink-0">
          <img src="/logo.svg" alt="st.zen" className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-none">
            <div className="font-black text-sm tracking-wide">ST.ZEN</div>
            <div className="text-[10px] tracking-widest text-white/50 font-semibold">ADMIN POS</div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-1 mt-2">
        {!collapsed && <div className="text-[10px] font-bold tracking-widest text-white/30 px-3 mb-1">MENU</div>}
        <NavLink to="/admin" end title={collapsed ? 'Ringkasan' : undefined} className={({ isActive }) => `${linkBase} ${isActive ? active : inactive} rounded-sm`}>
          <House size={18} weight="regular" />
          {!collapsed && 'Ringkasan'}
        </NavLink>
        <NavLink to="/admin/products" title={collapsed ? 'Produk' : undefined} className={({ isActive }) => `${linkBase} ${isActive ? active : inactive} rounded-sm`}>
          <Package size={18} weight="regular" />
          {!collapsed && 'Produk'}
        </NavLink>
        <NavLink to="/admin/orders" title={collapsed ? 'Pesanan' : undefined} className={({ isActive }) => `${linkBase} ${isActive ? active : inactive} rounded-sm`}>
          <Receipt size={18} weight="regular" />
          {!collapsed && 'Pesanan'}
        </NavLink>
      </nav>

      <div className="p-2 border-t border-white/10">
        <a href="/" title={collapsed ? 'Kembali ke Toko' : undefined} className={`flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white transition-colors ${collapsed ? 'justify-center py-2' : 'px-3 py-2'}`}>
          <Storefront size={16} weight="regular" />
          {!collapsed && 'Kembali ke Toko'}
        </a>
      </div>
    </aside>
  )
}
