interface CredentialViewerProps {
  credentials: string
  instructions?: string | null
  onCopy: () => void
  onReport?: () => void
}

export default function CredentialViewer({ credentials, instructions, onCopy, onReport }: CredentialViewerProps) {
  return (
    <div className="bg-neutral border-[4px] border-secondary shadow-pop-pink rounded-sm p-6">
      {/* Top bar */}
      <div className="flex justify-between items-center border-b-2 border-primary/30 pb-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-neutral bg-error" />
            <div className="w-3 h-3 rounded-full border-2 border-neutral bg-warning" />
            <div className="w-3 h-3 rounded-full border-2 border-neutral bg-success" />
          </div>
          <span className="font-mono text-xs text-primary uppercase tracking-widest">
            <span className="cursor-blink">_</span> DECRYPTED VAULT PAYLOAD
          </span>
        </div>
        <span className="badge bg-primary border-[2px] border-neutral text-neutral font-mono font-bold text-[10px]">
          READY
        </span>
      </div>

      {/* Credentials */}
      <pre className="font-mono text-sm text-primary font-bold bg-black/50 p-4 border border-primary/40 select-all overflow-x-auto whitespace-pre-wrap mb-4">
        {credentials}
      </pre>

      {/* Instructions */}
      {instructions && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-neutral/40 mb-1 uppercase tracking-wider">
            USAGE INSTRUCTIONS
          </p>
          <p className="text-xs font-bold text-neutral/80">
            {instructions}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-primary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral py-2"
          onClick={onCopy}
        >
          COPY CREDENTIALS
        </button>
        {onReport && (
          <button
            className="bg-secondary border-[3px] border-neutral shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs text-neutral px-4 py-2"
            onClick={onReport}
          >
            REPORT ISSUE
          </button>
        )}
      </div>
    </div>
  )
}
