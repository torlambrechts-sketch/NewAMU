// Møter — analyse page. Mounts ModuleAnalyticsDashboard with the
// `meetings` scope. Datasets are computed page-side so the scope file
// stays pure metadata.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETINGS_DASHBOARD_SCOPE_ID,
} from '../../../modules/meetings/dashboards/meetingsDashboardScope'
import '../../../modules/meetings/dashboards/meetingsDashboardScope'
import {
  MEETINGS_STATUS_OPTIONS,
  useMeetingsDatasets,
} from '../../../modules/meetings/dashboards/useMeetingsDatasets'
import {
  MEETING_FRAMEWORK_LABEL,
} from '../../../modules/meetings/meetingsLabels'
import {
  parseMeetingDecisionRow,
  type MeetingDecisionRow,
} from '../../../modules/meetings/types'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'
import type { ReportModule } from '../../types/reportBuilder'

export function MeetingsAnalysePage() {
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const meetings = useMeetings()
  const dashboard = useDashboardLayout({ supabase, scopeId: MEETINGS_DASHBOARD_SCOPE_ID })

  // Decisions live on the meeting detail; pull a flat view here so trends
  // work without loading each meeting individually.
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

  const categoryByMeetingId = useMemo(() => {
    const out = new Map<string, string | null>()
    const tplCategory = new Map<string, string | null>()
    for (const t of meetings.templates) {
      const id = t.systemTemplateId ?? t.orgTemplateId
      if (id) tplCategory.set(id, t.categoryId)
    }
    for (const m of meetings.meetings) {
      const tplId = m.system_template_id ?? m.org_template_id
      out.set(m.id, tplId ? tplCategory.get(tplId) ?? null : null)
    }
    return out
  }, [meetings.meetings, meetings.templates])

  const datasets = useMeetingsDatasets({
    filters: dashboard.filters,
    meetings: meetings.meetings,
    decisions: allDecisions,
    templates: meetings.templates,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByMeetingId,
  })

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

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: MEETINGS_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const empty =
    meetings.meetings.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen møter å analysere ennå. Planlegg et møte fra en mal for å se tallene her.
        </p>
      </div>
    ) : null

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
        accent={getDashboardScope(MEETINGS_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[{ label: 'HMS' }, { label: 'Møter', to: '/meetings' }, { label: 'Analyse' }]}
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
            <Link
              to="/meetings"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
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
        layout={layout}
        datasets={datasets}
        loading={meetings.loading || dashboard.loading}
        error={meetings.error ?? dashboard.error}
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
        scopeId={MEETINGS_DASHBOARD_SCOPE_ID}
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
