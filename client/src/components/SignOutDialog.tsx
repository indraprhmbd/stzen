import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCopy } from '../hooks/useCopy'

export function openSignOutDialog() {
  ;(document.getElementById('signout-dialog') as HTMLDialogElement | null)?.showModal()
}

// Single shared instance, rendered once in Header (always mounted via
// Layout). Profile and the desktop dropdown trigger it via
// openSignOutDialog(). Confirm signs out and returns home.
export default function SignOutDialog() {
  const { t } = useCopy()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function confirm() {
    ;(document.getElementById('signout-dialog') as HTMLDialogElement | null)?.close()
    await signOut()
    navigate('/')
  }

  return (
    <dialog id="signout-dialog" className="modal">
      <div className="modal-box bg-white border-comic shadow-comic p-5 max-w-xs">
        <h3
          className="font-black text-sm uppercase text-black"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.profile.signOutTitle}
        </h3>
        <p className="text-xs font-bold text-zinc-600 mt-1">{t.profile.signOutDesc}</p>
        <div className="flex gap-2 mt-4">
          <form method="dialog" className="flex-1">
            <button
              className="w-full bg-white text-black border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-brutal-interactive"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.profile.cancel}
            </button>
          </form>
          <button
            onClick={confirm}
            className="flex-1 bg-red-600 text-white border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-brutal-interactive"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t.profile.confirmSignOut}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  )
}
