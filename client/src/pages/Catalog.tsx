import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'
import Marquee from '../components/Marquee'
import ShopCtaCardSlim from '../components/ShopCtaCardSlim'

function Catalog() {
  const { t } = useCopy()

  return (
    <Layout>
      {/* ═══ HERO 2/3 + FEATURED CARD 1/3 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* Hero — 2/3 */}
        <section className="md:col-span-2 relative overflow-hidden bg-secondary border-comic shadow-comic p-4 md:p-6 bg-halftone">
          <div className="absolute inset-0 bg-white/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center md:text-left">
            <img
              src="/logo.svg"
              alt="ST.ZEN VAULT"
              className="w-[120px] md:w-[180px] h-auto drop-shadow-[3px_3px_0_#0D110F] -rotate-1 shrink-0 select-none"
            />
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="inline-block bg-primary text-neutral font-black border-2 border-black px-3 py-0.5 text-[10px] uppercase -rotate-1 shadow-comic-sm">
                {t.hero.statusPill}
              </span>
              <p className="font-black text-neutral text-xs uppercase tracking-wide bg-primary border-2 border-black inline-block px-2 py-1 rotate-1 leading-tight">
                {t.hero.title1} {t.hero.title2}
              </p>
            </div>
          </div>
        </section>

        {/* Shop CTA card — 1/3 */}
        <ShopCtaCardSlim />
        <Link
          to="/products"
          className="hidden md:flex bg-white border-comic shadow-comic p-3 md:p-4 flex-col justify-between hover:-translate-y-1 transition-all group"
        >
          <div className="flex flex-col gap-1 md:gap-1.5">
            <span className="bg-secondary text-white font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black w-fit -rotate-2 shadow-comic-sm">
              {t.nav.shop.toUpperCase()}
            </span>
            <h3
              className="font-black text-lg md:text-2xl uppercase text-neutral leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.hero.cta.split(' ')[0]}
            </h3>
            <h3
              className="font-black text-lg md:text-2xl uppercase text-primary leading-none text-shadow-comic"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.hero.cta.split(' ').slice(1).join(' ')}
            </h3>
            <p
              className="text-[10px] font-bold text-neutral/60 leading-tight mt-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {t.hero.tagline}
            </p>
          </div>
          <div className="mt-2 md:mt-3 border-t-4 border-black pt-1.5 md:pt-2 flex items-center justify-between">
            <span className="font-black text-xs uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t.products.title}
            </span>
            <span className="bg-neutral text-primary font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black -rotate-1 group-hover:rotate-0 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </Link>
      </div>

      <Marquee items={t.marquee} />

      {/* ═══ HOW IT WORKS — comic strip ═══ */}
      <section className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest text-neutral bg-primary border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.howItWorks.title}
          </h2>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {t.howItWorks.steps.map((step, i) => {
            const badgeColors = ['bg-secondary text-white', 'bg-primary text-neutral', 'bg-accent text-neutral', 'bg-neutral text-primary']
            return (
              <div key={step.num} className="bg-white border-comic shadow-comic p-2.5 flex gap-2 items-start">
                <span className={`inline-flex items-center justify-center w-7 h-7 ${badgeColors[i]} border-2 border-black font-black text-xs shrink-0 -rotate-2`}>
                  {step.num}
                </span>
                <div className="min-w-0">
                  <h3 className="font-black text-[11px] uppercase tracking-tight text-neutral leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {step.title}
                  </h3>
                  <p className="text-[10px] font-bold text-neutral leading-tight mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ═══ WHY ST.ZEN — comic panels ═══ */}
      <section className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest bg-accent text-neutral border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.whyUs.title}
          </h2>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { icon: 'bolt', accent: 'bg-secondary border-secondary', text: 'text-white', iconColor: 'text-neutral' },
            { icon: 'lock', accent: 'bg-primary border-black', text: 'text-neutral', iconColor: 'text-neutral' },
            { icon: 'verified', accent: 'bg-accent border-black', text: 'text-neutral', iconColor: 'text-neutral' },
          ].map((cfg, i) => {
            const item = t.whyUs.items[i]
            return (
              <div key={item.title} className={`${cfg.accent} border-comic shadow-comic p-3 flex gap-2.5 items-start`}>
                <span className={`material-symbols-outlined text-lg ${(cfg as any).iconColor || cfg.text} bg-white border-2 border-black w-8 h-8 grid place-items-center shrink-0 -rotate-2`}>{cfg.icon}</span>
                <div>
                  <h3 className={`font-black text-xs uppercase tracking-tight ${cfg.text === 'text-white' ? 'text-white' : 'text-neutral'}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {item.title}
                  </h3>
                  <p className={`text-[10px] font-bold leading-tight mt-1 ${cfg.text === 'text-white' ? 'text-white/80' : 'text-neutral/70'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ═══ TESTIMONIALS — comic ═══ */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest bg-neutral text-primary border-2 border-black px-2 py-0.5 rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.testimonials.title}
          </h2>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {t.testimonials.items.map((item) => (
            <div key={item.name} className="bg-white border-comic shadow-comic p-3">
              <div className="flex gap-0.5 mb-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-[10px] text-accent">star</span>
                ))}
              </div>
              <p className="text-[11px] font-bold text-neutral leading-snug mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                "{item.quote}"
              </p>
              <div className="border-t-2 border-black/10 pt-2 flex items-center justify-between">
                <div>
                  <p className="font-black text-[10px] uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{item.name}</p>
                  <p className="text-[8px] font-bold text-neutral/60">{item.product}</p>
                </div>
                <span className="bg-primary text-neutral font-black text-[7px] uppercase px-1.5 py-0.5 border-2 border-black -rotate-1">
                  {t.products.verifiedBuyer}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BOTTOM CTA — full-width comic panel ═══ */}
      <section className="mb-4">
        <Link
          to="/products"
          className="block bg-neutral border-comic shadow-comic p-6 md:p-8 relative overflow-hidden hover:-translate-y-1 transition-all group"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="bg-primary text-neutral font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black -rotate-2 shadow-comic-sm">
                SHOP
              </span>
              <h2
                className="font-black text-2xl md:text-3xl uppercase text-primary leading-none text-shadow-comic"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.products.title}
              </h2>
              <p className="text-xs font-bold text-white/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {t.hero.tagline}
              </p>
            </div>
            <span className="bg-primary text-neutral font-black text-sm uppercase px-5 py-2 border-2 border-black -rotate-1 group-hover:rotate-1 transition-all shadow-comic-sm shrink-0">
              {t.nav.shop.toUpperCase()} <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </Link>
      </section>
    </Layout>
  )
}

export default Catalog
