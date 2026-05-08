// Survey analytics page — second consumer of ModuleAnalyticsDashboard
// after compliance/checklists. Owns dataset compute (from useSurvey) and
// hands the result to the runtime + the registered survey scope.
//
// Filter chips persist to dashboard_layouts.filters; chip changes
// re-bucket survey data on the page side. Org-context dimensions
// (location/department/participant) land in T7.

import { useEffect, useMemo, useState } from 'react'
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
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurvey } from './useSurvey'
import { useSurveyPacks } from './useSurveyPacks'
import { useSurveyCategories } from './useSurveyCategories'
import { useSurveyOrgTemplates } from './useSurveyOrgTemplates'
import {
  SURVEY_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/surveyDashboardScope'
import './dashboards/surveyDashboardScope'
import { STATUS_OPTIONS, useSurveyDatasets } from './dashboards/useSurveyDatasets'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { useRegulationFilter } from '../../src/context/RegulationFilterContext'
import { useSurveyNav } from './useSurveyNav'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'


export function SurveyAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const survey = useSurvey({ supabase })
  const { packs } = useSurveyPacks({ supabase })
  const surveyCategories = useSurveyCategories({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })

  const { loadSurveys, loadTemplateCatalog } = survey
  useEffect(() => {
    void loadSurveys()
    void loadTemplateCatalog()
  }, [loadSurveys, loadTemplateCatalog])

  const dashboard = useDashboardLayout({ supabase, scopeId: SURVEY_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'pack',
        label: 'Pakke',
        description: 'Begrens til en eller flere pakker.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => packs.map((p) => ({ id: p.slug, label: p.short_name })),
      },
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på en eller flere katalog-maler.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          survey.templateCatalog
            .filter((t) => t.is_active !== false)
            .map((t) => ({ id: t.id, label: t.name })),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Kladd, aktiv, lukket eller arkivert.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'category',
        label: 'Kategori',
        description: 'Filtrer på kategorier definert i Innstillinger → Kategorier.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          surveyCategories.categories.map((c) => ({ id: c.id, label: c.name })),
      },
      {
        id: 'location',
        label: 'Lokasjon',
        description: 'Filtrer på undersøkelsens lokasjon.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrer på undersøkelsens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'participant',
        label: 'Deltaker',
        description: 'Inkluder kun undersøkelser der disse medlemmene deltar.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'anonymity',
        label: 'Anonymitet',
        description: 'Begrens til anonyme eller identifiserte undersøkelser.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () => [
          { id: 'anonymous', label: 'Anonyme' },
          { id: 'identified', label: 'Identifiserte' },
        ],
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på publisert / lukket dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [
      packs,
      survey.templateCatalog,
      surveyCategories.categories,
      orgSetup.locations,
      orgSetup.departments,
      orgSetup.members,
    ],
  )

  // Catalog id → category id lookup for the category filter. Cheap to
  // build once per render; the underlying tables move rarely.
  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) {
      m.set(t.catalogId, t.categoryId)
    }
    return m
  }, [surveyOrgTemplates.templates])

  // Cross-module regulation filter (category-architecture §T8).
  // Resolve a survey's regulation via catalog_id → category → regulation.
  const surveyNav = useSurveyNav()
  const { isActive: isRegulationActive } = useRegulationFilter()
  const filteredSurveys = useMemo(() => {
    const catRegById = new Map(
      surveyNav.categories.map((c) => [c.id, c.regulationId] as const),
    )
    return survey.surveys.filter((s) => {
      if (!s.catalog_id) return isRegulationActive(null)
      const catId = categoryByCatalogId.get(s.catalog_id)
      const regId = catId ? (catRegById.get(catId) ?? null) : null
      return isRegulationActive(regId)
    })
  }, [survey.surveys, categoryByCatalogId, surveyNav.categories, isRegulationActive])

  const datasets = useSurveyDatasets({
    filters: dashboard.filters,
    surveys: filteredSurveys,
    templateCatalog: survey.templateCatalog,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByCatalogId,
  })

  // Hydrate bar widgets with empty seriesKeys from the live dataset, same
  // pattern as the checklist analyse page.
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
    survey.surveys.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen undersøkelser å analysere ennå. Opprett eller publiser en
          undersøkelse for å se tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: SURVEY_DASHBOARD_SCOPE_ID,
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

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(SURVEY_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Undersøkelser', to: '/survey' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, svarprosent og malbruk på tvers av alle undersøkelsespakker."
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
              to="/survey"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={survey.loading || dashboard.loading}
        error={survey.error ?? dashboard.error}
        emptyState={empty}
        onEdit={undefined}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onResize={(w, next) =>
          void dashboard.saveLayout(
            dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)),
          )
        }
        {...editChrome.moduleProps}
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
        scopeId={SURVEY_DASHBOARD_SCOPE_ID}
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

