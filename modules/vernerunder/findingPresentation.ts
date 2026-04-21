import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { SelectOption } from '../../src/components/ui/SearchableSelect'
import type { VernerundeFindingRow } from './types'

const SEVERITY_LABEL: Record<VernerundeFindingRow['severity'], string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

export function findingSeverityClass(sev: VernerundeFindingRow['severity']): string {
  switch (sev) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/30'
    case 'high':
      return 'border-l-4 border-l-orange-500 bg-orange-50/30'
    case 'medium':
      return 'border-l-4 border-l-amber-500 bg-amber-50/30'
    case 'low':
    default:
      return 'border-l-4 border-l-sky-500 bg-sky-50/30'
  }
}

export function findingBadgeVariant(sev: VernerundeFindingRow['severity']): BadgeVariant {
  if (sev === 'low') return 'info'
  if (sev === 'medium') return 'medium'
  if (sev === 'high') return 'high'
  return 'critical'
}

export { SEVERITY_LABEL }

const SEVERITY_KEYS: VernerundeFindingRow['severity'][] = ['low', 'medium', 'high', 'critical']

export const SEVERITY_OPTIONS: SelectOption[] = SEVERITY_KEYS.map((k) => ({
  value: k,
  label: SEVERITY_LABEL[k],
}))
