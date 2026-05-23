// LearningDashboard — Records-shell layout for the course catalogue.
// Two-column: 260 px category rail (mobile: horizontal chips) + content card
// with tab strip (Alle / Mine / Publisert / Utkast), search, and view
// switcher (Bokser / Tabell). Mirrors the ChecklistsPage hub-mode pattern.
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  LayoutGrid,
  RefreshCw,
  Rows3,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module'
import type { Course, CourseProgress } from '../../types/learning'

const PIN_GREEN = '#1a3d32'
const MINT_BG = '#e7efe9'

// Shared with /learning/katalog so the user's Bokser/Tabell choice persists.
const VIEW_MODE_KEY = 'atics-learning-courses-view-mode'
const ALL_KEY = '__all__'
const UNCATEGORISED_KEY = '__uncat__'

type FilterId = 'alle' | 'mine' | 'publisert' | 'utkast'
type ViewMode = 'grid' | 'list'

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    if (raw === 'liste' || raw === 'list') return 'list'
    return 'grid'
  } catch {
    return 'grid'
  }
}

function saveViewMode(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, v === 'list' ? 'liste' : 'kort')
  } catch {
    /* ignore */
  }
}

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

/** Pick a category icon by name heuristic. */
function categoryIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('hms') || n.includes('vern') || n.includes('sikkerhet')) return ShieldCheck
  if (n.includes('brann') || n.includes('brann') || n.includes('fire')) return Flame
  return GraduationCap
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          {course.origin === 'system' ? <Badge variant="neutral">System</Badge> : null}
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900">{course.title}</h3>
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
        {course.localeVersionMajor != null ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
            v{course.localeVersionMajor}.{course.localeVersionMinor ?? 0}
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {c.origin === 'system' ? <Badge variant="neutral">System</Badge> : null}
                </div>
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
  const { profile, supabase } = useOrgSetupContext()
  const { categories } = useLearningCategories({ supabase })
  const navigate = useNavigate()

  const [view, setView] = useState<ViewMode>(loadViewMode)
  const [filter, setFilter] = useState<FilterId>('alle')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(ALL_KEY)

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

  // Tab + search filter — independent of sidebar category selection.
  const tabFiltered = useMemo(() => {
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

  // Build the sidebar category items with counts (react to tab + search).
  const activeCats = useMemo(
    () => categories.filter((c) => c.is_active).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb')),
    [categories],
  )

  const categoryCounts = useMemo(() => {
    const byId = new Map<string, number>()
    let uncategorised = 0
    const activeIdSet = new Set(activeCats.map((c) => c.id))
    for (const c of tabFiltered) {
      if (c.categoryId && activeIdSet.has(c.categoryId)) {
        byId.set(c.categoryId, (byId.get(c.categoryId) ?? 0) + 1)
      } else {
        uncategorised += 1
      }
    }
    return { byId, uncategorised }
  }, [tabFiltered, activeCats])

  // Category rail items: Alle + active categories + optional Annet.
  type RailItem = { id: string; label: string; count: number; Icon: typeof GraduationCap }
  const railItems = useMemo<RailItem[]>(() => {
    const items: RailItem[] = [
      { id: ALL_KEY, label: 'Alle', count: tabFiltered.length, Icon: GraduationCap },
    ]
    for (const cat of activeCats) {
      items.push({
        id: cat.id,
        label: cat.name,
        count: categoryCounts.byId.get(cat.id) ?? 0,
        Icon: categoryIcon(cat.name),
      })
    }
    if (categoryCounts.uncategorised > 0) {
      items.push({ id: UNCATEGORISED_KEY, label: 'Annet', count: categoryCounts.uncategorised, Icon: GraduationCap })
    }
    return items
  }, [tabFiltered.length, activeCats, categoryCounts])

  // Final visible courses after category selection.
  const visibleCourses = useMemo(() => {
    if (activeCategory === ALL_KEY) return tabFiltered
    if (activeCategory === UNCATEGORISED_KEY) {
      const activeIdSet = new Set(activeCats.map((c) => c.id))
      return tabFiltered.filter((c) => !c.categoryId || !activeIdSet.has(c.categoryId))
    }
    return tabFiltered.filter((c) => c.categoryId === activeCategory)
  }, [tabFiltered, activeCategory, activeCats])

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

  const filterTabs: { id: FilterId; label: string }[] = [
    { id: 'alle', label: 'Alle' },
    { id: 'mine', label: 'Mine kurs' },
    { id: 'publisert', label: 'Publisert' },
    { id: 'utkast', label: 'Utkast' },
  ]

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpis} />

      {/* Records-shell: two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">

        {/* ── LEFT: Category rail ── */}
        <aside className="space-y-3">
          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            {/* Desktop header */}
            <div className="hidden border-b border-neutral-100 px-4 py-3 lg:block">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Kategorier</h2>
            </div>

            {/* Mobile: horizontal chip scroll */}
            <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 lg:hidden">
              {railItems.map(({ id, label, Icon, count }) => {
                const isActive = id === activeCategory
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveCategory(id)}
                    className={[
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isActive ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
                    ].join(' ')}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    <span>{label}</span>
                    <span className={[
                      'rounded-full px-1 py-0 text-[10px] tabular-nums',
                      isActive ? 'bg-white/20 text-white' : 'text-neutral-500',
                    ].join(' ')}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Desktop: vertical list */}
            <ul className="hidden py-1.5 lg:block">
              {railItems.map(({ id, label, Icon, count }) => {
                const isActive = id === activeCategory
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(id)}
                      className={[
                        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
                        isActive ? 'bg-[#e7efe9] text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50',
                      ].join(' ')}
                      style={isActive ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                    >
                      <Icon
                        className={['h-3.5 w-3.5 shrink-0', isActive ? 'text-[#1a3d32]' : 'text-neutral-500'].join(' ')}
                        aria-hidden
                      />
                      <span className={['min-w-0 flex-1 truncate', isActive ? 'font-semibold' : 'font-medium'].join(' ')}>
                        {label}
                      </span>
                      <span className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        isActive ? 'bg-white text-[#14312a]' : 'bg-neutral-100 text-neutral-500',
                      ].join(' ')}>
                        {count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>

        {/* ── RIGHT: Content card ── */}
        <section className="space-y-3">
          <div
            className="rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            {/* Header strip: tabs + search + view switcher */}
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {/* Tab strip */}
              <nav className="flex items-center gap-1" aria-label="Kursfilter">
                {filterTabs.map(({ id, label }) => {
                  const active = filter === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilter(id)}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-[#1a3d32] text-white'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  )
                })}
              </nav>

              {/* Search + view switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    placeholder="Søk i tittel, tagger…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Søk i kurs"
                    className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white sm:w-52"
                  />
                </div>

                {/* View switcher: Bokser | Tabell */}
                <div
                  className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
                  role="radiogroup"
                  aria-label="Visningstype"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={view === 'grid'}
                    onClick={() => { setView('grid'); saveViewMode('grid') }}
                    title="Bokser"
                    className={[
                      'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                      view === 'grid' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800',
                    ].join(' ')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Bokser</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={view === 'list'}
                    onClick={() => { setView('list'); saveViewMode('list') }}
                    title="Tabell"
                    className={[
                      'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                      view === 'list' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800',
                    ].join(' ')}
                  >
                    <Rows3 className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Tabell</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content area */}
            {view === 'grid' ? (
              /* Bokser view */
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:p-6 xl:grid-cols-3">
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
              /* Tabell view */
              <>
                {/* Mobile compact list (sm:hidden) */}
                <ul className="divide-y divide-neutral-100 sm:hidden">
                  {visibleCourses.map((c) => {
                    const totalMin = courseDurationMinutes(c)
                    const status = statusBadgeFor(c.status)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/learning/courses/${c.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: MINT_BG, color: PIN_GREEN }}
                          >
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">{c.title}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                              <span>{c.modules.length} {c.modules.length === 1 ? 'modul' : 'moduler'}</span>
                              {totalMin > 0 ? <span>· ~{totalMin} min</span> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden />
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* Desktop table (hidden sm:block) */}
                <div className="hidden overflow-x-auto sm:block">
                  <CatalogTable courses={visibleCourses} orgStatsById={orgStatsById} />
                </div>
              </>
            )}

            {/* Footer */}
            <div className="border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
              Viser {visibleCourses.length} av {courses.length} kurs
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
