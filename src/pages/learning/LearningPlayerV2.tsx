// LearningPlayerV2 — Learner-facing course player. Outline rail on the left,
// lesson content in the middle, gamification side on the right. Keyboard
// arrows move between lessons. Replaces the legacy LearningPlayer at
// /learning/play/:courseId.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  GitBranch,
  HelpCircle,
  Info,
  Lock,
  MousePointer2,
  Play,
  PlayCircle,
  Sparkles,
  Square,
  Trophy,
  Upload,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { ModulePageShell } from '../../components/module'
import {
  Card,
  DesignIcon,
  ModeToggle,
  ProgressBar,
  type LearningMode,
} from '../../components/ui/elearningPrimitives'
import { deriveLeaderboard, moduleKindToBlock } from '../../lib/learning/elearningDesignKit'
import type { CourseModule } from '../../types/learning'

export function LearningPlayerV2() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId: string }>()
  const learning = useLearning()
  const {
    courses,
    progress,
    learningLoading,
    learningError,
    ensureProgress,
    setModuleCompleted,
    streakWeeks,
  } = learning
  const [mode, setMode] = useState<LearningMode>('advanced')
  const [activeIdx, setActiveIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, number>>>({})
  const [completeError, setCompleteError] = useState<string | null>(null)

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId])
  const sortedModules = useMemo(
    () => (course ? [...course.modules].sort((a, b) => a.order - b.order) : []),
    [course],
  )

  // Pull learner progress for the current course
  const myProgress = useMemo(
    () => progress.find((p) => p.courseId === courseId),
    [progress, courseId],
  )

  const completed = useMemo(() => {
    const set = new Set<string>()
    if (!myProgress) return set
    for (const m of sortedModules) {
      if (myProgress.moduleProgress[m.id]?.completed) set.add(m.id)
    }
    return set
  }, [myProgress, sortedModules])

  useEffect(() => {
    if (course && !myProgress) {
      ensureProgress(course.id)
    }
  }, [course, myProgress, ensureProgress])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && activeIdx < sortedModules.length - 1) setActiveIdx(activeIdx + 1)
      if (e.key === 'ArrowLeft' && activeIdx > 0) setActiveIdx(activeIdx - 1)
    },
    [activeIdx, sortedModules.length],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (learningLoading || !course) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert', to: '/' }, { label: 'Opplæring', to: '/learning' }, { label: 'Spiller' }]}
        title={<span className="inline-flex items-center gap-2"><PlayCircle className="h-5 w-5 text-[#1a3d32]" />Laster kurs…</span>}
        description={null}
        loading={learningLoading}
        loadingLabel="Henter kursinnhold…"
        notFound={
          learningLoading
            ? undefined
            : {
                title: 'Kurs ikke funnet',
                onBack: () => navigate('/learning'),
                backLabel: 'Til e-læring',
              }
        }
      >
        <div />
      </ModulePageShell>
    )
  }

  const courseRow = course
  const easy = mode === 'easy'
  const lesson = sortedModules[activeIdx] ?? null
  const totalLessons = sortedModules.length
  const progressRatio = totalLessons ? completed.size / totalLessons : 0
  const leaderboard = deriveLeaderboard(courseRow, progress, 3)
  const badges = courseRow.badges ?? []
  const earnedBadges = Math.min(badges.length || 4, completed.size)
  // Streak — `learning_streaks.streak_weeks` is recorded weekly. Multiply by 7
  // so the strip reads "dagers stim" per the design label.
  const streakDays = (streakWeeks ?? 0) * 7

  function markComplete() {
    if (!lesson) return
    setCompleteError(null)
    // `setModuleCompleted` fires-and-forgets a Supabase write. Failures are
    // surfaced through the hook-level `learningError`; we still optimistically
    // advance so the learner isn't stuck. The next refresh will reconcile.
    setModuleCompleted(courseRow.id, lesson.id)
    if (activeIdx < sortedModules.length - 1) setTimeout(() => setActiveIdx(activeIdx + 1), 250)
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Klarert', to: '/' },
        { label: 'Opplæring', to: '/learning' },
        { label: courseRow.title, to: `/learning/courses/${courseRow.id}/detail` },
        { label: 'Spiller' },
      ]}
      title={<span className="inline-flex items-center gap-2"><PlayCircle className="h-5 w-5 text-[#1a3d32]" />{courseRow.title}</span>}
      description={
        easy
          ? `Leksjon ${activeIdx + 1} av ${totalLessons}`
          : `Som læringen ser kurset · pilene navigerer · 80% kreves for å bestå sluttest.`
      }
      headerActions={
        <>
          <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => navigate(`/learning/courses/${courseRow.id}/detail`)}>
            Lukk
          </Button>
          <ModeToggle mode={mode} onChange={setMode} />
          <Button variant="secondary" icon={<Bookmark className="h-4 w-4" />}>Bokmerk</Button>
        </>
      }
    >
      {(learningError || completeError) ? (
        <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
          <DesignIcon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1">{learningError || completeError}</span>
        </div>
      ) : null}
      <Card className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex flex-1 items-center gap-3 text-xs text-neutral-700">
          <span className="font-semibold">Din fremdrift</span>
          <div className="max-w-xs flex-1">
            <ProgressBar value={progressRatio} />
          </div>
          <span className="tabular-nums">
            {completed.size} av {totalLessons} leksjoner
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Zap className="h-3.5 w-3.5" /> <span className="font-bold tabular-nums">{completed.size * 150}</span> XP
          </span>
          <span className="inline-flex items-center gap-1 text-orange-700">
            <Flame className="h-3.5 w-3.5" /> <span className="font-bold tabular-nums">{streakDays}</span> dagers stim
          </span>
          <span className="inline-flex items-center gap-1 text-purple-700">
            <Award className="h-3.5 w-3.5" /> <span className="font-bold tabular-nums">{earnedBadges}</span> badges
          </span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside>
          <div className="sticky top-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Læringsløp</div>
            <ul className="mt-2 space-y-0.5">
              {sortedModules.map((m, i) => {
                const active = i === activeIdx
                const done = completed.has(m.id)
                const locked = false
                return (
                  <li key={m.id}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() => !locked && setActiveIdx(i)}
                      className={[
                        '!justify-start w-full !gap-2 !rounded !px-2 !py-1.5 text-left text-xs !font-normal',
                        active
                          ? '!bg-[#e7efe9] !font-semibold text-[#1a3d32]'
                          : done
                            ? '!bg-transparent text-neutral-500 hover:!bg-neutral-50'
                            : '!bg-transparent text-neutral-700 hover:!bg-neutral-50',
                      ].join(' ')}
                      style={active ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                    >
                      <span
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums',
                          done
                            ? 'bg-green-600 text-white'
                            : active
                              ? 'bg-[#1a3d32] text-white'
                              : locked
                                ? 'bg-neutral-100 text-neutral-400'
                                : 'bg-neutral-200 text-neutral-600',
                        ].join(' ')}
                      >
                        {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : locked ? <Lock className="h-2.5 w-2.5" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="text-[9px] tabular-nums text-neutral-400">{m.durationMinutes}m</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>

        <article
          className="mx-auto w-full max-w-[680px] rounded-xl bg-white px-10 py-8 ring-1 ring-neutral-200/70"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          {lesson ? (
            <>
              <div className="border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <BookOpen className="h-3 w-3 text-[#1a3d32]" />
                  <span>Leksjon {activeIdx + 1} av {totalLessons}</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-neutral-500">
                    <Clock className="h-3 w-3" /> {lesson.durationMinutes} min
                  </span>
                </div>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-neutral-900">
                  {lesson.title}
                </h1>
              </div>

              <div className="mt-6 space-y-5">
                <ViewerBlock
                  lesson={lesson}
                  quizAnswers={quizAnswers[lesson.id] ?? {}}
                  setQuizAnswers={(answers) =>
                    setQuizAnswers((prev) => ({ ...prev, [lesson.id]: answers }))
                  }
                />
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                  onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                >
                  Forrige
                </Button>
                <span className="text-[10px] tabular-nums text-neutral-400">
                  {activeIdx + 1} / {totalLessons}
                </span>
                {activeIdx < totalLessons - 1 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                    onClick={markComplete}
                  >
                    Marker som lest · Neste
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Trophy className="h-3.5 w-3.5" />}
                    onClick={markComplete}
                  >
                    Fullfør kurs
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-md border-2 border-dashed border-neutral-200 px-6 py-12 text-center text-sm text-neutral-500">
              Kurset har ingen leksjoner ennå.
            </div>
          )}
        </article>

        <aside className="space-y-3">
          <Card className="bg-gradient-to-br from-[#fbf9f3] to-white p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <Sparkles className="h-3 w-3" /> Hverdagsmål
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-neutral-700">
              Studer 20 min i dag for å beholde stimen din.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar value={0.6} tone="warn" />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-amber-700">12/20m</span>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Neste badge</h3>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Trophy className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-neutral-900">Halvveis-helt</div>
                <div className="text-[11px] text-neutral-500">
                  Fullfør leksjon {Math.ceil(totalLessons / 2)} av {totalLessons}
                </div>
                <div className="mt-1">
                  <ProgressBar value={Math.min(1, completed.size / Math.max(1, Math.ceil(totalLessons / 2)))} />
                </div>
              </div>
            </div>
          </Card>

          {!easy && leaderboard.length > 0 ? (
            <Card className="p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Topp 3 denne uka</h3>
              <ul className="mt-2 space-y-1.5">
                {leaderboard.map((p) => (
                  <li key={p.rank} className="flex items-center gap-2 text-xs">
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                        p.rank === 1
                          ? 'bg-amber-500 text-white'
                          : p.rank === 2
                            ? 'bg-neutral-400 text-white'
                            : 'bg-orange-400 text-white',
                      ].join(' ')}
                    >
                      #{p.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-800">{p.name}</span>
                    <span className="font-semibold tabular-nums text-amber-700">{p.xp}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!easy ? (
            <Card className="p-4 text-[11px]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tastatursnarvei</h3>
              <ul className="mt-2 space-y-1 text-neutral-600">
                <li className="flex justify-between">
                  <span>Neste leksjon</span>
                  <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px]">→</kbd>
                </li>
                <li className="flex justify-between">
                  <span>Forrige</span>
                  <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px]">←</kbd>
                </li>
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </ModulePageShell>
  )
}

function ViewerBlock({
  lesson,
  quizAnswers,
  setQuizAnswers,
}: {
  lesson: CourseModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (answers: Record<string, number>) => void
}) {
  const block = moduleKindToBlock(lesson.kind)
  const c = lesson.content
  if (c.kind === 'video') {
    return (
      <section>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-700">
          <Video className="h-3 w-3" /> Video · {lesson.durationMinutes} min
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-lg bg-gradient-to-br from-neutral-900 via-[#1a3d32] to-neutral-800 text-white">
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <Play className="h-7 w-7" />
            </span>
            <div className="mt-2 text-xs font-medium opacity-80">
              {c.url ? 'Klikk for å spille' : 'Ingen video lastet opp ennå'}
            </div>
          </div>
        </div>
        {c.caption ? <p className="mt-2 text-sm text-neutral-600">{c.caption}</p> : null}
      </section>
    )
  }
  if (c.kind === 'text') {
    return (
      <section>
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        <p className="mt-2 text-[15px] leading-[1.65] text-neutral-700">
          {c.bodyMarkdown || c.body || 'Brødtekst…'}
        </p>
      </section>
    )
  }
  if (c.kind === 'tips') {
    return (
      <section className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900">{lesson.title}</h3>
          <ul className="mt-1 list-inside list-disc text-[13px] leading-snug text-blue-900">
            {c.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      </section>
    )
  }
  if (c.kind === 'checklist') {
    return (
      <section>
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        <ul className="mt-3 space-y-2">
          {c.items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
              <Square className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-sm text-neutral-700">{it.label}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (c.kind === 'quiz') {
    const total = c.questions.length || 1
    const answered = Object.keys(quizAnswers).length
    return (
      <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
          <HelpCircle className="h-3 w-3" /> Quiz · {total} spørsmål
          {c.validation ? ` · ${c.validation.requiredScore}% for å bestå` : ''}
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        {c.questions.map((q, i) => (
          <div key={q.id} className="mt-4 rounded-md border border-blue-200 bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Spørsmål {i + 1} av {total}
            </div>
            <div className="mt-1 text-sm font-medium text-neutral-900">{q.question}</div>
            <ul className="mt-3 space-y-1.5">
              {q.options.map((opt, oi) => {
                const active = quizAnswers[q.id] === oi
                return (
                  <li key={oi}>
                    <label
                      className={[
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        active ? 'border-[#1a3d32] bg-[#e7efe9]' : 'border-neutral-200 bg-white hover:border-[#1a3d32]/40',
                      ].join(' ')}
                    >
                      <StandardInput
                        type="radio"
                        name={`q-${q.id}`}
                        checked={active}
                        onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: oi })}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-neutral-800">{opt}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <Button variant="primary" size="sm" className="mt-3">
          Svar ({answered} / {total})
        </Button>
      </section>
    )
  }
  if (c.kind === 'scenario') {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <GitBranch className="h-3 w-3" /> Scenario · {c.steps.length} steg
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        {c.intro ? <p className="mt-2 text-[13px] text-neutral-700">{c.intro}</p> : null}
        {c.steps.map((step) => (
          <div key={step.id} className="mt-3">
            <p className="text-[13px] text-neutral-700">{step.prompt}</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {step.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="ghost"
                  size="sm"
                  className="!justify-start !rounded-md !border !border-amber-300 !bg-white !px-3 !py-2 text-left text-sm !font-normal text-neutral-800 hover:!border-amber-500"
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </section>
    )
  }
  if (c.kind === 'event') {
    return (
      <section className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
        <Download className="h-5 w-5 text-neutral-500" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{lesson.title}</h3>
          <div
            className="text-[12px] text-neutral-700"
            dangerouslySetInnerHTML={{ __html: c.instructions }}
          />
        </div>
        <Button variant="secondary" size="sm" icon={<Download className="h-3 w-3" />}>
          Last ned
        </Button>
      </section>
    )
  }
  if (c.kind === 'on_job') {
    return (
      <section className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-orange-800">
          <DesignIcon name="Briefcase" className="h-3 w-3" /> Praktisk øvelse
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        <ul className="mt-2 space-y-2">
          {c.tasks.map((t) => (
            <li key={t.id} className="rounded-md bg-white p-3 text-[13px] text-neutral-700">
              <div className="font-semibold text-neutral-900">{t.title}</div>
              <div className="mt-1">{t.description}</div>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" icon={<Upload className="h-3 w-3" />} className="mt-3">
          Last opp dokumentasjon
        </Button>
      </section>
    )
  }
  if (c.kind === 'flashcard') {
    return (
      <section className="rounded-lg border border-pink-200 bg-pink-50/40 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-pink-800">
          <MousePointer2 className="h-3 w-3" /> Interaktiv øvelse · {c.slides.length} kort
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {c.slides.map((slide) => (
            <FlashcardCard key={slide.id} front={slide.front} back={slide.back} />
          ))}
        </div>
      </section>
    )
  }
  if (c.kind === 'image') {
    return (
      <section>
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
        {c.imageUrl ? (
          <img src={c.imageUrl} alt={c.caption} className="mt-3 w-full rounded-lg" />
        ) : (
          <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
            Bilde ikke lastet opp
          </div>
        )}
        {c.caption ? <p className="mt-2 text-sm text-neutral-600">{c.caption}</p> : null}
      </section>
    )
  }
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight text-neutral-900">{lesson.title}</h2>
      <p className="mt-2 text-[13px] text-neutral-700">Innhold-type «{block}» har ingen avspillingsvisning ennå.</p>
      {c.kind === 'other' && c.body ? (
        <div className="mt-2 text-[14px] text-neutral-700">{c.body}</div>
      ) : null}
    </section>
  )
}

function FlashcardCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setFlipped(!flipped)}
      className="flex h-24 flex-col items-center justify-center !rounded-md !border !border-pink-200 !bg-white !p-3 text-center !font-normal hover:!border-pink-400"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-pink-700">
        {flipped ? 'Bakside' : 'Forside'}
      </span>
      <span className="mt-1 text-sm font-medium text-neutral-800">{flipped ? back : front}</span>
    </Button>
  )
}
