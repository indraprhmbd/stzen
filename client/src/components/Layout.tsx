import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <Header />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <Footer />
    </div>
  )
}
