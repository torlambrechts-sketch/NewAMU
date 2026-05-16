// RiskAnalysePage — analytics dashboard for the Risiko module.
//
// Aggregates risk-bearing data from five existing sources (compliance
// findings, tasks with template_kind ∈ {avvik, nestenulykke, risiko,
// tiltak}, deviations, inspection_findings, alert_cases) and renders
// 11 widgets through ModuleAnalyticsDashboard. No new write surface;
// this is the "visibility lands first" P1 deliverable.
//
// Filter chips cascade in lockstep — clicking a heatmap cell adds
// `likelihoodTier` + `consequenceTier` chips, scorecard rows emit
// `riskId` for the future register list page.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../src/components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../src/components/reports/PublishReportButton'
import { RISK_DASHBOARD_SCOPE_ID } from './dashboards/riskDashboardScope'
import './dashboards/riskDashboardScope'
import { useRiskDatasets } from './dashboards/useRiskDatasets'
import { useRiskSourceData } from './dashboards/useRiskSourceData'
import { HAZARD_CATEGORY_OPTIONS, type HazardCategoryId } from './dashboards/hazardCategories'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension, DashboardFilter } from '../../src/lib/dashboards/dashboardFilters'

const SEVERITY_OPTIONS = [
  { id: 'critical', label: 'Kritisk' },
  { id: 'high', label: 'Høy' },
  { id: 'medium', label: 'Middels' },
  { id: 'low', label: 'Lav' },
]
const LIKELIHOOD_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) }))
const CONSEQUENCE_OPTIONS = LIKELIHOOD_OPTIONS
const RESIDUAL_BAND_OPTIONS = [
  { id: 'red', label: 'Uakseptabel (13–25)' },
  { id: 'yellow', label: 'Moderat (7–12)' },
  { id: 'green', label: 'Akseptabel (1–6)' },
]
const STATUS_OPTIONS = [
  { id: 'open', label: 'Åpen' },
  { id: 'in_progress', label: 'Under behandling' },
  { id: 'mitigated', label: 'Tiltak verifisert' },
  { id: 'closed', label: 'Lukket' },
]
const SOURCE_OPTIONS = [
  { id: 'checklist', label: 'Sjekkliste' },
  { id: 'avvik', label: 'Avvik' },
  { id: 'risiko', label: 'Risikovurdering' },
  { id: 'deviation', label: 'Avvikssak' },
  { id: 'inspection', label: 'Vernerunde' },
  { id: 'alert', label: 'Varsling' },
]

export function RiskAnalysePage() {
  const { supabase, departments } = useOrgSetupContext()

  const {
    loading: dataLoading,
    error: dataError,
    findings,
    tasks,
    deviations,
    inspectionFindings,
    alerts,
  } = useRiskSourceData()

  const dashboard = useDashboardLayout({ supabase, scopeId: RISK_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      { id: 'severityTier', label: 'Alvorlighet', kind: 'enum', defaultOperator: 'in', loadOptions: () => SEVERITY_OPTIONS },
      { id: 'likelihoodTier', label: 'Sannsynlighet', kind: 'enum', defaultOperator: 'in', loadOptions: () => LIKELIHOOD_OPTIONS },
      { id: 'consequenceTier', label: 'Konsekvens', kind: 'enum', defaultOperator: 'in', loadOptions: () => CONSEQUENCE_OPTIONS },
      { id: 'residualBand', label: 'Restrisiko-bånd', kind: 'enum', defaultOperator: 'in', loadOptions: () => RESIDUAL_BAND_OPTIONS },
      { id: 'hazardCategory', label: 'Fareklasse', kind: 'enum', defaultOperator: 'in', loadOptions: () => HAZARD_CATEGORY_OPTIONS },
      { id: 'status', label: 'Status', kind: 'enum', defaultOperator: 'in', loadOptions: () => STATUS_OPTIONS },
      { id: 'department', label: 'Avdeling', kind: 'enum', defaultOperator: 'in', loadOptions: () => departments.map((d) => ({ id: d.id, label: d.name })) },
      { id: 'source', label: 'Kilde', kind: 'enum', defaultOperator: 'in', loadOptions: () => SOURCE_OPTIONS },
      { id: 'dateRange', label: 'Periode', description: 'Filter på opprettelsesdato.', kind: 'date_range', defaultOperator: 'between' },
    ],
    [departments],
  )

  const datasets = useRiskDatasets({
    filters: dashboard.filters,
    findings, tasks, deviations, inspectionFindings, alerts,
  })

  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey]
          const keys = Array.isArray(ds) ? ds.map((s: { id: string }) => s.id) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const empty =
    findings.length === 0 && tasks.length === 0 && deviations.length === 0 &&
    inspectionFindings.length === 0 && alerts.length === 0 && !dataLoading ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen risikodata ennå. Sjekkliste-funn, avvik og vernerunder vil dukke opp her etter hvert som de registreres.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const editChrome = useDashboardEditChrome({
    scopeId: RISK_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const widgetControlSlot = (m: ReportModule) => (
    <DashboardWidgetMenu
      ariaLabel={`Meny for widget ${m.title}`}
      onEdit={() => setEditWidget(m)}
      onDuplicate={() => {
        const dup = { ...m, id: freshId('w'), title: `${m.title} (kopi)` }
        void dashboard.saveLayout([...dashboard.layout, dup])
      }}
      onExportCsv={() => downloadCsv(widgetToCsv(m, datasets))}
      onRemove={() => {
        if (!window.confirm(`Fjerne widgeten «${m.title}»?`)) return
        void dashboard.saveLayout(dashboard.layout.filter((x) => x.id !== m.id))
      }}
    />
  )

  // Drill-down — the heatmap renderer emits two adjacent events (one per
  // axis) when a cell is clicked, but the simpler shape is `segmentLabel`
  // = the row label (likelihood) and we expand it to both axes by also
  // appending the consequence chip when the segmentLabel encodes both.
  const handleDrill = useCallback(
    (e: { dimensionId: string; segmentLabel: string }) => {
      const next: DashboardFilter[] = [...dashboard.filters]
      const addChip = (id: string, raw: string) => {
        if (next.some((f) => f.dimensionId === id)) return
        next.push({ id: freshId('chip'), dimensionId: id, operator: 'in', value: [raw] })
      }
      const parts = e.segmentLabel.split(/\s*[×x/]\s*/i)
      if (e.dimensionId === 'likelihoodTier' && parts.length === 2) {
        addChip('likelihoodTier', parts[0]!.trim())
        addChip('consequenceTier', parts[1]!.trim())
      } else {
        addChip(e.dimensionId, e.segmentLabel)
      }
      void dashboard.saveFilters(next)
    },
    [dashboard],
  )

  const titleHash = (() => {
    if (typeof window === 'undefined') return ''
    return window.location.hash
  })()

  // Surface preset URL hint (when user lands with ?hazardCategory=psychosocial
  // from a pinned sidebar item) — translate query param into a chip on first
  // mount if not already present.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const cat = p.get('hazardCategory')
    if (!cat) return
    if (dashboard.filters.some((f) => f.dimensionId === 'hazardCategory')) return
    void dashboard.saveFilters([
      ...dashboard.filters,
      { id: freshId('chip'), dimensionId: 'hazardCategory', operator: 'in', value: [cat] },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleHash])

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(RISK_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Risiko', to: '/risk/analyse' },
          { label: 'Analyse' },
        ]}
        title="Risiko"
        description="Tverrgående risikobilde — heatmap, restrisiko, psykososial og tiltaksdekning. Aggregerer sjekkliste-funn, avvik, vernerunder og varslinger."
        titleChooser={
          <DashboardChooser
            available={dashboard.available}
            activeRow={dashboard.row}
            isDefault={dashboard.isDefault}
            currentUserId={dashboard.currentUserId}
            onSelect={dashboard.selectLayout}
            onSaveAs={dashboard.saveAs}
            onRename={dashboard.renameActive}
            onDelete={dashboard.deleteActive}
            onMarkDefault={dashboard.markActiveDefault}
          />
        }
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {editChrome.toggleButton}
            <Link
              to="/overview/hms"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={RISK_DASHBOARD_SCOPE_ID}
              scopeLabel="Risiko"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={dataLoading || dashboard.loading}
        error={dataError ?? dashboard.error}
        emptyState={empty}
        dimensions={dimensions}
        filters={dashboard.filters}
        onFiltersChange={(f) => { void dashboard.saveFilters(f) }}
        onDrillDown={handleDrill}
        widgetControlSlot={widgetControlSlot}
        editMode={editChrome.editMode}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
      />

      <DashboardEditLayoutPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        layout={dashboard.layout}
        onSave={async (next) => {
          await dashboard.saveLayout(next)
          setEditOpen(false)
          return true
        }}
      />

      <DashboardAddWidgetPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scopeId={RISK_DASHBOARD_SCOPE_ID}
        onAdd={async (tpl) => {
          await dashboard.saveLayout([...dashboard.layout, { ...tpl, id: freshId('w') }])
          setAddOpen(false)
          return true
        }}
      />

      {editWidget && (
        <DashboardEditWidgetPanel
          open
          onClose={() => setEditWidget(null)}
          widget={editWidget}
          datasets={datasets}
          onSave={async (updated) => {
            await dashboard.saveLayout(
              dashboard.layout.map((m) => (m.id === updated.id ? updated : m)),
            )
            setEditWidget(null)
            return true
          }}
        />
      )}
    </>
  )
}

// HazardCategoryId is referenced via the snapshot types only, but
// re-exported for the sidebar pinned subs so it stays one source of
// truth.
export type { HazardCategoryId }
