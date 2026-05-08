// ModuleAlleListPage — generic "Alle X" table view for every capability
// module (category-architecture §T7). Renders a search + table with
// category-grouped rows. Drops below the per-module Analyse page in the
// sidebar so users have one canonical place to scan + filter every
// instance the module knows about.
//
// Generic over `RowT` so per-module pages stay thin: each one declares
// its row source, columns, search adapter, and category resolver, then
// hands the rest to the dashboard shell. The active regulation filter
// from RegulationFilterContext is applied automatically.

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { ModulePageShell } from './ModulePageShell'
import { StandardInput } from '../ui/Input'
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
  emptyState,
}: ModuleAlleListPageProps<RowT>) {
  const { isActive: isRegulationActive } = useRegulationFilter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!isRegulationActive(getRegulationId(r))) return false
      if (q.length === 0) return true
      return searchableText(r).toLowerCase().includes(q)
    })
  }, [rows, query, isRegulationActive, getRegulationId, searchableText])

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

