import { generatePublicId } from './publicId'

type DurationUnit = 'day' | 'week' | 'month'

const unitSuffix: Record<DurationUnit, string> = { day: 'D', week: 'W', month: 'M' }
const unitLabel: Record<DurationUnit, string> = { day: 'Hari', week: 'Minggu', month: 'Bulan' }

export function generateSku(baseName: string, duration?: number | null, unit: DurationUnit = 'month', accountType?: string | null): string {
  const base = baseName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const dur = duration ? `${duration}${unitSuffix[unit]}` : 'NA'
  const typ = accountType ? accountType.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X') : 'XXX'
  const rand = generatePublicId().slice(0, 4).toUpperCase()
  return `${base}-${dur}-${typ}-${rand}`
}

export function composeVariantName(baseName: string, duration?: number | null, unit: DurationUnit = 'month', accountType?: string | null, conditions?: string | null): string {
  let name = baseName
  if (accountType) name += ` ${accountType}`
  if (duration) name += ` ${duration} ${unitLabel[unit]}`
  if (conditions) name += ` (${conditions})`
  return name
}
