import { useBrand } from '../hooks/useBrand'

export default function Footer() {
  const brand = useBrand()

  return (
    <footer className="bg-base-300 border-t-[3px] border-neutral mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left: Brand */}
          <div>
            <span
              className="font-black text-lg uppercase tracking-tighter text-neutral"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {brand.name}
            </span>
            <p className="text-xs font-bold text-neutral/60 mt-1">
              {brand.tagline}
            </p>
          </div>

          {/* Center: Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 md:justify-center">
            <a href="#" className="font-bold uppercase text-xs text-neutral/60 hover:text-primary underline-offset-4 transition-colors">
              Terms
            </a>
            <a href="#" className="font-bold uppercase text-xs text-neutral/60 hover:text-primary underline-offset-4 transition-colors">
              Privacy
            </a>
            <a href="#" className="font-bold uppercase text-xs text-neutral/60 hover:text-primary underline-offset-4 transition-colors">
              Refunds
            </a>
            <a
              href={`https://wa.me/${brand.support.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold uppercase text-xs text-neutral/60 hover:text-primary underline-offset-4 transition-colors"
            >
              Support
            </a>
          </div>

          {/* Right: Copyright */}
          <div className="md:text-right">
            <p className="font-bold uppercase text-xs text-neutral/60">
              &copy; {new Date().getFullYear()} {brand.name}
            </p>
            <p className="font-bold uppercase text-[10px] text-neutral/40 mt-1">
              {brand.seo.metaDescription}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
