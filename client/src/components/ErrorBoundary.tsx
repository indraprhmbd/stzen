import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Route-level crash guard. A render error in one lazy page previously
// unmounted the whole tree into a white screen with no recovery path.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route crashed:', error, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white border-[3px] border-black shadow-brutal p-6 max-w-md w-full text-center">
            <h1
              className="font-black text-lg uppercase tracking-tight text-black mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Terjadi kesalahan
            </h1>
            <p className="text-xs font-bold text-zinc-500 mb-4">
              Halaman gagal dirender. Muat ulang, atau kembali ke beranda.
            </p>
            <pre className="font-mono text-[10px] text-left bg-zinc-100 border-2 border-black p-2 mb-4 overflow-x-auto max-h-24 select-all">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2 justify-center">
              <button
                className="bg-primary text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-4 py-2"
                onClick={() => window.location.reload()}
              >
                Muat ulang
              </button>
              <button
                className="bg-white text-black border-2 border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-[11px] px-4 py-2"
                onClick={() => {
                  this.setState({ error: null })
                  window.location.assign('/')
                }}
              >
                Ke beranda
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
