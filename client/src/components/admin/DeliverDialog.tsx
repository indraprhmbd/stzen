import { useState } from 'react'
import { openConfirm, closeConfirm } from './ConfirmDialog'

interface DeliverDialogProps {
  id: string
  productName: string
  onConfirm: (credential: string) => void
}

export { openConfirm }

// On-demand delivery dialog: collects the credential that the server imports,
// allocates, and delivers atomically. Vault orders skip this dialog entirely.
export default function DeliverDialog({ id, productName, onConfirm }: DeliverDialogProps) {
  const [credential, setCredential] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    if (!credential.trim()) {
      setError('Tempel kredensial dulu sebelum kirim')
      return
    }
    const value = credential
    setCredential('')
    setError(null)
    closeConfirm(id)
    onConfirm(value)
  }

  return (
    <dialog id={id} className="modal">
      <div className="modal-box max-w-md bg-white rounded-none border border-zinc-900 p-6">
        <h3 className="font-black text-base tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Kirim on-demand
        </h3>
        <p className="text-sm text-zinc-600 mt-2">
          {productName} — kredensial diimpor ke vault lalu dialokasikan ke pesanan ini dalam satu aksi.
        </p>
        <label className="block mt-4 text-xs font-bold tracking-widest uppercase text-zinc-500">
          Kredensial
          <textarea
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="email:password | PIN | instruksi..."
            rows={4}
            className="mt-1 w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono normal-case tracking-normal"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => { setCredential(''); setError(null); closeConfirm(id) }} className="border border-zinc-200 px-5 py-2 text-sm font-semibold">
            Batal
          </button>
          <button onClick={handleConfirm} className="bg-zinc-900 text-white px-5 py-2 text-sm font-semibold hover:bg-black">
            Kirim + alokasikan
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
