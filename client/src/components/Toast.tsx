export type ToastType = 'success' | 'error' | 'info'

export interface ToastData {
  id: number
  message: string
  type: ToastType
}

const STYLES: Record<ToastType, { box: string; icon: string }> = {
  success: { box: 'bg-primary text-black border-black', icon: 'check_circle' },
  error: { box: 'bg-error text-white border-black', icon: 'error' },
  info: { box: 'bg-panel-dark text-white border-black', icon: 'info' },
}

// ─── Toast Stack ────────────────────────────────────────────────────────────
// Brutal bottom-center notifications. Render once per page:
//   const { toasts, showToast, dismissToast } = useToast()
//   <ToastStack toasts={toasts} onDone={dismissToast} />
export default function ToastStack({ toasts, onDone }: { toasts: ToastData[]; onDone: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-max max-w-[92vw]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`border-[3px] shadow-brutal px-4 py-2 flex items-center gap-2 animate-toast-in ${STYLES[t.type].box}`}
        >
          <span className="material-symbols-outlined text-sm shrink-0">{STYLES[t.type].icon}</span>
          <span
            className="font-black text-xs uppercase tracking-wide break-words"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t.message}
          </span>
          <button
            onClick={() => onDone(t.id)}
            className="font-black text-xs opacity-60 hover:opacity-100 shrink-0"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
