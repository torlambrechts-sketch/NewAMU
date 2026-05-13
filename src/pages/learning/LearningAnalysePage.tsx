// Learning analytics page — fourth concrete consumer of
// ModuleAnalyticsDashboard (after checklists / survey / tasks).
// Owns dataset compute (from useLearning) and hands the result to the
// runtime + the registered learning scope.
//
// Per /specs/elearning-parity.md: the certification-expiry filter
// dimension is e-learning-specific (not in checklist/survey/tasks ports).
// Department resolution is via the user's organization_members row at
// completion time — a coarser "department-via-user" join, similar to
// tasks.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import {
  LEARNING_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/learningDashboardScope'
import './dashboards/learningDashboardScope'
import { STATUS_OPTIONS, useLearningDatasets } from './dashboards/useLearningDatasets'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardDimension } from '../../lib/dashboards/dashboardFilters'
import { makeFilter } from '../../lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../components/reports/ReportModuleWidget'

export function LearningAnalysePage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })
  const dashboard = useDashboardLayout({ supabase, scopeId: LEARNING_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'category',
        label: 'Kategori',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => cats.categories.map((c) => ({ id: c.id, label: c.name })),
      },
      {
        id: 'course',
        label: 'Kurs',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          learning.courses.map((c) => ({ id: c.id, label: c.title })),
      },
      {
        id: 'status',
        label: 'Status',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Resolved fra deltakerens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'user',
        label: 'Deltaker',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'expiry_window',
        label: 'Utløp',
        description: 'Sertifikater som utløper innen valgt vindu.',
        kind: 'enum',
        defaultOperator: 'is',
        operatorOptions: ['is'],
        loadOptions: () => [
          { id: '30', label: 'Innen 30 dager' },
          { id: '60', label: 'Innen 60 dager' },
          { id: '90', label: 'Innen 90 dager' },
        ],
      },
    ],
    [cats.categories, learning.courses, orgSetup.members, orgSetup.departments],
  )

  // Cross-module regulation filter (category-architecture §T8). Resolve
  // via course.categoryId → category.regulation_id. Pre-filter both
  // courses and downstream progress / certificates so the dataset
  // compute respects the active set without touching the hook signature.
  const { isActive: isRegulationActive } = useRegulationFilter()
  const { filteredCourses, filteredProgress, filteredCertificates } = useMemo(() => {
    const catRegById = new Map(
      cats.categories.map((c) => [c.id, c.regulation_id ?? null] as const),
    )
    const allowedCourseIds = new Set<string>()
    const courses = learning.courses.filter((c) => {
      const regId = c.categoryId ? (catRegById.get(c.categoryId) ?? null) : null
      const ok = isRegulationActive(regId)
      if (ok) allowedCourseIds.add(c.id)
      return ok
    })
    return {
      filteredCourses: courses,
      filteredProgress: learning.progress.filter((p) => allowedCourseIds.has(p.courseId)),
      filteredCertificates: learning.certificates.filter((c) => allowedCourseIds.has(c.courseId)),
    }
  }, [learning.courses, learning.progress, learning.certificates, cats.categories, isRegulationActive])

  const datasets = useLearningDatasets({
    filters: dashboard.filters,
    courses: filteredCourses,
    progress: filteredProgress,
    certificates: filteredCertificates,
    categories: cats.categories,
    members: orgSetup.members,
    departments: orgSetup.departments,
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

  const empty =
    learning.courses.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen kurs registrert ennå. Opprett et kurs for å se tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: LEARNING_DASHBOARD_SCOPE_ID,
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

  // Drill-down (3.2.2): translate a clicked segment label → option id for
  // the matching dimension, then toggle a chip on the active filter set.
  // Each branch knows the natural lookup map for its dimension.
  const handleDrillDown = (e: DrillDownEvent) => {
    let resolvedId: string | null = null
    if (e.dimensionId === 'status') {
      const opt = STATUS_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'category') {
      const cat = cats.categories.find((c) => c.name === e.segmentLabel)
      resolvedId = cat?.id ?? null
    } else if (e.dimensionId === 'course') {
      const course = learning.courses.find((c) => c.title === e.segmentLabel)
      resolvedId = course?.id ?? null
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
        accent={getDashboardScope(LEARNING_DASHBOARD_SCOPE_ID)?.accent}
        breadcrumb={[
          { label: 'Læring', to: '/learning' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, fullføring, sertifikatutløp og kursbruk på tvers av læringsmodulen."
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
              to="/learning"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey) {
                  e.preventDefault()
                  navigate('/learning')
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={LEARNING_DASHBOARD_SCOPE_ID}
              scopeLabel="Læring"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={learning.learningLoading || dashboard.loading}
        error={learning.learningError ?? dashboard.error}
        emptyState={empty}
        onEdit={undefined}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onDrillDown={handleDrillDown}
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
        scopeId={LEARNING_DASHBOARD_SCOPE_ID}
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

