// Flat list of all cases — searchable + status-filterable. Uses the
// List 2 – kandidat/ordre tabell pattern from the platform layout composer.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { List2Shell } from '../../../src/components/layout/List2Shell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus } from '../types'

const CREAM_DEEP = '#EFE8DC'

const STATUSES: Array<AlertStatus | 'open' | 'all'> = ['all', 'open', 'received', 'triage', 'investigation', 'internal_review', 'closed', 'dismissed']

function statusBadgeVariant(s: AlertStatus): 'neutral' | 'warning' | 'info' | 'success' {
  if (s === 'closed') return 'success'
  if (s === 'dismissed') return 'neutral'
  if (s === 'received' || s === 'triage') return 'warning'
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
      description="Alle saker — sortert etter mottakstidspunkt."
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
            <StandardInput
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Søk i tittel…"
              aria-label="Søk"
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={filtersOpen || activeFilterCount > 0 ? 'secondary' : 'ghost'}
              icon={<Filter className="size-3.5" />}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              Filter
            </Button>
            {activeFilterCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<X className="size-3.5" />}
                onClick={() => { setQ(''); setStatusFilter('all'); setPage(1) }}
              >
                Nullstill
              </Button>
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
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-600">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatusFilter(s); setPage(1) }}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'border-[#b91c1c] bg-[#b91c1c] text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {s === 'all' ? 'Alle' : s === 'open' ? 'Åpne' : ALERT_STATUS_LABEL[s as AlertStatus]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3 text-left">Tittel</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Mottatt</th>
                <th className="w-8 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-12 text-center text-sm text-neutral-500">
                      Ingen saker matcher filteret.
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/80"
                    onClick={() => navigate(`/alerts/${c.id}`)}
                  >
                    <td className="px-5 py-4 font-medium text-neutral-900">
                      {c.title}
                      {c.confidentiality_level === 'confidential' ? (
                        <Badge variant="critical" className="ml-2">Konfidensielt</Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{ALERT_KIND_SHORT_LABEL[c.kind]}</td>
                    <td className="px-5 py-4">
                      <Badge variant={statusBadgeVariant(c.status)}>{ALERT_STATUS_LABEL[c.status]}</Badge>
                    </td>
                    <td className="px-5 py-4 tabular-nums text-neutral-600">{new Date(c.received_at).toLocaleDateString('nb-NO')}</td>
                    <td className="w-8 px-3 py-4 text-neutral-300">
                      <ChevronRight className="h-4 w-4" />
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
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <div className="w-20">
                <SearchableSelect
                  value={String(perPage)}
                  onChange={(v) => { setPerPage(Number(v)); setPage(1) }}
                  options={[{ value: '10', label: '10' }, { value: '25', label: '25' }, { value: '50', label: '50' }]}
                />
              </div>
            </div>
            <span className="text-neutral-500">
              {total === 0
                ? 'Ingen treff'
                : `Viser ${start + 1}–${Math.min(start + perPage, total)} av ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Neste side"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </List2Shell>
    </ModulePageShell>
  )
}
