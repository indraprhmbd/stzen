import { Link } from 'react-router-dom'
import { NavArrowRight } from 'iconoir-react'
import { adminDocSections, adminDocFaq } from '../../config/admin.docs'

// ─── Admin Guide ─────────────────────────────────────────────────────────────
// Operator manual, Indonesian only, content from config/admin.docs.ts.
// Sections link to the real pages and tabs they describe.
export default function Guide() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Panduan</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">
          Cara pakai halaman admin. Tiap bagian punya tautan ke halaman aslinya.
        </p>
      </div>

      {/* Table of contents */}
      <div className="ad-card-flat p-3">
        <div className="flex flex-wrap gap-1.5">
          {adminDocSections.map((s) => (
            <a key={s.id} href={`#panduan-${s.id}`} className="ad-btn">
              {s.title}
            </a>
          ))}
          <a href="#panduan-faq" className="ad-btn ad-btn-dark">
            Tanya-Jawab
          </a>
        </div>
      </div>

      {adminDocSections.map((s) => (
        <section key={s.id} id={`panduan-${s.id}`} className="ad-card p-5 scroll-mt-4">
          <h2 className="font-semibold text-[17px] tracking-tight">{s.title}</h2>
          <p className="text-[13px] text-[#6e6e73] mt-1">{s.intro}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {s.points.map((p, i) => (
              <li key={i} className="text-[13px] leading-relaxed flex gap-2">
                <span aria-hidden className="text-[#aeaeb2] shrink-0">
                  •
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {s.links.map((l) => (
              <Link key={l.to} to={l.to} className="ad-btn ad-btn-dark">
                {l.label} <NavArrowRight width={13} height={13} strokeWidth={2} className="inline" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section id="panduan-faq" className="ad-card p-5 scroll-mt-4">
        <h2 className="font-semibold text-[17px] tracking-tight">Tanya-Jawab</h2>
        <p className="text-[13px] text-[#6e6e73] mt-1">
          Masalah umum dan cara menyelesaikannya.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {adminDocFaq.map((f, i) => (
            <details key={i} className="rounded-[10px] border border-[#e8e8ed] px-4 py-3">
              <summary className="text-[13px] font-semibold cursor-pointer">{f.q}</summary>
              <p className="text-[13px] text-[#6e6e73] leading-relaxed mt-2">{f.a}</p>
              {f.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {f.links.map((l) => (
                    <Link key={l.to} to={l.to} className="ad-btn ad-btn-dark">
                      {l.label} <NavArrowRight width={13} height={13} strokeWidth={2} className="inline" />
                    </Link>
                  ))}
                </div>
              )}
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
