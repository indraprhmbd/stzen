import type { ToastData } from '../Toast'

// ─── Admin Toast Stack ──────────────────────────────────────────────────────
// Minimal admin styling (matches the ad- aesthetic), not the brutalist
// storefront ToastStack. Same useToast data + auto-dismiss contract:
//   const { toasts, showToast, dismissToast } = useToast()
//   <AdminToastStack toasts={toasts} onDone={dismissToast} />
// Bottom-right on desktop; above the bottom nav on mobile (mb-14).
const STYLES: Record<ToastData['type'], string> = {
  success: 'bg-[#1d1d1f] text-white',
  error: 'bg-[#fdecec] text-[#b91c1c] border border-[#f5c2c2]',
  info: 'bg-white text-[#1d1d1f] border border-[#e8e8ed]',
}

export default function AdminToastStack({ toasts, onDone }: { toasts: ToastData[]; onDone: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast toast-end mb-14 lg:mb-0 z-[100]">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-[12px] px-4 py-3 text-sm font-medium flex items-center gap-3 ${STYLES[t.type]}`}>
          <span className="break-words">{t.message}</span>
          <button
            onClick={() => onDone(t.id)}
            className="opacity-60 hover:opacity-100 shrink-0 font-bold"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
