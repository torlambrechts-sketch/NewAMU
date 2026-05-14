// Alternative 3 — "Coach Sidekick". 60/40 split with a personified coach panel
// (Anne, HMS-rådgiver). Engagement comes from a real-sounding voice that frames
// each module, surfaces law refs, and asks reflection questions.

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

const ACCENT = '#a21caf'
const COACH_BG = '#f5e9f7'

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
  const earnedPoints = course.modules.reduce((sum, m) => (completed[m.id] ? sum + m.points : sum), 0)
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

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div className="min-h-[calc(100vh-100px)] bg-[#faf7f1] text-[#1f2421]">
        {/* Top utility band */}
        <div className="border-b border-[#ece5d3] bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
            <Link
              to="/platform-admin/course-player"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1f2421]/70 hover:text-[#1f2421]"
            >
              <ChevronLeft className="size-3.5" /> Tilbake til oversikt
            </Link>
            <div className="flex items-center gap-3 text-xs text-[#1f2421]/70">
              <span className="font-medium">{course.title}</span>
              <span aria-hidden>·</span>
              <span>
                <span className="font-semibold text-[#0f1311]">{completedCount}</span> av {total} fullført
              </span>
              <span aria-hidden>·</span>
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: ACCENT }}
              >
                <Sparkles className="size-3" /> {earnedPoints} XP
              </span>
            </div>
          </div>
        </div>

        {/* Chapter strip */}
        <div className="mx-auto max-w-[1100px] px-6 pt-8">
          <ol className="flex items-center gap-1.5">
            {course.modules.map((m, i) => {
              const done = completed[m.id]
              const isCurrent = i === idx
              return (
                <li key={m.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Gå til modul ${i + 1}: ${m.title}${done ? ' (fullført)' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className="group flex w-full flex-col gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a21caf]"
                  >
                    <span
                      className="h-1 w-full rounded-full transition-all"
                      style={{
                        backgroundColor: done
                          ? ACCENT
                          : isCurrent
                            ? `${ACCENT}55`
                            : '#e0d7c0',
                      }}
                    />
                    <span
                      className={`text-[11px] font-medium ${
                        isCurrent ? 'text-[#0f1311]' : 'text-[#1f2421]/55 group-hover:text-[#1f2421]/80'
                      }`}
                    >
                      Modul {i + 1}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Split layout */}
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1.6fr_1fr]">
          {finished ? (
            <div className="lg:col-span-2">
              <CoachFinishedBanner
                course={course}
                earnedPoints={earnedPoints}
                earnedBadges={earnedBadges}
                onRestart={() => {
                  setFinished(false)
                  setIdx(0)
                  setCompleted({})
                  setQuizAnswers({})
                  setQuizSubmitted(false)
                  setReflections({})
                  setCoachReflection({})
                }}
              />
            </div>
          ) : null}
          {!finished ? (
          <>
          {/* Lesson card */}
          <article className="rounded-3xl border border-[#ece5d3] bg-[#fdfcf7] p-8 shadow-sm">
            <header className="space-y-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-[2.5px]"
                style={{ color: ACCENT }}
              >
                {mod.eyebrow}
              </p>
              <h1 className="text-[28px] font-semibold leading-tight text-[#0f1311]">{mod.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#1f2421]/70">
                <span>{moduleTimeLabel(mod.durationMinutes)}</span>
                <span aria-hidden>·</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
                  style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
                >
                  <Sparkles className="size-3" /> +{mod.points} XP
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mod.lawRefs.map((r) => (
                    <span
                      key={r}
                      className="rounded-sm bg-[#efe9d8] px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            <hr className="my-6 border-[#ece5d3]" />

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
          </article>

          {/* Coach panel */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <CoachIntroCard
              mod={mod}
              prevModule={prevCompleted ? prevModule : null}
            />
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
          </>
          ) : null}
        </div>

        {/* Sticky bottom pager */}
        {!finished ? (
          <div className="sticky bottom-0 z-10 border-t border-[#ece5d3] bg-white/85 backdrop-blur">
            <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-3">
              <button
                type="button"
                onClick={back}
                disabled={idx === 0}
                aria-label="Gå til forrige modul (pil venstre)"
                className="inline-flex items-center gap-2 rounded-md border border-[#dcd4be] bg-white px-4 py-2 text-sm font-medium text-[#1f2421] hover:bg-[#faf7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a21caf] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-4" /> Forrige
              </button>
              <p
                id="coach-disabled-hint"
                className="hidden flex-1 text-center text-xs sm:block"
                style={{ color: disabledHint ? '#b3382a' : '#1f2421a0' }}
                role={disabledHint ? 'status' : undefined}
                aria-live={disabledHint ? 'polite' : undefined}
              >
                {disabledHint ??
                  (nextMod
                    ? `Anne sier: «Neste opp er ${nextMod.title}» (${moduleKindLabel(nextMod.kind)}, ${moduleTimeLabel(nextMod.durationMinutes)}).`
                    : 'Siste etappe – kursbeviset ditt utstedes når du fullfører.')}
              </p>
              <button
                type="button"
                onClick={advance}
                disabled={!canAdvance}
                aria-describedby={disabledHint ? 'coach-disabled-hint' : undefined}
                className="inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a21caf] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {idx === total - 1 ? 'Fullfør kurset' : 'Marker fullført og fortsett'}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        <CoachDesignNotes />
      </div>
    </div>
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
    <div className="rounded-2xl p-5" style={{ backgroundColor: COACH_BG }}>
      <div className="flex items-start gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          A
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#0f1311]">Anne · HMS-rådgiver</p>
          <p className="text-[11px] text-[#1f2421]/65">Din coach gjennom dette kurset</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[#1f2421]/70">
          <MessageCircle className="size-3" /> Snakker nå
        </span>
      </div>
      {prevModule ? (
        <div
          role="status"
          aria-live="polite"
          className="relative mt-4 rounded-xl bg-white/80 p-3 text-[13px] leading-relaxed text-[#1f2421] shadow-sm"
        >
          <span className="absolute -top-1.5 left-6 size-3 rotate-45 bg-white/80" aria-hidden />
          Bra jobba med <strong className="font-semibold text-[#0f1311]">«{prevModule.title}»</strong>{' '}
          — du tjente <strong className="font-semibold" style={{ color: ACCENT }}>+{prevModule.points} XP</strong>.
        </div>
      ) : null}
      <div className="relative mt-3 rounded-xl bg-white p-4 text-[14px] leading-relaxed text-[#1f2421] shadow-sm">
        <span className="absolute -top-1.5 left-6 size-3 rotate-45 bg-white" aria-hidden />
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
    <div className="rounded-2xl border border-[#ece5d3] bg-white p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <CalendarDays className="size-3.5" style={{ color: ACCENT }} />
        Dagens program
      </div>
      <p className="mt-1 text-[11px] text-[#1f2421]/55">
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
                className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a21caf] ${
                  isCurrent
                    ? 'border-[#a21caf]/40 bg-[#faf2fc]'
                    : isNext
                      ? 'border-dashed border-[#dcd4be] bg-[#fdfcf7]'
                      : 'border-transparent hover:bg-[#faf7f1]'
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    done
                      ? 'bg-[#a21caf] text-white'
                      : isCurrent
                        ? 'bg-[#a21caf]/15 text-[#a21caf]'
                        : 'bg-[#efe9d8] text-[#1f2421]/55'
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="flex-1 space-y-0.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[1.5px] ${
                        isCurrent ? 'text-[#a21caf]' : 'text-[#1f2421]/45'
                      }`}
                    >
                      Stopp {i + 1} · {moduleKindLabel(m.kind)}
                    </span>
                    {isNext ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Neste
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[13px] font-medium text-[#0f1311]">{m.title}</span>
                  <span className="block text-[10px] text-[#1f2421]/55">
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
    <div className="rounded-2xl border border-[#ece5d3] bg-[#fdfcf7] p-5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
          <Sparkles className="size-3.5" style={{ color: ACCENT }} />
          Poeng & merker
        </div>
        <span className="text-sm font-semibold text-[#0f1311]">
          <span style={{ color: ACCENT }}>{earnedPoints}</span>
          <span className="text-[#1f2421]/50"> / {course.totalPoints} XP</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#efe9d8]">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
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
                earned ? 'bg-[#faf2fc]' : ''
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  earned
                    ? 'bg-[#a21caf] text-white'
                    : 'border border-dashed border-[#dcd4be] text-[#1f2421]/35'
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    earned ? 'text-[#0f1311]' : 'text-[#1f2421]/45'
                  }`}
                >
                  {b.label}
                </p>
                <p className="truncate text-[10px] text-[#1f2421]/55">{b.description}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CoachOutcomesCard({ outcomes }: { outcomes: string[] }) {
  return (
    <div className="rounded-2xl border border-[#ece5d3] bg-white p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <BadgeCheck className="size-3.5" style={{ color: ACCENT }} />
        Etter denne modulen kan du
      </div>
      <ul className="mt-3 space-y-2">
        {outcomes.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-[#1f2421]">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: ACCENT }}
            />
            {o}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CoachFactCard({ fact }: { fact: { title: string; body: string } }) {
  return (
    <div className="rounded-2xl border border-[#ece5d3] bg-[#fdfcf7] p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
        <Quote className="size-3.5" style={{ color: ACCENT }} />
        {fact.title}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#1f2421]/85">{fact.body}</p>
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
    <div className="rounded-2xl border border-[#ece5d3] bg-white p-5">
      <div className="flex items-center justify-between">
        <label htmlFor={`coach-reflect-${modId}`} className="block text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
          Privat notat
        </label>
        <span className="rounded-full bg-[#efe9d8] px-2 py-0.5 text-[10px] font-medium text-[#1f2421]/70">
          Valgfritt
        </span>
      </div>
      <p className="mt-1 text-sm text-[#0f1311]">Hva tar du med deg fra denne modulen?</p>
      <p className="mt-0.5 text-[11px] text-[#1f2421]/55">
        Synes bare for deg. Påvirker ikke kursfullføring.
      </p>
      <textarea
        id={`coach-reflect-${modId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Én setning er nok."
        className="mt-3 w-full rounded-lg border border-[#dcd4be] bg-[#fdfcf7] px-3 py-2 text-sm text-[#1f2421] placeholder:text-[#1f2421]/40 focus:border-[#a21caf] focus:outline-none focus:ring-2 focus:ring-[#a21caf]/15"
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
        <p className="text-lg leading-relaxed text-[#0f1311]">{mod.lead}</p>
        {mod.body.map((p, i) => (
          <p key={i} className="text-[16px] leading-[1.7] text-[#2a2f2b]">
            {p}
          </p>
        ))}
        <div className="mt-2 rounded-xl border border-dashed border-[#dcd4be] bg-[#faf7f1] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[#1f2421]/70">
            Nøkkelpunkter
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-[#1f2421]">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color: ACCENT }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (mod.kind === 'quiz') {
    return (
      <div className="space-y-5">
        <p className="text-[15px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
        {mod.questions.map((q, qi) => {
          const picked = quizAnswers[q.id]
          return (
            <fieldset key={q.id} className="space-y-2.5">
              <legend className="text-[15px] font-semibold text-[#0f1311]">
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
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border bg-white px-3 py-2.5 text-sm transition ${
                        right
                          ? 'border-[#a21caf] bg-[#a21caf]/5'
                          : wrong
                            ? 'border-[#b3382a] bg-[#b3382a]/5'
                            : selected
                              ? 'border-[#a21caf]'
                              : 'border-[#dcd4be] hover:border-[#a21caf]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        disabled={quizSubmitted}
                        className="mt-0.5 size-4 accent-[#a21caf]"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
              {quizSubmitted ? (
                <p className="rounded-md bg-[#faf2fc] px-3 py-2 text-[13px] leading-relaxed text-[#1f2421]">
                  <strong className="text-[#0f1311]">Anne:</strong> {q.explanation}
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
            className="inline-flex items-center gap-2 rounded-md border border-[#a21caf] bg-white px-4 py-2 text-sm font-semibold text-[#a21caf] hover:bg-[#a21caf]/5 disabled:opacity-40"
          >
            Sjekk svarene
          </button>
        ) : quizScore ? (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              quizScore.ratio >= 2 / 3
                ? 'border-[#a21caf]/30 bg-[#a21caf]/5'
                : 'border-[#b3382a]/30 bg-[#b3382a]/5'
            }`}
          >
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0"
              style={{ color: quizScore.ratio >= 2 / 3 ? ACCENT : '#b3382a' }}
            />
            <div className="text-sm">
              <p className="font-semibold text-[#0f1311]">
                {quizScore.right} av {quizScore.total} riktig
              </p>
              <p className="mt-1 text-[#1f2421]/80">
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
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#a21caf] hover:underline"
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
      <p className="text-[15px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block text-[15px] font-semibold text-[#0f1311]">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-lg border border-[#dcd4be] bg-white px-3 py-2.5 text-sm text-[#1f2421] placeholder:text-[#1f2421]/40 focus:border-[#a21caf] focus:outline-none focus:ring-2 focus:ring-[#a21caf]/20"
            />
            <p className="text-right text-[11px] text-[#1f2421]/50">
              {v.length} tegn · minst 10 for å gå videre
            </p>
          </div>
        )
      })}
    </div>
  )
}

function CoachFinishedBanner({
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
      className="rounded-3xl border bg-white p-8 shadow-sm"
      style={{ borderColor: `${ACCENT}40` }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          A
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: ACCENT }}>
            Anne · HMS-rådgiver
          </p>
          <h2 className="text-xl font-semibold text-[#0f1311]">Bra jobba — kurset er ferdig.</h2>
          <p className="text-sm leading-relaxed text-[#1f2421]/80">
            Du tjente{' '}
            <strong className="text-[#0f1311]">
              {earnedPoints} av {course.totalPoints} kompetansepoeng
            </strong>{' '}
            og låste opp{' '}
            <strong className="text-[#0f1311]">
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
                    className="flex items-center gap-2 rounded-full bg-[#faf2fc] px-3 py-1.5"
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-[#0f1311]">{b.label}</span>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: ACCENT }}
            >
              Last ned kursbevis (PDF)
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-2 rounded-md border border-[#dcd4be] bg-white px-4 py-2 text-sm font-medium text-[#1f2421] hover:bg-[#faf7f1]"
            >
              Start på nytt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CoachDesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[#ece5d3] bg-[#fdfcf7]">
      <div className="mx-auto max-w-[1100px] px-6 py-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-semibold uppercase tracking-[1.5px]"
          style={{ color: ACCENT }}
        >
          {open ? 'Skjul' : 'Vis'} designnotater
        </button>
        {open ? (
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-[#1f2421]/80 md:grid-cols-2">
            <li>
              <strong>Persona reduserer kognitiv last.</strong> En tydelig «kilde» (Anne) gjør at
              forklaringer leses som veiledning, ikke som regler – øker villigheten til å spørre tilbake.
            </li>
            <li>
              <strong>Sticky bunn-pager.</strong> Refleksjonsfeltet i sidepanelet kan bli langt;
              hovedhandlingene følger alltid med ned.
            </li>
            <li>
              <strong>Læringsutbytte synliggjøres.</strong> «Etter denne modulen kan du …» gir
              progressjons-forventning før innholdet starter (forventningsstyring).
            </li>
            <li>
              <strong>Hovedkanal + sidekanal.</strong> 60/40 holder lesetekst innenfor anbefalt
              tegnbredde, samtidig som coach-panelet får plass uten å trenge modal.
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  )
}
