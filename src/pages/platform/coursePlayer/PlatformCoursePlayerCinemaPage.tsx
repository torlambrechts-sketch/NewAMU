// Alternative 2 — "Cinema Card" (app theme). This preview lives under
// /platform-admin/course-player/cinema but renders in the primary-app visual
// language: #F9F7F2 cream, white paper cards (rounded-xl border-neutral-200/80
// bg-white shadow-sm), #1a3d32 atics-green primary, Libre Baskerville serif
// titles. The intent is to show how the real /app course player would look —
// the dark platform-admin chrome is escaped with -mx- so this is a full-bleed
// app surface.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  Compass,
  FileText,
  HelpCircle,
  ListChecks,
  PartyPopper,
  PenLine,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  MOCK_COURSE,
  moduleKindLabel,
  moduleTimeLabel,
  type MockBadge,
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

export function PlatformCoursePlayerCinemaPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({})
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [xpToast, setXpToast] = useState<number | null>(null)
  const [badgeToast, setBadgeToast] = useState<MockBadge | null>(null)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [finished, setFinished] = useState(false)

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const overall = completedCount / total
  const earnedPoints = course.modules.reduce(
    (sum, m) => (completed[m.id] ? sum + m.points : sum),
    0,
  )
  const earnedBadges = course.badges.filter((b) => completed[b.awardedAtModuleId])
  const nextMod = idx < total - 1 ? course.modules[idx + 1] : null
  const sessionXp = course.level.currentXp + earnedPoints
  const levelPct = Math.min(1, sessionXp / course.level.nextLevelXp)

  const canAdvance = useMemo(() => {
    if (mod.kind === 'quiz') {
      const submitted = quizSubmitted[mod.id]
      if (!submitted) return false
      const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
      return right / mod.questions.length >= 2 / 3
    }
    if (mod.kind === 'reflection') {
      return mod.prompts.every((p) => (reflections[p.id] ?? '').trim().length >= 10)
    }
    return true
  }, [mod, quizAnswers, quizSubmitted, reflections])

  const disabledHint = (() => {
    if (mod.kind === 'quiz' && !quizSubmitted[mod.id]) return 'Sjekk svarene først.'
    if (mod.kind === 'quiz' && quizSubmitted[mod.id]) {
      const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
      if (right / mod.questions.length < 2 / 3) return 'Du må ha minst 2 riktige for å gå videre.'
    }
    if (mod.kind === 'reflection' && !canAdvance) return 'Skriv minst 10 tegn i hvert felt.'
    return null
  })()

  function advance() {
    setCompleted((c) => ({ ...c, [mod.id]: true }))
    setXpToast(mod.points)
    if (mod.badgeOnComplete) {
      const b = course.badges.find((x) => x.id === mod.badgeOnComplete)
      if (b) setBadgeToast(b)
    }
    if (idx < total - 1) {
      setTimeout(() => {
        setDirection('forward')
        setIdx(idx + 1)
      }, 200)
    } else {
      setTimeout(() => setFinished(true), 250)
    }
  }

  function goBack() {
    if (idx > 0) {
      setDirection('backward')
      setIdx(idx - 1)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') goBack()
      if (e.key === 'ArrowRight' && canAdvance) advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, canAdvance])

  useEffect(() => {
    if (xpToast === null) return
    const t = setTimeout(() => setXpToast(null), 1800)
    return () => clearTimeout(t)
  }, [xpToast])

  useEffect(() => {
    if (!badgeToast) return
    const t = setTimeout(() => setBadgeToast(null), 2600)
    return () => clearTimeout(t)
  }, [badgeToast])

  function resetAll() {
    setFinished(false)
    setIdx(0)
    setCompleted({})
    setQuizAnswers({})
    setQuizSubmitted({})
    setReflections({})
  }

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div
        className="min-h-[calc(100vh-100px)] text-neutral-900"
        style={{ backgroundColor: PAPER_BG }}
      >
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
          {/* Breadcrumb + serif H1 + level pill */}
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

            <div className="flex items-center gap-3">
              <LevelMeter
                level={course.level.levelNumber}
                label={course.level.levelLabel}
                sessionXp={sessionXp}
                nextLevelXp={course.level.nextLevelXp}
                pct={levelPct}
              />
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <X className="size-4" /> Avslutt
              </button>
            </div>
          </header>

          {/* KPI tile strip (mirrors LayoutScoreStatRow used on risiko-sikkerhet) */}
          <KpiStrip
            completedCount={completedCount}
            total={total}
            earnedPoints={earnedPoints}
            totalPoints={course.totalPoints}
            sessionXp={sessionXp}
            levelLabel={course.level.levelLabel}
            badgesEarned={earnedBadges.length}
            badgesTotal={course.badges.length}
          />

          {/* Step strip */}
          <ChapterDots
            course={course}
            currentIdx={idx}
            completed={completed}
            onPick={(i) => {
              setDirection(i > idx ? 'forward' : 'backward')
              setIdx(i)
            }}
          />

          {/* 70 / 30 split */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
            {finished ? (
              <CinemaFinishedCard
                course={course}
                earnedPoints={earnedPoints}
                earnedBadges={earnedBadges}
                levelPct={levelPct}
                onRestart={resetAll}
              />
            ) : (
              <article
                key={mod.id}
                className={`relative overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm ${
                  direction === 'forward' ? 'animate-cinema-in-right' : 'animate-cinema-in-left'
                }`}
              >
                {/* Subtle atics-green top stripe — cinematic anchor without breaking paper feel */}
                <div className="h-0.5 w-full" style={{ backgroundColor: GREEN }} aria-hidden />

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-7 py-4">
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

                <div className="px-7 py-8 md:px-9 md:py-10">
                  <CinemaModuleBody
                    mod={mod}
                    quizAnswers={quizAnswers}
                    setQuizAnswers={setQuizAnswers}
                    quizSubmittedForMod={!!quizSubmitted[mod.id]}
                    onSubmitQuiz={() => setQuizSubmitted((p) => ({ ...p, [mod.id]: true }))}
                    onResetQuiz={() => {
                      setQuizAnswers((p) => {
                        const next = { ...p }
                        if (mod.kind === 'quiz') for (const q of mod.questions) delete next[q.id]
                        return next
                      })
                      setQuizSubmitted((p) => ({ ...p, [mod.id]: false }))
                    }}
                    reflections={reflections}
                    setReflections={setReflections}
                  />
                </div>

                {/* Stage footer */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 bg-[#fbf9f3] px-7 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-neutral-600">
                      Modul {idx + 1} av {total} · {moduleTimeLabel(mod.durationMinutes)}
                    </span>
                    {nextMod ? (
                      <span className="text-[11px] text-neutral-500">
                        Neste opp:{' '}
                        <strong className="font-semibold text-neutral-800">{nextMod.title}</strong>{' '}
                        · {moduleKindLabel(nextMod.kind)}
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
                  <div className="flex items-center gap-3">
                    {disabledHint ? (
                      <span
                        id="cinema-disabled-hint"
                        role="status"
                        aria-live="polite"
                        className="hidden text-xs sm:inline"
                        style={{ color: '#b3382a' }}
                      >
                        {disabledHint}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={idx === 0}
                      aria-label="Forrige modul (pil venstre)"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ outlineColor: GREEN }}
                    >
                      <ArrowLeft className="size-4" /> Forrige
                    </button>
                    <button
                      type="button"
                      onClick={advance}
                      disabled={!canAdvance}
                      aria-describedby={disabledHint ? 'cinema-disabled-hint' : undefined}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        backgroundColor: GREEN,
                        outlineColor: GREEN,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
                    >
                      {idx === total - 1 ? 'Avslutt kurset' : 'Fortsett'}
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* Right rail */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              <ProgressRingCard
                completedCount={completedCount}
                total={total}
                overall={overall}
                earnedPoints={earnedPoints}
                totalPoints={course.totalPoints}
              />
              <TocCard
                course={course}
                currentIdx={idx}
                completed={completed}
                onPick={(i) => {
                  setDirection(i > idx ? 'forward' : 'backward')
                  setIdx(i)
                }}
              />
              <BadgeTrayCard course={course} completed={completed} />
            </aside>
          </div>

          {/* XP reward toast */}
          {xpToast !== null ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 animate-cinema-xp"
            >
              <div
                className="flex items-center gap-2 rounded-full border bg-white px-5 py-2.5 text-sm font-semibold shadow-md"
                style={{ borderColor: GOLD, color: GREEN }}
              >
                <Sparkles className="size-4" style={{ color: GOLD }} /> +{xpToast} XP · modul fullført
              </div>
            </div>
          ) : null}

          {/* Badge unlock toast */}
          {badgeToast ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed left-1/2 top-40 z-30 -translate-x-1/2 animate-cinema-badge"
            >
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-3 shadow-md">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  {(() => {
                    const Icon = BADGE_ICON[badgeToast.icon]
                    return <Icon className="size-4" />
                  })()}
                </span>
                <div className="text-left">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: GOLD }}
                  >
                    Nytt merke
                  </p>
                  <p className="text-sm font-semibold text-neutral-900">{badgeToast.label}</p>
                </div>
              </div>
            </div>
          ) : null}

          <DesignNotes />
        </div>

        <style>{`
          @keyframes cinemaInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes cinemaInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes cinemaXp { 0% { opacity: 0; transform: translate(-50%, 12px); } 20% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -8px); } }
          @keyframes cinemaBadge { 0% { opacity: 0; transform: translate(-50%, 16px) scale(0.94); } 25% { opacity: 1; transform: translate(-50%, 0) scale(1); } 85% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); } }
          @media (prefers-reduced-motion: no-preference) {
            .animate-cinema-in-right { animation: cinemaInRight 0.4s ease-out; }
            .animate-cinema-in-left { animation: cinemaInLeft 0.4s ease-out; }
            .animate-cinema-xp { animation: cinemaXp 1.8s ease-out; }
            .animate-cinema-badge { animation: cinemaBadge 2.6s ease-out; }
          }
        `}</style>
      </div>
    </div>
  )
}

function LevelMeter({
  level,
  label,
  sessionXp,
  nextLevelXp,
  pct,
}: {
  level: number
  label: string
  sessionXp: number
  nextLevelXp: number
  pct: number
}) {
  return (
    <div className="hidden items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-2.5 shadow-sm sm:flex">
      <div className="text-right leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Nivå {level} · {label}
        </p>
        <p className="text-xs font-semibold text-neutral-900">
          {sessionXp}
          <span className="text-neutral-500"> / {nextLevelXp} XP</span>
        </p>
      </div>
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200"
        aria-hidden
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: GREEN }}
        />
      </div>
    </div>
  )
}

function KpiStrip({
  completedCount,
  total,
  earnedPoints,
  totalPoints,
  sessionXp,
  levelLabel,
  badgesEarned,
  badgesTotal,
}: {
  completedCount: number
  total: number
  earnedPoints: number
  totalPoints: number
  sessionXp: number
  levelLabel: string
  badgesEarned: number
  badgesTotal: number
}) {
  const items: { big: string; title: string; sub: string }[] = [
    { big: `${completedCount}/${total}`, title: 'Moduler', sub: 'Fullført i denne økten' },
    {
      big: `${earnedPoints}`,
      title: 'Poeng tjent',
      sub: `av ${totalPoints} mulige`,
    },
    { big: `${badgesEarned}/${badgesTotal}`, title: 'Merker', sub: 'Låst opp så langt' },
    { big: `${sessionXp} XP`, title: 'Total balanse', sub: levelLabel },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-xl border border-neutral-200/80 px-4 py-3 md:px-5 md:py-4"
          style={{ backgroundColor: CREAM_TILE }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            {it.title}
          </p>
          <p
            className="mt-1 text-xl font-semibold text-neutral-900 md:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            {it.big}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

function ChapterDots({
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
    <div className="flex items-center justify-center gap-2">
      {course.modules.map((m, i) => {
        const done = completed[m.id]
        const isCurrent = i === currentIdx
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(i)}
            title={`Modul ${i + 1}: ${m.title}`}
            aria-label={`Gå til modul ${i + 1}: ${m.title}${done ? ' (fullført)' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            className="h-1.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              width: isCurrent ? 48 : 8,
              backgroundColor: isCurrent ? GREEN : done ? `${GREEN}66` : '#d6cfbe',
              outlineColor: GREEN,
            }}
          />
        )
      })}
    </div>
  )
}

function ProgressRingCard({
  completedCount,
  total,
  overall,
  earnedPoints,
  totalPoints,
}: {
  completedCount: number
  total: number
  overall: number
  earnedPoints: number
  totalPoints: number
}) {
  const r = 28
  const c = 2 * Math.PI * r
  const offset = c * (1 - overall)
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="h-0.5 -mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)]" style={{ backgroundColor: GREEN }} aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Fremdrift</p>
      <div className="mt-3 flex items-center gap-4">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="36" cy="36" r={r} stroke="#e8e2d2" strokeWidth="6" fill="none" />
          <circle
            cx="36"
            cy="36"
            r={r}
            stroke={GREEN}
            strokeWidth="6"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
          <text
            x="36"
            y="40"
            textAnchor="middle"
            className="text-[14px] font-semibold"
            fill="#0f1311"
          >
            {Math.round(overall * 100)}%
          </text>
        </svg>
        <dl className="space-y-1 text-xs">
          <div>
            <dt className="text-neutral-500">Moduler</dt>
            <dd className="text-sm font-semibold text-neutral-900">
              {completedCount} <span className="text-neutral-500">/ {total}</span>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Poeng</dt>
            <dd className="text-sm font-semibold" style={{ color: GREEN }}>
              {earnedPoints} <span className="text-neutral-500">/ {totalPoints} XP</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function TocCard({
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
        <ListChecks className="size-3.5" style={{ color: GREEN }} /> Innhold
      </div>
      <ol className="mt-3 space-y-1.5">
        {course.modules.map((m, i) => {
          const done = completed[m.id]
          const isCurrent = i === currentIdx
          const Icon = KIND_ICON[m.kind]
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{
                  backgroundColor: isCurrent ? `${GREEN}10` : 'transparent',
                  outlineColor: GREEN,
                }}
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: done ? GREEN : isCurrent ? `${GREEN}1f` : '#f3eee0',
                    color: done ? 'white' : isCurrent ? GREEN : '#7a7466',
                  }}
                >
                  {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="flex-1 space-y-0.5">
                  <span
                    className={`block text-[13px] ${
                      isCurrent ? 'font-semibold text-neutral-900' : 'text-neutral-700'
                    }`}
                  >
                    {m.title}
                  </span>
                  <span className="block text-[11px] text-neutral-500">
                    {moduleKindLabel(m.kind)} · {moduleTimeLabel(m.durationMinutes)} · +{m.points} XP
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

function BadgeTrayCard({
  course,
  completed,
}: {
  course: MockCourse
  completed: Record<string, boolean>
}) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <Trophy className="size-3.5" style={{ color: GOLD }} /> Merker
      </div>
      <ul className="mt-3 space-y-2">
        {course.badges.map((b) => {
          const earned = !!completed[b.awardedAtModuleId]
          const Icon = BADGE_ICON[b.icon]
          return (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 transition"
              style={{
                borderColor: earned ? `${GREEN}40` : '#e8e2d2',
                backgroundColor: earned ? `${GREEN}08` : 'transparent',
              }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
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
                <p className="truncate text-[11px] text-neutral-500">{b.description}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CinemaFinishedCard({
  course,
  earnedPoints,
  earnedBadges,
  levelPct,
  onRestart,
}: {
  course: MockCourse
  earnedPoints: number
  earnedBadges: MockBadge[]
  levelPct: number
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
          <PartyPopper className="size-5" />
        </span>
        <div className="flex-1">
          <h2
            className="text-xl font-semibold tracking-tight text-neutral-900"
            style={{ fontFamily: SERIF }}
          >
            Kurset er fullført
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Du tjente{' '}
            <strong style={{ color: GREEN }}>
              {earnedPoints} av {course.totalPoints} XP
            </strong>{' '}
            og er nå <strong style={{ color: GREEN }}>{Math.round(levelPct * 100)}%</strong> på vei
            mot Nivå {course.level.levelNumber + 1}.
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

function CinemaModuleBody({
  mod,
  quizAnswers,
  setQuizAnswers,
  quizSubmittedForMod,
  onSubmitQuiz,
  onResetQuiz,
  reflections,
  setReflections,
}: {
  mod: MockModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  quizSubmittedForMod: boolean
  onSubmitQuiz: () => void
  onResetQuiz: () => void
  reflections: Record<string, string>
  setReflections: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  if (mod.kind === 'text') {
    return (
      <div className="space-y-5">
        <h2
          className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
          style={{ fontFamily: SERIF }}
        >
          {mod.title}
        </h2>
        <p className="text-lg leading-relaxed text-neutral-800">{mod.lead}</p>
        <div className="space-y-4 text-[15px] leading-[1.75] text-neutral-700">
          {mod.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <aside
          className="rounded-xl border p-5"
          style={{
            backgroundColor: `${GREEN}06`,
            borderColor: `${GREEN}26`,
          }}
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
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    const passed = right / mod.questions.length >= 2 / 3
    const allAnswered = mod.questions.every((q) => quizAnswers[q.id] !== undefined)
    return (
      <div className="space-y-5">
        <h2
          className="text-2xl font-semibold tracking-tight text-neutral-900"
          style={{ fontFamily: SERIF }}
        >
          {mod.title}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-700">{mod.intro}</p>
        <div className="space-y-5">
          {mod.questions.map((q, qi) => {
            const picked = quizAnswers[q.id]
            return (
              <fieldset key={q.id} className="space-y-2.5">
                <legend className="text-base font-semibold text-neutral-900">
                  {qi + 1}. {q.question}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi) => {
                    const selected = picked === oi
                    const showRight = quizSubmittedForMod && oi === q.correctIndex
                    const showWrong = quizSubmittedForMod && selected && oi !== q.correctIndex
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={quizSubmittedForMod}
                        onClick={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        className="rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{
                          borderColor: showRight
                            ? GREEN
                            : showWrong
                              ? '#b3382a'
                              : selected
                                ? GREEN
                                : '#e8e2d2',
                          backgroundColor: showRight
                            ? `${GREEN}10`
                            : showWrong
                              ? '#b3382a10'
                              : selected
                                ? `${GREEN}08`
                                : 'white',
                          color: '#0f1311',
                          outlineColor: GREEN,
                        }}
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: showRight
                                ? GREEN
                                : selected
                                  ? `${GREEN}26`
                                  : '#f3eee0',
                              color: showRight ? 'white' : selected ? GREEN : '#7a7466',
                            }}
                          >
                            {String.fromCharCode(65 + oi)}
                          </span>
                          {opt}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {quizSubmittedForMod ? (
                  <p
                    className="rounded-lg px-3 py-2 text-[13px] leading-relaxed text-neutral-800"
                    style={{
                      backgroundColor: picked === q.correctIndex ? `${GREEN}0a` : '#b3382a08',
                    }}
                  >
                    {q.explanation}
                  </p>
                ) : null}
              </fieldset>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
          {!quizSubmittedForMod ? (
            <button
              type="button"
              onClick={onSubmitQuiz}
              disabled={!allAnswered}
              className="rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: GREEN, color: GREEN }}
            >
              Sjekk svarene
            </button>
          ) : (
            <p className="text-sm">
              <span className="font-semibold text-neutral-900">
                {right} av {mod.questions.length} riktig
              </span>{' '}
              <span className="text-neutral-600">
                — {passed ? 'bestått, klar for neste modul.' : 'ikke bestått ennå.'}
              </span>
            </p>
          )}
          {quizSubmittedForMod && !passed ? (
            <button
              type="button"
              onClick={onResetQuiz}
              className="text-xs font-semibold hover:underline"
              style={{ color: GREEN }}
            >
              Prøv på nytt
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h2
        className="text-2xl font-semibold tracking-tight text-neutral-900"
        style={{ fontFamily: SERIF }}
      >
        {mod.title}
      </h2>
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
            <strong className="text-neutral-900">Native i hovedappen.</strong> Samme krempapir
            (#F9F7F2), samme paperkort (rounded-xl border-neutral-200/80 bg-white shadow-sm) og
            samme atics-green CTA som /app frontpage og risiko-sikkerhet.
          </li>
          <li>
            <strong className="text-neutral-900">KPI-strip på toppen.</strong> Speiler
            LayoutScoreStatRow fra risiko-sikkerhet — moduler / poeng / merker / total balanse.
          </li>
          <li>
            <strong className="text-neutral-900">70 / 30-deling.</strong> Stage til venstre,
            gamification-HUD til høyre. Samme proporsjon som ModuleMainAside på frontpages.
          </li>
          <li>
            <strong className="text-neutral-900">Toaster, ikke poengtavle.</strong> +XP er
            gull-aksentert, merke-toast er green/paper. Begge feirer momentet, ingen leaderboards.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
