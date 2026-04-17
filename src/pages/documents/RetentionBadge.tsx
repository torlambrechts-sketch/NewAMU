import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Archive } from 'lucide-react'

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

type Props = {
  retentionCategory: string | null | undefined
  retainMinimumYears: number | null | undefined
  retainMaximumYears: number | null | undefined
  archivedAt: string | null | undefined
  scheduledDeletionAt: string | null | undefined
  isAdmin?: boolean
  pageId?: string
}

function daysUntil(iso: string, nowMs: number): number {
  return Math.ceil((new Date(iso).getTime() - nowMs) / (24 * 60 * 60 * 1000))
}

export function RetentionBadge({
  retentionCategory,
  retainMinimumYears,
  retainMaximumYears,
  archivedAt,
  scheduledDeletionAt,
  isAdmin,
  pageId,
}: Props) {
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const hasAny =
    Boolean(retentionCategory?.trim()) ||
    retainMinimumYears != null ||
    archivedAt ||
    scheduledDeletionAt

  if (!hasAny) return null

  const minY = retainMinimumYears != null && retainMinimumYears > 0 ? retainMinimumYears : null
  const maxY = retainMaximumYears != null && retainMaximumYears > 0 ? retainMaximumYears : null

  let lagring = 'Lagringstid: ikke satt'
  if (minY != null && maxY != null) lagring = `Lagringstid: ${minY}–${maxY} år`
  else if (minY != null) lagring = `Lagringstid: ${minY} år`

  const del = scheduledDeletionAt ? new Date(scheduledDeletionAt) : null
  const slettes =
    del && !Number.isNaN(del.getTime())
      ? `Slettes: ${del.toLocaleDateString('no-NO')}`
      : archivedAt && maxY == null
        ? 'Arkivert — ingen planlagt slettedato (sett maks. år for GDPR)'
        : null

  const d = scheduledDeletionAt ? daysUntil(scheduledDeletionAt, now) : null
  let tone = 'border-neutral-200 bg-neutral-100 text-neutral-600'
  if (d != null && d <= 30) tone = 'border-red-200 bg-red-50 text-red-900'
  else if (d != null && d <= 90) tone = 'border-amber-200 bg-amber-50 text-amber-900'

  const cat = retentionCategory?.trim() ? `${retentionCategory} · ` : ''

  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-none border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      <Archive className="size-3 shrink-0 opacity-70" aria-hidden />
      <span className="min-w-0">
        {cat}
        {lagring}
        {slettes ? ` · ${slettes}` : ''}
      </span>
      {d != null && d <= 30 && isAdmin && pageId ? (
        <Link
          to={`/documents/page/${pageId}/edit`}
          className="ml-1 shrink-0 font-semibold underline decoration-2 underline-offset-2"
        >
          Juster oppbevaring
        </Link>
      ) : null}
    </span>
  )
}
