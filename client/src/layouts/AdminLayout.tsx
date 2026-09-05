import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminBottomNav from './AdminBottomNav'
import '../styles/admin-soft.css'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin-sidebar-collapsed') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  return (
    <div className="admin-soft drawer lg:drawer-open">
      <input id="admin-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col min-h-screen bg-[#fafafa]">
        <main className="flex-1 px-4 pt-4 pb-20 md:px-6 md:pt-6 lg:pb-6 max-w-[1200px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <div className="drawer-side z-20 hidden lg:block">
        <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>
      <AdminBottomNav />
    </div>
  )
}
