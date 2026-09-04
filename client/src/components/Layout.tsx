import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <Header />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 pt-14 pb-20 md:pb-8">
        {children}
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <BottomNav />
    </div>
  )
}
