// AmlOutstandingTasksTable — table of utestående oppgaver, sorted with
// overdue first then by severity. Design source:
// ui_kits/aml-compliance/AmlPieces2.jsx OutstandingTasks.

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Badge } from '../ui/Badge'
import { StandardInput } from '../ui/Input'
import type { AmlTask, AmlTaskSeverity } from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

const SEV_LABEL: Record<AmlTaskSeverity, string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}
const SEV_VARIANT: Record<AmlTaskSeverity, 'critical' | 'warning' | 'info' | 'neutral'> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
}
const SEV_ORDER: Record<AmlTaskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const SEVERITY_OPTIONS: AmlTaskSeverity[] = ['critical', 'high', 'medium', 'low']

type SortKey = 'severity' | 'due' | 'module' | 'owner'
type SortDir = 'asc' | 'desc'

export function AmlOutstandingTasksTable({ tasks }: { tasks: AmlTask[] }) {
  const [search, setSearch] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [activeSeverities, setActiveSeverities] = useState<Set<AmlTaskSeverity>>(new Set())
  // Default sort: overdue first, then by severity. Same shape as
  // before but driven by a sortKey/sortDir state so the user can
  // override per column click.
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks
      .filter((t) => {
        if (overdueOnly && !t.overdue) return false
        if (activeSeverities.size > 0 && !activeSeverities.has(t.severity)) return false
        if (q) {
          const haystack = [t.title, t.module, t.law, t.owner, t.id].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .slice()
      .sort((a, b) => {
        // Overdue always sorts to the top regardless of column choice
        // — flipping that hides the most-urgent rows behind the fold.
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
        const dir = sortDir === 'asc' ? 1 : -1
        switch (sortKey) {
          case 'severity':
            return (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) * dir
          case 'due':
            return a.due.localeCompare(b.due, 'nb') * dir
          case 'module':
            return a.module.localeCompare(b.module, 'nb') * dir
          case 'owner':
            return a.owner.localeCompare(b.owner, 'nb') * dir
        }
      })
  }, [tasks, search, overdueOnly, activeSeverities, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }
  const toggleSeverity = (s: AmlTaskSeverity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const clearFilters = () => {
    setSearch('')
    setOverdueOnly(false)
    setActiveSeverities(new Set())
  }
  const hasActiveFilters = search !== '' || overdueOnly || activeSeverities.size > 0

  return (
    <ModuleSectionCard className="!p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Utestående oppgaver
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Forfall innen 30 dager, sortert etter alvorlighet og frist. Klikk for tiltak og signering.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="h-3.5 w-3.5" /> Eksporter
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/40 px-5 py-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <StandardInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk oppgave, modul, lov…"
            className="pl-8 py-1.5 text-xs"
            aria-label="Søk oppgaver"
          />
        </div>
        <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Alvorlighet
        </span>
        {SEVERITY_OPTIONS.map((s) => {
          const on = activeSeverities.has(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSeverity(s)}
              className={
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ' +
                (on
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')
              }
            >
              {SEV_LABEL[s]}
            </button>
          )
        })}
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-700">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
          />
          Bare forfalt
        </label>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-800"
          >
            Tilbakestill
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              <th className="px-5 py-2.5">Oppgave</th>
              <SortableTh label="Modul" colKey="module" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-3 py-2.5">Lovverk</th>
              <SortableTh label="Alvorlighet" colKey="severity" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="Ansvarlig" colKey="owner" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="Frist" colKey="due" align="right" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="px-5" />
              <th className="px-3 py-2.5 text-right" aria-label="Åpne" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className="border-t border-neutral-100 hover:bg-neutral-50/60"
              >
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-neutral-400">
                      {r.id}
                    </span>
                    <span className="font-medium text-neutral-900">{r.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-neutral-700">{r.module}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{r.law}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={SEV_VARIANT[r.severity]}>{SEV_LABEL[r.severity]}</Badge>
                </td>
                <td className="px-3 py-2.5 text-neutral-700">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-semibold text-neutral-700">
                      {r.owner
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    {r.owner}
                  </span>
                </td>
                <td
                  className={`px-5 py-2.5 text-right tabular-nums ${
                    r.overdue ? 'font-semibold text-red-700' : 'text-neutral-700'
                  }`}
                >
                  {r.overdue ? <span className="mr-1">⚠</span> : null}
                  {r.due}
                  {r.overdue ? (
                    <span className="ml-1 text-[10px] font-semibold text-red-600">
                      {' '}
                      · {r.daysLate}d
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-neutral-300">›</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
        <span>
          Viser {sorted.length} av {tasks.length} {hasActiveFilters ? '(filtrert)' : 'aktive'}
        </span>
        <a
          className="font-semibold text-[#1a3d32] hover:underline"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          Se alle oppgaver →
        </a>
      </div>
    </ModuleSectionCard>
  )
}

function SortableTh({
  label,
  colKey,
  sortKey,
  sortDir,
  onClick,
  align = 'left',
  className = '',
}: {
  label: string
  colKey: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (key: SortKey) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = sortKey === colKey
  const Arrow = sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`px-3 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onClick(colKey)}
        className={
          'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors ' +
          (active ? 'text-[#1a3d32]' : 'text-neutral-600 hover:text-neutral-900') +
          (align === 'right' ? ' float-right' : '')
        }
      >
        {label}
        {active ? <Arrow className="h-3 w-3" /> : null}
      </button>
    </th>
  )
}
