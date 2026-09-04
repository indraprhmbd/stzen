import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'

export default function ShopCtaCardSlim() {
  const { t } = useCopy()

  return (
    <Link
      to="/products"
      className="md:hidden bg-white border-comic shadow-comic px-3 py-2 flex items-center justify-between gap-2 group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="bg-secondary text-white font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black -rotate-2 shadow-comic-sm shrink-0">
          {t.nav.shop.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p
            className="font-black text-sm uppercase text-neutral leading-none truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t.hero.cta}
          </p>
          <p
            className="text-[10px] font-bold text-neutral/60 leading-tight truncate mt-0.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {t.hero.tagline}
          </p>
        </div>
      </div>
      <span className="bg-neutral text-primary font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black -rotate-1 group-hover:rotate-0 transition-all shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </span>
    </Link>
  )
}
