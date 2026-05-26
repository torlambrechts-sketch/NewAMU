// ModuleAlleListPage — generic "Alle X" table view for every capability
// module. Header bar + always-visible FilterBar with multi-select
// dropdown chips + paginated grouped table.
//
// Consumers pass `chipFilters` (single-select-shaped accessors carried
// over from the previous panel-based implementation). The wrapper
// converts each enum chip to a multi-select <FilterChip>; chip state
// is OR-semantics (show rows where accessor(row) ∈ selected).
//
// When `moduleSlug` is provided, the FilterBar exposes the saved-views
// control so admins can curate per-module landing combinations
// (org-shared content + per-user default star).

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { ModulePageShell } from './ModulePageShell'
import type { PageWidth } from '../layout/PageContainer'
import { List2Shell } from '../layout/List2Shell'
import { Button } from '../ui/Button'
import { SearchableSelect } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { FilterBar, SavedViewsControl } from '../ui/FilterBar'
import { FilterChip } from '../ui/FilterChip'
import { useSavedViews, type SavedView } from '../../hooks/useSavedViews'
import { useRegulationFilter } from '../../context/RegulationFilterContext'

export type ModuleAlleColumn<RowT> = {
  key: string
  label: string
  /** Cell renderer. Falls back to `String(row[key as keyof RowT])` when omitted. */
  render?: (row: RowT) => ReactNode
  align?: 'left' | 'right'
  /** Approximate fixed width in tailwind units; useful for status badges. */
  width?: string
}

/** Enum chip — accessor returns the row's value for this chip; null when none. */
export type ModuleAlleChipEnum<RowT> = {
  kind: 'enum'
  id: string
  label: string
  options: { id: string; label: string }[]
  /** Returns the row's value for this chip. Multi-select uses OR semantics. */
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

// Internal multi-select state for each chip. Enum: array of selected
// option ids. Date range: from/to ISO date strings.
type ChipMultiState =
  | { kind: 'enum'; values: string[] }
  | { kind: 'date_range'; from: string; to: string }

// Saved-views filter payload — flat record keyed by chip.id. Enum
// stores its selection array; date range stores { from, to }.
type SavedFilters = Record<
  string,
  { kind: 'enum'; values: string[] } | { kind: 'date_range'; from: string; to: string }
>

export interface ModuleAlleListPageProps<RowT> {
  title: string
  description?: ReactNode
  breadcrumb: { label: string; to?: string }[]
  headerActions?: ReactNode
  /** Content-width preset. Defaults to `full` so the table fills available space. */
  width?: PageWidth
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
  /** Optional filter chips rendered in the always-visible FilterBar. */
  chipFilters?: ModuleAlleChipFilter<RowT>[]
  /**
   * When set, enables the saved-views control in the FilterBar. The
   * slug scopes views to this module (org-shared content + per-user
   * default). Should be stable across renders (e.g. 'surveys',
   * 'documents', 'learning').
   */
  moduleSlug?: string
  /** Empty-state node when zero rows survive filtering. */
  emptyState?: ReactNode
  /** Optional accent — currently reserved for future use. */
  accent?: string
  /**
   * When provided, rows are rendered as a compact touch list on narrow screens
   * (< sm) instead of the horizontal-scroll table.
   */
  renderMobileRow?: (row: RowT) => ReactNode
}

export function ModuleAlleListPage<RowT>({
  title,
  description,
  breadcrumb,
  headerActions,
  width = 'full',
  rows,
  columns,
  getCategoryId,
  categoryNameById,
  getRegulationId,
  searchableText,
  chipFilters,
  moduleSlug,
  emptyState,
  renderMobileRow,
}: ModuleAlleListPageProps<RowT>) {
  const { isActive: isRegulationActive } = useRegulationFilter()
  const [query, setQuery] = useState('')
  const [chipState, setChipState] = useState<Record<string, ChipMultiState>>({})
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const setEnumChip = useCallback((id: string, values: string[]) => {
    setPage(1)
    setChipState((prev) => {
      const next = { ...prev }
      if (values.length === 0) delete next[id]
      else next[id] = { kind: 'enum', values }
      return next
    })
  }, [])

  const setDateChip = useCallback((id: string, patch: { from?: string; to?: string }) => {
    setPage(1)
    setChipState((prev) => {
      const cur =
        prev[id]?.kind === 'date_range'
          ? (prev[id] as { kind: 'date_range'; from: string; to: string })
          : { kind: 'date_range' as const, from: '', to: '' }
      const nextEntry: ChipMultiState = {
        kind: 'date_range',
        from: patch.from ?? cur.from,
        to: patch.to ?? cur.to,
      }
      const out = { ...prev }
      if (nextEntry.from === '' && nextEntry.to === '') delete out[id]
      else out[id] = nextEntry
      return out
    })
  }, [])

  const clearAll = useCallback(() => {
    setPage(1)
    setChipState({})
    setQuery('')
  }, [])

  const activeFilterCount =
    (query.trim() ? 1 : 0) + Object.keys(chipState).length

  // ── Saved views ─────────────────────────────────────────────────────
  // moduleSlug is required for the hook contract; we pass an empty
  // string when the consumer didn't opt in (the hook short-circuits
  // on empty slug and returns an empty list).
  const saved = useSavedViews<SavedFilters>(moduleSlug ?? '')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)

  // Apply the user's default view once after first load.
  useEffect(() => {
    if (!moduleSlug) return
    if (defaultApplied) return
    if (saved.loading) return
    if (activeFilterCount > 0) {
      // Chip state was hydrated from local state; if it happens to
      // match an existing saved view, surface that view's name in the
      // trigger label + light up the star icon. Otherwise leave the
      // trigger reading "Tilpasset visning".
      const match = saved.views.find((v) =>
        chipStateEquals(chipState, savedToChipState(v.filters)),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (saved.defaultViewId) {
      const def = saved.views.find((v) => v.id === saved.defaultViewId)
      if (def) {
        setChipState(savedToChipState(def.filters))
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [moduleSlug, defaultApplied, saved.loading, saved.defaultViewId, saved.views, activeFilterCount, chipState])

  const applyView = useCallback((view: SavedView<SavedFilters>) => {
    setPage(1)
    setChipState(savedToChipState(view.filters))
    setActiveViewId(view.id)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!isRegulationActive(getRegulationId(r))) return false
      if (q.length > 0 && !searchableText(r).toLowerCase().includes(q)) return false
      for (const chip of chipFilters ?? []) {
        const state = chipState[chip.id]
        if (!state) continue
        if (chip.kind === 'enum' && state.kind === 'enum') {
          if (state.values.length === 0) continue
          const v = chip.accessor(r)
          if (!v || !state.values.includes(v)) return false
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

  // Separate enum chips (rendered as FilterChip dropdowns in the bar)
  // from date_range chips (rendered as date input pairs below the bar
  // since they don't fit the dropdown pattern).
  const enumChips = (chipFilters ?? []).filter(
    (c): c is ModuleAlleChipEnum<RowT> => c.kind === 'enum',
  )
  const dateChips = (chipFilters ?? []).filter(
    (c): c is ModuleAlleChipDateRange<RowT> => c.kind === 'date_range',
  )

  // Detect unsaved changes vs the currently-applied view.
  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = saved.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !chipStateEquals(chipState, savedToChipState(view.filters))
  }, [activeViewId, chipState, saved.views])

  return (
    <ModulePageShell breadcrumb={breadcrumb} title={title} description={description} headerActions={headerActions} width={width}>
      <List2Shell>
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
          <div className="relative min-w-[200px] flex-1">
            <StandardInput
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder="Søk i alle…"
              aria-label="Søk"
              className="w-full"
            />
          </div>
        </div>

        {/* FilterBar — enum chips + saved views */}
        {enumChips.length > 0 || moduleSlug ? (
          <FilterBar
            chips={
              <>
                {enumChips.map((chip) => {
                  const state = chipState[chip.id]
                  const value = state?.kind === 'enum' ? state.values : []
                  return (
                    <FilterChip
                      key={chip.id}
                      label={chip.label}
                      options={chip.options.map((o) => ({ value: o.id, label: o.label }))}
                      value={value}
                      onChange={(next) => {
                        setEnumChip(chip.id, next)
                        setActiveViewId(null)
                      }}
                    />
                  )
                })}
              </>
            }
            activeFilterCount={Object.keys(chipState).length}
            onReset={() => {
              clearAll()
              setActiveViewId(null)
            }}
            savedViews={
              moduleSlug ? (
                <SavedViewsControl<SavedFilters>
                  currentFilters={chipStateToSaved(chipState)}
                  activeViewId={activeViewId}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onApplyView={applyView}
                  onClearActive={() => setActiveViewId(null)}
                  saved={saved}
                />
              ) : undefined
            }
          />
        ) : null}

        {/* Date-range chip row — kept as date input pairs since the chip
            dropdown pattern doesn't fit date pickers. Rendered only when
            date chips exist. */}
        {dateChips.length > 0 ? (
          <div className="flex flex-wrap items-end gap-4 border-b border-neutral-100 bg-neutral-50/40 px-4 py-3 md:px-5">
            {dateChips.map((chip) => {
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
                      onChange={(e) => { setDateChip(chip.id, { from: e.target.value }); setActiveViewId(null) }}
                      aria-label={`${chip.label} fra`}
                      className="w-[148px]"
                    />
                    <span className="text-xs text-neutral-400">–</span>
                    <StandardInput
                      type="date"
                      value={to}
                      onChange={(e) => { setDateChip(chip.id, { to: e.target.value }); setActiveViewId(null) }}
                      aria-label={`${chip.label} til`}
                      className="w-[148px]"
                    />
                    {from || to ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDateChip(chip.id, { from: '', to: '' }); setActiveViewId(null) }}
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

        {/* Mobile compact list — only rendered when the caller supplies renderMobileRow */}
        {renderMobileRow ? (
          <ul className="divide-y divide-neutral-100 sm:hidden">
            {total === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-neutral-500">
                {emptyState ?? 'Ingen rader matcher de aktive filtrene.'}
              </li>
            ) : (
              pagedGroups.flatMap((group) =>
                group.rows.map((row, ri) => (
                  <li key={`${group.key}:${ri}`}>{renderMobileRow(row)}</li>
                )),
              )
            )}
          </ul>
        ) : null}

        {/* Table */}
        <div className={renderMobileRow ? 'hidden overflow-x-auto sm:block' : 'overflow-x-auto'}>
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
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <div className="w-20">
                <SearchableSelect
                  value={String(perPage)}
                  onChange={(v) => { setPerPage(Number(v)); setPage(1) }}
                  options={[
                    { value: '10', label: '10' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                  ]}
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
              variant="ghost"
              size="icon"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-auto w-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-auto w-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
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

// ── Saved-views serialisation helpers ───────────────────────────────────

function savedToChipState(filters: SavedFilters): Record<string, ChipMultiState> {
  const out: Record<string, ChipMultiState> = {}
  for (const [id, entry] of Object.entries(filters)) {
    if (entry.kind === 'enum') out[id] = { kind: 'enum', values: [...entry.values] }
    else out[id] = { kind: 'date_range', from: entry.from, to: entry.to }
  }
  return out
}

function chipStateToSaved(state: Record<string, ChipMultiState>): SavedFilters {
  const out: SavedFilters = {}
  for (const [id, entry] of Object.entries(state)) {
    if (entry.kind === 'enum') out[id] = { kind: 'enum', values: [...entry.values] }
    else out[id] = { kind: 'date_range', from: entry.from, to: entry.to }
  }
  return out
}

function chipStateEquals(
  a: Record<string, ChipMultiState>,
  b: Record<string, ChipMultiState>,
): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    const av = a[k]
    const bv = b[k]
    if (!bv) return false
    if (av.kind !== bv.kind) return false
    if (av.kind === 'enum' && bv.kind === 'enum') {
      if (av.values.length !== bv.values.length) return false
      const aSorted = [...av.values].sort()
      const bSorted = [...bv.values].sort()
      if (aSorted.some((v, i) => v !== bSorted[i])) return false
    } else if (av.kind === 'date_range' && bv.kind === 'date_range') {
      if (av.from !== bv.from || av.to !== bv.to) return false
    }
  }
  return true
}
