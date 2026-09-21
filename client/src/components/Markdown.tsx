import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Reusable Markdown renderer for DB-authored content (product descriptions).
// Safe by default: AST-to-elements, no dangerouslySetInnerHTML, raw HTML
// escaped, javascript: URLs blocked by defaultUrlTransform. No rehype-raw.
const remarkPlugins = [remarkGfm]

const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const

function ExternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const external = !!href && /^https?:\/\//i.test(href)
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="underline underline-offset-2 text-blue-700 hover:text-black"
    >
      {children}
    </a>
  )
}

function TableWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="border-2 border-black text-sm font-semibold text-neutral/80 [&_tbody_tr:nth-child(odd)]:bg-black/[0.03]">{children}</table>
    </div>
  )
}

type Props = { source: string; className?: string }

function Markdown({ source, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          a: ExternalLink,
          h1: ({ children }) => <h1 className="font-black text-lg uppercase tracking-wide text-neutral mt-4 first:mt-0 mb-2" style={GROTESK}>{children}</h1>,
          h2: ({ children }) => <h2 className="font-black text-base uppercase tracking-wide text-neutral mt-4 first:mt-0 mb-1.5" style={GROTESK}>{children}</h2>,
          h3: ({ children }) => <h3 className="font-black text-sm uppercase tracking-wide text-neutral mt-3 first:mt-0 mb-1.5" style={GROTESK}>{children}</h3>,
          p: ({ children }) => <p className="text-sm font-semibold text-neutral/80 leading-relaxed mb-2.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside ps-5 text-sm font-semibold text-neutral/80 leading-relaxed mb-2.5 space-y-1 last:mb-0 marker:font-black marker:text-neutral/40">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ps-5 text-sm font-semibold text-neutral/80 leading-relaxed mb-2.5 space-y-1 last:mb-0 marker:font-black marker:text-neutral/40">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          // GFM task-list checkboxes render read-only.
          input: (props) => <input {...props} readOnly className="mr-1.5 align-[-2px]" />,
          strong: ({ children }) => <strong className="font-bold text-neutral">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="opacity-60">{children}</del>,
          table: TableWrapper,
          th: ({ children }) => <th className="border border-black bg-primary text-neutral font-black px-2 py-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-black px-2 py-1">{children}</td>,
          code: ({ children }) => <code className="font-mono text-[13px] bg-black/5 px-1 rounded-sm">{children}</code>,
          pre: ({ children }) => <pre className="font-mono text-[13px] bg-black/5 border-2 border-black p-2 overflow-x-auto mb-2.5">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-black/60 pl-3 italic mb-2.5 text-sm font-semibold text-neutral/70">{children}</blockquote>,
          hr: () => <hr className="border-t-2 border-dashed border-black/40 my-4" />,
          img: ({ src, alt }) => <img src={src} alt={alt ?? ''} loading="lazy" className="max-w-full h-auto border-2 border-black" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}

export default memo(Markdown)
