/**
 * ModulePageRenderer
 *
 * Renders a full module page from a ModuleTemplate config.
 * Uses the same platform layout components (WorkplaceStandardListLayout,
 * LayoutScoreStatRow, status pills) that power the rest of the app.
 *
 * Designed to be completely reusable — pass any ModuleTemplate and a
 * data array + renderRow function and get a consistent, production-ready
 * module page. Powers Inspeksjonsrunder, SJA, Vernerunder, etc.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { WorkplaceStandardListLayout } from '../layout/WorkplaceStandardListLayout'
import { LayoutScoreStatRow } from '../layout/LayoutScoreStatRow'
import type { HubMenu1Item } from '../layout/HubMenu1Bar'
import type {
  ModuleTemplate,
  StatusColor,
  StatusDef,
  TableColumn,
} from '../../types/moduleTemplate'

/* ── Status pill ──────────────────────────────────────────────────────────── */

const STATUS_PILL_CLASSES: Record<StatusColor, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  green:   'bg-emerald-100 text-emerald-800',
  amber:   'bg-amber-100 text-amber-800',
  red:     'bg-red-100 text-red-800',
  blue:    'bg-sky-100 text-sky-800',
  purple:  'bg-violet-100 text-violet-800',
  teal:    'bg-teal-100 text-teal-800',
}

export function StatusPill({ statusKey, statuses }: { statusKey: string; statuses: StatusDef[] }) {
  const def = statuses.find((s) => s.key === statusKey)
  const label = def?.label ?? statusKey
  const cls = STATUS_PILL_CLASSES[def?.color ?? 'neutral']
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

/* ── Column width helper ─────────────────────────────────────────────────── */

const WIDTH_CLASS: Record<string, string> = {
  xs:   'w-16',
  sm:   'w-24',
  md:   'w-36',
  lg:   'w-56',
  auto: '',
}

function colWidthClass(col: TableColumn): string {
  return WIDTH_CLASS[col.width ?? 'auto'] ?? ''
}

/* ── Table header row ─────────────────────────────────────────────────────── */

/** Exported for bespoke tables (e.g. SJA) that should match ModulePageRenderer. */
export const MODULE_PAGE_TABLE_TH_CLASS =
  'border-b border-neutral-200 bg-[#EFE8DC] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600 first:pl-5 last:pr-5'
export const MODULE_PAGE_TABLE_TD_CLASS = 'border-b border-neutral-100 px-4 py-3 text-sm text-neutral-800 first:pl-5 last:pr-5'
const TH_BASE = MODULE_PAGE_TABLE_TH_CLASS
const TD_BASE = MODULE_PAGE_TABLE_TD_CLASS

/* ── Props ────────────────────────────────────────────────────────────────── */

export type ModulePageRendererProps<T extends Record<string, unknown>> = {
  template: ModuleTemplate
  /** Live records to display in the table */
  records: T[]
  /** Total record count for KPI (may differ from filtered) */
  totalCount?: number
  /** Renders the value of a single cell given column + record */
  renderCell: (col: TableColumn, record: T) => ReactNode
  /** Called when user clicks the primary action button */
  onPrimaryAction?: () => void
  /** Primary action label override (defaults to "Ny inspeksjon") */
  primaryActionLabel?: string
  /** Hub menu tabs — if omitted, no tab strip is shown */
  hubItems?: HubMenu1Item[]
  /** Called when user clicks the settings button */
  onSettingsClick?: () => void
  /** Optional overlay (e.g. a slide-over panel) */
  overlay?: ReactNode
  /** Currently active status filter (drives filter pills) */
  activeStatusFilter?: string
  onStatusFilterChange?: (status: string | undefined) => void
  /** Search value */
  search: string
  onSearchChange: (value: string) => void
  /** Sort field */
  sortField?: string
  onSortChange?: (field: string) => void
  /** Empty state message */
  emptyMessage?: string
  /** Optional extra content above the table (e.g. notice panels) */
  aboveTable?: ReactNode
  /** When false, hide the inner H1/description (parent page already shows module title). */
  showListHeading?: boolean
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function ModulePageRenderer<T extends Record<string, unknown>>({
  template,
  records,
  totalCount,
  renderCell,
  onPrimaryAction,
  primaryActionLabel,
  hubItems = [],
  onSettingsClick,
  overlay,
  activeStatusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  sortField,
  onSortChange,
  emptyMessage = 'Ingen poster matcher søket.',
  aboveTable,
  showListHeading = true,
}: ModulePageRendererProps<T>) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { heading, tableColumns, statuses, kpis } = template
  const visibleCols = useMemo(
    () => tableColumns.filter((c) => !c.hidden),
    [tableColumns],
  )

  // KPI items — count filtered records per status filter
  const kpiItems = useMemo(() =>
    kpis
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({
        big: String(
          k.filter
            ? records.filter((r) => String(r[k.filter!.field]) === k.filter!.value).length
            : (totalCount ?? records.length),
        ),
        title: k.label,
        sub: k.sub,
      }))
  , [kpis, records, totalCount])

  // Sort options from sortable columns
  const sortOptions = useMemo(() =>
    visibleCols
      .filter((c) => c.sortable && c.format !== 'actions')
      .map((c) => ({ value: c.id, label: c.label }))
  , [visibleCols])

  // Filter panel: status chips
  const filterPanel = useMemo(() => (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onStatusFilterChange?.(undefined)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          !activeStatusFilter ? 'bg-[#1a3d32] text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
        }`}
      >
        Alle
      </button>
      {statuses.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onStatusFilterChange?.(activeStatusFilter === s.key ? undefined : s.key)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            activeStatusFilter === s.key ? 'bg-[#1a3d32] text-white' : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  ), [statuses, activeStatusFilter, onStatusFilterChange])

  const breadcrumb = (heading.breadcrumb ?? []).map((label, i, arr) => ({
    label,
    to: i < arr.length - 1 ? undefined : undefined,
  }))

  return (
    <WorkplaceStandardListLayout
      breadcrumb={breadcrumb}
      title={heading.title}
      description={
        heading.description
          ? <p className="max-w-2xl text-sm text-neutral-600">{heading.description}</p>
          : undefined
      }
      showTitleBlock={showListHeading}
      hubAriaLabel={`${heading.title} — faner`}
      hubItems={hubItems}
      toolbar={{
        count: { value: records.length, label: `${heading.title.toLowerCase()} (${activeStatusFilter ? statuses.find(s => s.key === activeStatusFilter)?.label ?? activeStatusFilter : 'alle'})` },
        searchPlaceholder: `Søk i ${heading.title.toLowerCase()}…`,
        searchValue: search,
        onSearchChange,
        filtersOpen,
        onFiltersOpenChange: setFiltersOpen,
        filterStatusText: activeStatusFilter ? `Filter: ${statuses.find(s => s.key === activeStatusFilter)?.label}` : undefined,
        filterPanel,
        sortOptions: sortOptions.length > 0 ? sortOptions : undefined,
        sortValue: sortField,
        onSortChange,
        viewMode: 'table',
        onViewModeChange: () => void 0,
        primaryAction: {
          label: primaryActionLabel ?? `Ny ${heading.title.toLowerCase()}`,
          icon: Plus,
          onClick: onPrimaryAction,
        },
        showSettingsButton: !!onSettingsClick,
        onSettingsClick,
        settingsAriaLabel: 'Innstillinger',
      }}
      overlay={overlay}
    >
      {/* KPI row */}
      {kpiItems.length > 0 && (
        <div className="mb-5">
          <LayoutScoreStatRow items={kpiItems} />
        </div>
      )}

      {/* Extra content above table */}
      {aboveTable && <div className="mb-5">{aboveTable}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-left">
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.id}
                  className={`${TH_BASE} ${colWidthClass(col)}`}
                  onClick={col.sortable && onSortChange ? () => onSortChange(col.id) : undefined}
                  style={col.sortable && onSortChange ? { cursor: 'pointer' } : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && sortField === col.id && (
                      <span className="text-[#1a3d32]">↑</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-5 py-12 text-center text-sm text-neutral-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.map((record, ri) => (
                <tr key={String(record.id ?? ri)} className="hover:bg-neutral-50/70">
                  {visibleCols.map((col) => (
                    <td key={col.id} className={`${TD_BASE} ${colWidthClass(col)}`}>
                      {renderCell(col, record)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="mt-3 text-right text-xs text-neutral-400">
        {records.length === (totalCount ?? records.length)
          ? `${records.length} poster`
          : `${records.length} av ${totalCount ?? records.length} poster`}
      </div>
    </WorkplaceStandardListLayout>
  )
}
