/**
 * Template component library — Phase 2: UI Component System.
 *
 * Canonical layout shells for every feature module. Import from
 * `../template` (the barrel) rather than from this file directly.
 *
 * Five primitives, all slot-prop / composition based:
 *   PageShell       — full page: breadcrumb → H1 → hub tabs → toolbar → canvas
 *   ModuleListView  — DB-driven list: KPI strip + toolbar + table
 *   ModuleDetailView— single-record detail panel
 *   FormModal       — right slide-over form
 *   DataTable       — type-safe generic table
 */

import type { ReactNode, ThHTMLAttributes } from 'react'

import {
  WorkplaceStandardListLayout,
  type WorkplaceStandardListLayoutProps,
} from '../components/layout/WorkplaceStandardListLayout'
import { WorkplaceStandardFormPanel } from '../components/layout/WorkplaceStandardFormPanel'
import { Table1Shell } from '../components/layout/Table1Shell'
import { ModulePageRenderer } from '../components/module/ModulePageRenderer'
import type { ModulePageRendererProps } from '../components/module/ModulePageRenderer'
import { WORKPLACE_PAGE_SERIF } from '../components/layout/WorkplacePageHeading1'

/* ── PageShell ────────────────────────────────────────────────────────────── */

export type PageShellProps = WorkplaceStandardListLayoutProps

/**
 * Full-page shell: breadcrumb → serif H1 → description → hub tabs →
 * optional toolbar → cream canvas card.
 *
 * Thin alias over `WorkplaceStandardListLayout`. Using this import keeps
 * future shell swaps to a single file rather than touching every module.
 */
export function PageShell(props: PageShellProps) {
  return <WorkplaceStandardListLayout {...props} />
}

/* ── ModuleListView ───────────────────────────────────────────────────────── */

export type ModuleListViewProps<T extends Record<string, unknown>> =
  ModulePageRendererProps<T>

/**
 * Data-driven list view: KPI stat strip → toolbar (search / filter / sort /
 * primary CTA) → table with column widths from `ModuleTemplate`.
 *
 * Pass any `ModuleTemplate` + your records and a `renderCell` function —
 * columns, statuses, and KPI definitions all come from the DB config.
 */
export function ModuleListView<T extends Record<string, unknown>>(
  props: ModuleListViewProps<T>,
) {
  return <ModulePageRenderer {...props} />
}

/* ── ModuleDetailView ─────────────────────────────────────────────────────── */

export type ModuleDetailViewProps = {
  /** Serif H2 in the card header */
  title: ReactNode
  /** Optional metadata line below the title (date, assignee…) */
  subtitle?: ReactNode
  /** Buttons / badges in the top-right header corner */
  headerActions?: ReactNode
  /** Scrollable record body */
  children: ReactNode
  /** Sticky footer — status bar, sign-off, save/cancel */
  footer?: ReactNode
}

const CARD = 'rounded-xl border border-neutral-200/80 bg-white overflow-hidden'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/**
 * Full-width detail panel for a single record (inspection round, case, task…).
 *
 * Matches the cream/white surface language of the workplace shell.
 * Compose inside `PageShell` as its `children`.
 */
export function ModuleDetailView({
  title,
  subtitle,
  headerActions,
  children,
  footer,
}: ModuleDetailViewProps) {
  return (
    <div className={CARD} style={CARD_SHADOW}>
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200/80 px-6 py-5">
        <div className="min-w-0">
          <h2
            className="text-2xl font-semibold tracking-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {headerActions}
          </div>
        ) : null}
      </header>

      <div className="px-6 py-6">{children}</div>

      {footer ? (
        <footer className="border-t border-neutral-200/80 bg-[#f0efe9] px-6 py-4">
          {footer}
        </footer>
      ) : null}
    </div>
  )
}

/* ── FormModal ────────────────────────────────────────────────────────────── */

export type FormModalProps = {
  open: boolean
  onClose: () => void
  /** Must match the id on the modal's heading element for `aria-labelledby` */
  titleId: string
  title: ReactNode
  children: ReactNode
  footer: ReactNode
}

/**
 * Right-side slide-over form panel.
 *
 * Matches the Tasks create/edit pattern: cream surface, serif title, sticky
 * footer band. Use inside `PageShell`'s `overlay` prop.
 */
export function FormModal(props: FormModalProps) {
  return <WorkplaceStandardFormPanel {...props} />
}

/* ── DataTable ────────────────────────────────────────────────────────────── */

export type DataTableColumn<T> = {
  /** Stable key used as React key and for the `<th>` */
  id: string
  /** Column header label */
  header: string
  /** Fixed width hint — maps to Tailwind classes defined as full literals */
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'auto'
  /** Render a single cell for this column */
  cell: (row: T, index: number) => ReactNode
  /** Extra `<th>` attributes (e.g. `aria-sort`) */
  headerProps?: ThHTMLAttributes<HTMLTableCellElement>
}

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  /** Stable key for React reconciliation */
  getRowKey: (row: T, index: number) => string
  /** Toolbar slot — pass `WorkplaceListToolbar` or any node */
  toolbar?: ReactNode
  /** Shown when `rows` is empty */
  emptyMessage?: ReactNode
  /** Adds hover + cursor-pointer on rows */
  onRowClick?: (row: T) => void
  className?: string
}

const TH =
  'border-b border-neutral-200 bg-[#EFE8DC] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-600 first:pl-5 last:pr-5'
const TD =
  'border-b border-neutral-100 px-4 py-3 text-sm text-neutral-800 first:pl-5 last:pr-5'
const WIDTH: Record<string, string> = {
  xs: 'w-16',
  sm: 'w-24',
  md: 'w-36',
  lg: 'w-56',
  auto: '',
}

/**
 * Generic, fully typed data table composed from `Table1Shell`.
 *
 * Modules compose this instead of hand-rolling `<table>` markup — consistent
 * header styling, empty states, and horizontal overflow are handled here.
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     { id: 'title', header: 'Tittel', width: 'lg', cell: (r) => r.title },
 *     { id: 'status', header: 'Status', cell: (r) => <StatusPill ... /> },
 *   ]}
 *   rows={records}
 *   getRowKey={(r) => r.id}
 *   onRowClick={(r) => openPanel(r)}
 * />
 * ```
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  toolbar,
  emptyMessage = 'Ingen poster funnet.',
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  return (
    <Table1Shell toolbar={toolbar}>
      <table
        className={`w-full min-w-[540px] border-collapse text-left ${className}`.trim()}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className={`${TH} ${WIDTH[col.width ?? 'auto'] ?? ''}`}
                {...col.headerProps}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-10 text-center text-sm text-neutral-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={
                  onRowClick
                    ? 'cursor-pointer transition hover:bg-neutral-50'
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`${TD} ${WIDTH[col.width ?? 'auto'] ?? ''}`}
                  >
                    {col.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Table1Shell>
  )
}
