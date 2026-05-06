import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Clock,
  GraduationCap,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { StandardInput } from '../../components/ui/Input'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY, ModuleSectionCard } from '../../components/module'
import type { Course, CourseProgress } from '../../types/learning'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"
const PIN_GREEN = '#1a3d32'
const MINT_BG = '#e7efe9'

type FilterId = 'alle' | 'mine' | 'publisert' | 'utkast'
type ViewMode = 'grid' | 'list'

type CourseStat = {
  assigned: number
  completed: number
  inProgress: number
  overdue: number
}

function statusBadgeFor(status: Course['status']) {
  if (status === 'published') return { variant: 'active' as const, label: 'Publisert' }
  if (status === 'draft') return { variant: 'draft' as const, label: 'Utkast' }
  return { variant: 'neutral' as const, label: 'Arkivert' }
}

function courseDurationMinutes(c: Course): number {
  return c.modules.reduce((s, m) => s + (m.durationMinutes || 0), 0)
}

function isCourseProgressComplete(course: Course, p: CourseProgress | undefined): boolean {
  if (!p || course.modules.length === 0) return false
  if (p.completedAt) return true
  return course.modules.every((m) => p.moduleProgress[m.id]?.completed)
}

function CourseCard({
  course,
  myProgress,
  orgStats,
}: {
  course: Course
  myProgress: CourseProgress | undefined
  orgStats: CourseStat | undefined
}) {
  const status = statusBadgeFor(course.status)
  const totalModules = course.modules.length
  const totalMin = courseDurationMinutes(course)
  const completed = myProgress
    ? Object.values(myProgress.moduleProgress).filter((mp) => mp.completed).length
    : 0
  const pct = myProgress && totalModules > 0 ? Math.round((completed / totalModules) * 100) : 0

  return (
    <Link
      to={`/learning/courses/${course.id}`}
      className="group flex flex-col items-stretch gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: MINT_BG, color: PIN_GREEN }}
        >
          <GraduationCap className="h-5 w-5" />
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="min-w-0">
        <h3
          className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900"
          style={{ fontFamily: SERIF_FAMILY }}
        >
          {course.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
      </div>

      {course.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {course.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
          {totalModules} {totalModules === 1 ? 'modul' : 'moduler'}
        </span>
        {totalMin > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-neutral-500" />
            ~{totalMin} min
          </span>
        ) : null}
        {course.recertificationMonths ? (
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />
            hver {course.recertificationMonths} mnd
          </span>
        ) : null}
      </div>

      {myProgress ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-600">
            <span>Din framgang</span>
            <span className="font-semibold tabular-nums text-neutral-900">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: PIN_GREEN }}
            />
          </div>
        </div>
      ) : orgStats && orgStats.assigned > 0 ? (
        <div className="text-[11px] text-neutral-500">
          {orgStats.completed}/{orgStats.assigned} fullført
          {orgStats.overdue > 0 ? (
            <span className="ml-1 font-semibold text-red-600">· {orgStats.overdue} forfalt</span>
          ) : null}
        </div>
      ) : (
        <div className="text-[11px] text-neutral-400">Ikke tildelt enda</div>
      )}
    </Link>
  )
}

function CatalogTable({
  courses,
  orgStatsById,
}: {
  courses: Course[]
  orgStatsById: Record<string, CourseStat>
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Kurs</th>
          <th className={MODULE_TABLE_TH}>Status</th>
          <th className={MODULE_TABLE_TH}>Moduler</th>
          <th className={MODULE_TABLE_TH}>Tildelt</th>
          <th className={MODULE_TABLE_TH}>Fullført</th>
          <th className={MODULE_TABLE_TH}>Forfalt</th>
          <th className={MODULE_TABLE_TH}>Resertifisering</th>
          <th className={MODULE_TABLE_TH} />
        </tr>
      </thead>
      <tbody>
        {courses.map((c) => {
          const stats = orgStatsById[c.id] ?? { assigned: 0, completed: 0, inProgress: 0, overdue: 0 }
          const status = statusBadgeFor(c.status)
          return (
            <tr key={c.id} className={MODULE_TABLE_TR_BODY}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ background: MINT_BG, color: PIN_GREEN }}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{c.title}</div>
                    {c.tags.length > 0 ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                        {c.tags.join(' · ')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <Badge variant={status.variant}>{status.label}</Badge>
              </td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">{c.modules.length}</td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">{stats.assigned}</td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">{stats.completed}</td>
              <td className="px-5 py-3 tabular-nums">
                {stats.overdue > 0 ? (
                  <span className="font-semibold text-red-600">{stats.overdue}</span>
                ) : (
                  <span className="text-neutral-400">0</span>
                )}
              </td>
              <td className="px-5 py-3 text-neutral-700">
                {c.recertificationMonths ? `Hver ${c.recertificationMonths}. mnd` : '—'}
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  to={`/learning/courses/${c.id}`}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Åpne
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function LearningDashboard() {
  const { courses, progress } = useLearning()
  const { profile } = useOrgSetupContext()

  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterId>('alle')
  const [search, setSearch] = useState('')

  const myProgressById = useMemo<Record<string, CourseProgress>>(() => {
    const out: Record<string, CourseProgress> = {}
    for (const p of progress) {
      if (!p.userId || p.userId === profile?.id) {
        out[p.courseId] = p
      }
    }
    return out
  }, [progress, profile?.id])

  const orgStatsById = useMemo<Record<string, CourseStat>>(() => {
    const out: Record<string, CourseStat> = {}
    for (const c of courses) {
      const rows = progress.filter((p) => p.courseId === c.id)
      const completed = rows.filter((p) => isCourseProgressComplete(c, p)).length
      const inProgress = rows.length - completed
      out[c.id] = {
        assigned: rows.length,
        completed,
        inProgress,
        overdue: 0,
      }
    }
    return out
  }, [courses, progress])

  const visibleCourses = useMemo(() => {
    return courses.filter((c) => {
      if (filter === 'mine' && !myProgressById[c.id]) return false
      if (filter === 'utkast' && c.status !== 'draft') return false
      if (filter === 'publisert' && c.status !== 'published') return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const haystack = `${c.title} ${c.description} ${c.tags.join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [courses, filter, search, myProgressById])

  const kpis = useMemo<LayoutScoreStatItem[]>(() => {
    const totalAssigned = Object.values(orgStatsById).reduce((s, x) => s + x.assigned, 0)
    const totalCompleted = Object.values(orgStatsById).reduce((s, x) => s + x.completed, 0)
    const totalOverdue = Object.values(orgStatsById).reduce((s, x) => s + x.overdue, 0)
    const completion = totalAssigned ? Math.round((totalCompleted / totalAssigned) * 100) : 0
    const activeCount = courses.filter((c) => c.status === 'published').length
    return [
      { big: String(activeCount), title: 'Aktive kurs', sub: 'Publisert i katalog' },
      { big: String(totalAssigned), title: 'Tildelinger', sub: 'Aktive på tvers av kurs' },
      {
        big: `${completion}%`,
        title: 'Gjennomføring',
        sub: `${totalCompleted} av ${totalAssigned} fullført`,
      },
      { big: String(totalOverdue), title: 'Forfalt', sub: 'Krever oppfølging' },
    ]
  }, [courses, orgStatsById])

  const filterChips: { id: FilterId; label: string }[] = [
    { id: 'alle', label: 'Alle' },
    { id: 'mine', label: 'Mine kurs' },
    { id: 'publisert', label: 'Publisert' },
    { id: 'utkast', label: 'Utkast' },
  ]

  const headerActions = (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => setView('grid')}
        aria-pressed={view === 'grid'}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === 'grid' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Kort
      </button>
      <button
        type="button"
        onClick={() => setView('list')}
        aria-pressed={view === 'list'}
        className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          view === 'list' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
        }`}
      >
        <ListIcon className="h-3.5 w-3.5" />
        Liste
      </button>
    </div>
  )

  const toolbar = (
    <>
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <StandardInput
          placeholder="Søk i tittel, tagger eller beskrivelse"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Søk i kurs"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {filterChips.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[#1a3d32] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Kurskatalog"
          description="Velg et kurs for å se moduler, deltakere og lovgrunnlag."
          headerActions={headerActions}
          toolbar={toolbar}
          footer={
            <span>
              Viser {visibleCourses.length} av {courses.length} kurs
            </span>
          }
        >
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCourses.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  myProgress={myProgressById[c.id]}
                  orgStats={orgStatsById[c.id]}
                />
              ))}
              {visibleCourses.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-neutral-500">
                  Ingen kurs samsvarer med filtrene.
                </div>
              ) : null}
            </div>
          ) : visibleCourses.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-neutral-500">
              Ingen kurs samsvarer med filtrene.
            </div>
          ) : (
            <CatalogTable courses={visibleCourses} orgStatsById={orgStatsById} />
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}
