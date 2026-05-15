// Alternative 5 — "Hjem" course-player. Wraps the lesson reading pane inside
// the actual /app workspace frontpage layout (mirrors WelcomeDashboardPage):
// breadcrumb → big serif Velkommen H1 → Hjem/Klassisk tab pills → 7fr/3fr
// split. The lesson sits in the "Neste på listen" position. The right rail
// keeps Denne uken / Varsler / Snarveier from the real frontpage (Åpne
// oppgaver + HMS-hendelser KPI boxes intentionally removed per request).

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  Maximize2,
  Minimize2,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Users2,
  type LucideIcon,
} from 'lucide-react'
import {
  MOCK_COURSE,
  moduleKindLabel,
  moduleTimeLabel,
  type MockBadgeIcon,
  type MockCourse,
  type MockModule,
} from './mockCourse'

const SERIF = "'Libre Baskerville', Georgia, serif"
const GREEN = '#1a3d32'
const GREEN_HOVER = '#14312a'
const PAPER_BG = '#F9F7F2'
const CREAM_TILE = '#f2eee6'
const AMBER_TODAY = '#ea7c3a'

type FontSize = 'sm' | 'base' | 'lg'

const FONT_SIZE_PX: Record<FontSize, string> = {
  sm: '0.9375rem',
  base: '1.0625rem',
  lg: '1.1875rem',
}

const FONT_SIZE_LABEL: Record<FontSize, string> = {
  sm: 'Liten tekst',
  base: 'Normal tekst',
  lg: 'Stor tekst',
}

const KIND_ICON: Record<MockModule['kind'], LucideIcon> = {
  text: FileText,
  quiz: HelpCircle,
  reflection: PenLine,
}

const BADGE_ICON: Record<MockBadgeIcon, LucideIcon> = {
  Compass,
  ShieldCheck,
  Award,
  Trophy,
}

export function PlatformCoursePlayerHjemPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const [fontSize, setFontSize] = useState<FontSize>('base')
  const [expanded, setExpanded] = useState(false)

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const earnedPoints = course.modules.reduce(
    (sum, m) => (completed[m.id] ? sum + m.points : sum),
    0,
  )
  const earnedBadges = course.badges.filter((b) => completed[b.awardedAtModuleId])
  const nextMod = idx < total - 1 ? course.modules[idx + 1] : null

  const quizScore = useMemo(() => {
    if (mod.kind !== 'quiz') return null
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    return { right, total: mod.questions.length, ratio: right / mod.questions.length }
  }, [mod, quizAnswers])

  const canAdvance = (() => {
    if (mod.kind === 'quiz') return quizSubmitted && quizScore !== null && quizScore.ratio >= 2 / 3
    if (mod.kind === 'reflection')
      return mod.prompts.every((p) => (reflections[p.id] ?? '').trim().length >= 10)
    return true
  })()

  function advance() {
    setCompleted((c) => ({ ...c, [mod.id]: true }))
    if (idx < total - 1) {
      setIdx(idx + 1)
      setQuizSubmitted(false)
    } else {
      setFinished(true)
    }
  }

  function back() {
    if (idx > 0) {
      setIdx(idx - 1)
      setQuizSubmitted(false)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') back()
      if (e.key === 'ArrowRight' && canAdvance) advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, canAdvance])

  function resetAll() {
    setFinished(false)
    setIdx(0)
    setCompleted({})
    setQuizAnswers({})
    setQuizSubmitted(false)
    setReflections({})
  }

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div
        className="min-h-[calc(100vh-100px)] text-neutral-900"
        style={{ backgroundColor: PAPER_BG }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
          {/* Header band — breadcrumb / serif H1 / tab pills / divider */}
          <header className="space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                <Link
                  to="/platform-admin/course-player"
                  className="hover:text-neutral-900"
                >
                  Workspace
                </Link>
                <span className="mx-1.5">›</span>
                <span className="text-neutral-700">Hjem</span>
              </p>
              <div className="flex items-center gap-3 text-neutral-500">
                <button
                  type="button"
                  aria-label="Innstillinger"
                  className="rounded-md p-1.5 hover:bg-white"
                >
                  <Settings className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Varsler"
                  className="relative rounded-md p-1.5 hover:bg-white"
                >
                  <Bell className="size-4" />
                  <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-[#d23a3a] text-[9px] font-bold text-white">
                    2
                  </span>
                </button>
              </div>
            </div>

            <h1
              className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl"
              style={{ fontFamily: SERIF }}
            >
              Velkommen tilbake, Tor Lambrechts
            </h1>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: GREEN }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
              >
                <Home className="size-4" /> Hjem
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-white"
              >
                <LayoutDashboard className="size-4" /> Klassisk dashbord
              </button>
            </div>

            <hr className="border-neutral-200" />
          </header>

          {/* 7fr / 3fr split (drops to single column when Utvid is active) */}
          <div
            className={
              expanded
                ? 'grid grid-cols-1 gap-6'
                : 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:items-start'
            }
          >
            {/* Main column — "Neste på listen" position becomes the lesson reading pane */}
            <main className="space-y-4">
              {finished ? (
                <HjemFinishedCard
                  course={course}
                  earnedPoints={earnedPoints}
                  earnedBadges={earnedBadges}
                  onRestart={resetAll}
                />
              ) : (
                <article className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
                  {/* Reading-pane header — matches "Neste på listen / Alle oppgaver" */}
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-6 py-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Neste på listen
                      </p>
                      <p
                        className="text-base font-semibold text-neutral-900"
                        style={{ fontFamily: SERIF }}
                      >
                        {course.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ReadingControls
                        fontSize={fontSize}
                        setFontSize={setFontSize}
                        expanded={expanded}
                        setExpanded={setExpanded}
                      />
                      <Link
                        to="/platform-admin/course-player"
                        className="text-[11px] font-bold uppercase tracking-wider hover:underline"
                        style={{ color: GREEN }}
                      >
                        Alle moduler →
                      </Link>
                    </div>
                  </header>

                  {/* Lesson body — font size scales the entire body */}
                  <div
                    className="px-6 py-6 md:px-8 md:py-8"
                    style={{ fontSize: FONT_SIZE_PX[fontSize] }}
                  >
                    {/* Module meta strip */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        {mod.eyebrow}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {mod.lawRefs.map((r) => (
                          <span
                            key={r}
                            className="rounded-md border border-neutral-200 bg-[#f7f5ee] px-2 py-0.5 font-mono text-[11px] text-neutral-700"
                          >
                            {r}
                          </span>
                        ))}
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: `${GREEN}15`, color: GREEN }}
                        >
                          <Sparkles className="size-3" /> +{mod.points} XP
                        </span>
                      </div>
                    </div>

                    <h2
                      className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                      style={{ fontFamily: SERIF }}
                    >
                      {mod.title}
                    </h2>

                    <div className="mt-5">
                      <HjemLessonBody
                        mod={mod}
                        quizAnswers={quizAnswers}
                        setQuizAnswers={setQuizAnswers}
                        quizSubmitted={quizSubmitted}
                        setQuizSubmitted={setQuizSubmitted}
                        quizScore={quizScore}
                        reflections={reflections}
                        setReflections={setReflections}
                      />
                    </div>
                  </div>

                  {/* Pager footer with Neste-opp + Forrige/Neste */}
                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-[#fbf9f3] px-6 py-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="text-neutral-600">
                        Modul {idx + 1} av {total} · {moduleTimeLabel(mod.durationMinutes)}
                      </span>
                      {nextMod ? (
                        <span className="text-[11px] text-neutral-500">
                          Neste opp:{' '}
                          <strong className="font-semibold text-neutral-800">{nextMod.title}</strong>
                        </span>
                      ) : (
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: GREEN }}
                        >
                          Siste etappe
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={back}
                        disabled={idx === 0}
                        aria-label="Forrige modul"
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowLeft className="size-3.5" /> Forrige
                      </button>
                      <button
                        type="button"
                        onClick={advance}
                        disabled={!canAdvance}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: GREEN }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
                      >
                        {idx === total - 1 ? 'Fullfør' : 'Fortsett'}
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </footer>
                </article>
              )}

              {/* Mini "+N flere" footer to match the screenshot's task-list feel */}
              {!finished ? (
                <button
                  type="button"
                  className="block w-full rounded-xl border border-dashed border-neutral-300 bg-white/60 px-4 py-3 text-center text-xs font-semibold text-neutral-600 hover:bg-white"
                >
                  + {Math.max(0, total - idx - 1)} moduler igjen i kurset
                </button>
              ) : null}
            </main>

            {/* Right rail — hidden under Utvid */}
            {!expanded ? (
              <aside className="space-y-4 lg:sticky lg:top-6">
                <DenneUkenCard
                  course={course}
                  completedCount={completedCount}
                  total={total}
                  earnedPoints={earnedPoints}
                  totalPoints={course.totalPoints}
                  nextMod={nextMod}
                  completed={completed}
                  onPickModule={(i) => {
                    setIdx(i)
                    setQuizSubmitted(false)
                  }}
                />
                <VarslerCard earnedBadges={earnedBadges} course={course} />
                <SnarveierCard
                  course={course}
                  currentIdx={idx}
                  completed={completed}
                  onPickModule={(i) => {
                    setIdx(i)
                    setQuizSubmitted(false)
                  }}
                />
              </aside>
            ) : null}
          </div>

          <DesignNotes />
        </div>
      </div>
    </div>
  )
}

function ReadingControls({
  fontSize,
  setFontSize,
  expanded,
  setExpanded,
}: {
  fontSize: FontSize
  setFontSize: (s: FontSize) => void
  expanded: boolean
  setExpanded: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white p-0.5">
      <div role="group" aria-label="Tekststørrelse" className="flex items-center">
        {(['sm', 'base', 'lg'] as const).map((s, i) => {
          const active = fontSize === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFontSize(s)}
              title={FONT_SIZE_LABEL[s]}
              aria-label={FONT_SIZE_LABEL[s]}
              aria-pressed={active}
              className="flex h-6 w-6 items-center justify-center rounded font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
              style={{
                backgroundColor: active ? `${GREEN}1a` : 'transparent',
                color: active ? GREEN : '#737373',
                outlineColor: GREEN,
                fontSize: i === 0 ? '0.65rem' : i === 1 ? '0.8rem' : '0.95rem',
              }}
            >
              A
            </button>
          )
        })}
      </div>
      <div className="mx-0.5 h-4 w-px bg-neutral-200" aria-hidden />
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Komprimer (vis sidefelt)' : 'Utvid (skjul sidefelt)'}
        aria-label={expanded ? 'Komprimer leseflate' : 'Utvid leseflate'}
        aria-pressed={expanded}
        className="flex h-6 items-center gap-1 rounded px-2 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{
          backgroundColor: expanded ? `${GREEN}1a` : 'transparent',
          color: expanded ? GREEN : '#525252',
          outlineColor: GREEN,
        }}
      >
        {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        <span className="hidden md:inline">{expanded ? 'Komprimer' : 'Utvid'}</span>
      </button>
    </div>
  )
}

type WeekItem = {
  id: string
  title: string
  meta: string
  status?: 'today' | 'pending' | 'done'
  /** When set, clicking the item jumps to that module index */
  jumpToModuleIdx?: number
}

type WeekCategory = {
  id: string
  label: string
  Icon: LucideIcon
  iconColor: string
  defaultOpen?: boolean
  items: WeekItem[]
}

function DenneUkenCard({
  course,
  completedCount,
  total,
  earnedPoints,
  totalPoints,
  nextMod,
  completed,
  onPickModule,
}: {
  course: MockCourse
  completedCount: number
  total: number
  earnedPoints: number
  totalPoints: number
  nextMod: MockModule | null
  completed: Record<string, boolean>
  onPickModule: (i: number) => void
}) {
  const dayLabels = ['man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.', 'søn.']
  const dayNumbers = [11, 12, 13, 14, 15, 16, 17]
  const todayIdx = 4 // Friday 15. mai 2026 — matches CLAUDE.md currentDate

  // Build categorised week content from mock course data.
  const moduleItems: WeekItem[] = course.modules.map((m, i) => {
    const done = !!completed[m.id]
    const isNext = nextMod?.id === m.id
    return {
      id: m.id,
      title: m.title,
      meta: `${moduleKindLabel(m.kind)} · ${moduleTimeLabel(m.durationMinutes)} · +${m.points} XP`,
      status: done ? 'done' : isNext ? 'today' : 'pending',
      jumpToModuleIdx: i,
    }
  })

  const reflectionItems: WeekItem[] = course.modules
    .filter((m) => m.kind === 'reflection')
    .map((m) => ({
      id: `refl-${m.id}`,
      title: m.title,
      meta: `Refleksjon · ${moduleTimeLabel(m.durationMinutes)}${
        completed[m.id] ? ' · lagret' : ' · venter'
      }`,
      status: completed[m.id] ? ('done' as const) : ('pending' as const),
      jumpToModuleIdx: course.modules.indexOf(m),
    }))

  const meetingItems: WeekItem[] = [
    {
      id: 'mtg-1',
      title: 'Verneombudsmøte mai',
      meta: 'fre. 15. mai · 15:00 · Teams',
      status: 'today',
    },
    {
      id: 'mtg-2',
      title: 'Q&A med Anne om internkontroll',
      meta: 'tor. 21. mai · 09:00',
      status: 'pending',
    },
  ]

  const deadlineItems: WeekItem[] = [
    {
      id: 'dl-1',
      title: 'Resertifisering Helse',
      meta: '30. mai 2026 · resertifisering',
      status: 'pending',
    },
    {
      id: 'dl-2',
      title: 'Kursbevis: Internkontroll',
      meta: 'Utstedes ved fullføring',
      status: 'pending',
    },
  ]

  const categories: WeekCategory[] = [
    {
      id: 'e-laering',
      label: 'E-læring',
      Icon: BookOpen,
      iconColor: GREEN,
      defaultOpen: true,
      items: moduleItems,
    },
    {
      id: 'refleksjon',
      label: 'Refleksjoner',
      Icon: PenLine,
      iconColor: '#c2410c',
      items: reflectionItems,
    },
    {
      id: 'moter',
      label: 'Møter',
      Icon: Users2,
      iconColor: '#7c3aed',
      items: meetingItems,
    },
    {
      id: 'frister',
      label: 'Frister',
      Icon: Clock,
      iconColor: '#a16207',
      items: deadlineItems,
    },
  ]

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Denne uken
        </p>
      </header>

      {/* Calendar grid header */}
      <div className="px-4 py-4">
        <p className="text-center text-xs text-neutral-500">Uke 20 · mai 2026</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {dayLabels.map((d) => (
            <span key={d} className="text-[10px] text-neutral-500">
              {d}
            </span>
          ))}
          {dayNumbers.map((n, i) => {
            const isToday = i === todayIdx
            return (
              <span
                key={n}
                className="mt-1 flex items-center justify-center"
                aria-label={isToday ? `${n}. mai (i dag)` : `${n}. mai`}
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full text-xs"
                  style={
                    isToday
                      ? { backgroundColor: AMBER_TODAY, color: 'white', fontWeight: 600 }
                      : { color: '#404040' }
                  }
                >
                  {n}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Expandable categories */}
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {categories.map((cat) => (
          <li key={cat.id}>
            <details open={cat.defaultOpen} className="group">
              <summary
                className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-[#fbf9f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{ outlineColor: GREEN }}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${cat.iconColor}14`,
                    color: cat.iconColor,
                  }}
                >
                  <cat.Icon className="size-3.5" />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-neutral-900">
                  {cat.label}
                </span>
                <span className="rounded-full bg-[#f3eee0] px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                  {cat.items.length}
                </span>
                <ChevronDown className="size-3.5 text-neutral-400 transition-transform group-open:rotate-180" />
              </summary>
              {cat.items.length === 0 ? (
                <p className="px-4 pb-3 text-[11px] text-neutral-500">Ingenting denne uken.</p>
              ) : (
                <ul className="space-y-1 px-4 pb-3 pt-1">
                  {cat.items.map((it) => {
                    const clickable = it.jumpToModuleIdx !== undefined
                    const Inner = (
                      <>
                        <span
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor:
                              it.status === 'done'
                                ? GREEN
                                : it.status === 'today'
                                  ? AMBER_TODAY
                                  : '#e5e1d4',
                            color:
                              it.status === 'done' || it.status === 'today'
                                ? 'white'
                                : '#a3a3a3',
                          }}
                        >
                          {it.status === 'done' ? (
                            <Check className="size-2.5" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-current opacity-80" />
                          )}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[12px] font-medium text-neutral-900">
                            {it.title}
                          </span>
                          <span className="block text-[10px] text-neutral-500">{it.meta}</span>
                        </span>
                      </>
                    )
                    return (
                      <li key={it.id}>
                        {clickable ? (
                          <button
                            type="button"
                            onClick={() => onPickModule(it.jumpToModuleIdx as number)}
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[#fbf9f3]"
                          >
                            {Inner}
                          </button>
                        ) : (
                          <div className="flex items-start gap-2 rounded-md px-2 py-1.5">
                            {Inner}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </details>
          </li>
        ))}
      </ul>

      {/* Footer learning-goal meter */}
      <footer className="border-t border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Læringsmål uka
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-neutral-600">
            {completedCount} av {total} moduler
          </span>
          <span className="font-semibold" style={{ color: GREEN }}>
            {earnedPoints} / {totalPoints} XP
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full"
            style={{
              width: `${(earnedPoints / totalPoints) * 100}%`,
              backgroundColor: GREEN,
            }}
          />
        </div>
      </footer>
    </section>
  )
}

function VarslerCard({
  earnedBadges,
  course,
}: {
  earnedBadges: MockCourse['badges']
  course: MockCourse
}) {
  const pending = course.badges.length - earnedBadges.length
  const items: { Icon: LucideIcon; title: string; sub: string; iconColor: string }[] = []
  if (earnedBadges.length > 0) {
    const latest = earnedBadges[earnedBadges.length - 1]
    items.push({
      Icon: Trophy,
      title: `Nytt merke låst opp: «${latest.label}»`,
      sub: latest.description,
      iconColor: GREEN,
    })
  }
  items.push({
    Icon: Bell,
    title: 'Refleksjonsoppgave venter',
    sub: 'Modul 3 — Bruk det på din egen avdeling',
    iconColor: '#7c2d12',
  })
  if (pending > 0) {
    items.push({
      Icon: Award,
      title: `${pending} ${pending === 1 ? 'merke' : 'merker'} igjen å låse opp`,
      sub: 'Fullfør gjenstående moduler for å fullføre kurset',
      iconColor: '#a16207',
    })
  }
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Varsler</p>
        <span className="flex size-5 items-center justify-center rounded-full bg-[#d23a3a] text-[9px] font-bold text-white">
          {items.length}
        </span>
      </header>
      <ul className="divide-y divide-neutral-100">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f3eee0', color: it.iconColor }}
            >
              <it.Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-neutral-900">{it.title}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">{it.sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SnarveierCard({
  course,
  currentIdx,
  completed,
  onPickModule,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPickModule: (i: number) => void
}) {
  const [innholdOpen, setInnholdOpen] = useState(false)
  const shortcuts: { Icon: LucideIcon; label: string; href?: string; onClick?: () => void; color: string }[] = [
    {
      Icon: ListChecks,
      label: 'Innhold',
      onClick: () => setInnholdOpen((v) => !v),
      color: GREEN,
    },
    { Icon: Bookmark, label: 'Mine notater', color: '#c2410c' },
    { Icon: Trophy, label: 'Mitt kursbevis', color: '#a16207' },
    { Icon: Users, label: 'Diskuter med kolleger', color: '#7c3aed' },
    { Icon: BookOpen, label: 'Bibliotek', color: '#0e7490' },
  ]
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Snarveier
        </p>
      </header>
      <ul className="divide-y divide-neutral-100">
        {shortcuts.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={s.onClick}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:bg-[#fbf9f3]"
            >
              <s.Icon className="size-4 shrink-0" style={{ color: s.color }} />
              <span className="flex-1">{s.label}</span>
              <ExternalLink className="size-3 text-neutral-400" />
            </button>
          </li>
        ))}
      </ul>

      {/* Innhold inline expand */}
      {innholdOpen ? (
        <div className="border-t border-neutral-100 bg-[#fbf9f3] px-4 py-3">
          <ol className="space-y-1.5">
            {course.modules.map((m, i) => {
              const done = completed[m.id]
              const isCurrent = i === currentIdx
              const Icon = KIND_ICON[m.kind]
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickModule(i)
                      setInnholdOpen(false)
                    }}
                    aria-current={isCurrent ? 'step' : undefined}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white"
                    style={{
                      backgroundColor: isCurrent ? `${GREEN}10` : undefined,
                    }}
                  >
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: done ? GREEN : isCurrent ? `${GREEN}1f` : 'white',
                        color: done ? 'white' : isCurrent ? GREEN : '#7a7466',
                      }}
                    >
                      {done ? <Check className="size-3" /> : <Icon className="size-3" />}
                    </span>
                    <span
                      className={`text-[12px] ${
                        isCurrent ? 'font-semibold text-neutral-900' : 'text-neutral-700'
                      }`}
                    >
                      {i + 1}. {m.title}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

function HjemFinishedCard({
  course,
  earnedPoints,
  earnedBadges,
  onRestart,
}: {
  course: MockCourse
  earnedPoints: number
  earnedBadges: MockCourse['badges']
  onRestart: () => void
}) {
  return (
    <div
      role="status"
      className="rounded-xl border bg-white p-8 shadow-sm"
      style={{ borderColor: `${GREEN}40` }}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: GREEN }}
        >
          <Trophy className="size-5" />
        </span>
        <div className="flex-1">
          <h2
            className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: SERIF }}
          >
            Kurset er fullført
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Du tjente{' '}
            <strong style={{ color: GREEN }}>
              {earnedPoints} av {course.totalPoints} XP
            </strong>{' '}
            og låste opp{' '}
            <strong style={{ color: GREEN }}>
              {earnedBadges.length} av {course.badges.length} merker
            </strong>
            . Kursbeviset er signert og lagret på profilen din.
          </p>
        </div>
      </div>

      {earnedBadges.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {earnedBadges.map((b) => {
            const Icon = BADGE_ICON[b.icon]
            return (
              <li
                key={b.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200/80 px-3 py-4 text-center"
                style={{ backgroundColor: CREAM_TILE }}
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  <Icon className="size-5" />
                </span>
                <p className="text-xs font-semibold text-neutral-900">{b.label}</p>
                <p className="text-[11px] leading-snug text-neutral-600">{b.description}</p>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
        >
          Last ned kursbevis (PDF)
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Start på nytt
        </button>
      </div>
    </div>
  )
}

function HjemLessonBody({
  mod,
  quizAnswers,
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  quizScore,
  reflections,
  setReflections,
}: {
  mod: MockModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  quizSubmitted: boolean
  setQuizSubmitted: (v: boolean) => void
  quizScore: { right: number; total: number; ratio: number } | null
  reflections: Record<string, string>
  setReflections: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  if (mod.kind === 'text') {
    return (
      <div className="space-y-5">
        <p className="text-lg leading-relaxed text-neutral-800">{mod.lead}</p>
        {mod.body.map((p, i) => (
          <p key={i} className="text-[15px] leading-[1.75] text-neutral-700">
            {p}
          </p>
        ))}
        <aside
          className="rounded-xl border p-5"
          style={{ backgroundColor: `${GREEN}06`, borderColor: `${GREEN}26` }}
        >
          <div
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: GREEN }}
          >
            <Award className="size-3.5" /> Nøkkelpunkter
          </div>
          <ul className="mt-3 space-y-2">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-800">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color: GREEN }} />
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    )
  }

  if (mod.kind === 'quiz') {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-neutral-700">{mod.intro}</p>
        {mod.questions.map((q, qi) => {
          const picked = quizAnswers[q.id]
          return (
            <fieldset key={q.id} className="space-y-2.5">
              <legend className="text-base font-semibold text-neutral-900">
                {qi + 1}. {q.question}
              </legend>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => {
                  const selected = picked === oi
                  const right = quizSubmitted && oi === q.correctIndex
                  const wrong = quizSubmitted && selected && oi !== q.correctIndex
                  return (
                    <label
                      key={oi}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-neutral-900 transition"
                      style={{
                        borderColor: right
                          ? GREEN
                          : wrong
                            ? '#b3382a'
                            : selected
                              ? GREEN
                              : '#e8e2d2',
                        backgroundColor: right
                          ? `${GREEN}10`
                          : wrong
                            ? '#b3382a10'
                            : selected
                              ? `${GREEN}08`
                              : 'white',
                      }}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        disabled={quizSubmitted}
                        className="mt-0.5 size-4"
                        style={{ accentColor: GREEN }}
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
              {quizSubmitted ? (
                <p className="rounded-md border border-neutral-200 bg-[#fbf9f3] px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
                  {q.explanation}
                </p>
              ) : null}
            </fieldset>
          )
        })}
        {!quizSubmitted ? (
          <button
            type="button"
            onClick={() => setQuizSubmitted(true)}
            disabled={Object.keys(quizAnswers).length < mod.questions.length}
            className="rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Sjekk svarene
          </button>
        ) : quizScore ? (
          <div
            className="flex items-start gap-3 rounded-lg border p-4"
            style={{
              borderColor: quizScore.ratio >= 2 / 3 ? `${GREEN}40` : '#b3382a40',
              backgroundColor: quizScore.ratio >= 2 / 3 ? `${GREEN}08` : '#b3382a08',
            }}
          >
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0"
              style={{ color: quizScore.ratio >= 2 / 3 ? GREEN : '#b3382a' }}
            />
            <div className="text-sm">
              <p className="font-semibold text-neutral-900">
                {quizScore.right} av {quizScore.total} riktig
              </p>
              <p className="mt-1 text-neutral-700">
                {quizScore.ratio >= 2 / 3 ? 'Bestått. Klar for neste modul.' : 'Prøv på nytt.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-neutral-700">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block text-[15px] font-semibold text-neutral-900">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ outlineColor: GREEN }}
            />
            <p className="text-right text-[11px] text-neutral-500">
              {v.length} tegn · minst 10 for å gå videre
            </p>
          </div>
        )
      })}
    </div>
  )
}

function DesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-bold uppercase tracking-wider hover:underline"
        style={{ color: GREEN }}
      >
        {open ? 'Skjul' : 'Vis'} designnotater
      </button>
      {open ? (
        <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-neutral-700 md:grid-cols-2">
          <li>
            <strong className="text-neutral-900">Kurset bor på hjemmesiden.</strong> Speiler
            WelcomeDashboardPage-mønsteret: serif «Velkommen tilbake»-headline, Hjem/Klassisk
            faner, 7fr/3fr-deling, krempapir.
          </li>
          <li>
            <strong className="text-neutral-900">«Neste på listen» = leksjons-kortet.</strong>
            Modulen sklir inn på samme posisjon som dagens oppgaveliste — null kontekstsbytte mellom
            arbeid og læring.
          </li>
          <li>
            <strong className="text-neutral-900">Frontpage-widgets beholdt.</strong> Denne uken
            (kalender + læringsmål), Varsler (merker + refleksjoner) og Snarveier (innhold, notater,
            kursbevis) er de samme widgetene som /app — bare kalibrert mot kurs-data.
          </li>
          <li>
            <strong className="text-neutral-900">Snarveier · Innhold = inline-utvidelse.</strong>
            Klikk på Innhold åpner module-listen rett under, framfor å laste en popover. Matcher
            hjemmesidens «smal og rolig sidekol.»-følelse.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
