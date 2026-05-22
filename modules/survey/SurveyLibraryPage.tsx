// SurveyLibraryPage — ModuleLibraryShell-wrapped library page for the Undersøkelser module.
//
// Lenses = licensed packs (arbeidsmiljo, vendor, compliance, engagement, exit).
// Tabs = categories per active lens, Alle always first.
// Library: template gallery filtered by lens + tab, recent surveys per pack.
// Katalog: all surveys in a searchable table.
// Analyse: inline ModuleAnalyticsDashboard (same wiring as SurveyAnalysePage).
// One hook instance per data source to avoid duplicate fetches.

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, FileText, Package, Plus, Sparkles } from 'lucide-react'
import { ModuleLibraryShell } from '../../src/components/module/ModuleLibraryShell'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../src/components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../src/components/reports/PublishReportButton'
import { FavoriteToggle } from '../../src/components/favorites/FavoriteToggle'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  LayoutTable1PostingsShell,
} from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { useSurvey } from './useSurvey'
import type { UseSurveyState } from './useSurvey'
import { useSurveyPacks } from './useSurveyPacks'
import { useSurveyCategories } from './useSurveyCategories'
import { useSurveyOrgTemplates } from './useSurveyOrgTemplates'
import { useSurveyNav } from './useSurveyNav'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useRegulationFilter } from '../../src/context/RegulationFilterContext'
import {
  SURVEY_DASHBOARD_SCOPE_ID,
} from './dashboards/surveyDashboardScope'
import './dashboards/surveyDashboardScope'
import { STATUS_OPTIONS, useSurveyDatasets } from './dashboards/useSurveyDatasets'
import { SURVEY_TYPE_OPTIONS } from './surveyLabels'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import type { SurveyPackSlug, SurveyRow, SurveyStatus, SurveyType } from './types'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'

const ACCENT = '#7c3aed'

const SURVEY_STATUS_BADGE: Record<SurveyStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  draft: 'draft',
  active: 'active',
  closed: 'signed',
  archived: 'neutral',
}

const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  closed: 'Lukket',
  archived: 'Arkivert',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { dateStyle: 'medium' })
}

export function SurveyLibraryPage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const navigate = useNavigate()

  const survey = useSurvey({ supabase })
  const { packs } = useSurveyPacks({ supabase })
  const surveyCategories = useSurveyCategories({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })
  const surveyNav = useSurveyNav()
  const { isActive: isRegulationActive } = useRegulationFilter()

  const { loadSurveys, loadTemplateCatalog } = survey
  useEffect(() => {
    void loadSurveys()
    void loadTemplateCatalog()
  }, [loadSurveys, loadTemplateCatalog])

  // ── Lens + tab state ─────────────────────────────────────────────────────
  const [activeLens, setActiveLens] = useState<string>(() => packs[0]?.slug ?? '')
  const [activeTab, setActiveTab] = useState<string>('alle')

  // Sync activeLens once packs load (first render, packs is []).
  useEffect(() => {
    if (activeLens === '' && packs.length > 0) {
      setActiveLens(packs[0].slug)
    }
  }, [activeLens, packs])

  const handleLensChange = useCallback((id: string) => {
    setActiveLens(id)
    setActiveTab('alle')
  }, [])

  // ── Create panel state ───────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [presetTemplateId, setPresetTemplateId] = useState<string | null>(null)
  const [katalogSearch, setKatalogSearch] = useState('')

  // ── Dashboard ────────────────────────────────────────────────────────────
  const dashboard = useDashboardLayout({ supabase, scopeId: SURVEY_DASHBOARD_SCOPE_ID })
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: SURVEY_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) {
      m.set(t.catalogId, t.categoryId)
    }
    return m
  }, [surveyOrgTemplates.templates])

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
        loadOptions: () => orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrer på undersøkelsens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
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

  const datasets = useSurveyDatasets({
    filters: dashboard.filters,
    surveys: filteredSurveys,
    templateCatalog: survey.templateCatalog,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByCatalogId,
  })

  const analyseLayout = useMemo(
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

  // ── Lenses (packs) ───────────────────────────────────────────────────────
  const lenses = useMemo(
    () => ({
      items: packs.map((p) => ({
        id: p.slug,
        label: p.short_name,
        icon: Package as ComponentType<{ className?: string }>,
      })),
      value: activeLens,
      onChange: handleLensChange,
    }),
    [packs, activeLens, handleLensChange],
  )

  // ── Tabs (categories per active lens) ────────────────────────────────────
  const tabs = useMemo(() => {
    const packCats = surveyCategories.categories
      .filter((c) => c.pack === activeLens && c.is_active && !c.deleted_at)
      .sort((a, b) => a.position - b.position)
    const packTemplates = survey.templateCatalog.filter(
      (t) => t.pack === activeLens && t.is_active !== false,
    )
    const countByCat = new Map<string, number>()
    for (const t of packTemplates) {
      const catId = categoryByCatalogId.get(t.id) ?? '__uncat__'
      countByCat.set(catId, (countByCat.get(catId) ?? 0) + 1)
    }
    return [
      { id: 'alle', label: 'Alle', count: packTemplates.length },
      ...packCats.map((c) => ({
        id: c.id,
        label: c.name,
        count: countByCat.get(c.id) ?? 0,
      })),
    ]
  }, [surveyCategories.categories, survey.templateCatalog, activeLens, categoryByCatalogId])

  // ── Filtered templates for library view ──────────────────────────────────
  const filteredTemplates = useMemo(() => {
    let list = survey.templateCatalog.filter(
      (t) => t.pack === activeLens && t.is_active !== false,
    )
    if (activeTab !== 'alle') {
      list = list.filter((t) => categoryByCatalogId.get(t.id) === activeTab)
    }
    return list
  }, [survey.templateCatalog, activeLens, activeTab, categoryByCatalogId])

  // ── Katalog surveys (all, searchable) ────────────────────────────────────
  const katalogSurveys = useMemo(() => {
    const q = katalogSearch.toLowerCase()
    return filteredSurveys.filter((s) => !q || s.title.toLowerCase().includes(q))
  }, [filteredSurveys, katalogSearch])

  // ── Pinned templates map for gallery decorations ─────────────────────────
  const pinnedById = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const t of surveyOrgTemplates.templates) {
      if (t.isActive) m.set(t.catalogId, true)
    }
    return m
  }, [surveyOrgTemplates.templates])

  // ── Library view ─────────────────────────────────────────────────────────
  const libraryView = (
    <div className="mx-auto max-w-[1400px] space-y-5 px-10 py-6">
      {survey.error && (
        <div className="mb-5">
          <WarningBox>{survey.error}</WarningBox>
        </div>
      )}
      <TemplateGallery
        templates={filteredTemplates}
        categories={surveyCategories.categories}
        activeCategoryId={activeTab === 'alle' ? null : activeTab}
        categoryByCatalogId={categoryByCatalogId}
        pinnedById={pinnedById}
        onSelect={(t) => {
          setPresetTemplateId(t.id)
          setCreateOpen(true)
        }}
      />
      <RecentSurveysCard
        surveys={filteredSurveys}
        activePack={activeLens as SurveyPackSlug}
        onOpen={(id) => navigate(`/survey/${id}`)}
      />
    </div>
  )

  // ── Katalog view ─────────────────────────────────────────────────────────
  const katalogView = (
    <div className="mx-auto max-w-[1400px] space-y-5 px-10 py-6">
      <div className="flex items-center gap-3">
        <StandardInput
          value={katalogSearch}
          onChange={(e) => setKatalogSearch(e.target.value)}
          placeholder="Søk etter undersøkelse …"
          className="max-w-sm"
        />
        <span className="text-sm text-neutral-600">{katalogSurveys.length} undersøkelser</span>
      </div>
      <LayoutTable1PostingsShell
        wrap
        title="Alle undersøkelser"
        description="Alle registrerte undersøkelser, sortert etter dato."
        toolbar={null}
        footer={<span className="text-neutral-500">{katalogSurveys.length} poster</span>}
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Publisert</th>
                <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
              </tr>
            </thead>
            <tbody>
              {katalogSurveys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-neutral-500">
                    Ingen undersøkelser funnet.
                  </td>
                </tr>
              ) : (
                katalogSurveys.map((s) => (
                  <tr
                    key={s.id}
                    className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                    onClick={() => navigate(`/survey/${s.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-neutral-900">{s.title}</td>
                    <td className="px-5 py-3">
                      <Badge variant={SURVEY_STATUS_BADGE[s.status]}>
                        {SURVEY_STATUS_LABEL[s.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{fmtDate(s.published_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-neutral-400">›</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </LayoutTable1PostingsShell>
    </div>
  )

  // ── Analyse view ─────────────────────────────────────────────────────────
  const analyseEmptyState =
    survey.surveys.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen undersøkelser å analysere ennå. Opprett eller publiser en undersøkelse for å se
          tallene her.
        </p>
      </div>
    ) : null

  const analyseView = (
    <ModuleAnalyticsDashboard
      accent={getDashboardScope(SURVEY_DASHBOARD_SCOPE_ID)?.accent ?? ACCENT}
      breadcrumb={undefined}
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
          <PublishReportButton
            sourceDashboardId={dashboard.row?.id ?? null}
            sourceDashboardName={dashboard.row?.name ?? null}
            scopeId={SURVEY_DASHBOARD_SCOPE_ID}
            scopeLabel="Undersøkelser"
            datasets={datasets}
            ensureSavedRow={dashboard.ensureSavedRow}
          />
        </div>
      }
      layout={analyseLayout}
      datasets={datasets}
      loading={survey.loading || dashboard.loading}
      error={survey.error ?? dashboard.error}
      emptyState={analyseEmptyState}
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
  )

  const analyseEditPanels = (
    <>
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
          return dashboard.saveLayout(
            dashboard.layout.map((m) => (m.id === next.id ? next : m)),
          )
        }}
        compatibleKinds={editWidget ? defaultCompatibleKinds(editWidget.kind) : undefined}
      />
    </>
  )

  const activePack = packs.find((p) => p.slug === activeLens)

  return (
    <ModuleLibraryShell
      eyebrow="HMS"
      title="Undersøkelser"
      subtitle={
        activePack
          ? activePack.description
          : 'Planlegg og gjennomfør medarbeider- og leverandørundersøkelser'
      }
      accentColor={ACCENT}
      settingsTo="/admin/settings/survey"
      lenses={packs.length > 1 ? lenses : undefined}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabRowAction={
        survey.canManage ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setPresetTemplateId(null)
              setCreateOpen(true)
            }}
          >
            Ny undersøkelse
          </Button>
        ) : undefined
      }
      libraryView={libraryView}
      katalogView={katalogView}
      analyseView={analyseView}
      analyseEditPanels={analyseEditPanels}
      detailPanel={
        <CreateSurveySlidePanel
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          survey={survey}
          presetTemplateId={presetTemplateId}
          presetPack={(activeLens as SurveyPackSlug) ?? undefined}
          onCreated={(id) => navigate(`/survey/${id}`)}
        />
      }
    />
  )
}

// ── Template gallery ──────────────────────────────────────────────────────

function TemplateGallery({
  templates,
  categories,
  activeCategoryId,
  categoryByCatalogId,
  pinnedById,
  onSelect,
}: {
  templates: SurveyTemplateCatalogRow[]
  categories: ReturnType<typeof useSurveyCategories>['categories']
  activeCategoryId: string | null
  categoryByCatalogId: Map<string, string | null>
  pinnedById: Map<string, boolean>
  onSelect: (t: SurveyTemplateCatalogRow) => void
}) {
  type Bucket = { key: string; name: string | null; tiles: SurveyTemplateCatalogRow[] }

  // When a specific category is active the parent pre-filtered `templates` already;
  // just show them flat. When "Alle" is active, group by category using the
  // org-template override mapping (catalogId → categoryId from surveyOrgTemplates).
  const grouped = useMemo<Bucket[]>(() => {
    if (activeCategoryId !== null) {
      return templates.length > 0
        ? [{ key: activeCategoryId, name: null, tiles: templates }]
        : []
    }
    const catNameById = new Map(categories.map((c) => [c.id, c.name]))
    const catOrder = categories
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id)
    const buckets = new Map<string, SurveyTemplateCatalogRow[]>()
    for (const t of templates) {
      const catId = categoryByCatalogId.get(t.id) ?? '__uncat__'
      const list = buckets.get(catId) ?? []
      list.push(t)
      buckets.set(catId, list)
    }
    const result: Bucket[] = []
    for (const catId of catOrder) {
      const tiles = buckets.get(catId)
      if (tiles?.length) result.push({ key: catId, name: catNameById.get(catId) ?? catId, tiles })
    }
    const uncat = buckets.get('__uncat__')
    if (uncat?.length) result.push({ key: '__uncat__', name: 'Uten kategori', tiles: uncat })
    // Fallback: if nothing grouped (no org-template overrides), show flat.
    return result.length > 0 ? result : [{ key: '__all__', name: null, tiles: templates }]
  }, [templates, categories, activeCategoryId, categoryByCatalogId])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Maler</h2>
        <span className="text-xs text-neutral-500">{templates.length} aktive</span>
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Velg en mal for å opprette en ny undersøkelse med forhåndsutfylte spørsmål.
      </p>
      <div className="mt-5 space-y-6">
        {templates.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen maler tilgjengelig for denne pakken.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.key}>
              {group.name !== null && (
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  {group.name}
                </h3>
              )}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tiles.map((t) => {
              const isPinned = pinnedById.has(t.id)
              return (
                <li key={t.id} className="relative">
                  <FavoriteToggle
                    kind="survey"
                    templateRef={t.id}
                    templateName={t.name}
                    size="sm"
                    className="absolute right-1.5 top-1.5 z-10 bg-white/90"
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className="group flex h-full w-full flex-col items-start gap-2 rounded-lg border border-neutral-200/80 bg-white p-4 text-left font-normal transition-colors hover:border-[#7c3aed]/30 hover:bg-neutral-50"
                  >
                    <div className="flex w-full items-start gap-2 pr-6">
                      <FileText
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#7c3aed]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#7c3aed]">
                          {t.name}
                        </span>
                        {t.estimated_minutes != null ? (
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            ~{t.estimated_minutes} min
                          </span>
                        ) : null}
                      </span>
                      {isPinned ? (
                        <Badge variant="success">
                          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                          Festet
                        </Badge>
                      ) : t.is_system ? (
                        <Badge variant="neutral">System</Badge>
                      ) : null}
                    </div>
                    {t.description ? (
                      <p className="line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))
      )}
    </div>
  </ModuleSectionCard>
  )
}

// ── Recent surveys card ───────────────────────────────────────────────────

function RecentSurveysCard({
  surveys,
  activePack,
  onOpen,
}: {
  surveys: SurveyRow[]
  activePack: SurveyPackSlug
  onOpen: (id: string) => void
}) {
  const recent = useMemo(
    () =>
      surveys
        .filter((s) => s.pack === activePack && s.status !== 'archived')
        .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
        .slice(0, 8),
    [surveys, activePack],
  )

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Siste undersøkelser</h2>
        <span className="text-xs text-neutral-500">{recent.length}</span>
      </div>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Ingen undersøkelser i denne pakken ennå.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {recent.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4 cursor-pointer hover:bg-neutral-100"
              onClick={() => onOpen(s.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
                <p className="mt-0.5 text-xs text-neutral-600">{fmtDate(s.published_at)}</p>
              </div>
              <Badge variant={SURVEY_STATUS_BADGE[s.status]}>{SURVEY_STATUS_LABEL[s.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </ModuleSectionCard>
  )
}

// ── Create survey slide panel ─────────────────────────────────────────────

function CreateSurveySlidePanel({
  open,
  onClose,
  survey,
  presetTemplateId,
  presetPack,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  survey: UseSurveyState
  presetTemplateId: string | null
  presetPack?: SurveyPackSlug
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [surveyType, setSurveyType] = useState<SurveyType>('internal')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const preset = presetTemplateId ?? ''
    setSelectedTemplateId(preset)
    const tpl = preset ? survey.templateCatalog.find((t) => t.id === preset) : undefined
    if (tpl) {
      setTitle(tpl.name)
      setDescription(tpl.description ?? '')
      setIsAnonymous(tpl.recommend_anonymous)
      setSurveyType(tpl.audience === 'external' ? 'external' : 'internal')
    } else {
      setTitle('')
      setDescription('')
      setIsAnonymous(false)
      setSurveyType('internal')
    }
    setStartDate('')
    setEndDate('')
  }, [open, presetTemplateId, survey.templateCatalog])

  const templateOptions = useMemo(() => {
    const templates = presetPack
      ? survey.templateCatalog.filter((t) => t.pack === presetPack && t.is_active !== false)
      : survey.templateCatalog.filter((t) => t.is_active !== false)
    return [
      { value: '', label: 'Uten mal' },
      ...templates.map((t) => ({
        value: t.id,
        label: `${t.name}${t.estimated_minutes != null ? ` (~${t.estimated_minutes} min)` : ''}`,
      })),
    ]
  }, [survey.templateCatalog, presetPack])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const row = await survey.createSurvey({
        title: title.trim(),
        description: description.trim() || null,
        is_anonymous: isAnonymous,
        survey_type: surveyType,
        start_date: startDate || null,
        end_date: endDate || null,
        pack: presetPack,
        catalog_id: selectedTemplateId || null,
      })
      if (!row) return
      if (selectedTemplateId) {
        await survey.applyTemplateToSurvey(row.id, selectedTemplateId)
      }
      onClose()
      onCreated(row.id)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="survey-lib-new-panel-title"
      title="Ny undersøkelse"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => void handleCreate(new Event('submit') as unknown as FormEvent)}
            disabled={busy || !title.trim()}
          >
            {busy ? 'Oppretter …' : 'Opprett'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-template">
            Mal (valgfri)
          </label>
          <SearchableSelect
            value={selectedTemplateId}
            options={templateOptions}
            onChange={(val) => {
              setSelectedTemplateId(val)
              const tpl = val ? survey.templateCatalog.find((t) => t.id === val) : undefined
              if (tpl) {
                setTitle(tpl.name)
                setDescription(tpl.description ?? '')
                setIsAnonymous(tpl.recommend_anonymous)
                setSurveyType(tpl.audience === 'external' ? 'external' : 'internal')
              }
            }}
            placeholder="Velg mal …"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Malens spørsmål kopieres til undersøkelsen — du kan tilpasse etterpå.
          </p>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-title">
            Tittel
          </label>
          <StandardInput
            id="survey-lib-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
            required
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-description">
            Beskrivelse
          </label>
          <StandardTextarea
            id="survey-lib-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5"
            rows={2}
            placeholder="Kort beskrivelse til deltakerne …"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-type">
            Type
          </label>
          <SearchableSelect
            value={surveyType}
            options={SURVEY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(val) => setSurveyType(val as SurveyType)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Anonym</label>
          <p className="mb-1.5 text-xs text-neutral-500">
            Deltakernes identitet skjules for administratorer.
          </p>
          <YesNoToggle value={isAnonymous} onChange={setIsAnonymous} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-start">
              Startdato
            </label>
            <StandardInput
              id="survey-lib-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-lib-end">
              Sluttdato
            </label>
            <StandardInput
              id="survey-lib-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      </form>
    </SlidePanel>
  )
}
