interface Props {
  value: string
  onChange: (rawDigits: string) => void
  placeholder?: string
  required?: boolean
  label: string
  hint?: string
}

// Rupiah text input: shows thousand-dot grouping while typing (6000 →
// 6.000) but reports raw digits upstream, so the `^\d+$` server contract
// and existing submit paths never see separators.
export function formatRupiah(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function RupiahInput({ value, onChange, placeholder, required, label, hint }: Props) {
  return (
    <label className="ad-label">{label}
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={formatRupiah(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className="ad-input mt-1.5 ad-num"
      />
      {hint && <p className="text-[11px] text-[#aeaeb2] mt-1 normal-case font-normal">{hint}</p>}
    </label>
  )
}
