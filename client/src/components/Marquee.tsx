interface MarqueeProps {
  items: string[]
  className?: string
}

export default function Marquee({ items, className = 'mb-6' }: MarqueeProps) {
  const content = items.join('   ///   ')
  // Duplicate for seamless loop
  const full = `${content}   ///   ${content}   ///   ${content}   ///   ${content}`

  return (
    <div className={`overflow-hidden border-y-[3px] border-on-surface bg-on-surface py-2.5 select-none ${className}`}>
      <div className="animate-marquee whitespace-nowrap flex">
        <span
          className="font-black text-[10px] md:text-xs uppercase tracking-widest text-primary-container mx-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {full}
        </span>
      </div>
    </div>
  )
}
