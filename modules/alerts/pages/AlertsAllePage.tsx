// Flat list of all cases — searchable + multi-select filter chips
// (Status + Type) with saved-view support. Uses the data-grid
// FilterBar pattern shared with Sjekklister / Tasks / Surveys.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { List2Shell } from '../../../src/components/layout/List2Shell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { FilterBar, SavedViewsControl } from '../../../src/components/ui/FilterBar'
import { FilterChip } from '../../../src/components/ui/FilterChip'
import { useSavedViews } from '../../../src/hooks/useSavedViews'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus, AlertKind } from '../types'

const ALL_STATUSES: AlertStatus[] = [
  'received',
  'triage',
  'investigation',
  'internal_review',
  'closed',
  'dismissed',
]

// The full kind enum lives in types.ts; we surface the labelled set
// from ALERT_KIND_SHORT_LABEL so the chip stays in sync with whatever
// the labels file expects.
const ALL_KINDS = Object.keys(ALERT_KIND_SHORT_LABEL) as AlertKind[]

type AlertFilters = {
  statuses: AlertStatus[]
  kinds: AlertKind[]
}

const EMPTY_FILTERS: AlertFilters = { statuses: [], kinds: [] }

function filtersFromUrl(params: URLSearchParams): AlertFilters {
  const get = (key: string) => {
    const raw = params.get(key)
    return raw ? raw.split(',').filter(Boolean) : []
  }
  return {
    statuses: get('status') as AlertStatus[],
    kinds: get('kind') as AlertKind[],
  }
}

function syncFiltersToUrl(f: AlertFilters) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const setOrDelete = (key: string, values: string[]) => {
    if (values.length > 0) url.searchParams.set(key, values.join(','))
    else url.searchParams.delete(key)
  }
  setOrDelete('status', f.statuses)
  setOrDelete('kind', f.kinds)
  window.history.replaceState(null, '', url.toString())
}

function countActive(f: AlertFilters): number {
  return f.statuses.length + f.kinds.length
}

function filtersEqual(a: AlertFilters, b: AlertFilters): boolean {
  const eq = (x: readonly string[], y: readonly string[]) => {
    if (x.length !== y.length) return false
    const xs = [...x].sort()
    const ys = [...y].sort()
    return xs.every((v, i) => v === ys[i])
  }
  return eq(a.statuses, b.statuses) && eq(a.kinds, b.kinds)
}

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
  const [filters, setFilters] = useState<AlertFilters>(() =>
    filtersFromUrl(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)),
  )
  useEffect(() => {
    syncFiltersToUrl(filters)
  }, [filters])
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const activeFilterCount = countActive(filters)

  // Saved views — module slug 'alerts'.
  const saved = useSavedViews<AlertFilters>('alerts')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (saved.loading) return
    if (activeFilterCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDefaultApplied(true)
      return
    }
    if (saved.defaultViewId) {
      const def = saved.views.find((v) => v.id === saved.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [defaultApplied, saved.loading, saved.defaultViewId, saved.views, activeFilterCount])

  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = saved.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !filtersEqual(filters, { ...EMPTY_FILTERS, ...view.filters })
  }, [activeViewId, filters, saved.views])

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase()
    const statusSet = filters.statuses.length ? new Set(filters.statuses) : null
    const kindSet = filters.kinds.length ? new Set(filters.kinds) : null
    return alerts.cases.filter((c) => {
      if (statusSet && !statusSet.has(c.status)) return false
      if (kindSet && !kindSet.has(c.kind)) return false
      if (qLower && !c.title.toLowerCase().includes(qLower)) return false
      return true
    })
  }, [alerts.cases, q, filters])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setQ('')
    setPage(1)
  }, [])

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Alle' }]}
      width="full"
      title="Alle saker"
      description="Alle saker — sortert etter mottakstidspunkt."
      loading={alerts.loading}
    >
      <List2Shell>
        {/* Search row */}
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
        </div>

        {/* Filter bar — Status + Type chips + saved views */}
        <FilterBar
          chips={
            <>
              <FilterChip
                label="Status"
                options={ALL_STATUSES.map((s) => ({ value: s, label: ALERT_STATUS_LABEL[s] }))}
                value={filters.statuses}
                onChange={(next) => {
                  setFilters((f) => ({ ...f, statuses: next as AlertStatus[] }))
                  setActiveViewId(null)
                  setPage(1)
                }}
              />
              <FilterChip
                label="Type"
                options={ALL_KINDS.map((k) => ({
                  value: k,
                  label: ALERT_KIND_SHORT_LABEL[k] ?? k,
                }))}
                value={filters.kinds}
                onChange={(next) => {
                  setFilters((f) => ({ ...f, kinds: next as AlertKind[] }))
                  setActiveViewId(null)
                  setPage(1)
                }}
              />
            </>
          }
          activeFilterCount={activeFilterCount}
          onReset={() => {
            clearAll()
            setActiveViewId(null)
          }}
          savedViews={
            <SavedViewsControl<AlertFilters>
              currentFilters={filters}
              activeViewId={activeViewId}
              hasUnsavedChanges={hasUnsavedChanges}
              onApplyView={(view) => {
                setFilters({ ...EMPTY_FILTERS, ...view.filters })
                setActiveViewId(view.id)
                setPage(1)
              }}
              onClearActive={() => setActiveViewId(null)}
              saved={saved}
            />
          }
        />

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
