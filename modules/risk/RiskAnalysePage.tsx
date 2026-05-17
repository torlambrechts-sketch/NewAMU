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
import { Link, useLocation } from 'react-router-dom'
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
import { buildRiskDatasets } from './dashboards/useRiskDatasets'
import { useRiskDashboardRows } from './dashboards/useRiskDashboardRows'
import { HAZARD_CATEGORIES, HAZARD_CATEGORY_OPTIONS, type HazardCategoryId } from './dashboards/hazardCategories'
import { LiveRiskFeed } from './components/LiveRiskFeed'
import type { ReportModule } from '../../src/types/reportBuilder'
import { makeFilter, type DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../src/components/reports/ReportModuleWidget'

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
// Mirrors the RiskSource union in useRiskDatasets. Kept inline so the
// chip-options array doesn't drag the whole module dep into the
// dimensions block.
const SOURCE_OPTIONS = [
  { id: 'checklist', label: 'Sjekkliste' },
  { id: 'task', label: 'Avvik / risiko' },
  { id: 'deviation', label: 'Avvikssak' },
  { id: 'inspection', label: 'Vernerunde' },
  { id: 'alert', label: 'Varsling' },
  { id: 'ros', label: 'ROS' },
  { id: 'sja', label: 'SJA' },
]

export function RiskAnalysePage() {
  const { supabase, departments } = useOrgSetupContext()

  const { loading: dataLoading, error: dataError, rows, path, reload: reloadRows } = useRiskDashboardRows()

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

  const datasets = useMemo(
    () => buildRiskDatasets(rows, dashboard.filters, dashboard.comparison),
    [rows, dashboard.filters, dashboard.comparison],
  )

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
    rows.length === 0 && !dataLoading ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen risikodata ennå. Sjekkliste-funn, avvik og vernerunder vil dukke opp her etter hvert som de registreres.
        </p>
        {path === 'source' && (
          <p className="mt-2 text-xs text-neutral-400">
            Tips: Kjør migrasjon 20260913100000 for å lese fra et samlet
            risikoregister-view istedenfor klientside-aggregering.
          </p>
        )}
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

  // Drill-down — resolve the clicked segment's display label back to the
  // chip value the filter selectors compare against (id, not label).
  // Toggle: clicking the same segment twice removes the chip. Mirrors
  // the resolver in ChecklistsAnalysePage / LearningAnalysePage so the
  // behaviour is identical across modules.
  //
  // Heatmap cell clicks are NOT supported by the engine yet (the
  // renderer doesn't wire onDrillDown for heatmap kinds). When that
  // lands, this handler will receive `dimensionId='likelihoodTier'` (or
  // similar) and the resolver below already handles the numeric ids.
  const handleDrill = useCallback(
    (e: DrillDownEvent) => {
      let resolvedId: string | null = null
      const label = e.segmentLabel
      switch (e.dimensionId) {
        case 'hazardCategory': {
          const cat = HAZARD_CATEGORIES.find((c) => c.labelNb === label || c.id === label)
          resolvedId = cat?.id ?? null
          break
        }
        case 'severityTier': {
          const sev = SEVERITY_OPTIONS.find((s) => s.label === label || s.id === label)
          resolvedId = sev?.id ?? null
          break
        }
        case 'residualBand': {
          const band = RESIDUAL_BAND_OPTIONS.find((b) => b.label === label || b.id === label)
          resolvedId = band?.id ?? null
          break
        }
        case 'source': {
          const s = SOURCE_OPTIONS.find((o) => o.label === label || o.id === label)
          resolvedId = s?.id ?? null
          break
        }
        case 'status': {
          const s = STATUS_OPTIONS.find((o) => o.label === label || o.id === label)
          resolvedId = s?.id ?? null
          break
        }
        case 'department': {
          const dep = departments.find((d) => d.name === label || d.id === label)
          resolvedId = dep?.id ?? null
          break
        }
        case 'likelihoodTier':
        case 'consequenceTier': {
          const trimmed = label.trim()
          resolvedId = /^[1-5]$/.test(trimmed) ? trimmed : null
          break
        }
        case 'riskId':
          // Scorecard row drill — the future RiskRegisterPage will read
          // this from the URL state. No chip mutation in P1.
          return
        default:
          return
      }
      if (!resolvedId) return
      const existing = dashboard.filters.find(
        (f) => f.dimensionId === e.dimensionId && f.value === resolvedId,
      )
      const next = existing
        ? dashboard.filters.filter((f) => f.id !== existing.id)
        : [...dashboard.filters, makeFilter(e.dimensionId, 'is', resolvedId)]
      void dashboard.saveFilters(next)
    },
    [dashboard, departments],
  )

  // Surface preset URL hint — when the user lands with
  // ?hazardCategory=psychosocial from a pinned sidebar item, translate
  // the param into a filter chip. Replaces any existing hazardCategory
  // chip so clicking different presets actually switches.
  const location = useLocation()
  useEffect(() => {
    const cat = new URLSearchParams(location.search).get('hazardCategory')
    if (!cat) return
    const valid = HAZARD_CATEGORIES.some((c) => c.id === cat)
    if (!valid) return
    const current = dashboard.filters.find((f) => f.dimensionId === 'hazardCategory')
    if (current && current.value === cat) return
    const others = dashboard.filters.filter((f) => f.dimensionId !== 'hazardCategory')
    void dashboard.saveFilters([...others, makeFilter('hazardCategory', 'is', cat)])
    // dashboard.filters omitted to avoid loops — the next render reflects
    // the saved chips, and we only want to react to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Live feed: show only when there are red / critical rows worth
  // highlighting. The component handles its own empty state, but we
  // omit it entirely when calm so the page chrome stays lean.
  const hasRedOrCritical = useMemo(
    () => rows.some((r) => r.isOpen && (r.band === 'red' || r.severityTier === 'critical')),
    [rows],
  )

  return (
    <>
      {hasRedOrCritical && (
        <div className="mx-auto mb-4 max-w-7xl px-6 pt-4">
          <LiveRiskFeed rows={rows} onTick={() => { void reloadRows() }} />
        </div>
      )}
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
        presets={getDashboardScope(RISK_DASHBOARD_SCOPE_ID)?.presets}
        onApplyPreset={(p) => { void dashboard.applyPreset(p) }}
        comparison={dashboard.comparison}
        onComparisonChange={(m) => { void dashboard.saveComparison(m) }}
        onDrillDown={handleDrill}
        // ^ heatmap cells are NOT clickable yet (engine gap — the heatmap
        //   renderer doesn't pass onDrillDown to HeatmapMini). Bar / donut
        //   / scorecard drills work via this same handler.
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
