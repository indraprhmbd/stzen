import type { LegalDoc as LegalDocBody } from '../../config/copy'
import Layout from '../../components/Layout'

// ─── LegalDoc (generic UU-PDP-era legal page renderer) ───────────────────────
// One renderer for Terms / Privacy / Refunds. Body comes from copy.ts
// (t.legal.*) so ID/EN switch via the existing lang toggle, no dual URLs.

export default function LegalDoc({ doc }: { doc: LegalDocBody }) {
  return (
    <Layout>
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1
            className="font-black text-sm uppercase tracking-widest bg-panel-dark text-white border-2 border-black px-3 py-1 -rotate-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {doc.title}
          </h1>
          <div className="flex-1 h-[3px] bg-black" />
        </div>
        <p className="text-xs font-bold text-neutral/60" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {doc.desc}
        </p>
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral/40 mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {doc.updated}
        </p>
      </section>

      <div className="flex flex-col gap-2 mb-4">
        {doc.sections.map((s, i) => (
          <article key={i} className="bg-white border-comic shadow-comic-sm p-4">
            <h2
              className="font-black text-xs uppercase tracking-tight text-neutral mb-1.5"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {s.h}
            </h2>
            {s.p.map((para, j) => (
              <p
                key={j}
                className="text-xs font-bold text-neutral/80 leading-relaxed mb-1.5 last:mb-0"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {para}
              </p>
            ))}
          </article>
        ))}
      </div>
    </Layout>
  )
}
