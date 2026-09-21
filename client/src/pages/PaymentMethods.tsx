import { Link } from 'react-router-dom'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'
import Layout from '../components/Layout'

export default function PaymentMethods() {
  const brand = useBrand()
  const { t } = useCopy()
  const { title, desc, methods } = t.info.paymentMethods

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

      {/* Methods */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {methods.map((method, i) => {
          const accents = ['bg-secondary text-white', 'bg-primary text-neutral', 'bg-white text-neutral']
          return (
            <div
              key={method.name}
              className={`${accents[i]} border-comic shadow-comic p-5 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="font-black text-base uppercase tracking-tight leading-none"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {method.name}
                </h3>
                <span
                  className="bg-neutral text-primary font-black text-[8px] uppercase px-2 py-0.5 border-2 border-black -rotate-1"
                >
                  {method.badge}
                </span>
              </div>
              <p
                className={`text-xs font-bold ${i === 0 ? 'text-white/80' : i === 1 ? 'text-neutral/70' : 'text-neutral/70'} leading-snug mb-4 flex-1`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {method.detail}
              </p>
            </div>
          )
        })}
      </div>

      {/* Account details */}
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2
            className="font-black text-xs uppercase tracking-widest bg-accent text-neutral border-2 border-black px-2 py-0.5 -rotate-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            REKENING
          </h2>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <div className="bg-white border-comic shadow-comic p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-[9px] font-bold uppercase text-neutral/50 block mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Bank</span>
              <span className="font-black text-sm uppercase text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {brand.payment.bankName}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-neutral/50 block mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>No. Rekening</span>
              <span className="font-black text-sm text-neutral font-mono">
                {brand.payment.accountNumber}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-neutral/50 block mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Atas Nama</span>
              <span className="font-black text-sm text-neutral" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {brand.payment.accountName}
              </span>
            </div>
          </div>
        </div>
      </section>

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
