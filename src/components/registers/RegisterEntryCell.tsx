// Schema-driven cell renderer for a register_record. Dispatches on
// field.kind and renders an appropriate compact representation.
// Used by RegisterEntriesTable (per-type list) and RegisterEntryPage
// (drill-in detail field list).

import { Check } from 'lucide-react'
import { RegisterInitials } from './RegisterInitials'
import type { RegisterField, RegisterRecord } from '../../types/registers'

type Props = {
  field: RegisterField
  record: RegisterRecord
  /** When true, the cell is being rendered on the detail page (no
   *  cell-level "—" placeholder, no truncation). */
  detailMode?: boolean
  /** If supplied, used as the visual emphasis (primary cell on list). */
  primary?: boolean
}

export function RegisterEntryCell({ field, record, detailMode = false, primary = false }: Props) {
  const value = record.values[field.key]

  if (value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0)) {
    return <span className="text-neutral-300">—</span>
  }

  switch (field.kind) {
    case 'text':
      return (
        <span
          className={primary ? 'font-medium text-neutral-900' : 'text-neutral-700'}
        >
          {String(value)}
        </span>
      )
    case 'number':
      return (
        <span className={primary ? 'font-medium tabular-nums text-neutral-900' : 'tabular-nums text-neutral-700'}>
          {String(value)}
        </span>
      )
    case 'date': {
      const due = parseDate(String(value))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isOverdue = due !== null && due < today
      const isSoon =
        due !== null && !isOverdue && due.getTime() - today.getTime() <= 30 * 86_400_000
      return (
        <span
          className={[
            'tabular-nums',
            isOverdue
              ? 'font-semibold text-red-700'
              : isSoon
                ? 'font-semibold text-amber-700'
                : 'text-neutral-700',
          ].join(' ')}
        >
          {formatDate(String(value))}
          {isOverdue && !detailMode ? ' !' : ''}
        </span>
      )
    }
    case 'boolean':
      return value === true ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <span className="text-neutral-500">Nei</span>
      )
    case 'select': {
      const lookup = field.options?.find((o) => o.value === value)
      const label = lookup?.label ?? String(value)
      const tone = selectTone(String(value))
      return (
        <span
          className={[
            'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            tone.bg,
            tone.fg,
          ].join(' ')}
        >
          {label}
        </span>
      )
    }
    case 'select_multi': {
      const ids = (value as unknown[]).filter((x): x is string => typeof x === 'string')
      const labels = ids.map((id) => field.options?.find((o) => o.value === id)?.label ?? id)
      if (detailMode) {
        return (
          <div className="flex flex-wrap gap-1">
            {labels.map((l) => (
              <span
                key={l}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700"
              >
                {l}
              </span>
            ))}
          </div>
        )
      }
      return (
        <span className="text-neutral-700">
          {labels.length === 0
            ? '—'
            : labels.length <= 2
              ? labels.join(', ')
              : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`}
        </span>
      )
    }
    case 'doc_ref':
    case 'location_ref':
      return <span className="font-mono text-xs text-neutral-700">{String(value)}</span>
  }
}

/**
 * Person-cell variant for fields that look like a person reference
 * (e.g. `employee`, `owner`, `responsible`). The schema doesn't carry
 * a `person` kind yet — we render any text field that the caller marks
 * as a person here.
 */
export function RegisterPersonCell({ value, primary = false }: { value: unknown; primary?: boolean }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-neutral-300">—</span>
  }
  const str = String(value)
  const masked = str === 'Anonymisert' || str === 'Anonym' || str === '—'
  return (
    <span className="inline-flex items-center gap-2">
      <RegisterInitials name={masked ? '? ?' : str} size={22} />
      <span className={primary ? 'font-medium text-neutral-900' : 'text-neutral-700'}>{str}</span>
    </span>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  // DD.MM.YYYY
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(s)
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function formatDate(s: string): string {
  const d = parseDate(s)
  if (!d) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/** Map a select value (slug) to a tonal pair. Best-effort — when no
 *  match, the neutral tone is used. */
function selectTone(value: string): { bg: string; fg: string } {
  const lower = value.toLowerCase()
  if (
    /(kritisk|critical|h[øo]y|alvorlig|forfalt|utg[åa]tt|non_compliant|brudd|sperret)/.test(lower) ||
    lower === '4' ||
    lower === '5'
  ) {
    return { bg: 'bg-red-100', fg: 'text-red-800' }
  }
  if (
    /(middels|medium|moderat|under behandling|partial|snart utl[øo]pt|advarsel|warning|in_progress)/.test(lower) ||
    lower === '3'
  ) {
    return { bg: 'bg-amber-100', fg: 'text-amber-900' }
  }
  if (
    /(h[øo]y[a-zæøå]*|stor|orange|increase|priority)/.test(lower)
  ) {
    return { bg: 'bg-orange-100', fg: 'text-orange-800' }
  }
  if (
    /(aktiv|godkjent|compliant|lukket|fullf[øo]rt|completed|success|akseptabel)/.test(lower) ||
    lower === '1'
  ) {
    return { bg: 'bg-green-100', fg: 'text-green-800' }
  }
  if (/(åpen|open|info|under evaluering|draft|utkast)/.test(lower) || lower === '2') {
    return { bg: 'bg-blue-100', fg: 'text-blue-800' }
  }
  if (/(personlig|sensitive|gdpr|konfidensiell|confidential|strengt)/.test(lower)) {
    return { bg: 'bg-purple-100', fg: 'text-purple-800' }
  }
  return { bg: 'bg-neutral-100', fg: 'text-neutral-700' }
}
