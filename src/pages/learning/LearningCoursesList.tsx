import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, Clock, Plus, Search, Star } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Course, CourseStatus } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'

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

function ProgressBarMini({ value }: { value: number }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)))
  return (
    <div
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      className="h-[6px] w-full overflow-hidden rounded-sm border border-[#e3ddcc] bg-[#f7f5ee]"
    >
      <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: '#1a3d32' }} />
    </div>
  )
}

type TabId = 'all' | 'active' | 'complete' | 'fav'

export function LearningCoursesList() {
  const navigate = useNavigate()
  const { can, organization, profile } = useOrgSetupContext()
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

  const creatorLabel = organization?.name?.trim() || 'Organisasjon'

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

  const courseFilterItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'all',
        label: 'Alle kurs',
        icon: BookOpen,
        active: tab === 'all',
        badgeCount: tabCounts.all,
        onClick: () => setTab('all'),
      },
      {
        key: 'active',
        label: 'Pågående',
        icon: Clock,
        active: tab === 'active',
        badgeCount: tabCounts.active,
        onClick: () => setTab('active'),
      },
      {
        key: 'complete',
        label: 'Fullført',
        icon: CheckCircle2,
        active: tab === 'complete',
        badgeCount: tabCounts.complete,
        onClick: () => setTab('complete'),
      },
      {
        key: 'fav',
        label: 'Favoritter',
        icon: Star,
        active: tab === 'fav',
        badgeCount: tabCounts.fav,
        onClick: () => setTab('fav'),
      },
    ],
    [tab, tabCounts.active, tabCounts.all, tabCounts.complete, tabCounts.fav],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold" style={{ color: PIN_GREEN }}>
            Kurs
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Flashkort, quiz, media, sjekklister og mikromoduler — samme uttrykk som resten av Klarert.
          </p>
        </div>
      </div>

      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster kurs…</p> : null}

      {canManage ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            const c = createCourse(title, desc)
            setTitle('')
            setDesc('')
            navigate(`/learning/courses/${c.id}`)
          }}
          className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4"
        >
          <h2 className="text-sm font-semibold" style={{ color: PIN_GREEN }}>
            Nytt kurs
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tittel"
              className="min-w-[200px] flex-1 rounded-lg border border-[#e3ddcc] px-3 py-2 text-sm"
              required
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Kort beskrivelse"
              className="min-w-[200px] flex-1 rounded-lg border border-[#e3ddcc] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PIN_GREEN }}
            >
              <Plus className="size-4" />
              Opprett
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4 text-sm text-[#6b6f68]">
          Du har ikke tilgang til å opprette kurs. Be om rettigheten «E-learning — opprette og redigere kurs» (
          <code className="rounded bg-neutral-100 px-1">learning.manage</code>).
        </p>
      )}

      <HubMenu1Bar ariaLabel="Kurs — filter" items={courseFilterItems} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i kurs…"
            className="w-full rounded-full border border-[#e3ddcc] bg-[#fbf9f3] py-2 pl-10 pr-4 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCards.map((c) => {
          const unlocked = isCourseUnlocked(c.id)
          const total = c.modules.length
          const mins = courseTotalMinutes(c)
          const p = progress.find((pr) => pr.courseId === c.id && (!pr.userId || pr.userId === profile?.id))
          const done = total ? c.modules.filter((m) => p?.moduleProgress[m.id]?.completed).length : 0
          const pct = total ? done / total : 0
          const isFav = favourites.has(c.id)

          return (
            <article
              key={c.id}
              className={`flex flex-col overflow-hidden rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] transition-shadow ${
                unlocked ? 'hover:shadow-md' : 'opacity-80'
              }`}
            >
              {/* Header image / gradient */}
              <div className="relative h-36 shrink-0 rounded-t-lg bg-gradient-to-br from-[#1a3d32] via-[#234d3f] to-[#2f6b52]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a3d32]/95 to-[#143528] opacity-95" />
                <button
                  type="button"
                  onClick={() => toggleFavourite(c.id)}
                  className="absolute right-3 top-3 rounded-lg bg-black/25 p-2 text-white backdrop-blur-sm hover:bg-black/40"
                  aria-label={isFav ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                >
                  <Star className={`size-4 ${isFav ? 'fill-[#c9a227] text-[#c9a227]' : 'text-white'}`} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1a3d32]">
                  {c.status === 'published' ? 'Publisert' : c.status === 'draft' ? 'Utkast' : 'Arkivert'}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="min-h-0 flex-1">
                  {unlocked ? (
                    <Link
                      to={`/learning/courses/${c.id}`}
                      className="font-serif text-lg font-semibold leading-snug text-[#1a3d32] hover:underline"
                    >
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-serif text-lg font-semibold text-neutral-500">{c.title}</span>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm text-[#6b6f68]">{c.description || 'Ingen beskrivelse.'}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#6b6f68]">
                    <span className="inline-flex items-center gap-1.5" title="Moduler">
                      <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      {total} {total === 1 ? 'modul' : 'moduler'}
                    </span>
                    <span className="inline-flex items-center gap-1.5" title="Estimert tid">
                      <Clock className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      {mins > 0 ? `~${mins} min` : '—'}
                    </span>
                  </div>

                  {total > 0 ? (
                    <div className="mt-3">
                      <ProgressBarMini value={pct} />
                      <p className="mt-1 text-[11px] text-[#6b6f68]">
                        Fremdrift: {done}/{total} moduler
                      </p>
                    </div>
                  ) : null}

                  {!unlocked ? (
                    <p className="mt-2 text-[11px] font-medium text-amber-800">Låst — fullfør forutsetninger</p>
                  ) : null}
                </div>

                {/* Footer in card */}
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: PIN_GREEN }}
                        aria-hidden
                      >
                        {creatorLabel.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#1a3d32]">{creatorLabel}</p>
                        <p className="text-[11px] text-[#6b6f68]">Kursansvarlig</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                      <AddTaskLink
                        title={`Oppfølging: ${c.title}`}
                        module="learning"
                        sourceType="learning_course"
                        sourceId={c.id}
                        sourceLabel={c.title}
                        className="rounded-md border border-[#e3ddcc] px-2 py-0.5 font-medium text-[#1a3d32] hover:bg-neutral-50"
                      >
                        Oppgave
                      </AddTaskLink>
                      {canManage ? (
                        <select
                          value={c.status}
                          onChange={(e) => updateCourse(c.id, { status: e.target.value as CourseStatus })}
                          className="max-w-[7rem] rounded-md border border-[#e3ddcc] bg-[#fbf9f3] px-1.5 py-0.5 text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="draft">Utkast</option>
                          <option value="published">Publisert</option>
                          <option value="archived">Arkivert</option>
                        </select>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {unlocked ? (
                      <Link
                        to={`/learning/play/${c.id}`}
                        className="inline-flex flex-1 items-center justify-center rounded-md bg-[#1a3d32] px-3 py-2 text-center text-xs font-medium text-white hover:opacity-95"
                      >
                        Åpne kurs
                      </Link>
                    ) : (
                      <span className="inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-full bg-neutral-200 px-3 py-2 text-center text-xs text-neutral-500">
                        Låst
                      </span>
                    )}
                    {canManage ? (
                      <Link
                        to={`/learning/courses/${c.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-[#e3ddcc] px-3 py-2 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                      >
                        Bygger
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filteredCards.length === 0 && !learningLoading ? (
        <p className="rounded-lg border border-dashed border-[#e3ddcc] bg-[#fbf9f3] p-10 text-center text-sm text-[#6b6f68]">
          Ingen kurs i dette filteret.
        </p>
      ) : null}
    </div>
  )
}
