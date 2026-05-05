import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Course, CourseStatus } from '../../types/learning'
import { LearningPrivacyNotice } from '../../components/learning/LearningPrivacyNotice'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { ModuleSectionCard } from '../../components/module'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"
const PIN_GREEN = '#1a3d32'
const MINT_BG = '#e7efe9'

const FAV_KEY = 'atics-learning-favourite-course-ids'

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
  const { can, profile } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    courses,
    createCourse,
    updateCourse,
    learningLoading,
    learningError,
    isCourseUnlocked,
    progress,
    certificates,
  } = useLearning()

  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [tab, setTab] = useState<TabId>('all')
  const [favourites, setFavourites] = useState<Set<string>>(loadFavouriteIds)
  const [showCreate, setShowCreate] = useState(false)

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

  const filteredCards = useMemo(() => {
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

  const toggleFavourite = (courseId: string) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      saveFavouriteIds(next)
      return next
    })
  }

  const filterChips: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'Alle kurs', count: tabCounts.all },
    { id: 'active', label: 'Pågående', count: tabCounts.active },
    { id: 'complete', label: 'Fullført', count: tabCounts.complete },
    { id: 'fav', label: 'Favoritter', count: tabCounts.fav },
  ]

  const headerActions = canManage ? (
    <Button
      size="sm"
      icon={<Plus className="h-3.5 w-3.5" />}
      onClick={() => setShowCreate((v) => !v)}
    >
      Nytt kurs
    </Button>
  ) : null

  return (
    <div className="space-y-6">
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster kurs…</p> : null}

      {!learningError ? <LearningPrivacyNotice /> : null}

      {showCreate && canManage ? (
        <ModuleSectionCard>
          <h2
            className="text-lg font-semibold text-neutral-900"
            style={{ fontFamily: SERIF_FAMILY }}
          >
            Nytt kurs
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Du kan endre tittel og beskrivelse senere i kursbyggeren.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              const c = createCourse(title, desc)
              setTitle('')
              setDesc('')
              setShowCreate(false)
              navigate(`/learning/courses/${c.id}`)
            }}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Tittel
              </label>
              <StandardInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="f.eks. AML-grunnkurs"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Kort beskrivelse
              </label>
              <StandardInput
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Hvem er målgruppen og hva lærer de?"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Avbryt
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                Opprett
              </Button>
            </div>
          </form>
        </ModuleSectionCard>
      ) : null}

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Kurskatalog"
          description="Velg et kurs for å se moduler, deltakere og lovgrunnlag."
          headerActions={headerActions}
          toolbar={
            <>
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <StandardInput
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
            </>
          }
          footer={
            <span>
              Viser {filteredCards.length} av {visibleCourses.length} kurs
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
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
                    </div>
                  </div>

                  <div className="min-w-0">
                    {unlocked ? (
                      <Link
                        to={`/learning/courses/${c.id}`}
                        className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900 hover:underline"
                        style={{ fontFamily: SERIF_FAMILY }}
                      >
                        {c.title}
                      </Link>
                    ) : (
                      <span
                        className="line-clamp-2 text-base font-semibold leading-snug text-neutral-500"
                        style={{ fontFamily: SERIF_FAMILY }}
                      >
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
                      <Link
                        to={`/learning/courses/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                      >
                        Bygger
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
            {filteredCards.length === 0 && !learningLoading ? (
              <div className="col-span-full py-12 text-center text-sm text-neutral-500">
                Ingen kurs i dette filteret.
              </div>
            ) : null}
          </div>
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </div>
  )
}
