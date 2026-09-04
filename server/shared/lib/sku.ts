import { generatePublicId } from './publicId'

export function generateSku(baseName: string, durationMonths?: number | null, accountType?: string | null): string {
  const base = baseName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const dur = durationMonths ? `${durationMonths}M` : 'NA'
  const typ = accountType ? accountType.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X') : 'XXX'
  const rand = generatePublicId().slice(0, 4).toUpperCase()
  return `${base}-${dur}-${typ}-${rand}`
}

export function composeVariantName(baseName: string, durationMonths?: number | null, accountType?: string | null, conditions?: string | null): string {
  let name = baseName
  if (durationMonths) name += ` - ${durationMonths} Bulan`
  if (accountType) name += ` - ${accountType}`
  if (conditions) name += ` - ${conditions}`
  return name
}
