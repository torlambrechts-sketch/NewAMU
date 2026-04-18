import type { LucideIcon } from 'lucide-react'
import { Filter, LayoutGrid, List, Plus, Search, Settings, Table2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HubMenu1Item } from './HubMenu1Bar'
import { HubMenu1Bar } from './HubMenu1Bar'
import type { WorkplaceBreadcrumbItem } from './WorkplacePageHeading1'
import { WorkplacePageHeading1 } from './WorkplacePageHeading1'

/** Primary action green — matches layout-reference CTA */
export const WORKPLACE_LIST_LAYOUT_CTA = '#2D403A'

/** z-index for full-viewport slide-over (same as Tasks create/edit panel). */
export const WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX = 100
const CREAM_DEEP = '#EFE8DC'

const CARD =
  'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

export type WorkplaceListViewMode = 'table' | 'box' | 'list'

export type WorkplaceListToolbarCount = {
  value: number
  /** e.g. "aktive annonser" */
  label: string
}

export type WorkplaceListToolbarSortOption = { value: string; label: string }

export type WorkplaceListToolbarProps = {
  /** Optional large number + label on the left (e.g. active jobs count) */
  count?: WorkplaceListToolbarCount
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  /** Filters button toggles panel */
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
  /** Shown next to Filters — e.g. "No filters applied" */
  filterStatusText?: string
  /** Optional panel below toolbar row (filters form) */
  filterPanel?: ReactNode
  sortOptions?: WorkplaceListToolbarSortOption[]
  sortValue?: string
  onSortChange?: (value: string) => void
  viewMode: WorkplaceListViewMode
  onViewModeChange: (mode: WorkplaceListViewMode) => void
  /** Main CTA — label should match page context */
  primaryAction: {
    label: string
    onClick?: () => void
    icon?: LucideIcon
  }
  /** Optional settings control (icon button) */
  showSettingsButton?: boolean
  onSettingsClick?: () => void
  settingsAriaLabel?: string
  className?: string
}

/**
 * Toolbar row: optional count, search, filters, table/box/list switch, sort, primary CTA.
 * Use with {@link WorkplaceStandardListLayout} or standalone on cream pages.
 */
export function WorkplaceListToolbar({
  count,
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  filtersOpen,
  onFiltersOpenChange,
  filterStatusText,
  filterPanel,
  sortOptions,
  sortValue,
  onSortChange,
  viewMode,
  onViewModeChange,
  primaryAction,
  showSettingsButton,
  onSettingsClick,
  settingsAriaLabel = 'Innstillinger',
  className = '',
}: WorkplaceListToolbarProps) {
  const PrimaryIcon = primaryAction.icon ?? Plus

  return (
    <div className={className}>
      <div className={`${CARD} overflow-hidden p-0`} style={CARD_SHADOW}>
        {/*
          Mobile: primary CTA first (full width) so it is never pushed below the fold by search + flex-wrap.
          md+: count → search → secondary controls → CTA (order reset).
        */}
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:gap-3 md:px-5 lg:gap-4">
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="order-1 flex w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm md:order-5 md:w-auto"
            style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
          >
            <PrimaryIcon className="size-4 shrink-0" strokeWidth={2.5} />
            {primaryAction.label}
          </button>
          {count ? (
            <p className="order-2 shrink-0 text-sm text-neutral-900 md:order-1">
              <span className="text-2xl font-bold tabular-nums text-neutral-900">{count.value}</span>{' '}
              <span className="font-medium text-neutral-600">{count.label}</span>
            </p>
          ) : null}
          <div className="relative order-3 min-w-0 w-full md:order-2 md:min-w-[200px] md:flex-1">
            <label htmlFor="workplace-list-toolbar-search" className="sr-only">
              Søk
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="workplace-list-toolbar-search"
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <div className="order-4 flex min-w-0 flex-1 flex-wrap items-center gap-2 md:order-3 md:flex-none md:shrink-0">
            <button
              type="button"
              onClick={() => onFiltersOpenChange(!filtersOpen)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                filtersOpen
                  ? 'border-neutral-400 bg-neutral-50 text-neutral-900'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              aria-expanded={filtersOpen}
            >
              <Filter className="size-3.5 text-neutral-500" />
              Filters
            </button>
            {filterStatusText ? (
              <span className="min-w-0 max-w-[10rem] truncate text-xs text-neutral-500 sm:max-w-none sm:whitespace-normal">
                {filterStatusText}
              </span>
            ) : null}
            <div className="flex shrink-0 rounded-lg border border-neutral-200 bg-white p-0.5" role="group" aria-label="Visning">
              <button
                type="button"
                onClick={() => onViewModeChange('table')}
                className={`rounded-md p-2 ${viewMode === 'table' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                aria-pressed={viewMode === 'table'}
                aria-label="Tabell"
                title="Tabell"
              >
                <Table2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('box')}
                className={`rounded-md p-2 ${viewMode === 'box' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                aria-pressed={viewMode === 'box'}
                aria-label="Boks (rutenett)"
                title="Boks"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={`rounded-md p-2 ${viewMode === 'list' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                aria-pressed={viewMode === 'list'}
                aria-label="Liste"
                title="Liste"
              >
                <List className="size-4" />
              </button>
            </div>
            {sortOptions && sortOptions.length > 0 && onSortChange ? (
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-neutral-600 sm:flex-initial">
                <span className="hidden sm:inline">Sorter</span>
                <select
                  value={sortValue ?? sortOptions[0]?.value}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-900 sm:min-w-[8rem] sm:flex-none"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showSettingsButton ? (
              <button
                type="button"
                onClick={onSettingsClick}
                className="ml-auto shrink-0 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 md:ml-0"
                aria-label={settingsAriaLabel}
              >
                <Settings className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
        {filtersOpen && filterPanel ? (
          <div className="border-b border-neutral-100 px-4 py-3 md:px-5" style={{ backgroundColor: CREAM_DEEP }}>
            {filterPanel}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type WorkplaceStandardListLayoutProps = {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  /** When false, only breadcrumb + hub render (tab supplies page title elsewhere, e.g. HSE module shell). */
  showTitleBlock?: boolean
  hubAriaLabel: string
  hubItems: HubMenu1Item[]
  /** Omit or pass `undefined` to hide the toolbar row (e.g. compact dashboard). */
  toolbar?: WorkplaceListToolbarProps
  /** Main content (switch table / cards / list in parent based on toolbar.viewMode) */
  children: ReactNode
  /** Optional slide-over (e.g. create/edit) — same z-index as list CTA pattern */
  overlay?: ReactNode
  /** Extra class on content card */
  contentClassName?: string
  className?: string
}

/**
 * Standard workplace list page: {@link WorkplacePageHeading1} + hub + {@link WorkplaceListToolbar} + white content card.
 * Import from `components/layout/WorkplaceStandardListLayout` and compose `children` per `toolbar.viewMode`.
 */
export function WorkplaceStandardListLayout({
  breadcrumb,
  title,
  description,
  headerActions,
  showTitleBlock = true,
  hubAriaLabel,
  hubItems,
  toolbar,
  children,
  overlay,
  contentClassName = '',
  className = '',
}: WorkplaceStandardListLayoutProps) {
  return (
    <div className={`relative space-y-6 ${className}`.trim()}>
      <WorkplacePageHeading1
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        headerActions={headerActions}
        showTitleBlock={showTitleBlock}
        menu={<HubMenu1Bar ariaLabel={hubAriaLabel} items={hubItems} />}
      />
      {toolbar ? <WorkplaceListToolbar {...toolbar} /> : null}
      <div className={`${CARD} overflow-hidden p-4 md:p-6 ${contentClassName}`.trim()} style={CARD_SHADOW}>
        {children}
      </div>
      {overlay}
    </div>
  )
}
