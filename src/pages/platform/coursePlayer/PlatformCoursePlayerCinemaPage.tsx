// Alternative 2 — "Cinema Card" (app theme + document-reader chrome). Default
// course-player. Mirrors the WikiPageView toolbar pattern: a sticky control
// strip across the top of the lesson card with Easy-reader link, Innhold
// popover, A-/A/A+ font sizes, and an Utvid/Komprimer toggle that drops the
// KPI widgets for an optimized reading view. Lesson card spans the full
// container width so it aligns with the widget bar above. Cinema identity is
// preserved through the green top accent, card-to-card slide animation, and
// XP/badge unlock toasts.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronLeft,
  Compass,
  FileText,
  HelpCircle,
  Maximize2,
  Minimize2,
  PanelLeft,
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
  const [fontSize, setFontSize] = useState<FontSize>('base')
  const [expanded, setExpanded] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)

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
      if (e.key === 'Escape' && tocOpen) setTocOpen(false)
      if (e.key === 'ArrowLeft') goBack()
      if (e.key === 'ArrowRight' && canAdvance) advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, canAdvance, tocOpen])

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
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-4 md:px-8">
          {/* Optional widget bar — hides under "Utvid" */}
          {!expanded ? (
            <>
              <KpiStrip
                completedCount={completedCount}
                total={total}
                overall={overall}
                earnedPoints={earnedPoints}
                totalPoints={course.totalPoints}
                badgesEarned={earnedBadges.length}
                badgesTotal={course.badges.length}
                level={course.level.levelNumber}
                levelLabel={course.level.levelLabel}
                sessionXp={sessionXp}
                nextLevelXp={course.level.nextLevelXp}
                levelPct={levelPct}
              />
              <ChapterDots
                course={course}
                currentIdx={idx}
                completed={completed}
                onPick={(i) => {
                  setDirection(i > idx ? 'forward' : 'backward')
                  setIdx(i)
                }}
              />
            </>
          ) : null}

          {/* Lesson card spans full container width — same edge as the KPI strip */}
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
              className={`overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm ${
                direction === 'forward' ? 'animate-cinema-in-right' : 'animate-cinema-in-left'
              }`}
            >
              {/* Cinema accent rule */}
              <div className="h-0.5 w-full" style={{ backgroundColor: GREEN }} aria-hidden />

              {/* Sticky reading toolbar — mirrors WikiPageView */}
              <ReadingToolbar
                completedCount={completedCount}
                total={total}
                earnedPoints={earnedPoints}
                fontSize={fontSize}
                setFontSize={setFontSize}
                expanded={expanded}
                setExpanded={setExpanded}
                onOpenToc={() => setTocOpen(true)}
                onExit={resetAll}
              />

              {/* Module meta strip */}
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

              {/* Module body — fontSize applied via inline style, mirrors WikiBlockRenderer */}
              <div
                className="px-7 py-8 md:px-10 md:py-10"
                style={{ fontSize: FONT_SIZE_PX[fontSize] }}
              >
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
                    style={{ backgroundColor: GREEN, outlineColor: GREEN }}
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

          {/* Toasts */}
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

          {/* Innhold popover */}
          {tocOpen ? (
            <TocOverlay
              course={course}
              currentIdx={idx}
              completed={completed}
              onPick={(i) => {
                setDirection(i > idx ? 'forward' : 'backward')
                setIdx(i)
                setTocOpen(false)
              }}
              onClose={() => setTocOpen(false)}
            />
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

function ReadingToolbar({
  completedCount,
  total,
  earnedPoints,
  fontSize,
  setFontSize,
  expanded,
  setExpanded,
  onOpenToc,
  onExit,
}: {
  completedCount: number
  total: number
  earnedPoints: number
  fontSize: FontSize
  setFontSize: (s: FontSize) => void
  expanded: boolean
  setExpanded: (v: boolean) => void
  onOpenToc: () => void
  onExit: () => void
}) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-t-xl border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur-sm">
      <Link
        to="/platform-admin/course-player"
        title="Tilbake til oversikt"
        aria-label="Tilbake til oversikt"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: GREEN }}
      >
        <ChevronLeft className="size-4" />
        <span className="hidden sm:inline">Tilbake</span>
      </Link>

      <ToolbarDivider />

      <Link
        to="/platform-admin/course-player/focus"
        title="Bytt til Focus Reader (enklere lesemodus)"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: GREEN }}
      >
        <BookOpen className="size-4" />
        <span className="hidden sm:inline">Easy lesing</span>
      </Link>

      <button
        type="button"
        onClick={onOpenToc}
        title="Vis innholdsliste"
        aria-label="Vis innholdsliste"
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: GREEN }}
      >
        <PanelLeft className="size-4" />
        <span className="hidden sm:inline">Innhold</span>
      </button>

      <ToolbarDivider />

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
              className={`flex h-7 w-7 items-center justify-center rounded-md font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                active ? '' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              style={{
                backgroundColor: active ? `${GREEN}1a` : undefined,
                color: active ? GREEN : undefined,
                outlineColor: GREEN,
                fontSize: i === 0 ? '0.7rem' : i === 1 ? '0.85rem' : '1rem',
              }}
            >
              A
            </button>
          )
        })}
      </div>

      <ToolbarDivider />

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Komprimer (vis widgets)' : 'Utvid (skjul widgets)'}
        aria-pressed={expanded}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: expanded ? `${GREEN}1a` : undefined,
          color: expanded ? GREEN : '#525252',
          outlineColor: GREEN,
        }}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = '#f5f5f5'
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = ''
        }}
      >
        {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        <span className="hidden md:inline">{expanded ? 'Komprimer' : 'Utvid'}</span>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-xs text-neutral-500 sm:inline">
          <span className="font-semibold text-neutral-900">{completedCount}/{total}</span>{' '}
          <span className="hidden md:inline">moduler</span>
        </span>
        <span
          className="hidden items-center gap-1 text-xs font-semibold sm:inline-flex"
          style={{ color: GREEN }}
        >
          <Sparkles className="size-3" /> {earnedPoints} XP
        </span>
        <button
          type="button"
          onClick={onExit}
          title="Nullstill og avslutt"
          aria-label="Nullstill og avslutt"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: GREEN }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
}

function KpiStrip({
  completedCount,
  total,
  overall,
  earnedPoints,
  totalPoints,
  badgesEarned,
  badgesTotal,
  level,
  levelLabel,
  sessionXp,
  nextLevelXp,
  levelPct,
}: {
  completedCount: number
  total: number
  overall: number
  earnedPoints: number
  totalPoints: number
  badgesEarned: number
  badgesTotal: number
  level: number
  levelLabel: string
  sessionXp: number
  nextLevelXp: number
  levelPct: number
}) {
  const items: { big: string; title: string; sub: string; meter?: number }[] = [
    {
      big: `${completedCount}/${total}`,
      title: 'Moduler',
      sub: `${Math.round(overall * 100)}% fullført`,
      meter: overall,
    },
    {
      big: `${earnedPoints}`,
      title: 'Poeng',
      sub: `av ${totalPoints} mulige`,
      meter: earnedPoints / totalPoints,
    },
    {
      big: `${badgesEarned}/${badgesTotal}`,
      title: 'Merker',
      sub: 'Låst opp så langt',
    },
    {
      big: `Nivå ${level}`,
      title: levelLabel,
      sub: `${sessionXp} / ${nextLevelXp} XP`,
      meter: levelPct,
    },
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
          {it.meter !== undefined ? (
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: '#e8e2d2' }}
              aria-hidden
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.round(it.meter * 100)}%`,
                  backgroundColor: GREEN,
                }}
              />
            </div>
          ) : null}
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

function TocOverlay({
  course,
  currentIdx,
  completed,
  onPick,
  onClose,
}: {
  course: MockCourse
  currentIdx: number
  completed: Record<string, boolean>
  onPick: (i: number) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Innhold"
    >
      <button
        type="button"
        aria-label="Lukk innhold"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <aside
        className="flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-neutral-200 p-5 shadow-2xl"
        style={{ backgroundColor: PAPER_BG }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Innhold
            </p>
            <h2
              className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: SERIF }}
            >
              {course.title}
            </h2>
            <p className="text-xs text-neutral-500">{course.audience}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
          >
            <X className="size-4" />
          </button>
        </div>

        <ol className="space-y-1.5">
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
                  className="flex w-full items-start gap-2.5 rounded-lg border bg-white px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                  style={{
                    borderColor: isCurrent ? `${GREEN}40` : '#e8e2d2',
                    backgroundColor: isCurrent ? `${GREEN}08` : 'white',
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
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: isCurrent ? GREEN : '#7a7466' }}
                    >
                      Modul {i + 1} · {moduleKindLabel(m.kind)}
                    </span>
                    <span
                      className={`block text-[13px] ${
                        isCurrent ? 'font-semibold text-neutral-900' : 'text-neutral-800'
                      }`}
                    >
                      {m.title}
                    </span>
                    <span className="block text-[10px] text-neutral-500">
                      {moduleTimeLabel(m.durationMinutes)} · +{m.points} XP
                      {m.badgeOnComplete
                        ? ` · låser opp ${course.badges.find((b) => b.id === m.badgeOnComplete)?.label}`
                        : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-auto rounded-xl border border-neutral-200/80 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Merker i kurset
          </p>
          <ul className="mt-3 flex gap-2">
            {course.badges.map((b) => {
              const earned = !!completed[b.awardedAtModuleId]
              const Icon = BADGE_ICON[b.icon]
              return (
                <li
                  key={b.id}
                  title={`${b.label} — ${b.description}`}
                  className="flex size-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: earned ? GREEN : 'transparent',
                    border: earned ? 'none' : '1px dashed #c8c0a8',
                    color: earned ? 'white' : '#9c9580',
                  }}
                >
                  <Icon className="size-4" />
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
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
          style={{ fontFamily: SERIF, fontSize: undefined }}
        >
          {mod.title}
        </h2>
        <p className="leading-relaxed text-neutral-800" style={{ fontSize: '1.125em' }}>
          {mod.lead}
        </p>
        <div className="space-y-4 leading-[1.75] text-neutral-700">
          {mod.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
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
              <li
                key={i}
                className="flex items-start gap-2 text-neutral-800"
                style={{ fontSize: '0.95em' }}
              >
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
        <p className="leading-relaxed text-neutral-700" style={{ fontSize: '0.95em' }}>
          {mod.intro}
        </p>
        <div className="space-y-5">
          {mod.questions.map((q, qi) => {
            const picked = quizAnswers[q.id]
            return (
              <fieldset key={q.id} className="space-y-2.5">
                <legend className="font-semibold text-neutral-900">
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
                        className="rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                    className="rounded-lg px-3 py-2 leading-relaxed text-neutral-800"
                    style={{
                      backgroundColor: picked === q.correctIndex ? `${GREEN}0a` : '#b3382a08',
                      fontSize: '0.85em',
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
      <p className="leading-relaxed text-neutral-700" style={{ fontSize: '0.95em' }}>
        {mod.intro}
      </p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block font-semibold text-neutral-900">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ outlineColor: GREEN, fontSize: '0.95em' }}
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
            <strong className="text-neutral-900">Wrap inni dokument-leseren.</strong> Sticky
            verktøystripe på toppen av leksjonskortet — samme mønster som WikiPageView, slik at
            kursspilleren leses som «dokument med innhold» framfor «egen flate».
          </li>
            <li>
            <strong className="text-neutral-900">Komprimert topp.</strong> Tilbakelink, tittel og
            avslutt er alle i den smale verktøystripa — ingen brødtekst over fold som spiser plass.
          </li>
          <li>
            <strong className="text-neutral-900">Reading-controls.</strong> A-/A/A+ skalerer
            leksjons-body via inline <code>fontSize</code> (samme teknikk som WikiBlockRenderer).
            Utvid skjuler KPI- og step-strip for maks lesetid.
          </li>
          <li>
            <strong className="text-neutral-900">Easy lesing.</strong> Bytter til Focus Reader
            (alternativ 1) — samme moduldata, men én lang lesekolonne uten widgets.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
