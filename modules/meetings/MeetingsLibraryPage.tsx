// MeetingsLibraryPage — ModuleLibraryShell-wrapped library page for the Møter module.
//
// Owns: category tabs (Alle + one per meeting_template_category), template
// gallery (filtered by active tab), upcoming meetings, all-meetings katalog,
// inline ModuleAnalyticsDashboard, and the create/peek slide panels.
// One useMeetings() instance feeds all views — no duplicate fetches.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronRight, Clock, ListChecks, Plus, Scale, Users } from 'lucide-react'
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
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
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
import { ReportingPeriodPicker, type PeriodValue } from './components/ReportingPeriodPicker'
import { suggestPeriodForTemplate } from './lib/suggestPeriodForTemplate'
import { useMeetings } from './useMeetings'
import type { UseMeetingsState } from './useMeetings'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { MEETINGS_DASHBOARD_SCOPE_ID } from './dashboards/meetingsDashboardScope'
import './dashboards/meetingsDashboardScope'
import {
  MEETINGS_STATUS_OPTIONS,
  useMeetingsDatasets,
} from './dashboards/useMeetingsDatasets'
import {
  MEETING_CADENCE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_FRAMEWORK_LABEL,
  MEETING_STATUS_LABEL,
  frameworkLabel,
} from './meetingsLabels'
import {
  parseMeetingDecisionRow,
  type MeetingConfidentialityLevel,
  type MeetingDecisionRow,
  type MeetingRow,
  type MeetingStatus,
  type ResolvedMeetingTemplate,
} from './types'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'
import type { ReportModule } from '../../src/types/reportBuilder'

const ACCENT = '#0891b2'

const STATUS_BADGE: Record<MeetingStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  planned: 'active',
  in_progress: 'active',
  completed: 'signed',
  cancelled: 'neutral',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function templateCadenceLabel(t: ResolvedMeetingTemplate): string {
  return t.cadenceHint ? MEETING_CADENCE_LABEL[t.cadenceHint] : 'Ved behov'
}

function isRestrictedTemplate(t: ResolvedMeetingTemplate): boolean {
  return t.defaultConfidentialityLevel !== 'standard'
}

export function MeetingsLibraryPage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const navigate = useNavigate()
  const meetings = useMeetings()

  const [activeTab, setActiveTab] = useState<string>('alle')
  const [createOpen, setCreateOpen] = useState(false)
  const [presetTemplateId, setPresetTemplateId] = useState<string | null>(null)
  const [peekTemplate, setPeekTemplate] = useState<ResolvedMeetingTemplate | null>(null)
  const [katalogSearch, setKatalogSearch] = useState('')

  // ── Decisions fetch for analyse dashboard ────────────────────────────────
  const [allDecisions, setAllDecisions] = useState<MeetingDecisionRow[]>([])
  useEffect(() => {
    if (!supabase || !meetings.orgId) return
    let cancelled = false
    void supabase
      .from('meeting_decisions')
      .select('*')
      .order('decision_at', { ascending: false })
      .limit(2000)
      .then((res) => {
        if (cancelled || res.error) return
        const parsed: MeetingDecisionRow[] = []
        for (const raw of res.data ?? []) {
          const p = parseMeetingDecisionRow(raw)
          if (p.success) parsed.push(p.data)
        }
        setAllDecisions(parsed)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, meetings.orgId])

  // ── Dashboard ────────────────────────────────────────────────────────────
  const dashboard = useDashboardLayout({ supabase, scopeId: MEETINGS_DASHBOARD_SCOPE_ID })
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: MEETINGS_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const categoryByMeetingId = useMemo(() => {
    const tplCategory = new Map<string, string | null>()
    for (const t of meetings.templates) {
      const id = t.systemTemplateId ?? t.orgTemplateId
      if (id) tplCategory.set(id, t.categoryId)
    }
    const out = new Map<string, string | null>()
    for (const m of meetings.meetings) {
      const tplId = m.system_template_id ?? m.org_template_id
      out.set(m.id, tplId ? tplCategory.get(tplId) ?? null : null)
    }
    return out
  }, [meetings.meetings, meetings.templates])

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på en eller flere maler.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          meetings.templates.map((t) => ({
            id: t.systemTemplateId ?? t.orgTemplateId ?? t.key,
            label: t.name,
          })),
      },
      {
        id: 'framework',
        label: 'Rammeverk',
        description: 'Filtrer på lovregime / standard.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          Object.entries(MEETING_FRAMEWORK_LABEL).map(([id, label]) => ({ id, label })),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Filtrer på møtestatus.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => MEETINGS_STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'category',
        label: 'Kategori',
        description: 'Filtrer på malenes kategori.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => meetings.categories.map((c) => ({ id: c.id, label: c.name })),
      },
      {
        id: 'location',
        label: 'Lokasjon',
        description: 'Filtrer på møtets lokasjon.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrer på møtets avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på planlagt / gjennomført dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [meetings.templates, meetings.categories, orgSetup.locations, orgSetup.departments],
  )

  const datasets = useMeetingsDatasets({
    filters: dashboard.filters,
    meetings: meetings.meetings,
    decisions: allDecisions,
    templates: meetings.templates,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByMeetingId,
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

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    const countByCategory = new Map<string, number>()
    for (const t of meetings.templates) {
      if (!t.isActive) continue
      const key = t.categoryId ?? '__uncat__'
      countByCategory.set(key, (countByCategory.get(key) ?? 0) + 1)
    }
    return [
      { id: 'alle', label: 'Alle', count: meetings.templates.filter((t) => t.isActive).length },
      ...meetings.categories
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          id: c.id,
          label: c.name,
          count: countByCategory.get(c.id) ?? 0,
        })),
    ]
  }, [meetings.templates, meetings.categories])

  // ── Filtered data per tab ────────────────────────────────────────────────
  const filteredTemplates = useMemo(
    () =>
      activeTab === 'alle'
        ? meetings.templates.filter((t) => t.isActive)
        : meetings.templates.filter((t) => t.isActive && t.categoryId === activeTab),
    [meetings.templates, activeTab],
  )

  const katalogMeetings = useMemo(() => {
    const q = katalogSearch.toLowerCase()
    return meetings.meetings.filter((m) => !q || m.title.toLowerCase().includes(q))
  }, [meetings.meetings, katalogSearch])

  // ── Library view ─────────────────────────────────────────────────────────
  const libraryView = (
    <div className="mx-auto max-w-[1400px] space-y-5 px-10 py-6">
      {meetings.error && (
        <div className="mb-5">
          <WarningBox>{meetings.error}</WarningBox>
        </div>
      )}
      <LibraryTemplateGallery
        templates={filteredTemplates}
        categories={meetings.categories}
        activeCategory={activeTab === 'alle' ? null : activeTab}
        orgHeadcount={orgSetup.members?.length ?? 0}
        onPeek={setPeekTemplate}
        onCreateForTemplate={(t) => {
          setPresetTemplateId(t.systemTemplateId ?? t.orgTemplateId ?? null)
          setCreateOpen(true)
        }}
      />
      <UpcomingMeetingsCard
        meetings={meetings.meetings}
        categoryFilter={activeTab === 'alle' ? null : activeTab}
        categoryByMeetingId={categoryByMeetingId}
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
          placeholder="Søk etter møtetittel …"
          className="max-w-sm"
        />
        <span className="text-sm text-neutral-600">{katalogMeetings.length} møter</span>
      </div>
      <LayoutTable1PostingsShell
        wrap
        title="Alle møter"
        description="Alle registrerte møter, sortert etter planlagt tidspunkt."
        toolbar={null}
        footer={<span className="text-neutral-500">{katalogMeetings.length} poster</span>}
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
              </tr>
            </thead>
            <tbody>
              {katalogMeetings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-neutral-500">
                    Ingen møter funnet.
                  </td>
                </tr>
              ) : (
                katalogMeetings.map((m) => (
                  <tr
                    key={m.id}
                    className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                    onClick={() => navigate(`/meetings/${m.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-neutral-900">{m.title}</td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_BADGE[m.status]}>
                        {MEETING_STATUS_LABEL[m.status]}
                      </Badge>
                      {m.confidentiality_level !== 'standard' ? (
                        <Badge
                          variant={
                            m.confidentiality_level === 'confidential'
                              ? 'confidential'
                              : 'restricted'
                          }
                          className="ml-1.5"
                        >
                          {MEETING_CONFIDENTIALITY_LABEL[m.confidentiality_level]}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">{fmtDate(m.scheduled_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-neutral-400" />
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
    meetings.meetings.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen møter å analysere ennå. Planlegg et møte fra en mal for å se tallene her.
        </p>
      </div>
    ) : null

  const analyseView = (
    <ModuleAnalyticsDashboard
      accent={getDashboardScope(MEETINGS_DASHBOARD_SCOPE_ID)?.accent ?? ACCENT}
      breadcrumb={undefined}
      title="Analyse"
      description="Volum, vedtak og etterlevelse på tvers av alle møtetyper."
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
            scopeId={MEETINGS_DASHBOARD_SCOPE_ID}
            scopeLabel="Møter"
            datasets={datasets}
            ensureSavedRow={dashboard.ensureSavedRow}
          />
        </div>
      }
      layout={analyseLayout}
      datasets={datasets}
      loading={meetings.loading || dashboard.loading}
      error={meetings.error ?? dashboard.error}
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
        scopeId={MEETINGS_DASHBOARD_SCOPE_ID}
        onAdd={(widget: ReportModule) => void dashboard.saveLayout([...dashboard.layout, widget])}
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

  return (
    <ModuleLibraryShell
      eyebrow="HMS"
      title="Møter"
      subtitle="Planlegg, gjennomfør og dokumenter lovpålagte møter"
      accentColor={ACCENT}
      settingsTo="/admin/settings/meetings"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabRowAction={
        meetings.canManage ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setPresetTemplateId(null)
              setCreateOpen(true)
            }}
          >
            Nytt møte
          </Button>
        ) : undefined
      }
      libraryView={libraryView}
      katalogView={katalogView}
      analyseView={analyseView}
      analyseEditPanels={analyseEditPanels}
      detailPanel={
        <>
          <CreateMeetingSlidePanel
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            meetings={meetings}
            presetTemplateId={presetTemplateId}
            onCreated={(id) => navigate(`/meetings/${id}`)}
          />
          {peekTemplate !== null && (
            <TemplatePeekSlidePanel
              open
              onClose={() => setPeekTemplate(null)}
              template={peekTemplate}
            />
          )}
        </>
      }
    />
  )
}

// ── Library template gallery ─────────────────────────────────────────────

function LibraryTemplateGallery({
  templates,
  categories,
  activeCategory,
  orgHeadcount,
  onPeek,
  onCreateForTemplate,
}: {
  templates: ResolvedMeetingTemplate[]
  categories: UseMeetingsState['categories']
  activeCategory: string | null
  orgHeadcount: number
  onPeek: (t: ResolvedMeetingTemplate) => void
  onCreateForTemplate: (t: ResolvedMeetingTemplate) => void
}) {
  const grouped = useMemo(() => {
    if (activeCategory !== null) {
      return templates.length > 0 ? [{ id: activeCategory, name: null, templates }] : []
    }
    const buckets = new Map<string, ResolvedMeetingTemplate[]>()
    for (const t of templates) {
      const key = t.categoryId ?? '__uncat__'
      const list = buckets.get(key) ?? []
      list.push(t)
      buckets.set(key, list)
    }
    const cats = categories.slice().sort((a, b) => a.position - b.position)
    const ordered: Array<{ id: string; name: string | null; templates: ResolvedMeetingTemplate[] }> =
      []
    for (const cat of cats) {
      const list = buckets.get(cat.id)
      if (list?.length) ordered.push({ id: cat.id, name: cat.name, templates: list })
    }
    const uncat = buckets.get('__uncat__')
    if (uncat?.length) ordered.push({ id: '__uncat__', name: 'Uten kategori', templates: uncat })
    return ordered
  }, [templates, categories, activeCategory])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#0891b2]" />
          <h2 className="text-lg font-semibold text-neutral-900">Maler</h2>
        </div>
        <span className="text-xs text-neutral-500">{templates.length} aktive</span>
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Velg en mal for å se agendasaker og krav, eller opprett et nytt møte direkte.
      </p>

      <div className="mt-5 space-y-6">
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen maler tilgjengelig ennå.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.id}>
              {group.name !== null && (
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  {group.name}
                </h3>
              )}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((t) => {
                  const belowThreshold =
                    t.minimumEmployeeCount != null && orgHeadcount < t.minimumEmployeeCount
                  return (
                    <li
                      key={t.key}
                      className="relative flex flex-col gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                    >
                      {(t.systemTemplateId ?? t.orgTemplateId) ? (
                        <FavoriteToggle
                          kind="meeting"
                          templateRef={(t.systemTemplateId ?? t.orgTemplateId) as string}
                          templateName={t.name}
                          size="sm"
                          className="absolute right-1.5 top-1.5 z-10 bg-white/90"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onPeek(t)}
                        className="flex h-auto flex-col items-start gap-2 rounded-none p-0 text-left font-normal hover:bg-transparent w-full"
                      >
                        <div className="flex w-full items-start justify-between gap-2 pr-6">
                          <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                          <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                        </div>
                        {t.description ? (
                          <p className="line-clamp-3 text-xs text-neutral-600">{t.description}</p>
                        ) : null}
                        {belowThreshold ? (
                          <div>
                            <Badge variant="warning">
                              Krever {t.minimumEmployeeCount}+ ansatte
                            </Badge>
                          </div>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {templateCadenceLabel(t)}
                          </span>
                          {t.definition.agendaItems.length ? (
                            <span className="inline-flex items-center gap-1">
                              <ListChecks className="h-3 w-3" />
                              {t.definition.agendaItems.length} saker
                            </span>
                          ) : null}
                        </div>
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => onCreateForTemplate(t)}
                        className="mt-auto"
                      >
                        Nytt {t.name.toLowerCase()}
                      </Button>
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

// ── Upcoming meetings card ────────────────────────────────────────────────

function UpcomingMeetingsCard({
  meetings,
  categoryFilter,
  categoryByMeetingId,
}: {
  meetings: MeetingRow[]
  categoryFilter: string | null
  categoryByMeetingId: Map<string, string | null>
}) {
  const upcoming = useMemo(() => {
    let list = meetings.filter(
      (m) => m.status === 'planned' || m.status === 'in_progress',
    )
    if (categoryFilter !== null) {
      list = list.filter((m) => categoryByMeetingId.get(m.id) === categoryFilter)
    }
    return list
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
      .slice(0, 8)
  }, [meetings, categoryFilter, categoryByMeetingId])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Kommende og pågående møter</h2>
        <span className="text-xs text-neutral-500">{upcoming.length}</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Ingen planlagte eller pågående møter.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/meetings/${m.id}`}
                  className="text-sm font-semibold text-neutral-900 hover:underline"
                >
                  {m.title}
                </Link>
                <p className="mt-0.5 text-xs text-neutral-600">{fmtDate(m.scheduled_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_BADGE[m.status]}>
                  {MEETING_STATUS_LABEL[m.status]}
                </Badge>
                {m.confidentiality_level !== 'standard' ? (
                  <Badge variant="warning">
                    {MEETING_CONFIDENTIALITY_LABEL[m.confidentiality_level]}
                  </Badge>
                ) : null}
                <Link
                  to={`/meetings/${m.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
                  aria-label={`Åpne ${m.title}`}
                >
                  Åpne <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModuleSectionCard>
  )
}

// ── Create meeting slide panel ────────────────────────────────────────────

function CreateMeetingSlidePanel({
  open,
  onClose,
  meetings,
  presetTemplateId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  meetings: UseMeetingsState
  presetTemplateId: string | null
  onCreated: (id: string) => void
}) {
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [confidentiality, setConfidentiality] = useState<MeetingConfidentialityLevel>('standard')
  const [period, setPeriod] = useState<PeriodValue>({ start: null, end: null, label: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const preset = presetTemplateId ?? ''
    setTemplateId(preset)
    const tpl = meetings.templates.find(
      (t) => t.systemTemplateId === preset || t.orgTemplateId === preset,
    )
    setTitle(tpl?.name ?? '')
    setConfidentiality(tpl?.defaultConfidentialityLevel ?? 'standard')
    setScheduledAt('')
    setPeriod(suggestPeriodForTemplate(tpl?.cadenceHint ?? null, null))
  }, [open, presetTemplateId, meetings.templates])

  // Re-suggest period when scheduledAt changes (but don't override explicit user edits).
  useEffect(() => {
    if (!open || !scheduledAt) return
    const tpl = meetings.templates.find(
      (t) => t.systemTemplateId === templateId || t.orgTemplateId === templateId,
    )
    if (!tpl?.cadenceHint) return
    setPeriod((prev) => {
      if (prev.start || prev.end || prev.label) return prev
      return suggestPeriodForTemplate(tpl.cadenceHint ?? null, scheduledAt)
    })
  }, [scheduledAt, templateId, meetings.templates, open])

  const templateOptions = useMemo(
    () =>
      meetings.templates
        .filter((t) => t.isActive)
        .map((t) => ({
          value: t.systemTemplateId ?? t.orgTemplateId ?? '',
          label: t.name,
        })),
    [meetings.templates],
  )

  const selectedTemplate = useMemo(
    () =>
      meetings.templates.find(
        (t) => t.systemTemplateId === templateId || t.orgTemplateId === templateId,
      ) ?? null,
    [meetings.templates, templateId],
  )

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (busy || !templateId || !title.trim()) return
    setBusy(true)
    try {
      const created = await meetings.createMeeting({
        title: title.trim(),
        templateId: selectedTemplate?.systemTemplateId ?? undefined,
        orgTemplateId: selectedTemplate?.orgTemplateId ?? undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        confidentialityLevel: confidentiality,
        reportingPeriodStart: period.start,
        reportingPeriodEnd: period.end,
        reportingPeriodLabel: period.label,
      })
      if (created) {
        onClose()
        onCreated(created.id)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-lib-new-panel-title"
      title="Nytt møte"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => void handleCreate(new Event('submit') as unknown as FormEvent)}
            disabled={busy || !templateId || !title.trim()}
          >
            {busy ? 'Oppretter …' : 'Opprett'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-lib-template">
            Mal
          </label>
          <SearchableSelect
            value={templateId}
            options={templateOptions}
            onChange={(val) => {
              setTemplateId(val)
              const tpl = meetings.templates.find(
                (t) => t.systemTemplateId === val || t.orgTemplateId === val,
              )
              if (tpl) {
                setTitle(tpl.name)
                setConfidentiality(tpl.defaultConfidentialityLevel ?? 'standard')
              }
            }}
            placeholder="Velg en mal …"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Malens agenda kopieres til møtet og kan ikke endres etter signering.
          </p>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-lib-title">
            Tittel
          </label>
          <StandardInput
            id="meetings-lib-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-lib-when">
            Planlagt tidspunkt
          </label>
          <StandardInput
            id="meetings-lib-when"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-lib-conf">
            Konfidensialitet
          </label>
          <SearchableSelect
            value={confidentiality}
            options={[
              { value: 'standard', label: MEETING_CONFIDENTIALITY_LABEL.standard },
              { value: 'restricted', label: MEETING_CONFIDENTIALITY_LABEL.restricted },
              { value: 'confidential', label: MEETING_CONFIDENTIALITY_LABEL.confidential },
            ]}
            onChange={(val) => setConfidentiality(val as MeetingConfidentialityLevel)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Drøftingsmøter og varslingssaker er begrenset som standard.
          </p>
        </div>
        <ReportingPeriodPicker
          value={period}
          onChange={setPeriod}
          anchor={scheduledAt || null}
          hint="Hvilken periode skal møtet gjennomgå? Forslag genereres fra malens kadens."
        />
      </form>
    </SlidePanel>
  )
}

// ── Template peek panel ───────────────────────────────────────────────────

function TemplatePeekSlidePanel({
  open,
  onClose,
  template,
}: {
  open: boolean
  onClose: () => void
  template: ResolvedMeetingTemplate
}) {
  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-lib-template-peek-title"
      title={`Mal: ${template.name}`}
      footer={
        <div className="flex w-full items-center justify-end">
          <Button variant="secondary" onClick={onClose}>
            Lukk
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{frameworkLabel(template.framework)}</Badge>
          <Badge variant="neutral">{templateCadenceLabel(template)}</Badge>
          {isRestrictedTemplate(template) ? (
            <Badge variant="warning">Begrenset som standard</Badge>
          ) : null}
        </div>

        {template.description ? (
          <p className="text-sm leading-relaxed text-neutral-700">{template.description}</p>
        ) : null}

        <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Krav</p>
          <dl className="mt-2 space-y-1.5 text-xs text-neutral-700">
            <div className="flex justify-between gap-3">
              <dt>Kadens</dt>
              <dd className="font-semibold">{templateCadenceLabel(template)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Varighet</dt>
              <dd className="font-semibold">
                {template.defaultDurationMinutes ? `${template.defaultDurationMinutes} min` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Innkallingsfrist</dt>
              <dd className="font-semibold">
                {template.definition.invitationLeadDays
                  ? `${template.definition.invitationLeadDays} dager`
                  : '—'}
              </dd>
            </div>
          </dl>
          {template.definition.requiredAttendees.length ? (
            <div className="mt-3 border-t border-neutral-200/80 pt-3">
              <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                <Users className="h-3 w-3" /> Påkrevde roller
              </p>
              <ul className="space-y-0.5 text-xs text-neutral-700">
                {template.definition.requiredAttendees.map((r, idx) => (
                  <li key={idx}>
                    {r.role}
                    {r.count ? ` × ${r.count}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Obligatoriske saker</h3>
          {template.definition.agendaItems.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen saker i malen.</p>
          ) : (
            <ol className="space-y-3">
              {template.definition.agendaItems
                .slice()
                .sort((a, b) => a.defaultPosition - b.defaultPosition)
                .map((item) => (
                  <li
                    key={item.key}
                    className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                      {item.isMandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
                    </div>
                    {item.description ? (
                      <p className="mt-2 text-xs text-neutral-600">{item.description}</p>
                    ) : null}
                    {item.lawRef ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <Scale className="h-3 w-3" /> {item.lawRef}
                      </p>
                    ) : null}
                  </li>
                ))}
            </ol>
          )}
        </div>

        {template.lawRefs.length ? (
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              <Scale className="h-3 w-3" /> Lovreferanser
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-neutral-700">
              {template.lawRefs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SlidePanel>
  )
}
