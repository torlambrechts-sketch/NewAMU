// Compliance Checklists analytics — first consumer of the new
// ModuleAnalyticsDashboard runtime + dashboardRegistry.
//
// The page owns the source data (executions, responses, templates) and
// computes the registry's published datasets from it. Filter chips
// (DashboardFilterBar inside the runtime) are persisted as part of
// dashboard_layouts.filters; chip changes re-run the dataset compute
// against a filtered subset of executions / responses.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import {
  CHECKLIST_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/checklistDashboardScope'
import './dashboards/checklistDashboardScope'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { useChecklistModule } from './useChecklistModule'
import {
  STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  useChecklistDatasets,
} from './dashboards/useChecklistDatasets'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'
import { makeFilter } from '../../src/lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../src/components/reports/ReportModuleWidget'


export function ChecklistsAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()

  const { load } = cl
  useEffect(() => {
    void load()
  }, [load])

  const dashboard = useDashboardLayout({ supabase, scopeId: CHECKLIST_DASHBOARD_SCOPE_ID })

  // Filter dimensions are page-side because their loadOptions need
  // live org data (packs, templates). Status + severity + date are
  // static and could move to the registry; we keep them together here
  // for cohesion.
  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'pack',
        label: 'Pakke',
        description: 'Begrens til en eller flere regulative pakker.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => packs.map((p) => ({ id: p.slug, label: p.shortName })),
      },
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på en eller flere maler.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          cl.templates.filter((t) => t.is_active).map((t) => ({ id: t.id, label: t.name })),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Kladd, aktiv eller signert.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'severity',
        label: 'Alvorlighetsgrad',
        description: 'Brukes på funn-baserte widgets.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => SEVERITY_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'location',
        label: 'Lokasjon',
        description: 'Filtrer på utførelsens lokasjon.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrer på utførelsens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'participant',
        label: 'Deltaker',
        description: 'Inkluder kun utførelser der disse medlemmene var deltakere.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på opprettet/signert dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [packs, cl.templates, orgSetup.locations, orgSetup.departments, orgSetup.members],
  )

  const datasets = useChecklistDatasets({
    filters: dashboard.filters,
    executions: cl.executions,
    responsesByExecutionId: cl.responsesByExecutionId,
    templates: cl.templates,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
  })

  // Layout: persisted dashboard_layouts row when one exists, otherwise
  // the registry default. Either way bar widgets with empty seriesKeys
  // get their keys filled from the live dataset so the bar renders.
  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey] as Record<string, unknown> | undefined
          const keys = ds && typeof ds === 'object' ? Object.keys(ds) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const empty =
    cl.executions.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen sjekklister å analysere ennå. Opprett eller signer en kjøring for å se
          tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

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

  // Drill-down (3.2.2): translate a clicked segment label → option id for
  // the matching dimension, then toggle a chip on the active filter set.
  const handleDrillDown = (e: DrillDownEvent) => {
    let resolvedId: string | null = null
    if (e.dimensionId === 'status') {
      const opt = STATUS_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'severity') {
      const opt = SEVERITY_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'pack') {
      const p = packs.find((x) => x.shortName === e.segmentLabel || x.slug === e.segmentLabel)
      resolvedId = p?.slug ?? null
    } else if (e.dimensionId === 'template') {
      const t = cl.templates.find((x) => x.name === e.segmentLabel)
      resolvedId = t?.id ?? null
    } else if (e.dimensionId === 'location') {
      const loc = orgSetup.locations.find((l) => l.name === e.segmentLabel)
      resolvedId = loc?.id ?? null
    } else if (e.dimensionId === 'department') {
      const dep = orgSetup.departments.find((d) => d.name === e.segmentLabel)
      resolvedId = dep?.id ?? null
    }
    if (!resolvedId) return
    const existing = dashboard.filters.find(
      (f) => f.dimensionId === e.dimensionId && f.value === resolvedId,
    )
    const next = existing
      ? dashboard.filters.filter((f) => f.id !== existing.id)
      : [...dashboard.filters, makeFilter(e.dimensionId, 'is', resolvedId)]
    void dashboard.saveFilters(next)
  }

  return (
    <>
      <ModuleAnalyticsDashboard
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Sjekklister', to: '/compliance/checklists' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, status, alvorlighetsgrader og malbruk på tvers av alle sjekklistepakker."
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
          // Match the Button component's default secondary size so this
          // sits flush with "Rediger oppsett" / "Legg til widget" added
          // by ModuleAnalyticsDashboard.
          <Link
            to="/compliance/checklists"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
        layout={layout}
        datasets={datasets}
        loading={cl.loading || dashboard.loading}
        error={cl.error ?? dashboard.error}
        emptyState={empty}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onDrillDown={handleDrillDown}
        filters={dashboard.filters}
        dimensions={dimensions}
        onFiltersChange={(next) => void dashboard.saveFilters(next)}
      />

      <DashboardEditLayoutPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        layout={dashboard.layout}
        onSave={(next) => dashboard.saveLayout(next)}
        onResetToDefault={dashboard.isDefault ? undefined : () => dashboard.resetToDefault()}
      />

      <DashboardAddWidgetPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scopeId={CHECKLIST_DASHBOARD_SCOPE_ID}
        onAdd={(widget: ReportModule) => dashboard.saveLayout([...dashboard.layout, widget])}
      />

      <DashboardEditWidgetPanel
        open={editWidget !== null}
        widget={editWidget}
        datasets={datasets}
        onClose={() => setEditWidget(null)}
        onDuplicate={(w) => {
          const dup = { ...w, id: freshId('w'), title: `${w.title} (kopi)` }
          void dashboard.saveLayout([...dashboard.layout, dup])
        }}
        onRemove={(w) => {
          void dashboard.saveLayout(dashboard.layout.filter((m) => m.id !== w.id))
        }}
        onSave={async (next) => {
          const ok = await dashboard.saveLayout(
            dashboard.layout.map((m) => (m.id === next.id ? next : m)),
          )
          return ok
        }}
        compatibleKinds={editWidget ? defaultCompatibleKinds(editWidget.kind) : undefined}
      />
    </>
  )
}

