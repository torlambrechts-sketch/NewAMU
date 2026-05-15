// LearningPlayerHjemLayout — production /app/learning Hjem-style course player.
// Mirrors the workspace WelcomeDashboardPage UX: serif greeting, Hjem/Klassisk
// tabs, 7fr/3fr split with the lesson in the "Neste på listen" position and a
// right rail with Denne uken (accordion per category) / Varsler / Snarveier.
//
// Phase 1 scope: consumes the existing useLearning hook (same progress,
// certificate, and unlock flow as the classic LearningPlayer). Supports text,
// quiz, and on_job module kinds. Other kinds render a "Marker som lest"
// fallback so a learner is never trapped. Wired to setModuleCompleted and
// issueCertificate verbatim from the classic flow. The layout is opt-in via
// the route's ?layout=hjem query param.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  ListChecks,
  Maximize2,
  Minimize2,
  PenLine,
  Sparkles,
  Trophy,
  Users,
  Users2,
  type LucideIcon,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Course, CourseModule, ModuleCompleteMeta } from '../../types/learning'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import {
  CommonPitfalls,
  DeepDiveAccordion,
  KeyTakeaways,
  ModuleBody,
} from '../../components/learning/MarkdownBody'
import { LeadershipInsight, ModuleGamificationPill } from '../../components/learning/LearningGamification'

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

const KIND_ICON: Record<CourseModule['kind'], LucideIcon> = {
  text: FileText,
  quiz: Award,
  flashcard: BookOpen,
  image: ImageIcon,
  video: Film,
  checklist: ListChecks,
  tips: Sparkles,
  on_job: PenLine,
  event: Users2,
  scenario: Users,
  other: BookOpen,
}

function kindLabel(kind: CourseModule['kind']): string {
  switch (kind) {
    case 'text': return 'Lese'
    case 'quiz': return 'Quiz'
    case 'flashcard': return 'Flashkort'
    case 'image': return 'Bilde'
    case 'video': return 'Video'
    case 'checklist': return 'Sjekkliste'
    case 'tips': return 'Tips'
    case 'on_job': return 'I praksis'
    case 'event': return 'Arrangement'
    case 'scenario': return 'Scenario'
    case 'other': return 'Annet'
  }
}

function timeLabel(minutes: number): string {
  return `${minutes} min`
}

function getModulePoints(mod: CourseModule): number {
  return mod.points ?? 10
}

export type LearningPlayerHjemLayoutProps = {
  course: Course
}

export function LearningPlayerHjemLayout({ course }: LearningPlayerHjemLayoutProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, supabaseConfigured } = useOrgSetupContext()
  const {
    progress,
    certificates,
    ensureProgress,
    setModuleCompleted,
    issueCertificate,
    iltEvents,
  } = useLearning()

  const modules = course.modules
  const total = modules.length

  // Reading controls
  const [fontSize, setFontSize] = useState<FontSize>('base')
  const [expanded, setExpanded] = useState(false)

  // Module navigation — initial idx jumps to first incomplete, or ?module= param
  const courseProgress = progress.find((p) => p.courseId === course.id)
  const initialIdx = useMemo(() => {
    if (modules.length === 0) return 0
    const requested = searchParams.get('module')
    if (requested) {
      const i = modules.findIndex((m) => m.id === requested)
      if (i >= 0) return i
    }
    const firstIncomplete = modules.findIndex(
      (m) => !courseProgress?.moduleProgress[m.id]?.completed,
    )
    return firstIncomplete >= 0 ? firstIncomplete : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  const [idx, setIdx] = useState(initialIdx)
  const mod = modules[idx]

  // Per-module local state (resets when current module changes)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [ojtChecks, setOjtChecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setQuizAnswers({})
    setQuizSubmitted(false)
    setOjtChecks({})
  }, [mod?.id])

  // Bootstrap progress row on mount
  useEffect(() => {
    void ensureProgress(course.id)
  }, [course.id, ensureProgress])

  // ?module= deep-links jump to module
  useEffect(() => {
    const mid = searchParams.get('module')
    if (!mid) return
    const i = modules.findIndex((m) => m.id === mid)
    if (i >= 0 && i !== idx) setIdx(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Derived
  const completed: Record<string, boolean> = Object.fromEntries(
    modules.map((m) => [m.id, !!courseProgress?.moduleProgress[m.id]?.completed]),
  )
  const completedCount = modules.filter((m) => completed[m.id]).length
  const allComplete = total > 0 && completedCount === total
  const earnedPoints = modules.reduce(
    (sum, m) => (completed[m.id] ? sum + getModulePoints(m) : sum),
    0,
  )
  const totalPoints = modules.reduce((sum, m) => sum + getModulePoints(m), 0)
  const nextMod = idx < total - 1 ? modules[idx + 1] : null

  // Quiz computation
  const quizContext = useMemo(() => {
    if (!mod || mod.kind !== 'quiz') return null
    if (mod.content.kind !== 'quiz') return null
    const c = mod.content
    const required = c.validation?.requiredScore ?? 67
    const allAnswered = c.questions.every((q) => quizAnswers[q.id] !== undefined)
    const right = c.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    const scorePct = c.questions.length === 0 ? 0 : Math.round((right / c.questions.length) * 100)
    const passed = scorePct >= required
    return { questions: c.questions, allAnswered, right, scorePct, required, passed }
  }, [mod, quizAnswers])

  // On-job: all tasks must be checked to advance
  const ojtContext = useMemo(() => {
    if (!mod || mod.kind !== 'on_job') return null
    if (mod.content.kind !== 'on_job') return null
    const tasks = mod.content.tasks
    const allChecked = tasks.length === 0 || tasks.every((t) => ojtChecks[t.id])
    return { tasks, allChecked }
  }, [mod, ojtChecks])

  const canAdvance = (() => {
    if (!mod) return false
    if (mod.kind === 'quiz') return quizSubmitted && !!quizContext?.passed
    if (mod.kind === 'on_job') return !!ojtContext?.allChecked
    return true
  })()

  const disabledHint: string | null = (() => {
    if (!mod) return null
    if (mod.kind === 'quiz' && !quizSubmitted) return 'Sjekk svarene først.'
    if (mod.kind === 'quiz' && quizSubmitted && !quizContext?.passed)
      return `Du må ha minst ${quizContext?.required}% riktig for å gå videre.`
    if (mod.kind === 'on_job' && !ojtContext?.allChecked)
      return 'Kryss av alle praksis-oppgavene for å fullføre modulen.'
    return null
  })()

  function buildAdvanceMeta(): ModuleCompleteMeta | undefined {
    if (!mod) return undefined
    if (mod.kind !== 'quiz' || mod.content.kind !== 'quiz') return undefined
    const c = mod.content
    const lastAnswers = Object.fromEntries(
      c.questions.map((q) => [q.id, quizAnswers[q.id] ?? -1]),
    )
    return {
      score: quizContext?.scorePct,
      lastAnswers,
      quizQuestions: c.questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex })),
    }
  }

  function advance() {
    if (!mod) return
    setModuleCompleted(course.id, mod.id, buildAdvanceMeta())
    if (idx < total - 1) {
      setIdx(idx + 1)
    } else {
      // Last module completed — open the certificate panel for issuance
      setKursbevisOpen(true)
    }
  }

  function back() {
    if (idx > 0) setIdx(idx - 1)
  }

  function jumpToModule(i: number) {
    setIdx(i)
    const next = new URLSearchParams(searchParams)
    next.set('module', modules[i].id)
    setSearchParams(next, { replace: true })
  }

  // Keyboard nav
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

  // Certificate panel
  const courseCert = certificates.find((c) => c.courseId === course.id)
  const hasCert = !!courseCert
  const profileName = profile?.display_name?.trim() ?? ''
  const certNameLocked = supabaseConfigured && profileName.length > 0
  const [kursbevisOpen, setKursbevisOpen] = useState(false)
  const [learnerNameInput, setLearnerNameInput] = useState(profileName)
  const [certFeedback, setCertFeedback] = useState<
    | { kind: 'success'; verifyCode: string }
    | { kind: 'error'; message: string }
    | null
  >(null)
  const learnerName = certNameLocked ? profileName : learnerNameInput.trim()

  function classicLayoutHref(): string {
    const next = new URLSearchParams(searchParams)
    next.set('layout', 'classic')
    const q = next.toString()
    return `/learning/play/${course.id}${q ? `?${q}` : ''}`
  }

  if (modules.length === 0) {
    return (
      <PaperWrapper>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <WarningBox>Dette kurset har ingen moduler ennå.</WarningBox>
        </div>
      </PaperWrapper>
    )
  }

  return (
    <PaperWrapper>
      <div className="space-y-6">
        {/* Header band — breadcrumb / serif H1 / tab pills / divider */}
        <header className="space-y-4 pb-2">
          <p className="text-xs text-neutral-500">
            <Link to="/" className="hover:text-neutral-900">Arbeidsflate</Link>
            <span className="mx-1.5">›</span>
            <Link to="/learning" className="hover:text-neutral-900">E-læring</Link>
            <span className="mx-1.5">›</span>
            <Link to="/learning/katalog" className="hover:text-neutral-900">Katalog</Link>
            <span className="mx-1.5">›</span>
            <span className="text-neutral-700">{course.title}</span>
          </p>

          <h1
            className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl"
            style={{ fontFamily: SERIF }}
          >
            {profileName ? `Velkommen tilbake, ${profileName.split(' ')[0]}` : 'Velkommen tilbake'}
          </h1>
          <p className="text-sm leading-relaxed text-neutral-600">
            Du fortsetter på <strong>{course.title}</strong>. {course.description}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: GREEN }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
            >
              <BookOpen className="size-4" /> Hjem
            </button>
            <button
              type="button"
              onClick={() => navigate(classicLayoutHref())}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-white"
            >
              <Bookmark className="size-4" /> Klassisk visning
            </button>
          </div>

          <hr className="border-neutral-200" />
        </header>

        {/* 7fr / 3fr split — drops to single column when Utvid */}
        <div
          className={
            expanded
              ? 'grid grid-cols-1 gap-6'
              : 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:items-start'
          }
        >
          <main className="space-y-4">
            <article className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
              {/* Card header */}
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
                    to="/learning/katalog"
                    className="text-[11px] font-bold uppercase tracking-wider hover:underline"
                    style={{ color: GREEN }}
                  >
                    Alle kurs →
                  </Link>
                </div>
              </header>

              {/* Body */}
              <div
                className="px-6 py-6 md:px-8 md:py-8"
                style={{ fontSize: FONT_SIZE_PX[fontSize] }}
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Modul {idx + 1} av {total} · {kindLabel(mod.kind)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-neutral-200 bg-[#f7f5ee] px-2 py-0.5 text-[11px] text-neutral-700">
                      {timeLabel(mod.durationMinutes)}
                    </span>
                    <ModuleGamificationPill
                      points={getModulePoints(mod)}
                      badgeId={mod.badgeId}
                      badgeLabel={course.badges?.find((b) => b.id === mod.badgeId)?.label}
                    />
                  </div>
                </div>

                <h2
                  className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
                  style={{ fontFamily: SERIF }}
                >
                  {mod.title}
                </h2>

                <div className="mt-5">
                  <LessonBody
                    mod={mod}
                    quizAnswers={quizAnswers}
                    setQuizAnswers={setQuizAnswers}
                    quizSubmitted={quizSubmitted}
                    setQuizSubmitted={setQuizSubmitted}
                    quizContext={quizContext}
                    ojtChecks={ojtChecks}
                    setOjtChecks={setOjtChecks}
                  />
                </div>
              </div>

              {/* Pager footer */}
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-[#fbf9f3] px-6 py-3">
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="text-neutral-600">
                    Modul {idx + 1} av {total} · {timeLabel(mod.durationMinutes)}
                  </span>
                  {disabledHint ? (
                    <span className="text-[11px]" style={{ color: '#b3382a' }} role="status" aria-live="polite">
                      {disabledHint}
                    </span>
                  ) : nextMod ? (
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
                    {idx === total - 1 ? 'Fullfør kurset' : 'Fortsett'}
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </footer>
            </article>

            {allComplete && !hasCert ? (
              <button
                type="button"
                onClick={() => setKursbevisOpen(true)}
                className="block w-full rounded-xl border border-dashed px-4 py-3 text-center text-xs font-bold uppercase tracking-wider transition hover:bg-white"
                style={{ borderColor: `${GREEN}40`, color: GREEN }}
              >
                Hent kursbevis →
              </button>
            ) : !allComplete ? (
              <p className="text-center text-xs text-neutral-500">
                {total - completedCount} {total - completedCount === 1 ? 'modul' : 'moduler'} igjen i kurset
              </p>
            ) : null}
          </main>

          {/* Right rail — hidden under Utvid */}
          {!expanded ? (
            <aside className="space-y-4 lg:sticky lg:top-6">
              <DenneUkenCard
                course={course}
                completed={completed}
                completedCount={completedCount}
                total={total}
                earnedPoints={earnedPoints}
                totalPoints={totalPoints}
                iltEventsForCourse={iltEvents.filter((e) => e.courseId === course.id)}
                onJumpToModule={jumpToModule}
              />
              <VarslerCard course={course} completed={completed} hasCert={hasCert} allComplete={allComplete} />
              <SnarveierCard
                course={course}
                currentIdx={idx}
                completed={completed}
                onPickModule={jumpToModule}
                onOpenCert={() => setKursbevisOpen(true)}
              />
            </aside>
          ) : null}
        </div>
      </div>

      {/* Certificate slide panel — same flow as classic player */}
      <SlidePanel
        open={kursbevisOpen}
        onClose={() => setKursbevisOpen(false)}
        titleId="learning-player-hjem-kursbevis"
        title="Kursbevis"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setKursbevisOpen(false)}>
              Lukk
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Award className="h-4 w-4" />}
              disabled={!allComplete || hasCert || !learnerName}
              onClick={() => {
                void (async () => {
                  setCertFeedback(null)
                  const r = await issueCertificate(course.id, learnerName)
                  if (r.ok) {
                    setCertFeedback({ kind: 'success', verifyCode: r.certificate.verifyCode })
                  } else {
                    setCertFeedback({ kind: 'error', message: r.error })
                  }
                })()
              }}
            >
              {hasCert ? 'Kursbevis utstedt' : 'Hent kursbevis'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            {certNameLocked
              ? 'Navn på kursbeviset hentes fra profilen din og kan ikke endres her.'
              : 'Skriv inn navnet som skal stå på kursbeviset.'}
          </p>
          {certFeedback?.kind === 'success' ? (
            <InfoBox>
              Kursbevis er utstedt. Verifiseringskode:{' '}
              <span className="font-mono font-semibold">{certFeedback.verifyCode}</span>.{' '}
              {courseCert ? (
                <Link
                  to={`/learning/certificates/${courseCert.id}/print`}
                  className="font-medium underline"
                  style={{ color: GREEN }}
                >
                  Åpne kursbevis
                </Link>
              ) : null}
            </InfoBox>
          ) : null}
          {certFeedback?.kind === 'error' ? (
            <WarningBox>{certFeedback.message}</WarningBox>
          ) : null}
          {!allComplete ? (
            <WarningBox>Fullfør alle modulene før du henter kursbeviset.</WarningBox>
          ) : null}
          {!certNameLocked ? (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-neutral-700">Navn</span>
              <StandardInput
                value={learnerNameInput}
                onChange={(e) => setLearnerNameInput(e.target.value)}
                placeholder="Fornavn Etternavn"
              />
            </label>
          ) : (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {profileName}
            </div>
          )}
        </div>
      </SlidePanel>
    </PaperWrapper>
  )
}

function PaperWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div
        className="min-h-[calc(100vh-100px)] text-neutral-900"
        style={{ backgroundColor: PAPER_BG }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">{children}</div>
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

type QuizCtx = {
  questions: { id: string; question: string; options: string[]; correctIndex: number }[]
  allAnswered: boolean
  right: number
  scorePct: number
  required: number
  passed: boolean
}

function LessonBody({
  mod,
  quizAnswers,
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  quizContext,
  ojtChecks,
  setOjtChecks,
}: {
  mod: CourseModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  quizSubmitted: boolean
  setQuizSubmitted: (v: boolean) => void
  quizContext: QuizCtx | null
  ojtChecks: Record<string, boolean>
  setOjtChecks: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const c = mod.content

  if (c.kind === 'text') {
    // Reading order: body → leadership insight → common pitfalls → key
    // takeaways → deep dive (collapsed by default so the page stays scannable).
    return (
      <div className="space-y-5">
        <ModuleBody body={c.body} bodyMarkdown={c.bodyMarkdown} bodyFormat={c.bodyFormat} />
        {c.leadershipInsight ? <LeadershipInsight markdown={c.leadershipInsight} /> : null}
        {c.commonPitfalls?.length ? <CommonPitfalls items={c.commonPitfalls} /> : null}
        {c.keyTakeaways?.length ? <KeyTakeaways items={c.keyTakeaways} /> : null}
        {c.deepDive ? <DeepDiveAccordion markdown={c.deepDive} /> : null}
      </div>
    )
  }

  if (c.kind === 'quiz' && quizContext) {
    return (
      <div className="space-y-5">
        {quizContext.questions.map((q, qi) => {
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
            </fieldset>
          )
        })}
        {!quizSubmitted ? (
          <button
            type="button"
            onClick={() => setQuizSubmitted(true)}
            disabled={!quizContext.allAnswered}
            className="rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Sjekk svarene
          </button>
        ) : (
          <div
            className="flex items-start gap-3 rounded-lg border p-4"
            style={{
              borderColor: quizContext.passed ? `${GREEN}40` : '#b3382a40',
              backgroundColor: quizContext.passed ? `${GREEN}08` : '#b3382a08',
            }}
          >
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0"
              style={{ color: quizContext.passed ? GREEN : '#b3382a' }}
            />
            <div className="text-sm">
              <p className="font-semibold text-neutral-900">
                {quizContext.right} av {quizContext.questions.length} riktig ({quizContext.scorePct}%)
              </p>
              <p className="mt-1 text-neutral-700">
                {quizContext.passed
                  ? 'Bestått. Klar for neste modul.'
                  : `Du må ha minst ${quizContext.required}% for å gå videre. Prøv på nytt.`}
              </p>
              {!quizContext.passed ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers(() => ({}))
                    setQuizSubmitted(false)
                  }}
                  className="mt-2 text-xs font-semibold hover:underline"
                  style={{ color: GREEN }}
                >
                  Prøv på nytt →
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (c.kind === 'on_job') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutral-700">
          Praktiske oppgaver du gjør på arbeidsplassen. Kryss av når hver oppgave er gjort.
        </p>
        <ul className="space-y-2">
          {c.tasks.map((t) => {
            const done = !!ojtChecks[t.id]
            return (
              <li key={t.id}>
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition"
                  style={{
                    borderColor: done ? GREEN : '#e8e2d2',
                    backgroundColor: done ? `${GREEN}08` : 'white',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) =>
                      setOjtChecks((p) => ({ ...p, [t.id]: e.target.checked }))
                    }
                    className="mt-0.5 size-4"
                    style={{ accentColor: GREEN }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-neutral-900">{t.title}</span>
                    {t.description ? (
                      <span className="mt-0.5 block text-sm text-neutral-700">{t.description}</span>
                    ) : null}
                    {t.requiredRole ? (
                      <span className="mt-1 inline-block rounded-full bg-[#f3eee0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                        Krever: {t.requiredRole}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // Fallback for kinds not yet supported in phase 1 (flashcard, image, video,
  // checklist, tips, event, scenario, other). Show a neutral placeholder; the
  // pager still lets the learner advance.
  return (
    <div className="space-y-3">
      <InfoBox>
        Denne modultypen ({kindLabel(mod.kind)}) støttes ikke fullt ut i
        Hjem-visningen ennå. Du kan bytte til klassisk visning ved å legge til{' '}
        <code>?layout=classic</code> i URL-en, eller markere modulen som lest under.
      </InfoBox>
    </div>
  )
}

type WeekItem = {
  id: string
  title: string
  meta: string
  status?: 'today' | 'pending' | 'done'
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
  completed,
  completedCount,
  total,
  earnedPoints,
  totalPoints,
  iltEventsForCourse,
  onJumpToModule,
}: {
  course: Course
  completed: Record<string, boolean>
  completedCount: number
  total: number
  earnedPoints: number
  totalPoints: number
  iltEventsForCourse: ReturnType<typeof useLearning>['iltEvents']
  onJumpToModule: (i: number) => void
}) {
  // Mini calendar: current week display. We don't know "today" without a date
  // util, but for now match the workspace pattern with a static week. (Phase 2
  // will wire to real `new Date()`.)
  const dayLabels = ['man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.', 'søn.']
  const today = new Date()
  const todayIdx = (today.getDay() + 6) % 7 // mon=0 .. sun=6
  // Compute the Monday of the current week
  const monday = new Date(today)
  monday.setDate(today.getDate() - todayIdx)
  const dayNumbers = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.getDate()
  })
  const monthLabel = today.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
  const weekNum = Math.ceil(
    ((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
  )

  const moduleItems: WeekItem[] = course.modules.map((m, i) => ({
    id: m.id,
    title: m.title,
    meta: `${kindLabel(m.kind)} · ${timeLabel(m.durationMinutes)} · +${getModulePoints(m)} XP`,
    status: completed[m.id]
      ? ('done' as const)
      : i === course.modules.findIndex((mm) => !completed[mm.id])
        ? ('today' as const)
        : ('pending' as const),
    jumpToModuleIdx: i,
  }))

  const reflectionItems: WeekItem[] = course.modules
    .filter((m) => m.kind === 'on_job')
    .map((m) => ({
      id: `refl-${m.id}`,
      title: m.title,
      meta: `I praksis · ${timeLabel(m.durationMinutes)}${completed[m.id] ? ' · gjennomført' : ' · venter'}`,
      status: completed[m.id] ? ('done' as const) : ('pending' as const),
      jumpToModuleIdx: course.modules.indexOf(m),
    }))

  const meetingItems: WeekItem[] = iltEventsForCourse.map((e) => ({
    id: e.id,
    title: e.title,
    meta: `${new Date(e.startsAt).toLocaleDateString('nb-NO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })}${e.locationText ? ` · ${e.locationText}` : ''}`,
    status: 'pending' as const,
  }))

  const deadlineItems: WeekItem[] = course.recertificationMonths
    ? [
        {
          id: 'recert',
          title: `Resertifisering: ${course.title}`,
          meta: `Hvert ${course.recertificationMonths}. måned`,
          status: 'pending' as const,
        },
      ]
    : []

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
      label: 'I praksis',
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

      <div className="px-4 py-4">
        <p className="text-center text-xs text-neutral-500">
          Uke {weekNum} · {monthLabel}
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {dayLabels.map((d) => (
            <span key={d} className="text-[10px] text-neutral-500">{d}</span>
          ))}
          {dayNumbers.map((n, i) => {
            const isToday = i === todayIdx
            return (
              <span
                key={`${i}-${n}`}
                className="mt-1 flex items-center justify-center"
                aria-label={isToday ? `${n}. (i dag)` : `${n}.`}
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

      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {categories.map((cat) => (
          <li key={cat.id}>
            <details open={cat.defaultOpen} className="group">
              <summary
                className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-[#fbf9f3]"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${cat.iconColor}14`, color: cat.iconColor }}
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
                              it.status === 'done' || it.status === 'today' ? 'white' : '#a3a3a3',
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
                            onClick={() => onJumpToModule(it.jumpToModuleIdx as number)}
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[#fbf9f3]"
                          >
                            {Inner}
                          </button>
                        ) : (
                          <div className="flex items-start gap-2 rounded-md px-2 py-1.5">{Inner}</div>
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
              width: `${totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0}%`,
              backgroundColor: GREEN,
            }}
          />
        </div>
      </footer>
    </section>
  )
}

function VarslerCard({
  course,
  completed,
  hasCert,
  allComplete,
}: {
  course: Course
  completed: Record<string, boolean>
  hasCert: boolean
  allComplete: boolean
}) {
  const items: { Icon: LucideIcon; title: string; sub: string; iconColor: string }[] = []

  // Earned badges (if course defines a badges catalog)
  const earnedBadges =
    course.badges?.filter((b) =>
      course.milestones?.some(
        (m) => m.badgeId === b.id && m.moduleIds.every((mid) => completed[mid]),
      ),
    ) ?? []
  if (earnedBadges.length > 0) {
    const latest = earnedBadges[earnedBadges.length - 1]
    items.push({
      Icon: Trophy,
      title: `Nytt merke låst opp: «${latest.label}»`,
      sub: latest.description ?? 'Bra jobba!',
      iconColor: GREEN,
    })
  }

  // Pending on_job tasks
  const pendingOjt = course.modules.filter(
    (m) => m.kind === 'on_job' && !completed[m.id],
  )
  if (pendingOjt.length > 0) {
    items.push({
      Icon: Bell,
      title: 'Praksis-oppgave venter',
      sub: pendingOjt[0].title,
      iconColor: '#7c2d12',
    })
  }

  // Certificate ready
  if (allComplete && !hasCert) {
    items.push({
      Icon: Award,
      title: 'Kursbevis klart',
      sub: 'Trykk «Hent kursbevis» for å laste ned PDF',
      iconColor: '#a16207',
    })
  }

  if (items.length === 0) {
    items.push({
      Icon: Sparkles,
      title: 'Ingen nye varsler',
      sub: 'Fortsett der du slapp.',
      iconColor: '#737373',
    })
  }

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Varsler
        </p>
        {items.length > 0 && items[0].iconColor !== '#737373' ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-[#d23a3a] text-[9px] font-bold text-white">
            {items.length}
          </span>
        ) : null}
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
  onOpenCert,
}: {
  course: Course
  currentIdx: number
  completed: Record<string, boolean>
  onPickModule: (i: number) => void
  onOpenCert: () => void
}) {
  const [innholdOpen, setInnholdOpen] = useState(false)
  const shortcuts: { Icon: LucideIcon; label: string; onClick?: () => void; href?: string; color: string }[] = [
    {
      Icon: ListChecks,
      label: 'Innhold',
      onClick: () => setInnholdOpen((v) => !v),
      color: GREEN,
    },
    {
      Icon: Award,
      label: 'Mitt kursbevis',
      onClick: onOpenCert,
      color: '#a16207',
    },
    {
      Icon: BookOpen,
      label: 'Kurskatalog',
      href: '/learning/katalog',
      color: '#0e7490',
    },
    {
      Icon: Users,
      label: 'Min profil',
      href: '/profile',
      color: '#7c3aed',
    },
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
            {s.href ? (
              <Link
                to={s.href}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:bg-[#fbf9f3]"
              >
                <s.Icon className="size-4 shrink-0" style={{ color: s.color }} />
                <span className="flex-1">{s.label}</span>
                <ExternalLink className="size-3 text-neutral-400" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={s.onClick}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-800 transition hover:bg-[#fbf9f3]"
              >
                <s.Icon className="size-4 shrink-0" style={{ color: s.color }} />
                <span className="flex-1">{s.label}</span>
                <ChevronDown
                  className={`size-3 text-neutral-400 transition-transform ${
                    s.label === 'Innhold' && innholdOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}
          </li>
        ))}
      </ul>

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

// Suppress unused-warning for the cream constant — it's exported for future
// reuse in surrounding workspace pages that want to share the tile look.
export const HJEM_CREAM_TILE = CREAM_TILE
