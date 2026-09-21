import { Link } from 'react-router-dom'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'

export default function HowToOrder() {
  const { t } = useCopy()
  const { steps, title, desc } = t.info.howToOrder

  return (
    <Layout>
      {/* Header */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1
            className="font-black text-sm uppercase tracking-widest bg-neutral text-white border-2 border-black px-3 py-1 -rotate-1"
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

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {steps.map((step, i) => {
          const accents = [
            { bg: 'bg-secondary', text: 'text-white', num: 'bg-primary text-neutral' },
            { bg: 'bg-primary', text: 'text-neutral', num: 'bg-neutral text-white' },
            { bg: 'bg-accent', text: 'text-neutral', num: 'bg-neutral text-white' },
            { bg: 'bg-neutral', text: 'text-primary', num: 'bg-primary text-neutral' },
          ]
          const cfg = accents[i % accents.length]!
          return (
            <div
              key={step.num}
              className={`${cfg.bg} border-comic shadow-comic p-5 flex gap-4 items-start`}
            >
              <span
                className={`inline-flex items-center justify-center w-10 h-10 ${cfg.num} border-2 border-black font-black text-lg shrink-0 -rotate-2 shadow-comic-sm`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {step.num}
              </span>
              <div>
                <h3
                  className={`font-black text-sm uppercase tracking-tight ${cfg.text} leading-none mb-1`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {step.title}
                </h3>
                <p
                  className={`text-xs font-bold ${cfg.text} opacity-80 leading-snug`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {step.desc}
                </p>
              </div>
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
