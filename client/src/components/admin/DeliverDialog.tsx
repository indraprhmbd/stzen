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
      <div className="modal-box ad-dialog max-w-md p-6">
        <h3 className="font-semibold text-[17px] tracking-tight text-[#1d1d1f]">
          Kirim on-demand
        </h3>
        <p className="text-sm text-[#6e6e73] mt-2">
          {productName}. Kredensial diimpor ke vault lalu dialokasikan ke pesanan ini dalam satu aksi.
        </p>
        <label className="ad-label block mt-4">
          Kredensial
          <textarea
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="email:password | PIN | instruksi..."
            rows={4}
            className="ad-input mt-1.5 font-mono normal-case"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => { setCredential(''); setError(null); closeConfirm(id) }} className="ad-btn">
            Batal
          </button>
          <button onClick={handleConfirm} className="ad-btn ad-btn-dark">
            Kirim + alokasikan
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  )
}
