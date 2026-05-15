// Alternative 3 — "Coach Sidekick" (app theme, Pinpoint-styled). Refactored to
// match the primary-app visual language used on /app frontpage and
// risiko-sikkerhet, with Pinpoint-style editorial accents: cream paper bg,
// Libre Baskerville serif headlines, KPI tiles, atics-green primary, white
// paper cards with neutral borders, and a salmon callout for Anne's
// "snakker nå" status. Anne keeps her magenta persona on the avatar only.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Compass,
  FileText,
  HelpCircle,
  MessageCircle,
  PartyPopper,
  PenLine,
  Quote,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
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
const GOLD = '#c9a227'
const PAPER_BG = '#F9F7F2'
const CREAM_TILE = '#f2eee6'
const SALMON_BG = '#f6dcd0'
const SALMON_TEXT = '#7c2d12'
const MINT_BG = '#d6ebd8'
const MINT_TEXT = '#1f5f3c'
const COACH_PERSONA = '#a21caf'

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

export function PlatformCoursePlayerCoachPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [coachReflection, setCoachReflection] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const earnedPoints = course.modules.reduce(
    (sum, m) => (completed[m.id] ? sum + m.points : sum),
    0,
  )
  const earnedBadges = course.badges.filter((b) => completed[b.awardedAtModuleId])
  const prevCompleted = idx > 0 && completed[course.modules[idx - 1].id]
  const prevModule = idx > 0 ? course.modules[idx - 1] : null
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

  const disabledHint = (() => {
    if (mod.kind === 'quiz' && !quizSubmitted) return 'Sjekk svarene først.'
    if (mod.kind === 'quiz' && quizScore && quizScore.ratio < 2 / 3)
      return 'Du må ha minst 2 riktige for å gå videre.'
    if (mod.kind === 'reflection' && !canAdvance) return 'Skriv minst 10 tegn i hvert felt.'
    return null
  })()

  function resetAll() {
    setFinished(false)
    setIdx(0)
    setCompleted({})
    setQuizAnswers({})
    setQuizSubmitted(false)
    setReflections({})
    setCoachReflection({})
  }

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div
        className="min-h-[calc(100vh-100px)] pb-24 text-neutral-900"
        style={{ backgroundColor: PAPER_BG }}
      >
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
          {/* Breadcrumb + serif H1 */}
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                to="/platform-admin/course-player"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700"
              >
                <ChevronLeft className="size-3.5" /> Tilbake til oversikt
              </Link>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                E-læring · Internkontroll
              </p>
              <h1
                className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                style={{ fontFamily: SERIF }}
              >
                {course.title}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{course.audience}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{ backgroundColor: MINT_BG, color: MINT_TEXT }}
              >
                <CheckCircle2 className="size-3" />
                {completedCount} av {total} fullført
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11px] font-semibold"
                style={{ borderColor: `${GREEN}33`, color: GREEN }}
              >
                <Sparkles className="size-3" /> {earnedPoints} XP
              </span>
            </div>
          </header>

          {/* KPI tile strip — Pinpoint style */}
          <KpiStrip
            completedCount={completedCount}
            total={total}
            earnedPoints={earnedPoints}
            totalPoints={course.totalPoints}
            badgesEarned={earnedBadges.length}
            badgesTotal={course.badges.length}
            currentEyebrow={mod.eyebrow}
          />

          {/* Chapter strip */}
          <ChapterStrip
            course={course}
            currentIdx={idx}
            completed={completed}
            onPick={(i) => {
              setIdx(i)
              setQuizSubmitted(false)
            }}
          />

          {/* 70 / 30 split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
            {finished ? (
              <CoachFinishedCard
                course={course}
                earnedPoints={earnedPoints}
                earnedBadges={earnedBadges}
                onRestart={resetAll}
              />
            ) : (
              <article className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
                {/* Top atics-green accent rule, Pinpoint-style */}
                <div className="h-0.5 w-full" style={{ backgroundColor: GREEN }} aria-hidden />

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-7 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {mod.eyebrow}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-neutral-200 bg-[#f7f5ee] px-2 py-0.5 text-[11px] text-neutral-700">
                      {moduleTimeLabel(mod.durationMinutes)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: `${GREEN}15`, color: GREEN }}
                    >
                      <Sparkles className="size-3" /> +{mod.points} XP
                    </span>
                    {mod.lawRefs.map((r) => (
                      <span
                        key={r}
                        className="rounded-md border border-neutral-200 bg-[#f7f5ee] px-2 py-0.5 font-mono text-[11px] text-neutral-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-7 py-8 md:px-9 md:py-10">
                  <h2
                    className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                    style={{ fontFamily: SERIF }}
                  >
                    {mod.title}
                  </h2>
                  <div className="mt-5">
                    <CoachLessonBody
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
              </article>
            )}

            {/* Anne's right rail */}
            {!finished ? (
              <aside className="space-y-4 lg:sticky lg:top-6">
                <CoachIntroCard mod={mod} prevModule={prevCompleted ? prevModule : null} />
                <CoachAgendaCard
                  course={course}
                  currentIdx={idx}
                  completed={completed}
                  onPick={(i) => {
                    setIdx(i)
                    setQuizSubmitted(false)
                  }}
                />
                <CoachOutcomesCard outcomes={mod.learningOutcomes} />
                <CoachPointsCard
                  course={course}
                  earnedPoints={earnedPoints}
                  completed={completed}
                />
                <CoachFactCard fact={mod.coachFact} />
                <CoachReflectCard
                  value={coachReflection[mod.id] ?? ''}
                  onChange={(v) => setCoachReflection((p) => ({ ...p, [mod.id]: v }))}
                  modId={mod.id}
                />
              </aside>
            ) : null}
          </div>

          <DesignNotes />
        </div>

        {/* Sticky bottom pager — paper white pinned to bottom */}
        {!finished ? (
          <div
            className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200"
            style={{ backgroundColor: 'rgba(249,247,242,0.92)', backdropFilter: 'blur(8px)' }}
          >
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-8">
              <button
                type="button"
                onClick={back}
                disabled={idx === 0}
                aria-label="Forrige modul (pil venstre)"
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ outlineColor: GREEN }}
              >
                <ArrowLeft className="size-4" /> Forrige
              </button>
              <p
                id="coach-disabled-hint"
                className="hidden flex-1 text-center text-xs sm:block"
                role={disabledHint ? 'status' : undefined}
                aria-live={disabledHint ? 'polite' : undefined}
                style={{ color: disabledHint ? '#b3382a' : '#7a7466' }}
              >
                {disabledHint ??
                  (nextMod
                    ? `Anne sier: «Neste opp er ${nextMod.title}» (${moduleKindLabel(nextMod.kind)}, ${moduleTimeLabel(nextMod.durationMinutes)}).`
                    : 'Siste etappe – kursbeviset utstedes når du fullfører.')}
              </p>
              <button
                type="button"
                onClick={advance}
                disabled={!canAdvance}
                aria-describedby={disabledHint ? 'coach-disabled-hint' : undefined}
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: GREEN, outlineColor: GREEN }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
              >
                {idx === total - 1 ? 'Fullfør kurset' : 'Marker fullført og fortsett'}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function KpiStrip({
  completedCount,
  total,
  earnedPoints,
  totalPoints,
  badgesEarned,
  badgesTotal,
  currentEyebrow,
}: {
  completedCount: number
  total: number
  earnedPoints: number
  totalPoints: number
  badgesEarned: number
  badgesTotal: number
  currentEyebrow: string
}) {
  const items: { big: string; title: string; sub: string }[] = [
    { big: `${completedCount}/${total}`, title: 'Moduler', sub: 'Fullført i denne økten' },
    { big: `${earnedPoints}`, title: 'Poeng', sub: `av ${totalPoints} mulige` },
    { big: `${badgesEarned}/${badgesTotal}`, title: 'Merker', sub: 'Låst opp så langt' },
    { big: `${currentEyebrow.replace('Modul ', '')}`, title: 'Du står på', sub: 'Aktiv modul' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-xl border border-neutral-200/80 px-4 py-3 md:px-5 md:py-4"
          style={{ backgroundColor: CREAM_TILE }}
        >
          <p
            className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: SERIF }}
          >
            {it.big}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
            {it.title}
          </p>
          <p className="text-[11px] text-neutral-500">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

function ChapterStrip({
  course,
  currentIdx,
  completed,
  onPick,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPick: (i: number) => void
}) {
  return (
    <ol className="flex items-center gap-1.5">
      {course.modules.map((m, i) => {
        const done = completed[m.id]
        const isCurrent = i === currentIdx
        return (
          <li key={m.id} className="flex-1">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Modul ${i + 1}: ${m.title}${done ? ' (fullført)' : ''}`}
              className="group flex w-full flex-col gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ outlineColor: GREEN }}
            >
              <span
                className="h-1 w-full rounded-full transition-all"
                style={{
                  backgroundColor: done ? GREEN : isCurrent ? `${GREEN}66` : '#d6cfbe',
                }}
              />
              <span
                className={`text-[11px] font-medium ${
                  isCurrent ? 'text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-700'
                }`}
              >
                Modul {i + 1}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function CoachIntroCard({
  mod,
  prevModule,
}: {
  mod: MockModule
  prevModule: MockModule | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="h-0.5 w-full" style={{ backgroundColor: COACH_PERSONA }} aria-hidden />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
            style={{ backgroundColor: COACH_PERSONA }}
          >
            A
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Anne · HMS-rådgiver</p>
            <p className="text-[11px] text-neutral-500">Din coach gjennom dette kurset</p>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: SALMON_BG, color: SALMON_TEXT }}
          >
            <MessageCircle className="size-3" /> Snakker nå
          </span>
        </div>

        {prevModule ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border px-3 py-2 text-[13px] leading-relaxed text-neutral-800"
            style={{
              backgroundColor: `${GREEN}06`,
              borderColor: `${GREEN}22`,
            }}
          >
            Bra jobba med <strong className="text-neutral-900">«{prevModule.title}»</strong> — du
            tjente <strong style={{ color: GREEN }}>+{prevModule.points} XP</strong>.
          </div>
        ) : null}

        <p className="text-[14px] leading-relaxed text-neutral-800">{mod.coachIntro}</p>
      </div>
    </div>
  )
}

function CoachAgendaCard({
  course,
  currentIdx,
  completed,
  onPick,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPick: (i: number) => void
}) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <CalendarDays className="size-3.5" style={{ color: GREEN }} /> Dagens program
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        «Vi har tre stopp i dag. Klikk fritt — jeg holder tråden.»
      </p>
      <ol className="mt-3 space-y-1.5">
        {course.modules.map((m, i) => {
          const done = completed[m.id]
          const isCurrent = i === currentIdx
          const isNext = i === currentIdx + 1
          const Icon = KIND_ICON[m.kind]
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{
                  borderColor: isCurrent ? `${GREEN}33` : isNext ? '#dcd4be' : 'transparent',
                  backgroundColor: isCurrent ? `${GREEN}08` : isNext ? '#fbf9f3' : 'transparent',
                  borderStyle: isNext && !isCurrent ? 'dashed' : 'solid',
                  outlineColor: GREEN,
                }}
              >
                <span
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: done ? GREEN : isCurrent ? `${GREEN}1f` : '#f3eee0',
                    color: done ? 'white' : isCurrent ? GREEN : '#7a7466',
                  }}
                >
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="flex-1 space-y-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: isCurrent ? GREEN : '#7a7466' }}
                    >
                      Stopp {i + 1} · {moduleKindLabel(m.kind)}
                    </span>
                    {isNext ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ backgroundColor: MINT_BG, color: MINT_TEXT }}
                      >
                        Neste
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[13px] font-medium text-neutral-900">{m.title}</span>
                  <span className="block text-[10px] text-neutral-500">
                    {moduleTimeLabel(m.durationMinutes)} · +{m.points} XP
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function CoachOutcomesCard({ outcomes }: { outcomes: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <BadgeCheck className="size-3.5" style={{ color: GREEN }} /> Etter denne modulen kan du
      </div>
      <ul className="mt-3 space-y-2">
        {outcomes.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-800">
            <Check className="mt-0.5 size-4 shrink-0" style={{ color: GREEN }} />
            {o}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoachPointsCard({
  course,
  earnedPoints,
  completed,
}: {
  course: MockCourse
  earnedPoints: number
  completed: Record<string, boolean>
}) {
  const pct = (earnedPoints / course.totalPoints) * 100
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          <Sparkles className="size-3.5" style={{ color: GOLD }} /> Poeng & merker
        </div>
        <span className="text-sm font-semibold text-neutral-900">
          <span style={{ color: GREEN }}>{earnedPoints}</span>
          <span className="text-neutral-500"> / {course.totalPoints} XP</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: GREEN }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {course.badges.map((b) => {
          const earned = !!completed[b.awardedAtModuleId]
          const Icon = BADGE_ICON[b.icon]
          return (
            <li
              key={b.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              style={{ backgroundColor: earned ? `${GREEN}0a` : 'transparent' }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: earned ? GREEN : 'transparent',
                  border: earned ? 'none' : '1px dashed #c8c0a8',
                  color: earned ? 'white' : '#9c9580',
                }}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    earned ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {b.label}
                </p>
                <p className="truncate text-[10px] text-neutral-500">{b.description}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CoachFactCard({ fact }: { fact: { title: string; body: string } }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <Quote className="size-3.5" style={{ color: GOLD }} /> {fact.title}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{fact.body}</p>
    </div>
  )
}

function CoachReflectCard({
  value,
  onChange,
  modId,
}: {
  value: string
  onChange: (v: string) => void
  modId: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`coach-reflect-${modId}`}
          className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
        >
          Privat notat
        </label>
        <span className="rounded-full border border-neutral-200 bg-[#fbf9f3] px-2 py-0.5 text-[10px] text-neutral-500">
          Valgfritt
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-neutral-900">
        Hva tar du med deg fra denne modulen?
      </p>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        Synes bare for deg. Påvirker ikke kursfullføring.
      </p>
      <textarea
        id={`coach-reflect-${modId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Én setning er nok."
        className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
        style={{ outlineColor: GREEN }}
      />
    </div>
  )
}

function CoachLessonBody({
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
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-neutral-900 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
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
                        outlineColor: GREEN,
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
                <p className="rounded-md border border-neutral-200 bg-[#fbf9f3] px-3 py-2 text-[13px] leading-relaxed text-neutral-800">
                  <strong className="text-neutral-900">Anne:</strong> {q.explanation}
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
                {quizScore.ratio >= 2 / 3
                  ? 'Anne nikker. Du kan gå videre.'
                  : 'Ikke bestått ennå – Anne foreslår å gå tilbake til forrige modul først.'}
              </p>
              {quizScore.ratio < 2 / 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers(() => ({}))
                    setQuizSubmitted(false)
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                  style={{ color: GREEN }}
                >
                  <RotateCcw className="size-3.5" /> Prøv på nytt
                </button>
              ) : null}
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

function CoachFinishedCard({
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
      className="overflow-hidden rounded-xl border bg-white shadow-sm lg:col-span-2"
      style={{ borderColor: `${GREEN}40` }}
    >
      <div className="h-0.5 w-full" style={{ backgroundColor: GREEN }} aria-hidden />
      <div className="p-8">
        <div className="flex items-start gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
            style={{ backgroundColor: COACH_PERSONA }}
          >
            A
          </div>
          <div className="flex-1 space-y-2">
            <p
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: GREEN }}
            >
              <PartyPopper className="size-3.5" /> Anne · HMS-rådgiver
            </p>
            <h2
              className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Bra jobba — kurset er ferdig.
            </h2>
            <p className="text-sm leading-relaxed text-neutral-700">
              Du tjente{' '}
              <strong style={{ color: GREEN }}>
                {earnedPoints} av {course.totalPoints} XP
              </strong>{' '}
              og låste opp{' '}
              <strong style={{ color: GREEN }}>
                {earnedBadges.length} av {course.badges.length} merker
              </strong>
              . Refleksjonene dine er lagret på profilen, og kursbeviset er signert.
            </p>

            {earnedBadges.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {earnedBadges.map((b) => {
                  const Icon = BADGE_ICON[b.icon]
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5"
                      style={{ borderColor: `${GREEN}33` }}
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: GREEN }}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="text-xs font-semibold text-neutral-900">{b.label}</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      </div>
    </div>
  )
}

function DesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
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
            <strong className="text-neutral-900">Pinpoint-følelse.</strong> Krempapir-bakgrunn,
            Libre Baskerville-overskrifter, hvite paperkort med atics-green topp-aksent. Mint-
            og salmonpiller fra samme språk.
          </li>
          <li>
            <strong className="text-neutral-900">Anne forblir Anne.</strong> Magenta-avatar holdes
            som persona-farge — distinkt fra UI-aksenten — så hun leses som «en person» framfor
            «en knapp».
          </li>
          <li>
            <strong className="text-neutral-900">KPI-strip + 70/30.</strong> Speiler frontpage-
            pattern fra risiko-sikkerhet: serif-tall i krem-flate, 7fr-leksjon + 3fr-sidekick.
          </li>
          <li>
            <strong className="text-neutral-900">Sticky pager på krempapir.</strong> Fortsett-
            knappen følger med i bunn, men i samme paperflate som resten — ingen mørk admin-
            kontrast.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
