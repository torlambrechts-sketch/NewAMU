// ModuleAnalyticsDashboard — the runtime that renders a registered
// dashboard scope. Used by ChecklistsAnalysePage today and (intended)
// by the analogous survey/inspection/etc. analytics pages tomorrow.
//
// The page that owns the source data (executions, responses, surveys, …)
// builds a `datasets: Record<string, unknown>` keyed by ReportDatasetKey
// and hands it in. The runtime reads `layout` (a ReportModule[]) and
// renders it through the shared ReportModulesGrid. Everything else —
// the page header, the Edit Layout / Add Widget action bar, the
// optional filter chip strip — is chrome.
//
// Phase 1: chrome only, no edit/add/filter actions wired. Phase 3 will
// pass `onEdit`, `onAddWidget`, and a `filterBar` slot through.

import type { ReactNode } from 'react'
import { Edit3, Plus } from 'lucide-react'
import { ModulePageShell } from './ModulePageShell'
import { Button } from '../ui/Button'
import { WarningBox } from '../ui/AlertBox'
import {
  ReportModulesGrid,
  type DrillDownEvent,
  type OnDropFromLibrary,
  type OnWidgetResize,
} from '../reports/ReportModuleWidget'
import { DashboardFilterBar } from './dashboard/DashboardFilterBar'
import type {
  DashboardComparisonMode,
  DashboardDimension,
  DashboardFilter,
  DashboardFilterPreset,
} from '../../lib/dashboards/dashboardFilters'
import { summariseFilters } from '../../lib/dashboards/summariseFilters'
import type { ReportModule } from '../../types/reportBuilder'

type WidgetControlSlot = (m: ReportModule) => ReactNode

export interface ModuleAnalyticsDashboardProps {
  /** Page title, shown in the header. */
  title: string
  /** Optional one-line description under the title. */
  description?: string
  /** Breadcrumb passed through to ModulePageShell. */
  breadcrumb?: { label: string; to?: string }[]
  /** Header right-side actions (e.g. "Tilbake"). Rendered before the dashboard actions. */
  headerActions?: ReactNode
  /**
   * Widget layout to render. In Phase 1 this is the registry's
   * defaultLayout; Phase 2 hands in the persisted user layout.
   */
  layout: ReportModule[]
  /** Resolved datasets, keyed by ReportDatasetKey. */
  datasets: Record<string, unknown>
  loading?: boolean
  /**
   * Soft "datasets still loading" signal. When true, the rendered
   * widget grid pulses subtly so users don't misread "Ingen rader"
   * placeholders as confirmed-empty data while async hooks are still
   * resolving. Distinct from `loading` (which hides the whole grid
   * until set false). Default false.
   */
  dataLoading?: boolean
  /** Page-level error string (renders a WarningBox above the grid). */
  error?: string | null
  /** Accent colour for the KPI insets. */
  accent?: string
  /**
   * Empty state shown when the layout has no widgets. Provide your own
   * to point users at "Add widget" or to explain how to populate the
   * dashboard for this scope.
   */
  emptyState?: ReactNode
  /** "Edit Layout" button handler — hidden when null/undefined. */
  onEdit?: () => void
  /** "Add Widget" button handler — hidden when null/undefined. */
  onAddWidget?: () => void
  /**
   * Custom filter bar slot — when provided, rendered above the grid
   * instead of the built-in DashboardFilterBar. Useful for embedding
   * a different filter UX without touching the runtime.
   */
  filterBar?: ReactNode
  /**
   * Filter chip state. When `dimensions` is non-empty the runtime
   * renders the built-in DashboardFilterBar with these chips;
   * `onFiltersChange` is called whenever the user adds, edits or
   * removes a chip.
   */
  filters?: DashboardFilter[]
  dimensions?: DashboardDimension[]
  onFiltersChange?: (next: DashboardFilter[]) => void
  /**
   * Scope-shipped preset chips rendered next to the filter chips.
   * When `onApplyPreset` is set the preset's filters (and comparison
   * mode) replace the active state.
   */
  presets?: DashboardFilterPreset[]
  onApplyPreset?: (preset: DashboardFilterPreset) => void
  /**
   * Comparison mode + change handler. The built-in filter bar
   * renders the "Sammenlign" dropdown only when `onComparisonChange`
   * is set, so scopes that haven't wired comparison in their dataset
   * hook simply omit the prop and the affordance disappears.
   */
  comparison?: DashboardComparisonMode
  onComparisonChange?: (next: DashboardComparisonMode) => void
  /** Per-widget control slot (rendered top-right of each widget shell). */
  widgetControlSlot?: WidgetControlSlot
  /**
   * Optional saved-view chooser slot — rendered inline next to the page
   * title. Pass a <DashboardChooser /> instance, or anything else
   * appropriate for the host page.
   */
  titleChooser?: ReactNode
  /**
   * Optional drill-down handler. When set, donut/bar widgets that
   * declare `drillDimensionId` become clickable; activating a segment
   * fires this callback with the raw label so the page can map it to
   * a chip and append it to the active filter set.
   */
  onDrillDown?: (e: DrillDownEvent) => void
  /**
   * Optional widget-resize handler (3.2.5). When set, each widget
   * renders a SE drag handle that snaps to the four `colSpan` values.
   * Pages typically wire this to `dashboard.saveLayout(...)` so the
   * change persists immediately.
   */
  onResize?: OnWidgetResize
  /**
   * Edit-mode (V3 design): when true, the runtime renders the inline
   * `widgetLibrarySlot` as a docked right rail (instead of the modal-
   * style "Add widget" SlidePanel) and widgets show always-on edit
   * chrome (resize handle visible without hover, X-to-remove inline).
   */
  editMode?: boolean
  /** Slot for the docked widget library rail in edit mode. */
  widgetLibrarySlot?: ReactNode
  /** Inline X-to-remove handler in edit mode — fires per widget. */
  onRemoveWidget?: (m: ReportModule) => void
  /** Drop-from-library handler — when set + editMode + widgetLibrarySlot,
   *  the grid accepts drag-and-drop from the rail (V3 design pattern). */
  onDropFromLibrary?: OnDropFromLibrary
  /**
   * Read-only mode for published reports + the public share view.
   * Suppresses Edit / Add buttons, drill-down navigation, and any edit
   * chrome; widgets retain their CSV export menu. Pages that render a
   * frozen snapshot pass `readOnly snapshotMode` together.
   */
  readOnly?: boolean
  /**
   * Presentational hint: render a "frozen snapshot" footer with the
   * snapshot timestamp + watermark text. Implies the page is reading
   * `datasets` from `snapshot_data` rather than live hooks.
   */
  snapshotMode?: boolean
  /** Snapshot timestamp ISO string for the footer. Only used when snapshotMode. */
  snapshotAt?: string | null
  /** Watermark caption rendered alongside the snapshot footer. */
  snapshotWatermark?: string
}

export function ModuleAnalyticsDashboard({
  title,
  description,
  breadcrumb,
  headerActions,
  layout,
  datasets,
  loading,
  dataLoading = false,
  error,
  accent = '#1a3d32',
  emptyState,
  onEdit,
  onAddWidget,
  filterBar,
  filters,
  dimensions,
  onFiltersChange,
  presets,
  onApplyPreset,
  comparison,
  onComparisonChange,
  widgetControlSlot,
  titleChooser,
  onDrillDown,
  onResize,
  editMode,
  widgetLibrarySlot,
  onRemoveWidget,
  onDropFromLibrary,
  readOnly,
  snapshotMode,
  snapshotAt,
  snapshotWatermark,
}: ModuleAnalyticsDashboardProps) {
  const effectiveEditMode = editMode && !readOnly
  const effectiveOnEdit = readOnly ? undefined : onEdit
  const effectiveOnAddWidget = readOnly ? undefined : onAddWidget
  const effectiveOnDrillDown = readOnly ? undefined : onDrillDown
  const effectiveOnResize = readOnly ? undefined : onResize
  const effectiveOnRemoveWidget = readOnly ? undefined : onRemoveWidget
  const effectiveOnDropFromLibrary = readOnly ? undefined : onDropFromLibrary
  const effectiveOnFiltersChange = readOnly ? undefined : onFiltersChange
  // Filter chrome — chip-style by default (single "+ Filter" entry,
  // active filters as removable chips, "Fjern alle" affordance). Pages
  // that need the legacy wall-of-dropdowns layout can pass a custom
  // `filterBar` slot using `DashboardScorecardFilterBar` directly.
  const effectiveOnApplyPreset = readOnly ? undefined : onApplyPreset
  const effectiveOnComparisonChange = readOnly ? undefined : onComparisonChange
  const builtInFilterBar =
    !filterBar && dimensions && dimensions.length > 0 && filters && effectiveOnFiltersChange ? (
      <DashboardFilterBar
        filters={filters}
        dimensions={dimensions}
        onChange={effectiveOnFiltersChange}
        presets={presets}
        onApplyPreset={effectiveOnApplyPreset}
        comparison={comparison}
        onComparisonChange={effectiveOnComparisonChange}
      />
    ) : null
  const showActions = Boolean(effectiveOnEdit || effectiveOnAddWidget)

  // When a chooser is provided, render it inline with the title so the
  // page header reads "Læring · analyse  [Standard ▼]" — mirrors the
  // reference designs from the roadmap.
  const titleNode = titleChooser ? (
    <span className="inline-flex items-center gap-3">
      <span>{title}</span>
      {titleChooser}
    </span>
  ) : (
    title
  )

  // Auto-subtitle from active filter chips (3.2.6). Appended below the
  // page-supplied description so consumers don't have to hand-type
  // "narrowed to Avdeling: Salg · Status: Signert".
  const filtersSubtitle =
    filters && filters.length > 0 && dimensions
      ? summariseFilters({ filters, dimensions })
      : ''
  const compositeDescription = filtersSubtitle ? (
    <span className="block">
      {description ? <span className="block">{description}</span> : null}
      <span className="block text-xs italic text-neutral-500">{filtersSubtitle}</span>
    </span>
  ) : (
    description
  )

  return (
    <ModulePageShell
      breadcrumb={breadcrumb ?? []}
      width="wide"
      title={titleNode}
      description={compositeDescription}
      headerActions={
        <div className="flex items-center gap-2">
          {headerActions}
          {showActions ? (
            <>
              {effectiveOnEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Edit3 className="h-4 w-4" />}
                  onClick={effectiveOnEdit}
                >
                  Rediger oppsett
                </Button>
              ) : null}
              {effectiveOnAddWidget ? (
                <Button
                  type="button"
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={effectiveOnAddWidget}
                >
                  Legg til widget
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {error ? <WarningBox>{error}</WarningBox> : null}
        {filterBar ?? builtInFilterBar}
        {loading && layout.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Laster …</p>
        ) : layout.length === 0 ? (
          (emptyState ?? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
              Ingen widgets i dette oppsettet ennå.
            </div>
          ))
        ) : effectiveEditMode && widgetLibrarySlot ? (
          // V3 edit mode: dock the widget library as a sticky right rail
          // (≥ xl) and let the grid fill the remaining width. Below xl the
          // rail hides itself and falls back to the modal "+Legg til widget".
          <div
            className="flex gap-4"
            aria-busy={dataLoading ? 'true' : undefined}
          >
            <div className={`min-w-0 flex-1 ${dataLoading ? 'animate-pulse opacity-70' : ''}`}>
              <ReportModulesGrid
                modules={layout}
                datasets={datasets}
                accent={accent}
                layoutMode="grid12"
                emptyLabel="Ingen data."
                controlSlot={widgetControlSlot}
                onDrillDown={effectiveOnDrillDown}
                onResize={effectiveOnResize}
                editMode
                onRemove={effectiveOnRemoveWidget}
                onDropFromLibrary={effectiveOnDropFromLibrary}
              />
            </div>
            {widgetLibrarySlot}
          </div>
        ) : (
          // aria-busy + animate-pulse signal "datasets still loading"
          // so empty widgets read as in-flight, not confirmed-empty.
          <div
            aria-busy={dataLoading ? 'true' : undefined}
            className={dataLoading ? 'animate-pulse opacity-70' : undefined}
          >
            <ReportModulesGrid
              modules={layout}
              datasets={datasets}
              accent={accent}
              layoutMode="grid12"
              emptyLabel="Ingen data."
              controlSlot={widgetControlSlot}
              onDrillDown={effectiveOnDrillDown}
              onResize={effectiveOnResize}
            />
          </div>
        )}
        {snapshotMode ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            {snapshotWatermark ? <span className="block font-medium">{snapshotWatermark}</span> : null}
            {snapshotAt ? (
              <span className="block">
                Frosset {new Date(snapshotAt).toLocaleString('nb-NO')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </ModulePageShell>
  )
}
