import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCopy } from '../hooks/useCopy'
import { openSignOutDialog } from '../components/SignOutDialog'
import Layout from '../components/Layout'

// ─── Profile (account hub) ──────────────────────────────────────────────────
// Mobile-first home for everything the header dropdown gates on desktop:
// identity, sign in/out, language, shortcut links. Reached via the rightmost
// bottom-nav tab on mobile, direct URL on desktop.

export default function Profile() {
  const { user } = useAuth()
  const { t, lang, toggle } = useCopy()

  const isAdmin = user?.app_metadata?.role === 'admin'
  const links = [
    ...(isAdmin ? [{ to: '/admin', label: t.nav.admin }] : []),
    { to: '/dashboard', label: t.nav.myOrders },
    { to: '/how-to-order', label: t.footer.howToOrder },
    { to: '/payment-methods', label: t.footer.paymentMethods },
    { to: '/faq', label: t.footer.faq },
    { to: '/syarat-ketentuan', label: t.footer.terms },
    { to: '/kebijakan-privasi', label: t.footer.privacy },
    { to: '/pengembalian-dana', label: t.footer.refunds },
  ]

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <h1
          className="font-black text-sm uppercase tracking-widest bg-panel-dark text-white border-2 border-black px-3 py-1 -rotate-1 w-fit mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t.profile.title}
        </h1>

        {/* Identity */}
        <div className="bg-white border-comic shadow-comic p-4 mb-3">
          {user ? (
            <>
              <p className="font-mono font-bold text-sm text-black truncate">{user.email}</p>
              <button
                onClick={openSignOutDialog}
                className="mt-3 w-full bg-white text-red-600 border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-brutal-interactive"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.auth.signOut}
              </button>
            </>
          ) : (
            <>
              <p className="font-black text-sm uppercase text-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {t.profile.guest}
              </p>
              <p className="text-xs font-bold text-zinc-600 mt-1">{t.profile.guestHint}</p>
              <Link
                to="/login"
                className="mt-3 block text-center bg-primary text-black border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-brutal-interactive"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.auth.signIn}
              </Link>
            </>
          )}
        </div>

        {/* Language */}
        <div className="bg-white border-comic shadow-comic p-4 mb-3">
          <p className="font-black text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.profile.language}
          </p>
          <div className="flex gap-2">
            {(['id', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => { if (lang !== l) toggle() }}
                className={`flex-1 border-2 border-black font-black text-xs uppercase px-4 py-2 shadow-comic-sm btn-brutal-interactive ${lang === l ? 'bg-panel-dark text-white' : 'bg-white text-black'}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {l === 'id' ? 'ID' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="bg-white border-comic shadow-comic p-4">
          <p className="font-black text-[10px] uppercase tracking-widest text-zinc-500 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.profile.quickLinks}
          </p>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center justify-between border-b-2 border-black/10 py-2.5 text-xs font-black uppercase text-black last:border-b-0"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {l.label}
              <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
