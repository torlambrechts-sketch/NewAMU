// Flat list of all cases — searchable + status-filterable. Uses the
// List 2 – kandidat/ordre tabell pattern from the platform layout composer.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { List2Shell } from '../../../src/components/layout/List2Shell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus } from '../types'

const CREAM_DEEP = '#EFE8DC'

const STATUS_OPTIONS: Array<{ value: AlertStatus | 'open' | 'all'; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Åpne' },
  { value: 'received', label: ALERT_STATUS_LABEL['received'] },
  { value: 'triage', label: ALERT_STATUS_LABEL['triage'] },
  { value: 'investigation', label: ALERT_STATUS_LABEL['investigation'] },
  { value: 'internal_review', label: ALERT_STATUS_LABEL['internal_review'] },
  { value: 'closed', label: ALERT_STATUS_LABEL['closed'] },
  { value: 'dismissed', label: ALERT_STATUS_LABEL['dismissed'] },
]

function statusBadgeVariant(status: AlertStatus): 'neutral' | 'warning' | 'info' {
  if (status === 'closed' || status === 'dismissed') return 'neutral'
  if (status === 'received' || status === 'triage') return 'warning'
  return 'info'
}

export function AlertsAllePage() {
  const alerts = useAlerts()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'open' | 'all'>('open')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase()
    return alerts.cases.filter((c) => {
      if (statusFilter === 'all') {
        // pass
      } else if (statusFilter === 'open') {
        if (['closed', 'dismissed'].includes(c.status)) return false
      } else if (c.status !== statusFilter) return false
      if (qLower && !c.title.toLowerCase().includes(qLower)) return false
      return true
    })
  }, [alerts.cases, q, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)

  const activeFilterCount = (q.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Alle' }]}
      title="Alle saker"
      headerActions={
        <Link to="/alerts">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />}>Tilbake</Button>
        </Link>
      }
      loading={alerts.loading}
    >
      <List2Shell>
        {/* Toolbar: search + filter toggle */}
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Søk i tittel…"
              aria-label="Søk"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#b91c1c]/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-neutral-400 bg-neutral-50 text-neutral-900'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
              aria-expanded={filtersOpen}
            >
              <Filter className="size-3.5 text-neutral-500" aria-hidden />
              Filter
            </button>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => { setQ(''); setStatusFilter('all'); setPage(1) }}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
              >
                <X className="size-3.5" aria-hidden />
                Nullstill
              </button>
            ) : (
              <span className="text-xs text-neutral-400">Ingen filter aktive</span>
            )}
          </div>
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen ? (
          <div
            className="border-b border-neutral-100 px-4 py-4 md:px-5"
            style={{ backgroundColor: CREAM_DEEP }}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setStatusFilter(opt.value); setPage(1) }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? 'border-[#b91c1c] bg-[#b91c1c] text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3 text-left">Tittel</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Mottatt</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="w-10 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
                    Ingen saker matcher filteret.
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/alerts/${c.id}`)}
                    className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/80"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-neutral-900">{c.title}</p>
                      {c.confidentiality_level === 'confidential' ? (
                        <Badge variant="critical" className="mt-1">Konfidensielt</Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {ALERT_KIND_SHORT_LABEL[c.kind]}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-neutral-600">
                      {new Date(c.received_at).toLocaleDateString('nb-NO')}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusBadgeVariant(c.status)}>
                        {ALERT_STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ChevronRight className="size-4 text-neutral-300" aria-hidden />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: items-per-page + pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span className="text-neutral-500">
              {total === 0
                ? 'Ingen treff'
                : `Viser ${start + 1}–${Math.min(start + perPage, total)} av ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Neste side"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </List2Shell>
    </ModulePageShell>
  )
}
