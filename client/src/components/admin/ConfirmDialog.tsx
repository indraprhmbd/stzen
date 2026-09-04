import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  id: string
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export function openConfirm(id: string) {
  ;(document.getElementById(id) as HTMLDialogElement | null)?.showModal()
}

export function closeConfirm(id: string) {
  ;(document.getElementById(id) as HTMLDialogElement | null)?.close()
}

export default function ConfirmDialog({ id, title, message, confirmLabel = 'Ya, lanjutkan', onConfirm }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: Event) => {
      if ((e.target as HTMLElement).closest('[data-confirm]')) {
        closeConfirm(id)
        onConfirm()
      }
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [id, onConfirm])
  return (
    <dialog id={id} ref={ref} className="modal">
      <div className="modal-box max-w-sm bg-white rounded-none border border-zinc-900 p-6">
        <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {title}
        </h3>
        <p className="text-sm text-zinc-600 mt-2">{message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => closeConfirm(id)} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">
            Batal
          </button>
          <button data-confirm className="bg-red-600 text-white px-5 py-2 text-sm font-semibold hover:bg-red-700">
            {confirmLabel}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  )
}
