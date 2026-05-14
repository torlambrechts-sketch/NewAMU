// Alternative 3 — "Coach Sidekick" (admin theme). Refactored to live inside the
// platform-admin slate-950/amber shell with a 7fr/3fr dashboard split. Anne
// (HMS-rådgiver) lives in the right rail as a stack of admin-style cards. Her
// magenta persona accent is preserved only on her avatar — every other accent
// switches to amber to stay native to platform-admin.

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

const COACH_PERSONA = '#d946ef'

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
    if (mod.kind === 'reflection' && !canAdvance) return 'Skriv minst 10 tegn i hvert felt under «I praksis».'
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
    <div className="space-y-6 pb-20">
      {/* Header band */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/platform-admin/course-player"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white"
          >
            <ChevronLeft className="size-3.5" /> Tilbake til oversikt
          </Link>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-500/90">
            Kursspiller · Alternativ 3 — Coach Sidekick
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{course.title}</h1>
          <p className="mt-1 text-sm text-neutral-400">{course.audience}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="font-semibold text-white">{completedCount}</span>
            <span className="text-neutral-500"> / {total} fullført</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-amber-300">
            <Sparkles className="size-3" /> {earnedPoints} XP
          </span>
        </div>
      </header>

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
        {/* Left: lesson */}
        {finished ? (
          <CoachFinishedCard
            course={course}
            earnedPoints={earnedPoints}
            earnedBadges={earnedBadges}
            onRestart={resetAll}
          />
        ) : (
          <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-7 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-500/90">
                {mod.eyebrow}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
                  {moduleTimeLabel(mod.durationMinutes)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  <Sparkles className="size-3" /> +{mod.points} XP
                </span>
                {mod.lawRefs.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-neutral-300"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-7 py-8 md:px-9 md:py-10">
              <h2 className="text-2xl font-semibold leading-tight text-white">{mod.title}</h2>
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

        {/* Right: Anne's panel */}
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

      {/* Sticky bottom pager */}
      {!finished ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-slate-950/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-8">
            <button
              type="button"
              onClick={back}
              disabled={idx === 0}
              aria-label="Forrige modul (pil venstre)"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Forrige
            </button>
            <p
              id="coach-disabled-hint"
              className="hidden flex-1 text-center text-xs sm:block"
              style={{ color: disabledHint ? '#fca5a5' : undefined }}
              role={disabledHint ? 'status' : undefined}
              aria-live={disabledHint ? 'polite' : undefined}
            >
              <span className="text-neutral-500">
                {disabledHint ??
                  (nextMod
                    ? `Anne sier: «Neste opp er ${nextMod.title}» (${moduleKindLabel(nextMod.kind)}, ${moduleTimeLabel(nextMod.durationMinutes)}).`
                    : 'Siste etappe – kursbeviset utstedes når du fullfører.')}
              </span>
            </p>
            <button
              type="button"
              onClick={advance}
              disabled={!canAdvance}
              aria-describedby={disabledHint ? 'coach-disabled-hint' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {idx === total - 1 ? 'Fullfør kurset' : 'Marker fullført og fortsett'}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      <DesignNotes />
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
              className="group flex w-full flex-col gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
            >
              <span
                className="h-1 w-full rounded-full transition-all"
                style={{
                  backgroundColor: done
                    ? '#fbbf24'
                    : isCurrent
                      ? 'rgba(251,191,36,0.45)'
                      : 'rgba(255,255,255,0.10)',
                }}
              />
              <span
                className={`text-[11px] font-medium ${
                  isCurrent ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-md shadow-black/30"
          style={{ backgroundColor: COACH_PERSONA }}
        >
          A
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Anne · HMS-rådgiver</p>
          <p className="text-[11px] text-neutral-400">Din coach gjennom dette kurset</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
          <MessageCircle className="size-3" /> Snakker nå
        </span>
      </div>
      {prevModule ? (
        <div
          role="status"
          aria-live="polite"
          className="relative mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[13px] leading-relaxed text-neutral-200"
        >
          Bra jobba med <strong className="text-white">«{prevModule.title}»</strong> — du tjente{' '}
          <strong className="font-semibold text-amber-300">+{prevModule.points} XP</strong>.
        </div>
      ) : null}
      <div className="relative mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-[14px] leading-relaxed text-neutral-100">
        {mod.coachIntro}
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        <CalendarDays className="size-4 text-amber-400" /> Dagens program
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
                className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400 ${
                  isCurrent
                    ? 'border-amber-400/40 bg-amber-500/10'
                    : isNext
                      ? 'border-dashed border-white/15 bg-white/[0.02]'
                      : 'border-transparent hover:bg-white/5'
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    done
                      ? 'bg-amber-500 text-slate-900'
                      : isCurrent
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/5 text-neutral-400'
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="flex-1 space-y-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isCurrent ? 'text-amber-300' : 'text-neutral-500'
                      }`}
                    >
                      Stopp {i + 1} · {moduleKindLabel(m.kind)}
                    </span>
                    {isNext ? (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-900">
                        Neste
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[13px] font-medium text-neutral-100">{m.title}</span>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        <BadgeCheck className="size-4 text-amber-400" /> Etter denne modulen kan du
      </div>
      <ul className="mt-3 space-y-2">
        {outcomes.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-200">
            <Check className="mt-0.5 size-4 shrink-0 text-amber-400" />
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <Sparkles className="size-4 text-amber-400" /> Poeng & merker
        </div>
        <span className="text-sm font-semibold text-white">
          <span className="text-amber-300">{earnedPoints}</span>
          <span className="text-neutral-500"> / {course.totalPoints} XP</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-amber-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {course.badges.map((b) => {
          const earned = !!completed[b.awardedAtModuleId]
          const Icon = BADGE_ICON[b.icon]
          return (
            <li
              key={b.id}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                earned ? 'bg-amber-500/10' : ''
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  earned
                    ? 'bg-amber-500 text-slate-900'
                    : 'border border-dashed border-white/15 text-neutral-500'
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${earned ? 'text-white' : 'text-neutral-500'}`}>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        <Quote className="size-4 text-amber-400" /> {fact.title}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{fact.body}</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`coach-reflect-${modId}`}
          className="text-xs font-medium uppercase tracking-wide text-neutral-500"
        >
          Privat notat
        </label>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
          Valgfritt
        </span>
      </div>
      <p className="mt-1 text-sm text-white">Hva tar du med deg fra denne modulen?</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">
        Synes bare for deg. Påvirker ikke kursfullføring.
      </p>
      <textarea
        id={`coach-reflect-${modId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Én setning er nok."
        className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
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
        <p className="text-lg leading-relaxed text-neutral-100">{mod.lead}</p>
        {mod.body.map((p, i) => (
          <p key={i} className="text-[15px] leading-[1.75] text-neutral-300">
            {p}
          </p>
        ))}
        <aside className="rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-300">
            <Award className="size-3.5" /> Nøkkelpunkter
          </div>
          <ul className="mt-3 space-y-2">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-200">
                <Check className="mt-0.5 size-4 shrink-0 text-amber-400" />
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
        <p className="text-sm leading-relaxed text-neutral-300">{mod.intro}</p>
        {mod.questions.map((q, qi) => {
          const picked = quizAnswers[q.id]
          return (
            <fieldset key={q.id} className="space-y-2.5">
              <legend className="text-base font-semibold text-white">
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
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-amber-400 ${
                        right
                          ? 'border-amber-400/60 bg-amber-500/15 text-white'
                          : wrong
                            ? 'border-red-400/50 bg-red-500/10 text-white'
                            : selected
                              ? 'border-amber-400 bg-amber-500/10 text-white'
                              : 'border-white/10 bg-white/[0.03] text-neutral-200 hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        disabled={quizSubmitted}
                        className="mt-0.5 size-4 accent-amber-500"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
              {quizSubmitted ? (
                <p className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-neutral-200">
                  <strong className="text-white">Anne:</strong> {q.explanation}
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
            className="rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
          >
            Sjekk svarene
          </button>
        ) : quizScore ? (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              quizScore.ratio >= 2 / 3
                ? 'border-amber-400/30 bg-amber-500/10'
                : 'border-red-400/40 bg-red-500/10'
            }`}
          >
            <CheckCircle2
              className={`mt-0.5 size-5 shrink-0 ${
                quizScore.ratio >= 2 / 3 ? 'text-amber-300' : 'text-red-300'
              }`}
            />
            <div className="text-sm">
              <p className="font-semibold text-white">
                {quizScore.right} av {quizScore.total} riktig
              </p>
              <p className="mt-1 text-neutral-300">
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
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:underline"
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
      <p className="text-sm leading-relaxed text-neutral-300">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block text-[15px] font-semibold text-white">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
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
      className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-8 lg:col-span-2"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-md shadow-black/30"
          style={{ backgroundColor: COACH_PERSONA }}
        >
          A
        </div>
        <div className="flex-1 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            <PartyPopper className="size-3.5" /> Anne · HMS-rådgiver
          </p>
          <h2 className="text-xl font-semibold text-white">Bra jobba — kurset er ferdig.</h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            Du tjente{' '}
            <strong className="text-amber-300">
              {earnedPoints} av {course.totalPoints} XP
            </strong>{' '}
            og låste opp{' '}
            <strong className="text-amber-300">
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
                    className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-900">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-white">{b.label}</span>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              Last ned kursbevis (PDF)
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
            >
              Start på nytt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold uppercase tracking-wide text-amber-400/90 hover:text-amber-300"
      >
        {open ? 'Skjul' : 'Vis'} designnotater
      </button>
      {open ? (
        <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-neutral-300 md:grid-cols-2">
          <li>
            <strong className="text-white">Native i platform-admin.</strong> Samme kort
            (<code>rounded-2xl border-white/10 bg-white/5</code>), samme amber-aksent og samme
            7fr/3fr-deling som <code>WorkplaceSplit7030Layout</code>.
          </li>
          <li>
            <strong className="text-white">Anne forblir Anne.</strong> Persona-fargen
            (magenta-avatar) er beholdt for å skille mennesket fra UI-aksenten — alt annet er
            amber.
          </li>
          <li>
            <strong className="text-white">Persistent pager.</strong> Fortsett-knappen følger med
            i bunn — den ligger ikke skjult inne i kortet, slik at den alltid er innenfor
            tommelrekkevidde.
          </li>
          <li>
            <strong className="text-white">Sosial uten å være sosial-mediafølelse.</strong> Anne
            kvitterer på forrige modul i sin egen boble, men det er ingen «likes» eller
            leaderboard.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
