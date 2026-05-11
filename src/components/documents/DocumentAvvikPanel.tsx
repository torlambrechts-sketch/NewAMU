// Lists open and closed avvik linked to a wiki page. Mirrors the row shape
// used in the avvik kanban so users recognise the data instantly. Auto-
// promoted avvik (from high/critical avvik_proposal comments) live next to
// manually-promoted ones; the source-comment back-pointer is available but
// not surfaced here to keep the list focused on action.

import { Link } from 'react-router-dom'
import { ShieldAlert, ExternalLink } from 'lucide-react'
import { Badge, type BadgeVariant } from '../ui/Badge'
import type { LinkedAvvik } from '../../hooks/useWikiPageAvvik'

type Props = {
  linked: LinkedAvvik[]
  loading?: boolean
  emptyLabel?: string
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Åpen',
  rapportert: 'Rapportert',
  in_progress: 'Under behandling',
  under_behandling: 'Under behandling',
  tiltak_iverksatt: 'Tiltak iverksatt',
  closed: 'Lukket',
  lukket: 'Lukket',
}

const SEVERITY_LABEL: Record<LinkedAvvik['severity'], string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

function severityVariant(s: LinkedAvvik['severity']): BadgeVariant {
  if (s === 'critical' || s === 'high') return 'danger'
  if (s === 'medium') return 'warning'
  return 'neutral'
}

function statusVariant(status: string): BadgeVariant {
  if (status === 'closed' || status === 'lukket') return 'neutral'
  if (status === 'tiltak_iverksatt' || status === 'in_progress' || status === 'under_behandling') return 'info'
  return 'warning'
}

export function DocumentAvvikPanel({ linked, loading, emptyLabel }: Props) {
  if (loading) {
    return <p className="text-xs text-neutral-500">Laster avvik…</p>
  }
  if (linked.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">
        {emptyLabel ?? 'Ingen avvik knyttet til dette dokumentet.'}
      </p>
    )
  }
  const open = linked.filter((a) => !a.closedAt)
  const closed = linked.filter((a) => a.closedAt)
  return (
    <div className="space-y-3">
      {open.length > 0 ? (
        <ul className="space-y-2">
          {open.map((a) => (
            <AvvikRow key={a.linkId} avvik={a} />
          ))}
        </ul>
      ) : null}
      {closed.length > 0 ? (
        <details className="rounded border border-neutral-200 bg-neutral-50/60 px-2 py-1.5 text-xs">
          <summary className="cursor-pointer text-neutral-600">
            Lukkede avvik ({closed.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {closed.map((a) => (
              <AvvikRow key={a.linkId} avvik={a} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function AvvikRow({ avvik }: { avvik: LinkedAvvik }) {
  return (
    <li className="flex items-start gap-2 rounded border border-neutral-200 bg-white p-2 text-xs">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-700">
        <ShieldAlert className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-800">{avvik.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Badge variant={severityVariant(avvik.severity)}>{SEVERITY_LABEL[avvik.severity]}</Badge>
          <Badge variant={statusVariant(avvik.status)}>{STATUS_LABEL[avvik.status] ?? avvik.status}</Badge>
          <span className="ml-auto text-[10px] text-neutral-400">
            {new Date(avvik.createdAt).toLocaleDateString('nb-NO')}
          </span>
        </div>
      </div>
      <Link
        to={`/tasks/management?avvik=${avvik.deviationId}`}
        className="inline-flex items-center text-[#0f766e] hover:text-[#134e4a]"
        title="Åpne i avvik-modulen"
        aria-label="Åpne i avvik-modulen"
      >
        <ExternalLink className="size-3.5" aria-hidden />
      </Link>
    </li>
  )
}

export function DocumentAvvikChip({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-900"
      title={`${count} åpne avvik knyttet til dokumentet`}
    >
      <ShieldAlert className="size-3" aria-hidden />
      {count} avvik
    </span>
  )
}
