import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  LayoutGrid,
  List,
  Pencil,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Course, CourseStatus } from '../../types/learning'
import { LearningPrivacyNotice } from '../../components/learning/LearningPrivacyNotice'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { ModuleSectionCard } from '../../components/module'
import { BEIGE_NAV, WikiFolderNavRow } from '../../components/module/ModuleWikiFolderNavRow'

const PIN_GREEN = '#1a3d32'
const MINT_BG = '#e7efe9'

const FAV_KEY = 'atics-learning-favourite-course-ids'
const VIEW_MODE_KEY = 'atics-learning-courses-view-mode'
const UNCATEGORISED_KEY = '__uncat__'
const ALL_KEY = '__all__'

type ViewMode = 'kort' | 'liste'

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    return raw === 'liste' ? 'liste' : 'kort'
  } catch {
    return 'kort'
  }
}

function saveViewMode(v: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, v)
  } catch {
    /* ignore */
  }
}

function loadFavouriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function saveFavouriteIds(ids: Set<string>) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

function courseTotalMinutes(c: Course): number {
  return c.modules.reduce((acc, m) => acc + (m.durationMinutes || 0), 0)
}

function statusBadgeFor(status: CourseStatus) {
  if (status === 'published') return { variant: 'active' as const, label: 'Publisert' }
  if (status === 'draft') return { variant: 'draft' as const, label: 'Utkast' }
  return { variant: 'neutral' as const, label: 'Arkivert' }
}

function ProgressBarMini({ value }: { value: number }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIN_GREEN }} />
    </div>
  )
}

const COURSE_STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Utkast' },
  { value: 'published', label: 'Publisert' },
  { value: 'archived', label: 'Arkivert' },
]

type TabId = 'all' | 'active' | 'complete' | 'fav'

export function LearningCoursesList() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase, can, isAdmin, profile } = orgSetup
  const canManage = isAdmin || can('learning.manage')
  const canDelete = isAdmin || can('learning.delete') || canManage
  const {
    courses,
    updateCourse,
    deleteCourse,
    learningLoading,
    learningError,
    isCourseUnlocked,
    progress,
    certificates,
  } = useLearning()
  const { categories } = useLearningCategories({ supabase })

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<TabId>('all')
  const [favourites, setFavourites] = useState<Set<string>>(loadFavouriteIds)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_KEY)
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode)

  const visibleCourses = useMemo(() => {
    let list = courses
    if (!canManage) list = list.filter((c) => c.status === 'published')
    const qq = q.trim().toLowerCase()
    if (qq) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(qq) ||
          c.description.toLowerCase().includes(qq) ||
          c.tags.some((t) => t.toLowerCase().includes(qq)),
      )
    }
    return list
  }, [courses, canManage, q])

  const tabCounts = useMemo(() => {
    const all = visibleCourses.length
    let active = 0
    let complete = 0
    let fav = 0
    for (const c of visibleCourses) {
      const cert = certificates.some((x) => x.courseId === c.id)
      const p = progress.find((pr) => pr.courseId === c.id && (!pr.userId || pr.userId === profile?.id))
      const total = c.modules.length
      const done = total ? c.modules.filter((m) => p?.moduleProgress[m.id]?.completed).length : 0
      const pct = total ? done / total : 0
      if (favourites.has(c.id)) fav += 1
      if (cert || (total > 0 && pct >= 1)) complete += 1
      else if (p && total > 0 && pct > 0 && pct < 1) active += 1
    }
    return { all, active, complete, fav }
  }, [visibleCourses, certificates, progress, profile?.id, favourites])

  // Tab + favourites filter — independent of the selected category sidebar.
  const tabFiltered = useMemo(() => {
    return visibleCourses.filter((c) => {
      if (tab === 'fav') return favourites.has(c.id)
      const cert = certificates.some((x) => x.courseId === c.id)
      const p = progress.find((pr) => pr.courseId === c.id && (!pr.userId || pr.userId === profile?.id))
      const total = c.modules.length
      const done = total ? c.modules.filter((m) => p?.moduleProgress[m.id]?.completed).length : 0
      const pct = total ? done / total : 0
      if (tab === 'active') return total > 0 && pct > 0 && pct < 1 && !cert
      if (tab === 'complete') return cert || (total > 0 && pct >= 1)
      return true
    })
  }, [visibleCourses, tab, favourites, certificates, progress, profile?.id])

  // Counts per sidebar row (Alle / per-kategori / Annet) — computed off the
  // tab-filtered set so chips and category counts stay in sync.
  const sidebarCategories = useMemo(() => {
    const activeCats = categories.filter((c) => c.is_active)
    const byId = new Map<string, number>()
    let uncategorised = 0
    for (const c of tabFiltered) {
      if (c.categoryId && activeCats.some((cat) => cat.id === c.categoryId)) {
        byId.set(c.categoryId, (byId.get(c.categoryId) ?? 0) + 1)
      } else {
        uncategorised += 1
      }
    }
    const rows = activeCats
      .map((cat) => ({ id: cat.id, name: cat.name, position: cat.position, count: byId.get(cat.id) ?? 0 }))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
    return { rows, uncategorised, all: tabFiltered.length }
  }, [tabFiltered, categories])

  // Cards visible in the right pane: tab + sidebar category.
  const filteredCards = useMemo(() => {
    if (selectedCategoryId === ALL_KEY) return tabFiltered
    if (selectedCategoryId === UNCATEGORISED_KEY) {
      const activeIds = new Set(categories.filter((c) => c.is_active).map((c) => c.id))
      return tabFiltered.filter((c) => !c.categoryId || !activeIds.has(c.categoryId))
    }
    return tabFiltered.filter((c) => c.categoryId === selectedCategoryId)
  }, [tabFiltered, selectedCategoryId, categories])

  const toggleFavourite = (courseId: string) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      saveFavouriteIds(next)
      return next
    })
  }

  const handleDelete = (course: Course) => {
    if (!canDelete) return
    if (
      !window.confirm(
        `Slette kurset «${course.title}»? Modul, fremdrift og sertifikater fjernes også. Dette kan ikke angres.`,
      )
    ) {
      return
    }
    void (async () => {
      const r = await deleteCourse(course.id)
      if (!r.ok) setDeleteError(r.error)
      else setDeleteError(null)
    })()
  }

  const filterChips: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'Alle kurs', count: tabCounts.all },
    { id: 'active', label: 'Pågående', count: tabCounts.active },
    { id: 'complete', label: 'Fullført', count: tabCounts.complete },
    { id: 'fav', label: 'Favoritter', count: tabCounts.fav },
  ]

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {deleteError ? <WarningBox>{deleteError}</WarningBox> : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster kurs…</p> : null}

      {!learningError ? <LearningPrivacyNotice /> : null}

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Kurskatalog"
          description="Velg et kurs for å se moduler, deltakere og lovgrunnlag."
          toolbar={
            <>
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <StandardInput
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Søk i tittel, tagger eller beskrivelse"
                  className="pl-9"
                  aria-label="Søk i kurs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {filterChips.map((f) => {
                  const active = tab === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTab(f.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-[#1a3d32] text-white'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      {f.id === 'all' ? <BookOpen className="h-3 w-3" /> : null}
                      {f.id === 'active' ? <Clock className="h-3 w-3" /> : null}
                      {f.id === 'complete' ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {f.id === 'fav' ? <Star className="h-3 w-3" /> : null}
                      {f.label}
                      {f.count > 0 ? (
                        <span
                          className={`ml-0.5 rounded-full px-1.5 text-[10px] tabular-nums ${
                            active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {f.count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div
                role="group"
                aria-label="Visningstype"
                className="ml-auto inline-flex overflow-hidden rounded-md border border-neutral-200"
              >
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('kort')
                    saveViewMode('kort')
                  }}
                  aria-pressed={viewMode === 'kort'}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'kort'
                      ? 'bg-[#1a3d32] text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  Kort
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('liste')
                    saveViewMode('liste')
                  }}
                  aria-pressed={viewMode === 'liste'}
                  className={`inline-flex items-center gap-1 border-l border-neutral-200 px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'liste'
                      ? 'bg-[#1a3d32] text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <List className="h-3 w-3" />
                  Liste
                </button>
              </div>
            </>
          }
          footer={
            <span>
              Viser {filteredCards.length} av {visibleCourses.length} kurs
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(200px,22%)_1fr]">
            <aside
              className="border-b border-neutral-200 p-2 lg:border-b-0 lg:border-r lg:border-neutral-200/80"
              style={{ backgroundColor: BEIGE_NAV }}
            >
              <WikiFolderNavRow
                label="Alle kategorier"
                sub={`${sidebarCategories.all} kurs`}
                active={selectedCategoryId === ALL_KEY}
                onSelect={() => setSelectedCategoryId(ALL_KEY)}
              />
              {sidebarCategories.rows.map((cat) => (
                <WikiFolderNavRow
                  key={cat.id}
                  label={cat.name}
                  sub={`${cat.count} ${cat.count === 1 ? 'kurs' : 'kurs'}`}
                  active={selectedCategoryId === cat.id}
                  onSelect={() => setSelectedCategoryId(cat.id)}
                />
              ))}
              {sidebarCategories.uncategorised > 0 ? (
                <WikiFolderNavRow
                  label="Annet"
                  sub={`${sidebarCategories.uncategorised} kurs`}
                  active={selectedCategoryId === UNCATEGORISED_KEY}
                  onSelect={() => setSelectedCategoryId(UNCATEGORISED_KEY)}
                />
              ) : null}
            </aside>
            <div className="min-w-0 bg-white p-4 md:p-6">
              {viewMode === 'liste' ? (
                <LearningCoursesListView
                  courses={filteredCards}
                  canManage={canManage}
                  canDelete={canDelete}
                  isCourseUnlocked={isCourseUnlocked}
                  progress={progress}
                  certificates={certificates}
                  profileId={profile?.id}
                  favourites={favourites}
                  toggleFavourite={toggleFavourite}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCards.map((c) => {
              const unlocked = isCourseUnlocked(c.id)
              const total = c.modules.length
              const mins = courseTotalMinutes(c)
              const p = progress.find(
                (pr) => pr.courseId === c.id && (!pr.userId || pr.userId === profile?.id),
              )
              const done = total ? c.modules.filter((m) => p?.moduleProgress[m.id]?.completed).length : 0
              const pct = total ? done / total : 0
              const isFav = favourites.has(c.id)
              const status = statusBadgeFor(c.status)
              const sectionCount = c.sections?.length ?? 0

              return (
                <article
                  key={c.id}
                  className={`group flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    unlocked ? '' : 'opacity-80'
                  }`}
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: MINT_BG, color: PIN_GREEN }}
                    >
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleFavourite(c.id)}
                        aria-label={isFav ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                        className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-amber-500"
                      >
                        <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {c.origin === 'system' ? <Badge variant="neutral">System</Badge> : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    {unlocked ? (
                      <Link
                        to={`/learning/courses/${c.id}`}
                        className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900 hover:underline"
                      >
                        {c.title}
                      </Link>
                    ) : (
                      <span className="line-clamp-2 text-base font-semibold leading-snug text-neutral-500">
                        {c.title}
                      </span>
                    )}
                    <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">
                      {c.description || 'Ingen beskrivelse.'}
                    </p>
                  </div>

                  {c.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 3).map((t) => (
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
                    {sectionCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
                        {sectionCount} {sectionCount === 1 ? 'seksjon' : 'seksjoner'}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
                      {total} {total === 1 ? 'modul' : 'moduler'}
                    </span>
                    {mins > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-neutral-500" />
                        ~{mins} min
                      </span>
                    ) : null}
                    {c.recertificationMonths ? (
                      <span className="inline-flex items-center gap-1">
                        <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />
                        hver {c.recertificationMonths} mnd
                      </span>
                    ) : null}
                    {c.localeVersionMajor != null ? (
                      <span
                        className="ml-auto inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
                        title={
                          c.localeVersionPublishedAt
                            ? `Publisert ${new Date(c.localeVersionPublishedAt).toLocaleDateString('nb-NO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}`
                            : undefined
                        }
                      >
                        v{c.localeVersionMajor}.{c.localeVersionMinor ?? 0}
                        {c.localeVersionPublishedAt ? (
                          <span className="text-neutral-500">
                            · oppd.{' '}
                            {new Date(c.localeVersionPublishedAt).toLocaleDateString('nb-NO', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {p?.startedVersionMajor != null &&
                    c.localeVersionMajor != null &&
                    (c.localeVersionMajor > p.startedVersionMajor ||
                      (c.localeVersionMajor === p.startedVersionMajor &&
                        (c.localeVersionMinor ?? 0) > (p.startedVersionMinor ?? 0))) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Ny versjon tilgjengelig
                      </span>
                    ) : null}
                  </div>

                  {total > 0 && p ? (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-600">
                        <span>Din framgang</span>
                        <span className="font-semibold tabular-nums text-neutral-900">
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                      <ProgressBarMini value={pct} />
                    </div>
                  ) : !unlocked ? (
                    <p className="text-[11px] font-medium text-amber-800">Låst — fullfør forutsetningskurs</p>
                  ) : (
                    <div className="text-[11px] text-neutral-400">Ikke tildelt enda</div>
                  )}

                  <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 border-t border-neutral-100 pt-3">
                    {canManage ? (
                      <div className="mr-auto" onClick={(e) => e.stopPropagation()}>
                        <SearchableSelect
                          value={c.status}
                          options={COURSE_STATUS_OPTIONS}
                          onChange={(val) => updateCourse(c.id, { status: val as CourseStatus })}
                          triggerClassName="px-2 py-1 text-[10px]"
                          className="mt-0"
                        />
                      </div>
                    ) : null}
                    {unlocked ? (
                      <Link
                        to={`/learning/play/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#14312a]"
                      >
                        Åpne kurs
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-500">
                        Låst
                      </span>
                    )}
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={<Pencil className="h-3 w-3" />}
                        onClick={() => navigate(`/learning/courses/${c.id}`)}
                        aria-label={`Rediger ${c.title}`}
                      >
                        Rediger
                      </Button>
                    ) : null}
                    {canDelete && c.origin !== 'system' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="h-3 w-3" />}
                        onClick={() => handleDelete(c)}
                        aria-label={`Slett ${c.title}`}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Slett
                      </Button>
                    ) : null}
                  </div>
                </article>
              )
                  })}
                </div>
              )}
              {filteredCards.length === 0 && !learningLoading ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  Ingen kurs i dette filteret. Bruk «Nytt kurs» øverst for å opprette ett.
                </div>
              ) : null}
            </div>
          </div>
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}

type ListViewProps = {
  courses: Course[]
  canManage: boolean
  canDelete: boolean
  isCourseUnlocked: (id: string) => boolean
  progress: ReturnType<typeof useLearning>['progress']
  certificates: ReturnType<typeof useLearning>['certificates']
  profileId: string | undefined
  favourites: Set<string>
  toggleFavourite: (id: string) => void
  onDelete: (c: Course) => void
}

function LearningCoursesListView({
  courses,
  canManage,
  canDelete,
  isCourseUnlocked,
  progress,
  certificates,
  profileId,
  favourites,
  toggleFavourite,
  onDelete,
}: ListViewProps) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            <th className="px-3 py-2"></th>
            <th className="px-3 py-2">Kurs</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Versjon</th>
            <th className="px-3 py-2">Moduler</th>
            <th className="px-3 py-2">Framgang</th>
            <th className="px-3 py-2 text-right">Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => {
            const unlocked = isCourseUnlocked(c.id)
            const total = c.modules.length
            const p = progress.find((pr) => pr.courseId === c.id && (!pr.userId || pr.userId === profileId))
            const done = total ? c.modules.filter((m) => p?.moduleProgress[m.id]?.completed).length : 0
            const pct = total ? done / total : 0
            const cert = certificates.some((x) => x.courseId === c.id)
            const isFav = favourites.has(c.id)
            const status = statusBadgeFor(c.status)
            return (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleFavourite(c.id)}
                    aria-label={isFav ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-amber-500"
                  >
                    <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </td>
                <td className="px-3 py-2">
                  {unlocked ? (
                    <Link to={`/learning/courses/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-neutral-500">{c.title}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {c.origin === 'system' ? <Badge variant="neutral">System</Badge> : null}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-neutral-700">
                  {c.localeVersionMajor != null
                    ? `v${c.localeVersionMajor}.${c.localeVersionMinor ?? 0}`
                    : `v${c.courseVersion ?? 1}`}
                </td>
                <td className="px-3 py-2 text-neutral-700">{total}</td>
                <td className="px-3 py-2">
                  {cert || pct >= 1 ? (
                    <Badge variant="success">Fullført</Badge>
                  ) : pct > 0 ? (
                    <span className="text-xs tabular-nums text-neutral-700">{Math.round(pct * 100)}%</span>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {unlocked ? (
                      <Link
                        to={`/learning/play/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14312a]"
                      >
                        Åpne
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="rounded-md bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-500">
                        Låst
                      </span>
                    )}
                    {canManage ? (
                      <Link
                        to={`/learning/courses/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                        aria-label={`Rediger ${c.title}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Link>
                    ) : null}
                    {canDelete && c.origin !== 'system' ? (
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        aria-label={`Slett ${c.title}`}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
