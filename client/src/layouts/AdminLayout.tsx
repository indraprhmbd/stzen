import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminSidebar from './AdminSidebar'
import AdminBottomNav from './AdminBottomNav'
import { SidebarSimple, Storefront } from '@phosphor-icons/react'

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin-sidebar-collapsed') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  return (
    <div className="drawer lg:drawer-open">
      <input id="admin-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen bg-[#f4f5f7]">
        <div className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => setCollapsed((v) => !v)} className="hidden lg:inline-flex btn btn-ghost btn-sm border border-zinc-200 bg-white">
              <SidebarSimple size={16} />
            </button>
            <span className="hidden lg:block text-xs font-semibold tracking-widest text-zinc-400 uppercase">Panel Admin</span>
            <span className="lg:hidden text-sm font-black tracking-tight">Panel Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-none">
              <span className="text-sm font-semibold">{user?.email}</span>
              <span className="text-[11px] text-zinc-500">Administrator</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 text-white grid place-items-center text-xs font-bold">
              {(user?.email?.[0] ?? 'A').toUpperCase()}
            </div>
            {/* Bottom nav (mobile) covers the 5 admin sections; the sidebar's
                "Kembali ke Toko" link needs a home here since the drawer is
                desktop-only now. */}
            <a href="/" title="Kembali ke Toko" className="lg:hidden btn btn-ghost btn-sm border border-zinc-200 bg-white">
              <Storefront size={16} />
            </a>
            <button onClick={() => signOut()} className="btn btn-sm bg-white border border-zinc-200 rounded-sm text-xs font-semibold">
              Keluar
            </button>
          </div>
        </div>
        <main className="flex-1 px-4 pt-4 pb-20 md:px-6 md:pt-6 lg:pb-6 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <div className="drawer-side z-20 hidden lg:block">
        <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <AdminSidebar collapsed={collapsed} />
      </div>
      <AdminBottomNav />
    </div>
  )
}
