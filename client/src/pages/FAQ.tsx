import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'

export default function FAQ() {
  const { t } = useCopy()
  const { title, desc, items } = t.info.faq
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Layout>
      {/* Header */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1
            className="font-black text-sm uppercase tracking-widest bg-neutral text-primary border-2 border-black px-3 py-1 -rotate-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </h1>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <p className="text-xs font-bold text-neutral/60" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {desc}
        </p>
      </section>

      {/* Accordion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {items.map((item, i) => {
          const isOpen = openIndex === i
          return (
            <div
              key={i}
              className={`border-comic shadow-comic-sm transition-all ${isOpen ? 'bg-primary' : 'bg-white'}`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left gap-3"
              >
                <span
                  className={`font-black text-xs uppercase tracking-tight ${isOpen ? 'text-neutral' : 'text-neutral'}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {item.q}
                </span>
                <span
                  className={`shrink-0 w-6 h-6 border-2 border-black flex items-center justify-center font-black text-xs transition-all ${isOpen ? 'bg-neutral text-primary -rotate-45' : 'bg-accent text-neutral rotate-0'}`}
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t-2 border-black/10 pt-3">
                  <p
                    className="text-xs font-bold text-neutral/80 leading-snug"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <section className="mb-4">
        <Link
          to="/products"
          className="block bg-neutral border-comic shadow-comic p-5 text-center hover:-translate-y-1 transition-all group"
        >
          <span
            className="font-black text-lg uppercase text-primary"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            MULAI BELANJA
          </span>
          <span className="block text-[10px] font-bold text-white/60 mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Lihat katalog produk kami
          </span>
        </Link>
      </section>
    </Layout>
  )
}
