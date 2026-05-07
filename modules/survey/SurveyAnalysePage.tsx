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
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import type { SurveyRow, SurveyStatus } from './types'
import type { ReportModule } from '../../src/types/reportBuilder'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../src/lib/dashboards/dashboardFilters'

const STATUS_OPTIONS: { id: SurveyStatus; label: string }[] = [
  { id: 'draft', label: 'Kladd' },
  { id: 'active', label: 'Aktiv / publisert' },
  { id: 'closed', label: 'Lukket' },
  { id: 'archived', label: 'Arkivert' },
]

type FilterSelectors = {
  packs: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<SurveyStatus>; mode: 'include' | 'exclude' } | null
  categories: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  locations: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  participants: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  anonymous: 'only' | 'exclude' | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    packs: null,
    templates: null,
    statuses: null,
    categories: null,
    locations: null,
    departments: null,
    participants: null,
    anonymous: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'pack') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.packs = { ids, mode }
    } else if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<SurveyStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'category') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.categories = { ids, mode }
    } else if (f.dimensionId === 'location') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.locations = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'participant') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.participants = { ids, mode }
    } else if (f.dimensionId === 'anonymity') {
      const v = typeof f.value === 'string' ? f.value : ''
      if (v === 'anonymous') out.anonymous = 'only'
      else if (v === 'identified') out.anonymous = 'exclude'
    } else if (f.dimensionId === 'date') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.from = new Date(r.from)
        if (r.to) out.to = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
        out.from = new Date(f.value)
      } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
        out.to = new Date(f.value + 'T23:59:59')
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

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

  const datasets = useMemo(() => {
    const sel = buildSelectors(dashboard.filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    // Filter surveys by chips first; downstream datasets bucket the
    // already-filtered set so a single chip moves every widget consistently.
    const surveys = survey.surveys.filter((s: SurveyRow) => {
      if (!matchesSet(sel.packs, s.pack)) return false
      if (s.catalog_id && !matchesSet(sel.templates, s.catalog_id)) return false
      if (sel.templates && !s.catalog_id) {
        if (sel.templates.mode === 'include') return false
      }
      if (sel.categories) {
        const catId = s.catalog_id ? categoryByCatalogId.get(s.catalog_id) ?? null : null
        if (!catId) {
          if (sel.categories.mode === 'include') return false
        } else if (!matchesSet(sel.categories, catId)) {
          return false
        }
      }
      if (!matchesSet(sel.statuses, s.status)) return false
      if (sel.locations) {
        if (!s.location_id) {
          if (sel.locations.mode === 'include') return false
        } else if (!matchesSet(sel.locations, s.location_id)) {
          return false
        }
      }
      if (sel.departments) {
        if (!s.department_id) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, s.department_id)) {
          return false
        }
      }
      if (sel.participants) {
        const intersects = s.participant_member_ids.some((id) => sel.participants!.ids.has(id))
        if (sel.participants.mode === 'include' ? !intersects : intersects) return false
      }
      if (sel.anonymous === 'only' && !s.is_anonymous) return false
      if (sel.anonymous === 'exclude' && s.is_anonymous) return false
      if (sel.from || sel.to) {
        const at = s.closed_at
          ? new Date(s.closed_at)
          : s.published_at
          ? new Date(s.published_at)
          : s.created_at
          ? new Date(s.created_at)
          : null
        if (!dateInRange(at, sel.from, sel.to)) return false
      }
      return true
    })

    let total = 0
    let open = 0
    let closed = 0
    let ytdClosed = 0
    let anonymous = 0
    const statusCounts: Record<string, number> = {
      Kladd: 0,
      Aktiv: 0,
      Lukket: 0,
      Arkivert: 0,
    }
    const packCounts: Record<string, number> = {}
    const templateCounts = new Map<string, number>()
    const locationCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()
    const locationById = new Map(orgSetup.locations.map((l) => [l.id, l.name]))
    const departmentById = new Map(orgSetup.departments.map((d) => [d.id, d.name]))

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    // Responses-over-time: when survey was published in month X, attribute
    // its responses to X. We don't have per-response timestamps loaded here
    // (would need a separate query); the proxy is "publish month volume".
    const publishedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))

    for (const s of surveys) {
      total += 1
      if (s.status === 'closed') {
        closed += 1
        statusCounts.Lukket = (statusCounts.Lukket ?? 0) + 1
        if (s.closed_at && new Date(s.closed_at) >= yearStart) ytdClosed += 1
      } else if (s.status === 'archived') {
        statusCounts.Arkivert = (statusCounts.Arkivert ?? 0) + 1
      } else if (s.status === 'active') {
        open += 1
        statusCounts.Aktiv = (statusCounts.Aktiv ?? 0) + 1
      } else {
        open += 1
        statusCounts.Kladd = (statusCounts.Kladd ?? 0) + 1
      }
      if (s.is_anonymous) anonymous += 1

      const packLabel =
        packs.find((p) => p.slug === s.pack)?.short_name ?? s.pack
      packCounts[packLabel] = (packCounts[packLabel] ?? 0) + 1

      if (s.catalog_id) {
        const tpl = survey.templateCatalog.find((t) => t.id === s.catalog_id)
        const tplName = tpl?.name ?? '(ad-hoc)'
        templateCounts.set(tplName, (templateCounts.get(tplName) ?? 0) + 1)
      } else {
        templateCounts.set('(ad-hoc)', (templateCounts.get('(ad-hoc)') ?? 0) + 1)
      }

      const locName = s.location_id
        ? locationById.get(s.location_id) ?? '(ukjent)'
        : '(uten lokasjon)'
      locationCounts.set(locName, (locationCounts.get(locName) ?? 0) + 1)

      const depName = s.department_id
        ? departmentById.get(s.department_id) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depName, (departmentCounts.get(depName) ?? 0) + 1)

      // Attribute each survey's responses to the month it was published.
      // Approximation — a more accurate version would bucket each
      // org_survey_responses row by its own submitted_at, but that would
      // require loading per-response data on the analyse list view.
      const published = s.published_at ? new Date(s.published_at) : null
      if (published) {
        const k = monthKey(published)
        if (publishedByMonth.has(k))
          publishedByMonth.set(k, (publishedByMonth.get(k) ?? 0) + s.response_count)
      }
    }

    // Cached counts on the surveys row are maintained by triggers in
    // migration 20260828120028. Sum across the filtered set; rate is
    // total responses / total invitations across published surveys
    // (drafts + archived contribute zero invitations).
    let responses = 0
    let invitationsTotal = 0
    for (const s of surveys) {
      responses += s.response_count
      if (s.status === 'active' || s.status === 'closed') {
        invitationsTotal += s.invitation_count
      }
    }
    const responseRatePct =
      invitationsTotal > 0 ? Math.round((responses / invitationsTotal) * 100) : 0

    const topTemplates = [...templateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const templateBar: Record<string, number> = {}
    for (const [name, count] of topTemplates) templateBar[name] = count

    return {
      survey_kpi_summary: {
        total,
        open,
        closed,
        ytdClosed,
        responses,
        responseRatePct,
      },
      survey_status_distribution: statusCounts,
      survey_pack_distribution: packCounts,
      survey_template_distribution: templateBar,
      survey_responses_by_location: Object.fromEntries(locationCounts),
      survey_responses_by_department: Object.fromEntries(departmentCounts),
      survey_anonymity_distribution: {
        Anonym: anonymous,
        Identifisert: total - anonymous,
      },
      survey_responses_over_time: months.map((m) => ({
        x: m.label,
        y: publishedByMonth.get(m.key) ?? 0,
      })),
      survey_response_rate_over_time: months.map((m) => ({
        x: m.label,
        y: 0,
      })),
    } as Record<string, unknown>
  }, [
    survey.surveys,
    survey.templateCatalog,
    packs,
    orgSetup.locations,
    orgSetup.departments,
    categoryByCatalogId,
    dashboard.filters,
  ])

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

  const widgetControlSlot = (m: ReportModule) => (
    <DashboardWidgetMenu
      ariaLabel={`Meny for widget ${m.title}`}
      onEdit={() => setEditWidget(m)}
      onDuplicate={() => {
        const dup = { ...m, id: cryptoUuid(), title: `${m.title} (kopi)` }
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
          <Link
            to="/survey"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
        layout={layout}
        datasets={datasets}
        loading={survey.loading || dashboard.loading}
        error={survey.error ?? dashboard.error}
        emptyState={empty}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
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
          const dup = { ...w, id: cryptoUuid(), title: `${w.title} (kopi)` }
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

const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
function cryptoUuid(): string {
  if (typeof cryptoLike?.randomUUID === 'function') return cryptoLike.randomUUID()
  return `w_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}
