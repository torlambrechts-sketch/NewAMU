// ModuleAlleListPage — generic "Alle X" table view for every capability
// module (category-architecture §T7). Uses the List 2 – kandidat/ordre
// tabell pattern: search + collapsible filter panel inside a List2Shell card,
// paginated flat table with category group rows.

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import { ModulePageShell } from './ModulePageShell'
import { List2Shell } from '../layout/List2Shell'
import { Button } from '../ui/Button'
import { SearchableSelect } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { useRegulationFilter } from '../../context/RegulationFilterContext'

const CREAM_DEEP = '#EFE8DC'

export type ModuleAlleColumn<RowT> = {
  key: string
  label: string
  /** Cell renderer. Falls back to `String(row[key as keyof RowT])` when omitted. */
  render?: (row: RowT) => ReactNode
  align?: 'left' | 'right'
  /** Approximate fixed width in tailwind units; useful for status badges. */
  width?: string
}

/** Single-select enum chip — typical for status / module / source / owner. */
export type ModuleAlleChipEnum<RowT> = {
  kind: 'enum'
  id: string
  label: string
  options: { id: string; label: string }[]
  /** Returns the row's value for this chip; null when the row has no value. */
  accessor: (row: RowT) => string | null
}

/** Date-range chip — narrows by an ISO timestamp accessor. */
export type ModuleAlleChipDateRange<RowT> = {
  kind: 'date_range'
  id: string
  label: string
  /** Returns an ISO timestamp string or null. */
  accessor: (row: RowT) => string | null
}

export type ModuleAlleChipFilter<RowT> =
  | ModuleAlleChipEnum<RowT>
  | ModuleAlleChipDateRange<RowT>

type ChipState =
  | { kind: 'enum'; value: string }
  | { kind: 'date_range'; from: string; to: string }

export interface ModuleAlleListPageProps<RowT> {
  title: string
  description?: ReactNode
  breadcrumb: { label: string; to?: string }[]
  headerActions?: ReactNode
  rows: RowT[]
  columns: ModuleAlleColumn<RowT>[]
  /** Category id (Cat 2) the row belongs to — drives default grouping/sort. */
  getCategoryId: (row: RowT) => string | null
  /** Display label per category id (when there's a header in the table). */
  categoryNameById?: Map<string, string>
  /** Regulation id (Cat 1) the row belongs to — drives the cross-module filter. */
  getRegulationId: (row: RowT) => string | null
  /** Free-text search adapter — joined string is matched case-insensitively. */
  searchableText: (row: RowT) => string
  /** Optional filter chips rendered in a collapsible panel. */
  chipFilters?: ModuleAlleChipFilter<RowT>[]
  /** Empty-state node when zero rows survive filtering. */
  emptyState?: ReactNode
  /** Optional accent — currently reserved for future use. */
  accent?: string
}

export function ModuleAlleListPage<RowT>({
  title,
  description,
  breadcrumb,
  headerActions,
  rows,
  columns,
  getCategoryId,
  categoryNameById,
  getRegulationId,
  searchableText,
  chipFilters,
  emptyState,
}: ModuleAlleListPageProps<RowT>) {
  const { isActive: isRegulationActive } = useRegulationFilter()
  const [query, setQuery] = useState('')
  const [chipState, setChipState] = useState<Record<string, ChipState>>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const setEnumChip = (id: string, value: string) => {
    setPage(1)
    setChipState((prev) => {
      const next = { ...prev }
      if (!value) delete next[id]
      else next[id] = { kind: 'enum', value }
      return next
    })
  }
  const setDateChip = (id: string, patch: { from?: string; to?: string }) => {
    setPage(1)
    setChipState((prev) => {
      const cur = (prev[id] as { kind: 'date_range'; from: string; to: string } | undefined) ?? {
        kind: 'date_range' as const,
        from: '',
        to: '',
      }
      const next: ChipState = {
        kind: 'date_range',
        from: patch.from ?? cur.from,
        to: patch.to ?? cur.to,
      }
      const out = { ...prev }
      if (next.from === '' && next.to === '') delete out[id]
      else out[id] = next
      return out
    })
  }
  const clearChip = (id: string) => {
    setPage(1)
    setChipState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }
  const clearAllChips = () => {
    setPage(1)
    setChipState({})
    setQuery('')
  }

  const activeFilterCount =
    (query.trim() ? 1 : 0) + Object.keys(chipState).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!isRegulationActive(getRegulationId(r))) return false
      if (q.length > 0 && !searchableText(r).toLowerCase().includes(q)) return false
      for (const chip of chipFilters ?? []) {
        const state = chipState[chip.id]
        if (!state) continue
        if (chip.kind === 'enum' && state.kind === 'enum') {
          if (chip.accessor(r) !== state.value) return false
        } else if (chip.kind === 'date_range' && state.kind === 'date_range') {
          const raw = chip.accessor(r)
          if (!raw) return false
          const at = new Date(raw).getTime()
          if (state.from) {
            if (at < new Date(state.from).getTime()) return false
          }
          if (state.to) {
            if (at > new Date(`${state.to}T23:59:59`).getTime()) return false
          }
        }
      }
      return true
    })
  }, [rows, query, isRegulationActive, getRegulationId, searchableText, chipFilters, chipState])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageSlice = filtered.slice(start, start + perPage)

  // Re-group the current page's rows so category headers are scoped to the page.
  const pagedGroups = useMemo(() => {
    const buckets = new Map<string, RowT[]>()
    for (const r of pageSlice) {
      const key = getCategoryId(r) ?? '__uncat__'
      const list = buckets.get(key) ?? []
      list.push(r)
      buckets.set(key, list)
    }
    const orderedKeys = [...buckets.keys()].sort((a, b) => {
      if (a === '__uncat__') return 1
      if (b === '__uncat__') return -1
      const aLabel = categoryNameById?.get(a) ?? a
      const bLabel = categoryNameById?.get(b) ?? b
      return aLabel.localeCompare(bLabel, 'nb')
    })
    return orderedKeys.map((k) => ({
      key: k,
      label: k === '__uncat__' ? 'Uten kategori' : (categoryNameById?.get(k) ?? k),
      rows: buckets.get(k) ?? [],
    }))
  }, [pageSlice, getCategoryId, categoryNameById])

  const hasFilters = Boolean(chipFilters && chipFilters.length > 0)

  return (
    <ModulePageShell breadcrumb={breadcrumb} title={title} description={description} headerActions={headerActions}>
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
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder="Søk i alle…"
              aria-label="Søk"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/20"
            />
          </div>
          {hasFilters ? (
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
                  onClick={clearAllChips}
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
                >
                  <X className="size-3.5" aria-hidden />
                  Nullstill
                </button>
              ) : (
                <span className="text-xs text-neutral-400">Ingen filter aktive</span>
              )}
            </div>
          ) : null}
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && hasFilters ? (
          <div
            className="flex flex-wrap items-end gap-4 border-b border-neutral-100 px-4 py-4 md:px-5"
            style={{ backgroundColor: CREAM_DEEP }}
          >
            {chipFilters!.map((chip) => {
              if (chip.kind === 'enum') {
                const state = chipState[chip.id]
                const value = state?.kind === 'enum' ? state.value : ''
                return (
                  <div key={chip.id} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                      {chip.label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="min-w-[180px]">
                        <SearchableSelect
                          value={value}
                          options={[
                            { value: '', label: 'Alle' },
                            ...chip.options.map((o) => ({ value: o.id, label: o.label })),
                          ]}
                          onChange={(v) => setEnumChip(chip.id, v)}
                          placeholder="Alle"
                        />
                      </div>
                      {value ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => clearChip(chip.id)}
                          aria-label={`Fjern ${chip.label}-filter`}
                          className="h-auto w-auto rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                        >
                          <X className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              }
              const state = chipState[chip.id]
              const from = state?.kind === 'date_range' ? state.from : ''
              const to = state?.kind === 'date_range' ? state.to : ''
              return (
                <div key={chip.id} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                    {chip.label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <StandardInput
                      type="date"
                      value={from}
                      onChange={(e) => setDateChip(chip.id, { from: e.target.value })}
                      aria-label={`${chip.label} fra`}
                      className="w-[148px]"
                    />
                    <span className="text-xs text-neutral-400">–</span>
                    <StandardInput
                      type="date"
                      value={to}
                      onChange={(e) => setDateChip(chip.id, { to: e.target.value })}
                      aria-label={`${chip.label} til`}
                      className="w-[148px]"
                    />
                    {from || to ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => clearChip(chip.id)}
                        aria-label={`Fjern ${chip.label}-filter`}
                        className="h-auto w-auto rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-5 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    {emptyState ?? (
                      <div className="px-5 py-10 text-center text-sm text-neutral-500">
                        Ingen rader matcher de aktive filtrene.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                pagedGroups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="bg-neutral-50/60">
                      <td
                        colSpan={columns.length}
                        className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400"
                      >
                        {group.label}
                        <span className="ml-2 font-normal">({group.rows.length})</span>
                      </td>
                    </tr>
                    {group.rows.map((row, ri) => (
                      <tr
                        key={`${group.key}:${ri}`}
                        className="border-b border-neutral-100 hover:bg-neutral-50/80"
                      >
                        {columns.map((c) => {
                          const content = c.render
                            ? c.render(row)
                            : String((row as Record<string, unknown>)[c.key] ?? '—')
                          return (
                            <td
                              key={c.key}
                              className={`px-5 py-4 text-neutral-800 ${
                                c.align === 'right' ? 'text-right' : ''
                              }`}
                            >
                              {content}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
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
