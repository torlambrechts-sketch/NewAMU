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
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import type { Course, CourseProgress, Certificate } from '../../types/learning'
import type { ReportModule } from '../../types/reportBuilder'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../lib/dashboards/dashboardFilters'
import { makeFilter } from '../../lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../components/reports/ReportModuleWidget'

type ProgressStatus = 'enrolled' | 'in_progress' | 'completed' | 'expired'

const STATUS_OPTIONS: { id: ProgressStatus; label: string }[] = [
  { id: 'enrolled', label: 'Påmeldt' },
  { id: 'in_progress', label: 'Pågående' },
  { id: 'completed', label: 'Fullført' },
  { id: 'expired', label: 'Utløpt' },
]

type FilterSelectors = {
  categories: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  courses: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<ProgressStatus>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  users: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  expiryWithinDays: number | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    categories: null,
    courses: null,
    statuses: null,
    departments: null,
    users: null,
    expiryWithinDays: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'category') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.categories = { ids, mode }
    } else if (f.dimensionId === 'course') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.courses = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<ProgressStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'user') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.users = { ids, mode }
    } else if (f.dimensionId === 'expiry_window') {
      // Operator-agnostic: the value is one of "30" / "60" / "90".
      if (typeof f.value === 'string' && f.value) {
        const n = Number(f.value)
        if (!Number.isNaN(n) && n > 0) out.expiryWithinDays = n
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

function progressStatus(
  course: Course,
  progress: CourseProgress | undefined,
  cert: Certificate | undefined,
  expiryDate: Date | null,
  now: Date,
): ProgressStatus {
  if (cert && expiryDate && expiryDate < now) return 'expired'
  if (cert) return 'completed'
  const total = course.modules.length
  if (!progress || total === 0) return 'enrolled'
  const done = course.modules.filter((m) => progress.moduleProgress[m.id]?.completed).length
  if (done >= total) return 'completed'
  if (done > 0) return 'in_progress'
  return 'enrolled'
}

function certExpiryDate(cert: Certificate, course: Course): Date | null {
  const months = course.recertificationMonths
  if (!months || months <= 0) return null
  const issued = new Date(cert.issuedAt)
  const exp = new Date(issued)
  exp.setMonth(exp.getMonth() + months)
  return exp
}

export function LearningAnalysePage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })
  const dashboard = useDashboardLayout({ supabase, scopeId: LEARNING_DASHBOARD_SCOPE_ID })

  // member id → department id (snapshot lookup at compute time)
  const departmentByMemberId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const member of orgSetup.members) m.set(member.id, member.department_id)
    return m
  }, [orgSetup.members])

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

  const datasets = useMemo(() => {
    const sel = buildSelectors(dashboard.filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const courseById = new Map(learning.courses.map((c) => [c.id, c]))
    const categoryNameById = new Map(cats.categories.map((c) => [c.id, c.name]))
    const departmentNameById = new Map(
      orgSetup.departments.map((d) => [d.id, d.name]),
    )
    // Department resolution prefers the trigger-maintained snapshot on
    // CourseProgress (set at completion by migration 20260828120030).
    // Falls back to the user→member→department lookup when no snapshot
    // exists (in-progress rows, legacy completions before the trigger).
    const memberDepartmentByUser = (userId?: string): string | null => {
      if (!userId) return null
      const member = orgSetup.members.find((m) => m.id === userId)
      return member ? departmentByMemberId.get(member.id) ?? null : null
    }
    const departmentForRow = (
      progress: CourseProgress | undefined,
      userId: string | undefined,
    ): string | null => {
      if (progress?.departmentIdAtCompletion) return progress.departmentIdAtCompletion
      return memberDepartmentByUser(userId)
    }

    type ProgressRow = {
      course: Course
      progress: CourseProgress | undefined
      cert: Certificate | undefined
      status: ProgressStatus
      expiry: Date | null
      userId: string | undefined
      categoryId: string | null
    }

    const rows: ProgressRow[] = []
    for (const p of learning.progress) {
      const course = courseById.get(p.courseId)
      if (!course) continue
      const cert = learning.certificates.find(
        (c) => c.courseId === p.courseId && (!p.userId || true),
      )
      const exp = cert ? certExpiryDate(cert, course) : null
      rows.push({
        course,
        progress: p,
        cert,
        status: progressStatus(course, p, cert, exp, now),
        expiry: exp,
        userId: p.userId,
        categoryId: course.categoryId ?? null,
      })
    }
    // Also include enrolled-only rows for courses with certs but no
    // progress (rare — preserves cert visibility).
    for (const cert of learning.certificates) {
      const exists = rows.some((r) => r.cert?.id === cert.id)
      if (exists) continue
      const course = courseById.get(cert.courseId)
      if (!course) continue
      const exp = certExpiryDate(cert, course)
      rows.push({
        course,
        progress: undefined,
        cert,
        status: progressStatus(course, undefined, cert, exp, now),
        expiry: exp,
        userId: undefined,
        categoryId: course.categoryId ?? null,
      })
    }

    const filtered = rows.filter((r) => {
      if (sel.categories) {
        const cid = r.categoryId
        if (!cid) {
          if (sel.categories.mode === 'include') return false
        } else if (!matchesSet(sel.categories, cid)) {
          return false
        }
      }
      if (!matchesSet(sel.courses, r.course.id)) return false
      if (!matchesSet(sel.statuses, r.status)) return false
      if (sel.departments) {
        const dep = departmentForRow(r.progress, r.userId)
        if (!dep) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, dep)) {
          return false
        }
      }
      if (sel.users) {
        if (!r.userId) {
          if (sel.users.mode === 'include') return false
        } else if (!matchesSet(sel.users, r.userId)) {
          return false
        }
      }
      if (sel.expiryWithinDays) {
        if (!r.expiry) return false
        const diffDays = (r.expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays < 0 || diffDays > sel.expiryWithinDays) return false
      }
      return true
    })

    let totalCourses = 0
    let activeLearners = 0
    let totalCompleted = 0
    let completedYtd = 0
    /** YTD count for the equivalent date range last year — drives the
     *  comparison delta on the "Fullført i år" KPI. */
    let completedPrevYtd = 0
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const prevYearCutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    let certsExpiring30d = 0
    const statusCounts: Record<string, number> = {
      Påmeldt: 0,
      Pågående: 0,
      Fullført: 0,
      Utløpt: 0,
    }
    const categoryCounts = new Map<string, number>()
    const courseCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()
    const expiryWindowCounts: Record<string, number> = {
      'Innen 30d': 0,
      '30–60d': 0,
      '60–90d': 0,
      '90d+': 0,
    }

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const completionsByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    // Previous-period series (months 23..12 ago) used by the line widget's
    // comparison overlay so users can see year-over-year shape.
    const prevMonths: { key: string; label: string }[] = []
    for (let i = 23; i >= 12; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      prevMonths.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const completionsByMonthPrev = new Map<string, number>(prevMonths.map((m) => [m.key, 0]))

    // Distinct courses contributing to filtered set
    const seenCourseIds = new Set<string>()

    for (const r of filtered) {
      seenCourseIds.add(r.course.id)

      if (r.status === 'enrolled') statusCounts.Påmeldt += 1
      else if (r.status === 'in_progress') {
        statusCounts.Pågående += 1
        activeLearners += 1
      } else if (r.status === 'completed') statusCounts.Fullført += 1
      else if (r.status === 'expired') statusCounts.Utløpt += 1

      if (r.cert) {
        totalCompleted += 1
        const issued = new Date(r.cert.issuedAt)
        if (issued >= yearStart) completedYtd += 1
        if (issued >= prevYearStart && issued <= prevYearCutoff) completedPrevYtd += 1
        if (completionsByMonth.has(monthKey(issued))) {
          completionsByMonth.set(
            monthKey(issued),
            (completionsByMonth.get(monthKey(issued)) ?? 0) + 1,
          )
        } else if (completionsByMonthPrev.has(monthKey(issued))) {
          completionsByMonthPrev.set(
            monthKey(issued),
            (completionsByMonthPrev.get(monthKey(issued)) ?? 0) + 1,
          )
        }
      }

      if (r.expiry && r.expiry > now) {
        const diffDays = (r.expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays <= 30) {
          expiryWindowCounts['Innen 30d'] += 1
          certsExpiring30d += 1
        } else if (diffDays <= 60) expiryWindowCounts['30–60d'] += 1
        else if (diffDays <= 90) expiryWindowCounts['60–90d'] += 1
        else expiryWindowCounts['90d+'] += 1
      }

      const catLabel = r.categoryId
        ? categoryNameById.get(r.categoryId) ?? '(ukjent)'
        : 'Annet'
      categoryCounts.set(catLabel, (categoryCounts.get(catLabel) ?? 0) + 1)

      const courseLabel = r.course.title
      courseCounts.set(courseLabel, (courseCounts.get(courseLabel) ?? 0) + 1)

      const dep = departmentForRow(r.progress, r.userId)
      const depLabel = dep
        ? departmentNameById.get(dep) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depLabel, (departmentCounts.get(depLabel) ?? 0) + 1)
    }

    totalCourses = seenCourseIds.size

    const topCourses = [...courseCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const topCoursesBar: Record<string, number> = {}
    for (const [name, count] of topCourses) topCoursesBar[name] = count

    // ── Users × courses heatmap (E-1 widget consumer) ────────────────────
    // Top 12 most-active users × top 12 most-engaged courses; cells encode
    // 0 = not started, 0.5 = in progress, 1 = completed. Capped on both
    // dimensions so the grid stays legible on standard widget widths.
    const learnerNameById = new Map<string, string>()
    const courseTitleById = new Map<string, string>()
    const userCellByPair = new Map<string, number>() // `${userId}:${courseId}` → cellValue
    const userActivityCount = new Map<string, number>()
    const courseActivityCount = new Map<string, number>()
    for (const r of filtered) {
      if (!r.userId) continue
      const uid = r.userId
      const cid = r.course.id
      const cellValue = r.status === 'completed' ? 1 : r.status === 'in_progress' ? 0.5 : 0
      userCellByPair.set(`${uid}:${cid}`, cellValue)
      userActivityCount.set(uid, (userActivityCount.get(uid) ?? 0) + 1)
      courseActivityCount.set(cid, (courseActivityCount.get(cid) ?? 0) + 1)
      if (r.progress?.learnerName && !learnerNameById.has(uid)) {
        learnerNameById.set(uid, r.progress.learnerName)
      }
      if (!courseTitleById.has(cid)) courseTitleById.set(cid, r.course.title)
    }
    const topUserIds = [...userActivityCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([uid]) => uid)
    const topCourseIds = [...courseActivityCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([cid]) => cid)
    const heatmapRows = topUserIds.map((uid) => learnerNameById.get(uid) ?? '—')
    const heatmapColumns = topCourseIds.map((cid) => courseTitleById.get(cid) ?? '—')
    const heatmapCells = topUserIds.map((uid) =>
      topCourseIds.map((cid) => userCellByPair.get(`${uid}:${cid}`) ?? 0),
    )

    return {
      learning_kpi_summary: {
        totalCourses,
        activeLearners,
        completedYtd,
        certsExpiring30d,
        totalCompleted,
      },
      learning_status_distribution: statusCounts,
      learning_category_distribution: Object.fromEntries(categoryCounts),
      learning_top_courses: topCoursesBar,
      learning_completions_over_time: months.map((m) => ({
        x: m.label,
        y: completionsByMonth.get(m.key) ?? 0,
      })),
      learning_completions_over_time_prev: prevMonths.map((m) => ({
        x: m.label,
        y: completionsByMonthPrev.get(m.key) ?? 0,
      })),
      learning_kpi_summary_prev: { completedYtd: completedPrevYtd },
      learning_certs_expiring_window: expiryWindowCounts,
      learning_completions_by_department: Object.fromEntries(departmentCounts),
      learning_completions_by_user_heatmap: {
        rows: heatmapRows,
        columns: heatmapColumns,
        cells: heatmapCells,
      },
    } as Record<string, unknown>
  }, [
    learning.courses,
    learning.progress,
    learning.certificates,
    cats.categories,
    orgSetup.members,
    orgSetup.departments,
    departmentByMemberId,
    dashboard.filters,
  ])

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
        }
        layout={layout}
        datasets={datasets}
        loading={learning.learningLoading || dashboard.loading}
        error={learning.learningError ?? dashboard.error}
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
        scopeId={LEARNING_DASHBOARD_SCOPE_ID}
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
