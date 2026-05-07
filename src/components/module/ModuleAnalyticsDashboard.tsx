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
import { ReportModulesGrid } from '../reports/ReportModuleWidget'
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
  /** Optional filter chip bar slot rendered above the grid. */
  filterBar?: ReactNode
  /** Per-widget control slot (rendered top-right of each widget shell). */
  widgetControlSlot?: WidgetControlSlot
}

export function ModuleAnalyticsDashboard({
  title,
  description,
  breadcrumb,
  headerActions,
  layout,
  datasets,
  loading,
  error,
  accent = '#1a3d32',
  emptyState,
  onEdit,
  onAddWidget,
  filterBar,
  widgetControlSlot,
}: ModuleAnalyticsDashboardProps) {
  const showActions = Boolean(onEdit || onAddWidget)

  return (
    <ModulePageShell
      breadcrumb={breadcrumb ?? []}
      title={title}
      description={description}
      headerActions={
        <div className="flex items-center gap-2">
          {headerActions}
          {showActions ? (
            <>
              {onEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Edit3 className="h-4 w-4" />}
                  onClick={onEdit}
                >
                  Rediger oppsett
                </Button>
              ) : null}
              {onAddWidget ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={onAddWidget}
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
        {filterBar}
        {loading && layout.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Laster …</p>
        ) : layout.length === 0 ? (
          (emptyState ?? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
              Ingen widgets i dette oppsettet ennå.
            </div>
          ))
        ) : (
          <ReportModulesGrid
            modules={layout}
            datasets={datasets}
            accent={accent}
            layoutMode="grid12"
            emptyLabel="Ingen data."
            controlSlot={widgetControlSlot}
          />
        )}
      </div>
    </ModulePageShell>
  )
}
