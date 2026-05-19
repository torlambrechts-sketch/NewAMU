// Semantic-aware diff value renderer — spec §5.
//
// Each DiffValue carries a `semantic` hint that drives the chip / styling
// applied around the display string. Falls back to plain text rendering
// for unknown semantics. Empty / null display renders as italic muted
// "(ingen verdi)" so the diff card always has a visible row.

import { useTranslation } from 'react-i18next'
import type { DiffValue } from '../../../lib/audit/diffShape'
import { StatusChip, statusFromLabel } from '../../ui/StatusChip'

const SEVERITY_TONE: Record<string, { dot: string; chip: string }> = {
  lav: { dot: 'bg-green-500', chip: 'bg-green-50 text-green-800 border-green-200' },
  middels: { dot: 'bg-yellow-500', chip: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
  høy: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 border-orange-200' },
  hoy: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 border-orange-200' },
  kritisk: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200' },
}

function SeverityChip({ display }: { display: string }) {
  const key = display.trim().toLowerCase()
  const tone = SEVERITY_TONE[key] ?? { dot: 'bg-neutral-400', chip: 'bg-neutral-50 text-neutral-700 border-neutral-200' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {display}
    </span>
  )
}

function isLikelyIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s)
}

function formatDate(display: string, raw?: string): string {
  const source = raw && isLikelyIsoDate(raw) ? raw : display
  const d = new Date(source)
  if (Number.isNaN(d.getTime())) return display
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function SemanticValue({ value }: { value: DiffValue }) {
  const { t } = useTranslation()
  const display = value.display?.trim() ?? ''

  if (!display || display === '(ingen verdi)') {
    return <span className="text-sm italic text-neutral-400">{t('endringslogg.noValue', '(ingen verdi)')}</span>
  }

  const semantic = value.semantic ?? 'plain'

  if (semantic === 'status') {
    return <StatusChip status={statusFromLabel(display)} label={display} />
  }

  if (semantic === 'severity') {
    return <SeverityChip display={display} />
  }

  if (semantic === 'date') {
    return <span className="text-sm text-neutral-800">{formatDate(display, value.raw)}</span>
  }

  if (semantic === 'user') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-neutral-800">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-neutral-100 text-[9px] font-semibold text-neutral-700">
          {display
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </span>
        {display}
      </span>
    )
  }

  // plain
  if (display.length <= 24 && /^[\w.\-_/]+$/.test(display)) {
    return (
      <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[13px] text-neutral-800">{display}</span>
    )
  }
  return <span className="text-sm text-neutral-800">{display}</span>
}
