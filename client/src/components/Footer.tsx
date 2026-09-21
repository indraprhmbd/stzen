import { Link } from 'react-router-dom'
import { useBrand } from '../hooks/useBrand'
import { usePublicSettings } from '../hooks/usePublicSettings'
import { useCopy } from '../hooks/useCopy'

export default function Footer() {
  const brand = useBrand()
  const support = usePublicSettings()
  const waNumber = support.whatsapp || brand.support.whatsappNumber
  const tgUser = support.telegram || brand.support.telegramUsername
  const supEmail = support.email || brand.support.email
  const { t } = useCopy()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-panel-dark border-t-4 border-primary mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        {/* Top: Brand + Social */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 mb-5">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.svg" alt={brand.name} className="h-10 w-10 shrink-0" />
            <div>
              <span className="font-black text-sm uppercase text-white leading-none block" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {brand.name}
              </span>
              <span className="text-[9px] font-bold text-white/60 block mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {brand.tagline}
              </span>
            </div>
          </Link>

          {/* Social - comic pill icons */}
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border-2 border-black p-2 shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all"
              aria-label="WhatsApp"
            >
              <svg className="w-4 h-4 text-neutral" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <a
              href={`https://t.me/${tgUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border-2 border-black p-2 shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all"
              aria-label="Telegram"
            >
              <svg className="w-4 h-4 text-neutral" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a
              href={`mailto:${supEmail}`}
              className="bg-white border-2 border-black p-2 shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic transition-all"
              aria-label="Email"
            >
              <svg className="w-4 h-4 text-neutral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </a>
          </div>
        </div>

        {/* Middle: 3-col links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-5">
          {/* Shop */}
          <div>
            <h3
              className="font-black text-[10px] uppercase tracking-wider text-white mb-2 pb-1.5 border-b-2 border-white/20"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.nav.shop}
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/products" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">{t.products.title}</Link></li>
              <li><Link to="/products?category=streaming" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">Streaming</Link></li>
              <li><Link to="/products?category=ai+tools" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">AI Tools</Link></li>
              <li><Link to="/products?category=productivity" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">Productivity</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3
              className="font-black text-[10px] uppercase tracking-wider text-white mb-2 pb-1.5 border-b-2 border-white/20"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t.footer.howToOrder}
            </h3>
            <ul className="space-y-1.5">
              <li><Link to="/how-to-order" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">{t.footer.howToOrder}</Link></li>
              <li><Link to="/payment-methods" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">{t.footer.paymentMethods}</Link></li>
              <li><Link to="/faq" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">{t.footer.faq}</Link></li>
              <li><Link to="/dashboard" className="text-[11px] font-bold text-white/70 hover:text-white transition-colors">{t.footer.myOrders}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="font-black text-[10px] uppercase tracking-wider text-white mb-2 pb-1.5 border-b-2 border-white/20"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              HUBUNGI KAMI
            </h3>
            <ul className="space-y-1.5">
               <li>
                 <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-white/70 hover:text-[#25D366] transition-colors flex items-center gap-1.5">
                   <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                   WhatsApp
                 </a>
               </li>
              <li>
                <a href={`https://t.me/${tgUser}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-white/70 hover:text-[#0088cc] transition-colors flex items-center gap-1.5">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </a>
              </li>
               <li>
                 <a href={`mailto:${supEmail}`} className="text-[11px] font-bold text-white/70 hover:text-accent transition-colors flex items-center gap-1.5">
                   <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                   {supEmail}
                 </a>
               </li>
            </ul>
            {/* Payment badge */}
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white/5 border-2 border-white/20 px-2 py-1">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span
                className="text-[8px] font-black uppercase text-white/60 tracking-wider"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {brand.payment.bankName} {brand.payment.accountNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t-2 border-white/20 pt-3 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase text-white/50">
            &copy; {year} {brand.name}. {t.footer.rights}.
          </p>
          <div className="flex items-center gap-3">
            <Link to="/syarat-ketentuan" className="text-[9px] font-bold uppercase text-white/50 hover:text-white transition-colors">{t.footer.terms}</Link>
            <Link to="/kebijakan-privasi" className="text-[9px] font-bold uppercase text-white/50 hover:text-white transition-colors">{t.footer.privacy}</Link>
            <Link to="/pengembalian-dana" className="text-[9px] font-bold uppercase text-white/50 hover:text-white transition-colors">{t.footer.refunds}</Link>
            <span className="text-white/10">|</span>
            <a
              href="https://langitkode.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-black uppercase tracking-wider text-white/50 hover:text-white transition-colors"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              LangitKode Creative
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
