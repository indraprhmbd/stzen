import { Link } from 'react-router-dom'
import { useBrand } from '../hooks/useBrand'
import { useCopy } from '../hooks/useCopy'

export default function Footer() {
  const brand = useBrand()
  const { t } = useCopy()
  const year = new Date().getFullYear()

  const heading = {
    fontFamily: "'Space Grotesk', sans-serif",
  } as const

  return (
    <footer className="bg-on-surface border-t-[3px] border-primary-container mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 pt-10 pb-5">
        {/* Top: Brand strip */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-block">
              <img src="/logo.svg" alt={brand.name} className="h-14 w-14" />
            </Link>
            <div>
              <h2
                className="text-lg text-white uppercase leading-none"
                style={{ fontFamily: "'Rubik Mono One', sans-serif" }}
              >
                {brand.name}
              </h2>
              <p
                className="text-[10px] font-bold text-inverse-on-surface/50 mt-0.5"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {brand.tagline}
              </p>
            </div>
          </div>
          {/* Social icons */}
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${brand.support.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-inverse-surface border-2 border-inverse-on-surface/20 p-2.5 hover:border-secondary-container hover:text-secondary-container transition-colors"
              aria-label="WhatsApp"
            >
              <span className="material-symbols-outlined text-lg text-inverse-on-surface">chat</span>
            </a>
            <a
              href={`https://t.me/${brand.support.telegramUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-inverse-surface border-2 border-inverse-on-surface/20 p-2.5 hover:border-primary-container hover:text-primary-container transition-colors"
              aria-label="Telegram"
            >
              <span className="material-symbols-outlined text-lg text-inverse-on-surface">send</span>
            </a>
            <a
              href={`mailto:${brand.support.email}`}
              className="bg-inverse-surface border-2 border-inverse-on-surface/20 p-2.5 hover:border-tertiary-container hover:text-tertiary-container transition-colors"
              aria-label="Email"
            >
              <span className="material-symbols-outlined text-lg text-inverse-on-surface">mail</span>
            </a>
          </div>
        </div>

        {/* Middle: 3-col links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
          {/* Shop */}
          <div>
            <h3
              className="font-black uppercase text-[11px] tracking-wider text-primary-container mb-3 pb-2 border-b border-inverse-on-surface/10"
              style={heading}
            >
              {t.nav.shop}
            </h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">{t.products.title}</Link></li>
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">Streaming</Link></li>
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">AI Tools</Link></li>
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">Productivity</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3
              className="font-black uppercase text-[11px] tracking-wider text-primary-container mb-3 pb-2 border-b border-inverse-on-surface/10"
              style={heading}
            >
              {t.footer.howToOrder}
            </h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">{t.footer.howToOrder}</Link></li>
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">{t.footer.paymentMethods}</Link></li>
              <li><Link to="/" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">{t.footer.faq}</Link></li>
              <li><Link to="/dashboard" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors">{t.footer.myOrders}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="font-black uppercase text-[11px] tracking-wider text-primary-container mb-3 pb-2 border-b border-inverse-on-surface/10"
              style={heading}
            >
              HUBUNGI KAMI
            </h3>
            <ul className="space-y-2">
              <li>
                <a href={`https://wa.me/${brand.support.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-inverse-on-surface/50 hover:text-secondary-container transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">chat</span>
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={`https://t.me/${brand.support.telegramUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-inverse-on-surface/50 hover:text-primary-container transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">send</span>
                  Telegram
                </a>
              </li>
              <li>
                <a href={`mailto:${brand.support.email}`} className="text-xs font-bold text-inverse-on-surface/50 hover:text-tertiary-container transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  {brand.support.email}
                </a>
              </li>
            </ul>
            {/* AES badge */}
            <div className="mt-3 inline-flex items-center gap-1.5 bg-primary-container/10 border border-primary-container/30 px-2.5 py-1 rounded-sm">
              <span className="material-symbols-outlined text-[10px] text-primary-container">lock</span>
              <span
                className="text-[8px] font-black uppercase text-primary-container/80 tracking-wider"
                style={heading}
              >
                AES-256 Encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-inverse-on-surface/10 pt-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[9px] font-bold uppercase text-inverse-on-surface/30">
            &copy; {year} {brand.name}. {t.footer.rights}.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex gap-4">
              <a href="#" className="text-[9px] font-bold uppercase text-inverse-on-surface/30 hover:text-secondary-container transition-colors">Terms</a>
              <a href="#" className="text-[9px] font-bold uppercase text-inverse-on-surface/30 hover:text-secondary-container transition-colors">Privacy</a>
              <a href="#" className="text-[9px] font-bold uppercase text-inverse-on-surface/30 hover:text-secondary-container transition-colors">Refunds</a>
            </div>
            <span className="text-inverse-on-surface/10">|</span>
            <a
              href="https://langitkode.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-black uppercase tracking-wider text-inverse-on-surface/30 hover:text-primary-container transition-colors"
              style={heading}
            >
              LangitKode Creative
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
