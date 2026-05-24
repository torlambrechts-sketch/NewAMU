// LearningHubPage — Main e-læring hub. Framework rail on the left,
// Kurs/Maler/Statistikk tabs with bokser/tabell view modes, search and a
// compliance summary aside. Replaces the legacy LearningDashboard at /learning.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  FileStack,
  LayoutGrid,
  Pencil,
  Play,
  Plus,
  Rows3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import {
  ELEARNING_FRAMEWORKS,
  ELEARNING_MANDATORY_LABEL,
  aggregateCohort,
  aggregateLearningKpis,
  courseDurationHours,
  courseIconName,
  formatDateNb,
  frameworkForCourse,
  isMandatoryCourse,
  sortCohortsForHub,
  type CohortAggregate,
} from '../../lib/learning/elearningDesignKit'
import {
  Card,
  CARD_SHADOW,
  CohortStatusPill,
  CourseCardOverlay,
  DesignIcon,
  ELEARNING_TABLE_TH,
  ELEARNING_TABLE_TR,
  FrameworkPill,
  ModeToggle,
  PAPER_BG,
  ProgressBar,
  RailItem,
  type LearningMode,
} from '../../components/ui/elearningPrimitives'
import type { Course } from '../../types/learning'

type TabId = 'courses' | 'templates' | 'statistikk'
type ViewMode = 'tabell' | 'bokser'

const VIEW_MODE_KEY = 'atics-elearning-hub-view-mode'

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    return raw === 'tabell' ? 'tabell' : 'bokser'
  } catch {
    return 'bokser'
  }
}

function saveViewMode(value: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, value)
  } catch {
    /* ignore */
  }
}

const SHARED_SERIF = "'Libre Baskerville', Georgia, serif"

export function LearningHubPage() {
  const navigate = useNavigate()
  const learning = useLearning()
  const { courses, progress } = learning
  const [mode, setMode] = useState<LearningMode>('advanced')
  const [framework, setFramework] = useState<string>('all')
  const [tab, setTab] = useState<TabId>('courses')
  const [view, setView] = useState<ViewMode>(() => loadViewMode())
  const [query, setQuery] = useState('')

  useEffect(() => {
    saveViewMode(view)
  }, [view])

  const easy = mode === 'easy'

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const filteredCourses = useMemo(() => {
    let list = courses
    if (framework !== 'all') list = list.filter((c) => frameworkForCourse(c) === framework)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((c) => `${c.title} ${c.description} ${c.tags.join(' ')}`.toLowerCase().includes(q))
    }
    // Cohorts (Kurs) view — exclude pure drafts so they live in Maler.
    return list.filter((c) => c.status !== 'draft' || progress.some((p) => p.courseId === c.id))
  }, [courses, framework, query, progress])

  const filteredTemplates = useMemo(() => {
    let list = courses
    if (framework !== 'all') list = list.filter((c) => frameworkForCourse(c) === framework)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((c) => `${c.title} ${c.description} ${c.tags.join(' ')}`.toLowerCase().includes(q))
    }
    return list
  }, [courses, framework, query])

  const filteredCohorts = useMemo(
    () =>
      filteredCourses
        .map((c) => aggregateCohort(c, progress))
        .sort(sortCohortsForHub),
    [filteredCourses, progress],
  )

  const counts = useMemo(() => {
    const acc: Record<string, { courses: number; maler: number }> = {
      all: { courses: courses.length, maler: courses.length },
    }
    for (const f of ELEARNING_FRAMEWORKS) {
      const matched = courses.filter((c) => frameworkForCourse(c) === f.id)
      acc[f.id] = { courses: matched.length, maler: matched.length }
    }
    return acc
  }, [courses])

  const kpi = useMemo(() => aggregateLearningKpis(courses, progress), [courses, progress])

  const missingMandatory = useMemo(() => {
    const missing = new Set<string>()
    for (const c of courses) {
      if (!isMandatoryCourse(c)) continue
      // Count distinct learner ids that have not started this mandatory course
      const own = progress.filter((p) => p.courseId === c.id)
      const completed = own.filter((p) => !!p.completedAt).length
      missing.add(`${c.id}:${Math.max(0, own.length - completed)}`)
    }
    return missing.size
  }, [courses, progress])

  return (
    <div className="min-h-screen" style={{ background: '#F9F7F2' }}>
      <header style={{ background: '#F9F7F2' }}>
        <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
          <div className="space-y-4">
            <nav aria-label="Brødsmule" className="text-xs text-neutral-500">
              <span>
                <a href="/" className="hover:text-neutral-700">Klarert</a>
                <span className="mx-1.5 text-neutral-300">›</span>
                <span className="text-neutral-600">Compliance</span>
                <span className="mx-1.5 text-neutral-300">›</span>
                <span className="text-neutral-600">Opplæring</span>
              </span>
            </nav>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1
                  className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                  style={{ fontFamily: SHARED_SERIF }}
                >
                  Opplæring
                </h1>
                <div className="mt-2 max-w-3xl text-sm text-neutral-600">
                  {easy
                    ? 'Kurs, sertifiseringer og lovpålagt opplæring.'
                    : `${kpi.activeCourses} aktive kurs · ${kpi.enrolledTotal} påmeldinger · ${Math.round(kpi.mandatoryCompliance * 100)}% lovpålagt etterlevelse.`}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                <ModeToggle mode={mode} onChange={setMode} />
                <Button
                  variant="secondary"
                  icon={<Award className="h-4 w-4" />}
                  onClick={() => navigate('/learning/kompetanse')}
                >
                  Sertifikater
                </Button>
                <Button
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate('/learning/courses/new')}
                >
                  Ny mal
                </Button>
                <Button
                  variant="primary"
                  icon={<BookOpenCheck className="h-4 w-4" />}
                  onClick={() => {
                    const first = courses.find((c) => c.status === 'published')
                    if (first) navigate(`/learning/play/${first.id}`)
                  }}
                >
                  Start kurs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <Card>
              <div className="border-b border-neutral-100 px-4 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Rammeverk</h2>
              </div>
              <ul className="py-1.5">
                <RailItem
                  active={framework === 'all'}
                  iconName="LayoutGrid"
                  label="Alle"
                  count={counts.all[tab === 'templates' ? 'maler' : 'courses']}
                  onClick={() => setFramework('all')}
                />
                {ELEARNING_FRAMEWORKS.map((f) => {
                  const count = counts[f.id]?.[tab === 'templates' ? 'maler' : 'courses'] ?? 0
                  if (!count) return null
                  return (
                    <RailItem
                      key={f.id}
                      active={framework === f.id}
                      iconName={f.icon}
                      iconColor={f.color}
                      label={f.short}
                      count={count}
                      onClick={() => setFramework(f.id)}
                    />
                  )
                })}
              </ul>
            </Card>

            {!easy ? (
              <Card className="p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Compliance</h3>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Lovpålagt</span>
                    <span className="text-base font-bold tabular-nums text-[#1a3d32]">
                      {Math.round(kpi.mandatoryCompliance * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={kpi.mandatoryCompliance} />
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs">
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-700">Aktive kurs</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{kpi.activeCourses}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-700">Påmeldinger</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{kpi.enrolledTotal}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-700">Bestått-rate</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{Math.round(kpi.passRate * 100)}%</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-neutral-700">Snittscore</span>
                    <span className="font-semibold tabular-nums text-neutral-900">{kpi.avgScore}</span>
                  </li>
                </ul>
              </Card>
            ) : null}

            {!easy && missingMandatory > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <div>
                    <div className="font-semibold">{missingMandatory} {ELEARNING_MANDATORY_LABEL.toLowerCase()} kurs mangler påmeldinger</div>
                    <div className="mt-0.5">Frist innen 6 mnd etter valg som verneombud.</div>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>

          <section>
            <Card>
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-2.5">
                <Tabs
                  items={[
                    { id: 'courses', label: 'Kurs', icon: BookOpen, badgeCount: filteredCohorts.length } as TabItem,
                    { id: 'templates', label: 'Maler', icon: FileStack, badgeCount: filteredTemplates.length } as TabItem,
                    { id: 'statistikk', label: 'Statistikk', icon: BarChart3 } as TabItem,
                  ]}
                  activeId={tab}
                  onChange={(id) => setTab(id as TabId)}
                />
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                    <StandardInput
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Søk i kurs, maler…"
                      className="w-52 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs"
                    />
                  </div>
                  {tab !== 'statistikk' ? (
                    <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                      {(
                        [
                          { id: 'tabell' as const, label: 'Tabell', Icon: Rows3 },
                          { id: 'bokser' as const, label: 'Bokser', Icon: LayoutGrid },
                        ]
                      ).map((m) => {
                        const active = m.id === view
                        const Icon = m.Icon
                        return (
                          <Button
                            key={m.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setView(m.id)}
                            title={m.label}
                            className={[
                              '!gap-1.5 rounded px-2 py-1 text-xs font-medium',
                              active
                                ? '!bg-white text-neutral-900 !shadow-sm ring-1 ring-neutral-200'
                                : '!bg-transparent text-neutral-500 hover:text-neutral-800',
                            ].join(' ')}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">{m.label}</span>
                          </Button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                {tab === 'courses' ? (
                  filteredCohorts.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-neutral-500">Ingen kurs i denne kategorien ennå.</div>
                  ) : view === 'bokser' ? (
                    <CourseBoxes
                      cohorts={filteredCohorts}
                      courseById={courseById}
                      easy={easy}
                      onOpen={(courseId) => navigate(`/learning/courses/${courseId}/detail`)}
                    />
                  ) : (
                    <CourseTable
                      cohorts={filteredCohorts}
                      courseById={courseById}
                      easy={easy}
                      onOpen={(courseId) => navigate(`/learning/courses/${courseId}/detail`)}
                    />
                  )
                ) : null}
                {tab === 'templates' ? (
                  view === 'bokser' ? (
                    <TemplateBoxes
                      templates={filteredTemplates}
                      easy={easy}
                      onOpen={(c) => navigate(`/learning/courses/${c.id}`)}
                      onStart={(c) => navigate(`/learning/play/${c.id}`)}
                    />
                  ) : (
                    <TemplateTable
                      templates={filteredTemplates}
                      easy={easy}
                      onOpen={(c) => navigate(`/learning/courses/${c.id}`)}
                    />
                  )
                ) : null}
                {tab === 'statistikk' ? <StatistikkPanel kpi={kpi} easy={easy} /> : null}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}

function CourseBoxes({
  cohorts,
  courseById,
  easy,
  onOpen,
}: {
  cohorts: CohortAggregate[]
  courseById: Map<string, Course>
  easy: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
      {cohorts.map((c) => {
        const course = courseById.get(c.courseId)
        if (!course) return null
        const fwId = frameworkForCourse(course)
        const fw = ELEARNING_FRAMEWORKS.find((f) => f.id === fwId) ?? null
        const hours = courseDurationHours(course)
        const mandatory = isMandatoryCourse(course)
        const hasCertificate = !!course.recertificationMonths
        return (
          <article
            key={c.courseId}
            onClick={() => onOpen(c.courseId)}
            className="cursor-pointer overflow-hidden rounded-xl border border-neutral-200/80 bg-white transition-all hover:border-[#1a3d32]/40 hover:shadow-md"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="relative h-12 bg-gradient-to-br from-[#1a3d32] via-[#2f5b48] to-[#5A9C76]">
              <div className="absolute inset-0 flex items-center justify-center opacity-25">
                <DesignIcon name={courseIconName(course)} className="h-7 w-7 text-white" />
              </div>
              <CourseCardOverlay framework={fw} mandatory={mandatory} hasCertificate={hasCertificate} hours={hours} />
            </div>

            <div className="p-3">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
                  <DesignIcon name={courseIconName(course)} className="h-3 w-3" />
                </span>
                <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-neutral-900">{course.title}</h3>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <CohortStatusPill status={c.status} />
                {!easy && c.startedAt ? <span className="text-[9px] tabular-nums text-neutral-500">{formatDateNb(c.startedAt)}</span> : null}
              </div>
              <div className="mt-2.5 rounded-md px-2.5 py-1.5" style={{ background: PAPER_BG }}>
                <div className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <span>Fremdrift</span>
                  <span className="text-sm font-bold tabular-nums text-[#1a3d32]">{Math.round(c.avgProgress * 100)}%</span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={c.avgProgress} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] tabular-nums text-neutral-600">
                  <span>
                    <span className="font-semibold text-green-700">{c.completed}</span> fullført
                  </span>
                  <span>
                    <span className="font-semibold text-blue-700">{c.inProgress}</span> pågår
                  </span>
                  <span>
                    <span className="font-semibold text-neutral-700">{c.notStarted}</span> ikke startet
                  </span>
                </div>
              </div>

              {!easy && c.avgScore !== null ? (
                <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 text-amber-500" />
                    {(c.avgRating ?? 4).toFixed(1)}
                  </span>
                  <span className="tabular-nums">
                    Score <span className="font-semibold text-neutral-900">{c.avgScore}</span>
                  </span>
                  <span className="tabular-nums">{c.enrolled} påmeldte</span>
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function CourseTable({
  cohorts,
  courseById,
  easy,
  onOpen,
}: {
  cohorts: CohortAggregate[]
  courseById: Map<string, Course>
  easy: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={ELEARNING_TABLE_TH}>Kurs</th>
            <th className={ELEARNING_TABLE_TH}>Status</th>
            <th className={ELEARNING_TABLE_TH}>Påmeldte</th>
            <th className={ELEARNING_TABLE_TH}>Fremdrift</th>
            {!easy ? <th className={ELEARNING_TABLE_TH}>Bestått</th> : null}
            {!easy ? <th className={ELEARNING_TABLE_TH}>Snittscore</th> : null}
            <th className={ELEARNING_TABLE_TH}>Periode</th>
            <th className={`${ELEARNING_TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => {
            const course = courseById.get(c.courseId)
            if (!course) return null
            const mandatory = isMandatoryCourse(course)
            return (
              <tr
                key={c.courseId}
                className={`${ELEARNING_TABLE_TR} cursor-pointer`}
                onClick={() => onOpen(c.courseId)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
                      <DesignIcon name={courseIconName(course)} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-neutral-900">{course.title}</span>
                        {mandatory ? (
                          <span
                            title="Lovpålagt"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e7efe9] text-[#1a3d32]"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-500">{course.description.slice(0, 60)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <CohortStatusPill status={c.status} />
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">{c.enrolled}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20">
                      <ProgressBar value={c.avgProgress} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-neutral-900">
                      {Math.round(c.avgProgress * 100)}%
                    </span>
                  </div>
                </td>
                {!easy ? (
                  <td className="px-5 py-3 tabular-nums">
                    <span className="font-semibold text-green-700">{c.passed}</span>/
                    <span className="text-neutral-500">{c.enrolled}</span>
                  </td>
                ) : null}
                {!easy ? (
                  <td className="px-5 py-3 tabular-nums text-neutral-900">
                    {c.avgScore !== null ? c.avgScore : <span className="text-neutral-400">—</span>}
                  </td>
                ) : null}
                <td className="px-5 py-3 tabular-nums text-neutral-700">
                  {formatDateNb(c.startedAt)} – {formatDateNb(c.endsAt)}
                </td>
                <td className="px-5 py-3 text-right text-neutral-300">›</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TemplateBoxes({
  templates,
  easy,
  onOpen,
  onStart,
}: {
  templates: Course[]
  easy: boolean
  onOpen: (c: Course) => void
  onStart: (c: Course) => void
}) {
  if (templates.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-neutral-500">Ingen maler i denne kategorien ennå.</div>
  }
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const fwId = frameworkForCourse(t)
        const fw = ELEARNING_FRAMEWORKS.find((f) => f.id === fwId) ?? null
        const mandatory = isMandatoryCourse(t)
        const hours = courseDurationHours(t)
        return (
          <article
            key={t.id}
            className="flex flex-col rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="flex items-start gap-2.5 p-3 pb-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
                <DesignIcon name={courseIconName(t)} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  {fw ? <FrameworkPill id={fw.id} /> : null}
                  {mandatory ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
                      <ShieldCheck className="h-2 w-2" /> Lovpålagt
                    </span>
                  ) : null}
                  {t.recertificationMonths ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-900">
                      <Award className="h-2 w-2" /> Sertifikat
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-neutral-900">{t.title}</h3>
              </div>
            </div>
            <div className="border-t border-neutral-100 px-4 py-2 text-[11px]" style={{ background: PAPER_BG }}>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{hours}t</div>
                  <div className="text-[10px] text-neutral-500">varighet</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{t.modules.length}</div>
                  <div className="text-[10px] text-neutral-500">moduler</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{t.courseVersion ?? 1}</div>
                  <div className="text-[10px] text-neutral-500">kjørt</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">
                    v{t.localeVersionMajor ?? t.courseVersion ?? 1}.{t.localeVersionMinor ?? t.courseVersionMinor ?? 0}
                  </div>
                  <div className="text-[10px] text-neutral-500">versjon</div>
                </div>
              </div>
            </div>
            {!easy ? (
              <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-600">
                <div className="line-clamp-2">{t.description || 'Ingen beskrivelse.'}</div>
                {t.recertificationMonths ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-neutral-500">
                    <Award className="h-3 w-3" /> Sertifikat gyldig i {Math.round(t.recertificationMonths / 12)} år
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-auto flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpen(t)}
                className="!gap-0 !border-transparent !bg-transparent px-0 py-0 text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
              >
                Rediger ›
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Play className="h-3 w-3" />}
                onClick={() => onStart(t)}
              >
                Start kohort
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function TemplateTable({
  templates,
  easy,
  onOpen,
}: {
  templates: Course[]
  easy: boolean
  onOpen: (c: Course) => void
}) {
  if (templates.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-neutral-500">Ingen maler i denne kategorien ennå.</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={ELEARNING_TABLE_TH}>Mal</th>
            <th className={ELEARNING_TABLE_TH}>Rammeverk</th>
            <th className={ELEARNING_TABLE_TH}>Varighet</th>
            <th className={ELEARNING_TABLE_TH}>Moduler</th>
            {!easy ? <th className={ELEARNING_TABLE_TH}>Sertifikat</th> : null}
            <th className={ELEARNING_TABLE_TH}>Versjon</th>
            <th className={`${ELEARNING_TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => {
            const mandatory = isMandatoryCourse(t)
            return (
              <tr
                key={t.id}
                className={`${ELEARNING_TABLE_TR} cursor-pointer`}
                onClick={() => onOpen(t)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <DesignIcon name={courseIconName(t)} className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-900">{t.title}</span>
                        {mandatory ? <ShieldCheck className="h-3 w-3 text-[#1a3d32]" /> : null}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {t.origin === 'system' ? 'Systemkurs' : t.origin === 'fork' ? 'Forking av systemkurs' : 'Internt kurs'} · {t.modules.length} moduler
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <FrameworkPill id={frameworkForCourse(t)} />
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">{courseDurationHours(t)}t</td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">{t.modules.length}</td>
                {!easy ? (
                  <td className="px-5 py-3 text-neutral-700">
                    {t.recertificationMonths ? `${Math.round(t.recertificationMonths / 12)} år` : <span className="text-neutral-400">Permanent</span>}
                  </td>
                ) : null}
                <td className="px-5 py-3 tabular-nums text-neutral-700">v{t.localeVersionMajor ?? t.courseVersion ?? 1}.{t.localeVersionMinor ?? t.courseVersionMinor ?? 0}</td>
                <td className="px-5 py-3 text-right">
                  <Button variant="primary" size="sm" icon={<Pencil className="h-3 w-3" />}>
                    Bygger
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatistikkPanel({
  kpi,
  easy,
}: {
  kpi: ReturnType<typeof aggregateLearningKpis>
  easy: boolean
}) {
  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatistikkCard label="Lovpålagt etterlevelse" value={`${Math.round(kpi.mandatoryCompliance * 100)}%`} progress={kpi.mandatoryCompliance} />
        <StatistikkCard label="Bestått-rate" value={`${Math.round(kpi.passRate * 100)}%`} sub={`${kpi.completedTotal} av ${kpi.enrolledTotal}`} />
        <StatistikkCard label="Snittscore" value={`${kpi.avgScore}`} sub="av 100" />
        <StatistikkCard label="Snittrating" value={`${kpi.avgRating.toFixed(1)}`} sub={kpi.avgTimeHours ? `${kpi.avgTimeHours}t snittforbruk` : 'ingen rangering'} starIcon />
      </div>

      {!easy && kpi.perFramework.length > 0 ? (
        <div className="mt-5 rounded-md border border-neutral-200/80 p-4">
          <h4 className="text-sm font-semibold text-neutral-900">Per rammeverk</h4>
          <ul className="mt-3 space-y-2.5">
            {kpi.perFramework.map((b) => (
              <li key={b.id}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="font-medium text-neutral-900">{b.label}</span>
                  <span className="tabular-nums text-neutral-700">
                    <span className="font-semibold">{b.completed}</span> av {b.enrolled} · {Math.round(b.rate * 100)}%
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={b.rate} tone={b.rate >= 0.8 ? 'forest' : 'warn'} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function StatistikkCard({
  label,
  value,
  sub,
  progress,
  starIcon,
}: {
  label: string
  value: string
  sub?: string
  progress?: number
  starIcon?: boolean
}) {
  return (
    <div className="rounded-md p-3" style={{ background: PAPER_BG }}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div
        className="mt-1 flex items-baseline gap-1 text-2xl font-bold tabular-nums text-[#1a3d32]"
        style={{ fontFamily: SHARED_SERIF }}
      >
        {value}
        {starIcon ? <Star className="h-3 w-3 text-amber-500" /> : null}
      </div>
      {progress !== undefined ? (
        <div className="mt-1.5">
          <ProgressBar value={progress} />
        </div>
      ) : null}
      {sub ? <div className="text-[10px] text-neutral-500">{sub}</div> : null}
    </div>
  )
}
