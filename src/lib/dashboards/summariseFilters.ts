// summariseFilters — synthesise a one-line context string from the
// active filter chips so analyse pages don't have to hand-type
// "Last 12 months · Grouped by Pack"-style subtitles (3.2.6).
//
// Output style: `Avdeling: 2 · Status: Signert · Periode: jan – des`.
// Joins distinct dimension labels with `·`, joins multiple values
// inside a single dimension with `, ` (or shows the count when the
// list grows past three).
//
// The summariser is intentionally pure: it never touches the
// `loadOptions` callbacks (those are async and would break the
// renderer). It uses the chip's raw value when the dimension didn't
// surface a label cache; consumers that want pretty labels can pass a
// `labelLookup` map.

import type { DashboardFilter, DashboardDimension } from './dashboardFilters'

const MAX_INLINE_VALUES = 3

export type SummariseFiltersInput = {
  filters: DashboardFilter[]
  dimensions: DashboardDimension[]
  /**
   * Optional id → label map per dimension, when the consumer has the
   * cache handy. Without it, we surface counts for multi-select chips.
   */
  labelLookup?: Map<string, Map<string, string>>
}

export function summariseFilters({
  filters,
  dimensions,
  labelLookup,
}: SummariseFiltersInput): string {
  if (filters.length === 0) return ''
  const dimensionById = new Map(dimensions.map((d) => [d.id, d]))
  const parts: string[] = []
  for (const f of filters) {
    const dim = dimensionById.get(f.dimensionId)
    if (!dim) continue

    if (dim.kind === 'date_range') {
      const v = f.value as { from?: string; to?: string } | string | null
      if (typeof v === 'string') {
        parts.push(`${dim.label}: ${formatDate(v)}`)
        continue
      }
      const from = v?.from ? formatDate(v.from) : null
      const to = v?.to ? formatDate(v.to) : null
      if (from && to) parts.push(`${dim.label}: ${from} – ${to}`)
      else if (from) parts.push(`${dim.label}: fra ${from}`)
      else if (to) parts.push(`${dim.label}: til ${to}`)
      continue
    }

    // enum + text dimensions
    const ids = Array.isArray(f.value)
      ? (f.value as unknown[]).filter((x): x is string => typeof x === 'string')
      : typeof f.value === 'string' && f.value
        ? [f.value]
        : []
    if (ids.length === 0) continue

    const dimCache = labelLookup?.get(dim.id)
    const labels = ids.map((id) => dimCache?.get(id) ?? id)
    const op = f.operator === 'is_not' ? '≠' : ':'

    if (labels.length <= MAX_INLINE_VALUES) {
      parts.push(`${dim.label}${op} ${labels.join(', ')}`)
    } else {
      parts.push(`${dim.label}${op} ${labels.length} valgt`)
    }
  }
  return parts.join(' · ')
}

function formatDate(iso: string): string {
  // Accept "YYYY-MM-DD" or full ISO. Render as "1. jan 2026".
  try {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
