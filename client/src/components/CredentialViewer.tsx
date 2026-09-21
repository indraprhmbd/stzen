interface CredentialViewerProps {
  credentials: string
  instructions?: string | null
  onCopy: () => void
  onReport?: () => void
}

export default function CredentialViewer({ credentials, instructions, onCopy, onReport }: CredentialViewerProps) {
  return (
    <div className="bg-on-surface border-[4px] border-secondary-container shadow-3d-pop rounded-sm p-5 relative overflow-hidden">
      {/* Decorative corner dots */}
      <div className="absolute top-2 left-2 w-3 h-3 bg-primary-container border-2 border-black rounded-full" />
      <div className="absolute top-2 right-2 w-3 h-3 bg-primary-container border-2 border-black rounded-full" />
      <div className="absolute bottom-2 left-2 w-3 h-3 bg-primary-container border-2 border-black rounded-full" />
      <div className="absolute bottom-2 right-2 w-3 h-3 bg-primary-container border-2 border-black rounded-full" />

      {/* Top bar */}
      <div className="flex justify-between items-center border-b-2 border-primary-container/30 pb-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-black bg-error" />
            <div className="w-3 h-3 rounded-full border-2 border-black bg-warning" />
            <div className="w-3 h-3 rounded-full border-2 border-black bg-primary-container" />
          </div>
          <span className="font-mono text-xs text-white uppercase tracking-widest">
            <span className="cursor-blink">_</span> DECRYPTED VAULT PAYLOAD
          </span>
        </div>
        <span className="badge bg-primary-container text-black border-2 border-black font-mono font-bold text-[10px]">
          READY
        </span>
      </div>

      {/* Credentials */}
      <pre className="font-mono text-sm text-white font-bold bg-dark-sage/50 p-4 border border-primary-container/40 select-all overflow-x-auto whitespace-pre-wrap mb-4">
        {credentials}
      </pre>

      {/* Instructions */}
      {instructions && (
        <div className="mb-4 bg-tertiary-container/20 p-3 border-l-[3px] border-tertiary">
          <p className="text-[10px] font-bold text-inverse-on-surface/40 mb-1 uppercase tracking-wider">
            USAGE INSTRUCTIONS
          </p>
          <p className="text-xs font-bold text-inverse-on-surface/80">
            {instructions}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="flex-1 bg-primary-container text-black border-[3px] border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs py-2"
          onClick={onCopy}
        >
          COPY CREDENTIALS
        </button>
        {onReport && (
          <button
            className="bg-secondary-container text-black border-[3px] border-black shadow-brutal-sm btn-brutal-interactive font-black uppercase text-xs px-4 py-2"
            onClick={onReport}
          >
            REPORT ISSUE
          </button>
        )}
      </div>
    </div>
  )
}
