import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'
import { usePublicSettings } from '../hooks/usePublicSettings'
import Layout from '../components/Layout'
import Marquee from '../components/Marquee'
import ShopCtaCardSlim from '../components/ShopCtaCardSlim'

function Catalog() {
  const { t } = useCopy()
  const stripRef = useRef<HTMLDivElement>(null)
  // Public store announcement (admin settings, store.announcement).
  // Always on while set: admin controls visibility by clearing the text.
  const { announcement } = usePublicSettings()

  // Desktop has no carousel buttons: vertical wheel over the strip scrolls
  // it horizontally instead of moving the page.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    let snapTimer: ReturnType<typeof setTimeout> | null = null
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      // Snap (even proximity) grabs between ticks and reads as stuck -
      // suspend it while wheeling, restore 200ms after the last tick.
      el.style.scrollSnapType = 'none'
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (snapTimer) clearTimeout(snapTimer)
      snapTimer = setTimeout(() => {
        el.style.scrollSnapType = ''
      }, 200)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      if (snapTimer) clearTimeout(snapTimer)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <Layout>

      {/* ═══ HERO 2/3 + FEATURED CARD 1/3 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {/* Hero - 2/3 */}
        <section className="md:col-span-2 relative overflow-hidden bg-secondary border-comic shadow-comic p-4 md:p-6 bg-halftone">
          <div className="absolute inset-0 bg-white/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center md:text-left">
            <img
              src="/logo.svg"
              alt="ST.ZEN VAULT"
              className="w-[120px] md:w-[180px] h-auto drop-shadow-[3px_3px_0_#0D110F] -rotate-1 shrink-0 select-none"
            />
            <div className="flex flex-col items-center md:items-start gap-2">
              <span className="inline-block bg-white text-neutral font-black border-2 border-black px-3 py-0.5 text-[10px] uppercase shadow-comic-sm">
                {t.hero.statusPill}
              </span>
              <p className="font-black text-neutral text-xs uppercase tracking-wide bg-white border-2 border-black inline-block px-2 py-1 leading-tight">
                {t.hero.title1} {t.hero.title2}
              </p>
            </div>
          </div>
        </section>

        {/* Shop CTA card - 1/3 */}
        <ShopCtaCardSlim />
        <Link
          to="/products"
          className="hidden md:flex bg-white border-comic shadow-comic p-3 md:p-4 flex-col justify-between hover:-translate-y-1 transition-all group"
        >
          <div className="flex flex-col gap-1 md:gap-1.5">
            <span className="bg-primary text-neutral font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black w-fit shadow-comic-sm">
              {t.nav.shop.toUpperCase()}
            </span>
            <h3
              className="font-black text-lg md:text-2xl uppercase text-neutral leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.hero.cardTitle1}
            </h3>
            <h3
              className="font-black text-lg md:text-2xl uppercase text-secondary leading-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.hero.cardTitle2}
            </h3>
            <p
              className="text-[10px] font-bold text-neutral/60 leading-tight mt-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {t.hero.cardTagline}
            </p>
          </div>
          <div className="mt-2 md:mt-3 border-t-4 border-black pt-1.5 md:pt-2 flex items-center justify-between">
            <span className="font-black text-xs uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t.products.title}
            </span>
            <span className="bg-primary text-neutral font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black group-hover:rotate-1 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </Link>
      </div>

      {/* Announcement marquee above hero: admin text wins, falls back to default copy */}
      <Marquee items={announcement ? [announcement] : t.marquee} className="mb-3" />

      {/* ═══ HOW IT WORKS - comic strip ═══ */}
      <section className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest text-neutral bg-primary border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.howItWorks.title}
          </h2>
          <div className="flex-1 h-[3px] bg-panel-dark" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {t.howItWorks.steps.map((step) => {
            return (
              <div key={step.num} className="bg-white border-comic shadow-comic p-2.5 flex gap-2 items-start transition-all duration-[60ms] ease-out md:hover:-translate-x-[2px] md:hover:-translate-y-[2px] md:hover:shadow-[7px_7px_0px_0px_#0D110F]">
                <span className="inline-flex items-center justify-center w-7 h-7 bg-primary text-neutral border-2 border-black font-black text-xs shrink-0">
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

      {/* ═══ WHY ST.ZEN - comic panels ═══ */}
      <section className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest bg-accent text-neutral border-2 border-black px-2 py-0.5 -rotate-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.whyUs.title}
          </h2>
          <div className="flex-1 h-[3px] bg-panel-dark" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {t.whyUs.items.map((item, i) => {
            const icons = ['verified', 'lock', 'chat']
            return (
              <div key={item.title} className="bg-white border-comic shadow-comic p-3 flex gap-2.5 items-start transition-all duration-[60ms] ease-out md:hover:-translate-x-[2px] md:hover:-translate-y-[2px] md:hover:shadow-[7px_7px_0px_0px_#0D110F]">
                <span className="material-symbols-outlined text-lg text-neutral bg-primary border-2 border-black w-8 h-8 grid place-items-center shrink-0">{icons[i]}</span>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-tight text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {item.title}
                  </h3>
                  <p className="text-[10px] font-bold leading-tight mt-1 text-neutral/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ═══ TESTIMONIALS - comic ═══ */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-black text-xs uppercase tracking-widest bg-panel-dark text-white border-2 border-black px-2 py-0.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t.testimonials.title}
          </h2>
          <div className="flex-1 h-[3px] bg-panel-dark" />
        </div>
        <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2 -mx-4 pl-6 pr-4 scroll-pl-6 snap-x snap-proximity md:mx-0 md:px-0 md:scroll-px-0">
          {t.testimonials.items.map((item) => (
            <div key={item.name} className="bg-white border-comic shadow-comic p-3 shrink-0 w-[270px] md:w-[300px] snap-start transition-all duration-[60ms] ease-out md:hover:-translate-x-[2px] md:hover:-translate-y-[2px] md:hover:shadow-[7px_7px_0px_0px_#0D110F]">
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

      {/* ═══ BOTTOM CTA - full-width comic panel ═══ */}
      <section className="mb-4">
        <Link
          to="/products"
          className="block bg-panel-dark border-comic shadow-comic p-6 md:p-8 relative overflow-hidden hover:-translate-y-1 transition-all group"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="bg-primary text-neutral font-black text-[9px] uppercase px-2 py-0.5 border-2 border-black shadow-comic-sm">
                SHOP
              </span>
              <h2
                className="font-black text-2xl md:text-3xl uppercase text-white leading-none"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t.products.title}
              </h2>
            </div>
            <span className="bg-primary text-neutral font-black text-sm uppercase px-5 py-2 border-2 border-black group-hover:rotate-1 transition-all shadow-comic-sm shrink-0">
              {t.nav.shop.toUpperCase()} <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </Link>
      </section>
    </Layout>
  )
}

export default Catalog
