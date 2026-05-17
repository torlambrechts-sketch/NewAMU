// ModuleAlleListPage — generic "Alle X" table view for every capability
// module (category-architecture §T7). Renders a search + filter chip strip
// + table with category-grouped rows. Drops below the per-module Analyse
// page in the sidebar so users have one canonical place to scan + filter
// every instance the module knows about.
//
// Generic over `RowT` so per-module pages stay thin: each one declares
// its row source, columns, search adapter, category resolver, and
// (optionally) a chip-filter list. The active regulation filter from
// RegulationFilterContext is applied automatically.

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { ModulePageShell } from './ModulePageShell'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect } from '../ui/SearchableSelect'
import { useRegulationFilter } from '../../context/RegulationFilterContext'

export type ModuleAlleColumn<RowT> = {
  key: string
  label: string
  /** Cell renderer. Falls back to `String(row[key as keyof RowT])` when omitted. */
  render?: (row: RowT) => ReactNode
  /** Sort affinity — `'category'` is the default group order; otherwise pure string compare. */
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
  /** Optional filter chips rendered in a strip below the search box. */
  chipFilters?: ModuleAlleChipFilter<RowT>[]
  /** Empty-state node when zero rows survive filtering. */
  emptyState?: ReactNode
  /** Optional accent for the search-bar focus + table chrome. */
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

  const setEnumChip = (id: string, value: string) => {
    setChipState((prev) => {
      const next = { ...prev }
      if (!value) delete next[id]
      else next[id] = { kind: 'enum', value }
      return next
    })
  }
  const setDateChip = (id: string, patch: { from?: string; to?: string }) => {
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
    setChipState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!isRegulationActive(getRegulationId(r))) return false
      if (q.length > 0 && !searchableText(r).toLowerCase().includes(q)) return false
      // Chip filters
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
            const from = new Date(state.from).getTime()
            if (at < from) return false
          }
          if (state.to) {
            // Inclusive end-of-day
            const to = new Date(`${state.to}T23:59:59`).getTime()
            if (at > to) return false
          }
        }
      }
      return true
    })
  }, [
    rows,
    query,
    isRegulationActive,
    getRegulationId,
    searchableText,
    chipFilters,
    chipState,
  ])

  // Group by category id for the default sort. When no categoryNameById
  // is supplied we still group, just without rendered headers.
  const grouped = useMemo(() => {
    const buckets = new Map<string, RowT[]>()
    for (const r of filtered) {
      const key = getCategoryId(r) ?? '__uncat__'
      const list = buckets.get(key) ?? []
      list.push(r)
      buckets.set(key, list)
    }
    const orderedKeys = [...buckets.keys()].sort((a, b) => {
      // Uncategorised rows fall to the bottom.
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
  }, [filtered, getCategoryId, categoryNameById])

  return (
    <ModulePageShell breadcrumb={breadcrumb} title={title} description={description} headerActions={headerActions}>
      <div className="space-y-4">
        {/* Search row — mirrors the action-board filter strip pattern */}
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <StandardInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i alle…"
            aria-label="Søk"
            className="pl-9"
          />
        </div>

        {/* Chip filter strip (action-board pattern). */}
        {chipFilters && chipFilters.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            {chipFilters.map((chip) => {
              if (chip.kind === 'enum') {
                const state = chipState[chip.id]
                const value = state?.kind === 'enum' ? state.value : ''
                return (
                  <div key={chip.id} className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
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
                          <X className="h-3.5 w-3.5" aria-hidden />
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
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {chip.label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <StandardInput
                      type="date"
                      value={from}
                      onChange={(e) => setDateChip(chip.id, { from: e.target.value })}
                      aria-label={`${chip.label} fra`}
                      className="w-[150px]"
                    />
                    <span className="text-xs text-neutral-400">–</span>
                    <StandardInput
                      type="date"
                      value={to}
                      onChange={(e) => setDateChip(chip.id, { to: e.target.value })}
                      aria-label={`${chip.label} til`}
                      className="w-[150px]"
                    />
                    {from || to ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => clearChip(chip.id)}
                        aria-label={`Fjern ${chip.label}-filter`}
                        className="h-auto w-auto rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Table — category headers separate row groups */}
        {filtered.length === 0 ? (
          (emptyState ?? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
              Ingen rader matcher de aktive filtrene.
            </div>
          ))
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50">
                <tr className="border-b border-neutral-200">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 ${
                        c.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="bg-neutral-50/60">
                      <td
                        colSpan={columns.length}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                      >
                        {group.label}
                        <span className="ml-2 font-normal text-neutral-400">
                          ({group.rows.length})
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((row, ri) => (
                      <tr
                        key={`${group.key}:${ri}`}
                        className="border-t border-neutral-100 hover:bg-neutral-50/40"
                      >
                        {columns.map((c) => {
                          const content = c.render
                            ? c.render(row)
                            : String((row as Record<string, unknown>)[c.key] ?? '—')
                          return (
                            <td
                              key={c.key}
                              className={`px-4 py-2 text-neutral-800 ${
                                c.align === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {content}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModulePageShell>
  )
}

