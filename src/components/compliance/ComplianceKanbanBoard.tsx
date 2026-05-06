import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AticsKanbanCard, AticsKanbanColumn } from '../ui/aticsPrimitives'
import type { ComplianceItem, ComplianceItemSource, ComplianceItemStatus } from './useComplianceWorkItems'

const STATUS_COLUMNS: { key: ComplianceItemStatus; label: string }[] = [
  { key: 'open', label: 'Åpne' },
  { key: 'in_progress', label: 'Pågår' },
  { key: 'awaiting_signature', label: 'Venter signatur' },
  { key: 'overdue', label: 'Forfalt' },
  { key: 'completed', label: 'Lukket' },
]

const SOURCE_LABEL: Record<ComplianceItemSource, string> = {
  action_plan: 'Tiltak',
  ros: 'ROS',
  inspection: 'Inspeksjon',
  sja: 'SJA',
  annual_review: 'Årsgjennomgang',
  training: 'Opplæring',
  hr_discussion: 'HR drøftelse',
  hr_consultation: 'HR drøfting',
  survey: 'Undersøkelse',
}

const SOURCE_BADGE: Record<ComplianceItemSource, string> = {
  action_plan: 'bg-neutral-100 text-neutral-700',
  ros: 'bg-rose-100 text-rose-800',
  inspection: 'bg-sky-100 text-sky-800',
  sja: 'bg-amber-100 text-amber-800',
  annual_review: 'bg-violet-100 text-violet-800',
  training: 'bg-emerald-100 text-emerald-800',
  hr_discussion: 'bg-indigo-100 text-indigo-800',
  hr_consultation: 'bg-indigo-50 text-indigo-700',
  survey: 'bg-cyan-100 text-cyan-800',
}

const PRIORITY_BADGE: Record<NonNullable<ComplianceItem['priority']>, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-50 text-amber-800',
  low: 'bg-neutral-100 text-neutral-600',
}

const PRIORITY_LABEL: Record<NonNullable<ComplianceItem['priority']>, string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}

type Props = {
  items: ComplianceItem[]
  /** When provided, filter dropdown is rendered above the columns. Default: shown. */
  showFilters?: boolean
}

/**
 * Reuses AticsKanbanColumn / AticsKanbanCard primitives. Status columns are fixed
 * (open / in_progress / awaiting_signature / overdue / completed); cards are
 * grouped by mapping ComplianceItem.status onto the column key.
 */
export function ComplianceKanbanBoard({ items, showFilters = true }: Props) {
  const [sourceFilter, setSourceFilter] = useState<ComplianceItemSource | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false
      if (!q) return true
      return (
        it.title.toLowerCase().includes(q) ||
        (it.legalRef ?? '').toLowerCase().includes(q) ||
        (it.assigneeName ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, sourceFilter, query])

  const grouped = useMemo(() => {
    const map: Record<ComplianceItemStatus, ComplianceItem[]> = {
      open: [],
      in_progress: [],
      awaiting_signature: [],
      overdue: [],
      completed: [],
    }
    for (const it of filtered) map[it.status].push(it)
    return map
  }, [filtered])

  const sourceOptions: { key: ComplianceItemSource | 'all'; label: string }[] = [
    { key: 'all', label: 'Alle kilder' },
    { key: 'action_plan', label: SOURCE_LABEL.action_plan },
    { key: 'ros', label: SOURCE_LABEL.ros },
    { key: 'inspection', label: SOURCE_LABEL.inspection },
    { key: 'sja', label: SOURCE_LABEL.sja },
    { key: 'annual_review', label: SOURCE_LABEL.annual_review },
    { key: 'training', label: SOURCE_LABEL.training },
    { key: 'hr_discussion', label: SOURCE_LABEL.hr_discussion },
    { key: 'hr_consultation', label: SOURCE_LABEL.hr_consultation },
    { key: 'survey', label: SOURCE_LABEL.survey },
  ]

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200/80 bg-white px-3 py-2">
          <label className="sr-only" htmlFor="kanban-search">
            Søk
          </label>
          <input
            id="kanban-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i tittel, paragraf eller ansvarlig…"
            className="min-w-[220px] flex-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
          />
          <div className="flex flex-wrap gap-1.5">
            {sourceOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSourceFilter(opt.key)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  sourceFilter === opt.key
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {STATUS_COLUMNS.map((col) => (
          <AticsKanbanColumn
            key={col.key}
            title={`${col.label} · ${grouped[col.key].length}`}
          >
            {grouped[col.key].map((it) => (
              <AticsKanbanCard key={it.id}>
                <ComplianceCardBody item={it} />
              </AticsKanbanCard>
            ))}
            {grouped[col.key].length === 0 ? (
              <li className="rounded-md border border-dashed border-neutral-200 bg-white px-2 py-3 text-center text-[11px] text-neutral-400">
                Ingen
              </li>
            ) : null}
          </AticsKanbanColumn>
        ))}
      </div>
    </div>
  )
}

function ComplianceCardBody({ item }: { item: ComplianceItem }) {
  const sourceClass = SOURCE_BADGE[item.source]
  const due = item.dueDate ? new Date(item.dueDate) : null
  const dueLabel = due ? due.toLocaleDateString('nb-NO') : null

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug text-neutral-900">{item.title}</p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className={`rounded px-1.5 py-0.5 font-semibold ${sourceClass}`}>
          {SOURCE_LABEL[item.source]}
        </span>
        {item.priority ? (
          <span className={`rounded px-1.5 py-0.5 font-semibold ${PRIORITY_BADGE[item.priority]}`}>
            {PRIORITY_LABEL[item.priority]}
          </span>
        ) : null}
        {item.legalRef ? (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{item.legalRef}</span>
        ) : null}
      </div>
      {item.assigneeName || dueLabel ? (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          {item.assigneeName ? `Ansvarlig: ${item.assigneeName}` : 'Ikke tildelt'}
          {dueLabel ? ` · Frist: ${dueLabel}` : null}
        </p>
      ) : null}
    </>
  )

  if (item.href) {
    return (
      <Link to={item.href} className="block hover:opacity-90">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}
