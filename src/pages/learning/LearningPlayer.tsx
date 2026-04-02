import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Award, Check, ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import type { Course, CourseModule, CourseProgress } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'
import { classifyVideoUrl, vimeoEmbedSrc, youtubeEmbedSrc } from '../../lib/videoEmbed'

const TEXT_DWELL_WORDS = 120
const TEXT_DWELL_SEC = 12
const IFRAME_MIN_WATCH_SEC = 30

function stripHtmlWordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

function firstIncompleteModuleIndex(modules: CourseModule[], cp: CourseProgress | undefined): number {
  if (!cp) return 0
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]
    if (!cp.moduleProgress[m.id]?.completed) return i
  }
  return Math.max(0, modules.length - 1)
}

export function LearningPlayer() {
  const { courseId } = useParams<{ courseId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    courses,
    certificates,
    progress,
    ensureProgress,
    setModuleCompleted,
    patchModuleProgress,
    issueCertificate,
  } = useLearning()
  const course = courses.find((c) => c.id === courseId)

  const jumpModuleId = searchParams.get('m')
  const [idx, setIdx] = useState(0)
  const resumeRef = useRef(false)
  const [learnerName, setLearnerName] = useState('')
  const [certModal, setCertModal] = useState<{ code: string; title: string } | null>(null)

  const [flashFlipped, setFlashFlipped] = useState(false)
  const [flashQueue, setFlashQueue] = useState<string[]>([])
  const [flashIdx, setFlashIdx] = useState(0)

  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const [checkDone, setCheckDone] = useState<Record<string, boolean>>({})

  /** Only used when text module exceeds word threshold */
  const [longTextDwellDone, setLongTextDwellDone] = useState(false)
  const [textReflection, setTextReflection] = useState('')

  const [videoProgress, setVideoProgress] = useState(0)
  const [iframeWatchSec, setIframeWatchSec] = useState(0)

  const [tipsPick, setTipsPick] = useState<number | null>(null)

  const [onJobNotes, setOnJobNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (courseId) ensureProgress(courseId)
  }, [courseId, ensureProgress])

  useEffect(() => {
    resumeRef.current = false
  }, [courseId])

  const modules = useMemo(() => {
    if (!course) return []
    return [...course.modules].sort((a, b) => a.order - b.order)
  }, [course])

  const courseProgress = progress.find((p) => p.courseId === course?.id)

  useEffect(() => {
    if (!course || !courseProgress || modules.length === 0 || resumeRef.current) return
    resumeRef.current = true
    queueMicrotask(() => {
      let next = firstIncompleteModuleIndex(modules, courseProgress)
      if (jumpModuleId) {
        const j = modules.findIndex((m) => m.id === jumpModuleId)
        if (j >= 0) next = j
        setSearchParams({}, { replace: true })
      }
      setIdx(next)
    })
  }, [course, courseProgress, modules, jumpModuleId, setSearchParams])

  const current = modules[idx]

  const textDwellOk = useMemo(() => {
    if (!current || current.content.kind !== 'text') return true
    const words = stripHtmlWordCount(current.content.body)
    if (words <= TEXT_DWELL_WORDS) return true
    return longTextDwellDone
  }, [current, longTextDwellDone])

  useEffect(() => {
    queueMicrotask(() => {
      setFlashFlipped(false)
      setFlashIdx(0)
      setQuizAnswers({})
      setQuizSubmitted(false)
      setTextReflection('')
      setVideoProgress(0)
      setIframeWatchSec(0)
      setTipsPick(null)
      if (current?.content.kind === 'flashcard') {
        setFlashQueue(current.content.slides.map((s) => s.id))
      } else {
        setFlashQueue([])
      }
      if (current?.content.kind === 'text') {
        const w = stripHtmlWordCount(current.content.body)
        if (w > TEXT_DWELL_WORDS) setLongTextDwellDone(false)
      }

      if (current && courseProgress) {
        const mp = courseProgress.moduleProgress[current.id]
        if (current.content.kind === 'quiz' && mp?.lastAnswers) {
          setQuizAnswers(mp.lastAnswers)
          setQuizSubmitted(true)
        }
        if (current.content.kind === 'text' && mp?.reflectionAnswer) {
          setTextReflection(mp.reflectionAnswer)
        }
        if (current.content.kind === 'tips' && mp?.tipsReflectionIndex != null) {
          setTipsPick(mp.tipsReflectionIndex)
        }
        if (current.content.kind === 'on_job' && mp?.onJobTaskNotes) {
          setOnJobNotes(mp.onJobTaskNotes)
        }
      }
    })
  }, [idx, current, courseProgress])

  useEffect(() => {
    if (!current || current.content.kind !== 'text') return
    const words = stripHtmlWordCount(current.content.body)
    if (words <= TEXT_DWELL_WORDS) return
    const t = window.setTimeout(() => setLongTextDwellDone(true), TEXT_DWELL_SEC * 1000)
    return () => clearTimeout(t)
  }, [current])

  useEffect(() => {
    if (!current || current.content.kind !== 'video') return
    const kind = classifyVideoUrl(current.content.url)
    if (kind === 'youtube' || kind === 'vimeo' || kind === 'unknown') {
      const t = window.setInterval(() => {
        setIframeWatchSec((s) => s + 1)
      }, 1000)
      return () => clearInterval(t)
    }
    return undefined
  }, [current])

  const modulesComplete = Boolean(
    course &&
      course.modules.length > 0 &&
      course.modules.every((m) => courseProgress?.moduleProgress[m.id]?.completed),
  )
  const hasCert = course ? certificates.some((c) => c.courseId === course.id) : false

  if (!course || course.status !== 'published') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        {course ? (
          <>
            This course is not published.{' '}
            <Link to={`/learning/courses/${course.id}`} className="underline">
              Open builder
            </Link>
          </>
        ) : (
          'Course not found.'
        )}
      </div>
    )
  }

  const activeCourse = course

  const completedCount = modules.filter((m) => courseProgress?.moduleProgress[m.id]?.completed).length
  const remainingMin = modules
    .filter((m) => !courseProgress?.moduleProgress[m.id]?.completed)
    .reduce((a, m) => a + m.durationMinutes, 0)

  function completeCurrent(extra?: { score?: number; lastAnswers?: Record<string, number> }) {
    if (!current) return
    setModuleCompleted(activeCourse.id, current.id, extra)
    if (idx < modules.length - 1) setIdx(idx + 1)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-sm">
        <Link to="/learning/courses" className="text-emerald-800 hover:underline">
          ← Courses
        </Link>
      </nav>
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">{activeCourse.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{activeCourse.description}</p>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-[#2D403A]">
            Progress: {completedCount} of {modules.length} modules complete
          </span>
          <span className="text-neutral-600">~{remainingMin} min remaining</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${modules.length ? (completedCount / modules.length) * 100 : 0}%`,
              backgroundColor: PIN_GREEN,
            }}
          />
        </div>
      </div>

      {idx === 0 && activeCourse.learningObjectives && activeCourse.learningObjectives.length > 0 ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" aria-labelledby="obj-heading">
          <h2 id="obj-heading" className="font-serif text-lg font-semibold text-[#2D403A]">
            What you will learn
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-neutral-700">
            {activeCourse.learningObjectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {modules.map((m, i) => {
          const done = courseProgress?.moduleProgress[m.id]?.completed
          const label = m.title.length > 36 ? `${m.title.slice(0, 34)}…` : m.title
          return (
            <button
              key={m.id}
              type="button"
              title={m.title}
              onClick={() => setIdx(i)}
              className={`max-w-[220px] truncate rounded-full px-3 py-1 text-left text-xs font-medium ${
                i === idx ? 'text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
              style={i === idx ? { backgroundColor: PIN_GREEN } : {}}
            >
              {i + 1}. {label}
              {done ? ' ✓' : ''}
            </button>
          )
        })}
      </div>

      {current && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-[#2D403A]">{current.title}</h2>
          <p className="text-xs text-neutral-500">
            ~{current.durationMinutes} min · {current.kind}
          </p>
          <div className="mt-6">
            <ModulePlayer
              course={activeCourse}
              courseProgress={courseProgress}
              mod={current}
              flashFlipped={flashFlipped}
              setFlashFlipped={setFlashFlipped}
              flashQueue={flashQueue}
              setFlashQueue={setFlashQueue}
              flashIdx={flashIdx}
              setFlashIdx={setFlashIdx}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              quizSubmitted={quizSubmitted}
              setQuizSubmitted={setQuizSubmitted}
              checkDone={checkDone}
              setCheckDone={setCheckDone}
              textDwellOk={textDwellOk}
              textWordCount={
                current?.content.kind === 'text' ? stripHtmlWordCount(current.content.body) : 0
              }
              textReflection={textReflection}
              setTextReflection={setTextReflection}
              videoProgress={videoProgress}
              setVideoProgress={setVideoProgress}
              iframeWatchSec={iframeWatchSec}
              tipsPick={tipsPick}
              setTipsPick={setTipsPick}
              onJobNotes={onJobNotes}
              setOnJobNotes={setOnJobNotes}
              patchModuleProgress={patchModuleProgress}
              onComplete={completeCurrent}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          disabled={idx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="rounded-full border border-neutral-200 px-4 py-2 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={idx >= modules.length - 1}
          onClick={() => setIdx((i) => Math.min(modules.length - 1, i + 1))}
          className="rounded-full border border-neutral-200 px-4 py-2 text-sm disabled:opacity-40"
        >
          Next module
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5">
        <h3 className="font-semibold text-[#2D403A]">Complete course & certificate</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Mark each module complete from within the module. Then enter your name for a demo certificate.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={learnerName}
            onChange={(e) => setLearnerName(e.target.value)}
            placeholder="Your full name"
            className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!modulesComplete || hasCert}
            onClick={() => {
              if (!learnerName.trim()) return
              const cert = issueCertificate(activeCourse.id, learnerName)
              if (cert !== null) setCertModal({ code: cert.verifyCode, title: activeCourse.title })
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: PIN_GREEN }}
          >
            <Award className="size-4" />
            {hasCert ? 'Certificate issued' : 'Issue certificate'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {!modulesComplete
            ? 'Complete every module to unlock certificate issuance.'
            : hasCert
              ? 'A certificate is already on file for this course in this browser.'
              : 'You can issue your demo certificate now.'}
        </p>
      </div>

      {certModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-title"
        >
          <div className="relative max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
              onClick={() => setCertModal(null)}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="text-5xl" aria-hidden>
              🏆
            </div>
            <h2 id="cert-title" className="mt-4 font-serif text-xl font-semibold text-[#2D403A]">
              Congratulations!
            </h2>
            <p className="mt-2 text-sm text-neutral-600">You completed</p>
            <p className="font-medium text-[#2D403A]">{certModal.title}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-neutral-500">Verification code</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-emerald-800">{certModal.code}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-lg border border-neutral-200 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
              onClick={() => {
                setCertModal(null)
                window.print()
              }}
            >
              Print / save as PDF
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ModulePlayer({
  course,
  courseProgress,
  mod,
  flashFlipped,
  setFlashFlipped,
  flashQueue,
  setFlashQueue,
  flashIdx,
  setFlashIdx,
  quizAnswers,
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  checkDone,
  setCheckDone,
  textDwellOk,
  textWordCount,
  textReflection,
  setTextReflection,
  videoProgress,
  setVideoProgress,
  iframeWatchSec,
  tipsPick,
  setTipsPick,
  onJobNotes,
  setOnJobNotes,
  patchModuleProgress,
  onComplete,
}: {
  course: Course
  courseProgress: CourseProgress | undefined
  mod: CourseModule
  flashFlipped: boolean
  setFlashFlipped: (v: boolean) => void
  flashQueue: string[]
  setFlashQueue: Dispatch<SetStateAction<string[]>>
  flashIdx: number
  setFlashIdx: Dispatch<SetStateAction<number>>
  quizAnswers: Record<string, number>
  setQuizAnswers: Dispatch<SetStateAction<Record<string, number>>>
  quizSubmitted: boolean
  setQuizSubmitted: Dispatch<SetStateAction<boolean>>
  checkDone: Record<string, boolean>
  setCheckDone: Dispatch<SetStateAction<Record<string, boolean>>>
  textDwellOk: boolean
  textWordCount: number
  textReflection: string
  setTextReflection: (v: string) => void
  videoProgress: number
  setVideoProgress: (n: number) => void
  iframeWatchSec: number
  tipsPick: number | null
  setTipsPick: (n: number | null) => void
  onJobNotes: Record<string, string>
  setOnJobNotes: Dispatch<SetStateAction<Record<string, string>>>
  patchModuleProgress: ReturnType<typeof useLearning>['patchModuleProgress']
  onComplete: (extra?: { score?: number; lastAnswers?: Record<string, number> }) => void
}) {
  const c = mod.content
  const mp = courseProgress?.moduleProgress[mod.id]
  const minPass =
    mod.kind === 'quiz'
      ? mod.minPassScore ?? course.minPassScore ?? 70
      : 0

  if (c.kind === 'flashcard') {
    const slidesById = new Map(c.slides.map((s) => [s.id, s]))
    const q = flashQueue.length ? flashQueue : c.slides.map((s) => s.id)
    const safeIdx = Math.min(flashIdx, Math.max(0, q.length - 1))
    const slideId = q[safeIdx]
    const slide = slideId ? slidesById.get(slideId) : undefined
    if (!slide) return <p>No cards</p>
    const last = safeIdx >= q.length - 1
    const dueStr = mp?.flashcardSlideState?.[slide.id]?.reviewDueAt ?? slide.reviewDueAt
    const hasSchedule = Boolean(dueStr)

    return (
      <div className="space-y-4">
        <div className="text-center text-xs text-neutral-500">
          Card {safeIdx + 1} / {q.length}
          {hasSchedule ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Review scheduled</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setFlashFlipped(!flashFlipped)}
          className="relative mx-auto block aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl shadow-xl"
          style={{
            background: flashFlipped
              ? 'linear-gradient(160deg, #1e3d35 0%, #2D403A 100%)'
              : 'linear-gradient(160deg, #3d5a52 0%, #2D403A 100%)',
          }}
        >
          <div className="flex h-full flex-col justify-between p-6 text-white">
            <div className="text-xs uppercase tracking-widest opacity-70">
              {flashFlipped ? 'Answer' : 'Question'}
            </div>
            <p className="text-center font-serif text-xl leading-snug">
              {flashFlipped ? slide.back : slide.front}
            </p>
            <div className="text-center text-xs opacity-70">Tap to flip</div>
          </div>
        </button>
        {flashFlipped ? (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              className="rounded-full border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
              onClick={() => {
                const nextDue = new Date(Date.now() + 864e5 * 3).toISOString()
                patchModuleProgress(course.id, mod.id, {
                  flashcardSlideState: {
                    ...mp?.flashcardSlideState,
                    [slide.id]: { reviewDueAt: nextDue },
                  },
                })
                if (last) {
                  onComplete()
                } else {
                  setFlashIdx((i) => i + 1)
                  setFlashFlipped(false)
                }
              }}
            >
              Got it
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800"
              onClick={() => {
                setFlashQueue((prev) => {
                  const cur = prev[safeIdx]
                  if (!cur) return prev
                  const rest = prev.filter((_, i) => i !== safeIdx)
                  return [...rest, cur]
                })
                setFlashIdx(0)
                setFlashFlipped(false)
              }}
            >
              Review again
            </button>
          </div>
        ) : null}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={safeIdx <= 0}
            onClick={() => {
              setFlashIdx((i) => Math.max(0, i - 1))
              setFlashFlipped(false)
            }}
            className="rounded-full border border-neutral-200 p-2 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={last}
            onClick={() => {
              setFlashIdx((i) => Math.min(q.length - 1, i + 1))
              setFlashFlipped(false)
            }}
            className="rounded-full border border-neutral-200 p-2 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onComplete()}
          className="w-full rounded-full py-3 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Mark deck complete
        </button>
      </div>
    )
  }

  if (c.kind === 'quiz') {
    if (c.questions.length === 0) return <p>No questions</p>
    const answered = c.questions.every((q) => quizAnswers[q.id] !== undefined)
    let correctCount = 0
    for (const q of c.questions) {
      if (quizAnswers[q.id] === q.correctIndex) correctCount += 1
    }
    const scorePct = Math.round((correctCount / c.questions.length) * 100)
    const lastAnswers = Object.fromEntries(
      c.questions.map((q) => [q.id, quizAnswers[q.id] ?? -1]),
    )
    const passed = scorePct >= minPass
    const wrong = c.questions.filter((q) => quizAnswers[q.id] !== q.correctIndex)

    function tryAgain() {
      setQuizAnswers({})
      setQuizSubmitted(false)
    }

    return (
      <div className="space-y-6">
        <p className="text-xs text-neutral-500">Passing score: {minPass}%</p>
        {c.questions.map((q) => {
          const sel = quizAnswers[q.id]
          const ok = sel === q.correctIndex
          return (
            <div key={q.id} className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
              <p className="font-medium text-neutral-900">{q.question}</p>
              <ul className="mt-3 space-y-2">
                {q.options.map((o, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={quizSubmitted}
                      onClick={() => setQuizAnswers((s) => ({ ...s, [q.id]: i }))}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        sel === i ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'
                      } ${quizSubmitted ? 'opacity-90' : ''}`}
                    >
                      {o}
                    </button>
                  </li>
                ))}
              </ul>
              {sel !== undefined && (
                <div className="mt-2 space-y-1">
                  <p className={`text-sm ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
                    {ok ? 'Correct' : 'Incorrect'}
                  </p>
                  {q.explanation ? (
                    <p className="text-sm text-neutral-700">{q.explanation}</p>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
        {answered ? (
          <p className="text-sm font-medium text-[#2D403A]">
            Score: {correctCount}/{c.questions.length} ({scorePct}%)
            {!passed && quizSubmitted ? (
              <span className="ml-2 text-red-700">Below passing ({minPass}% required)</span>
            ) : null}
          </p>
        ) : null}

        {quizSubmitted && wrong.length > 0 ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3 text-sm">
            <p className="font-medium text-amber-950">Review incorrect</p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-amber-950">
              {wrong.map((q) => (
                <li key={q.id}>
                  <span className="font-medium">{q.question}</span> — Correct:{' '}
                  <strong>{q.options[q.correctIndex]}</strong>
                  {q.explanation ? <span className="block text-neutral-700">{q.explanation}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!quizSubmitted ? (
          <button
            type="button"
            disabled={!answered}
            onClick={() => setQuizSubmitted(true)}
            className="w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: PIN_GREEN }}
          >
            Check answers
          </button>
        ) : passed ? (
          <button
            type="button"
            onClick={() => onComplete({ score: scorePct, lastAnswers })}
            className="w-full rounded-full py-3 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
          >
            Complete module
          </button>
        ) : (
          <button
            type="button"
            onClick={tryAgain}
            className="w-full rounded-full border border-neutral-300 py-3 text-sm font-medium text-[#2D403A]"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (c.kind === 'text') {
    const html = sanitizeLearningHtml(normalizeModuleHtml(c.body))
    const needReflect = Boolean(c.reflectionPrompt?.trim())
    const canContinue =
      textDwellOk && (!needReflect || textReflection.trim().length >= 3)

    return (
      <div>
        {textWordCount > TEXT_DWELL_WORDS ? (
          <p className="mb-3 text-xs text-neutral-500">
            {!textDwellOk
              ? `Please read for at least ${TEXT_DWELL_SEC}s… (${textWordCount} words)`
              : 'You can continue.'}
          </p>
        ) : null}
        <div
          className="prose prose-sm max-w-none text-neutral-800 [&_a]:text-emerald-800 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {c.reflectionPrompt ? (
          <label className="mt-4 block text-sm">
            <span className="font-medium text-[#2D403A]">{c.reflectionPrompt}</span>
            <textarea
              value={textReflection}
              onChange={(e) => {
                setTextReflection(e.target.value)
                patchModuleProgress(course.id, mod.id, { reflectionAnswer: e.target.value })
              }}
              rows={3}
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onComplete()}
          className="mt-6 w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Continue
        </button>
      </div>
    )
  }

  if (c.kind === 'image') {
    return (
      <div>
        <img src={c.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />
        <p className="mt-2 text-sm text-neutral-600">{c.caption}</p>
        <button
          type="button"
          onClick={() => onComplete()}
          className="mt-4 w-full rounded-full py-3 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Continue
        </button>
      </div>
    )
  }

  if (c.kind === 'video') {
    const url = c.url.trim()
    const kind = classifyVideoUrl(url)
    const yt = youtubeEmbedSrc(url)
    const vm = vimeoEmbedSrc(url)
    const needIframeWatch = (kind === 'youtube' || kind === 'vimeo') && iframeWatchSec < IFRAME_MIN_WATCH_SEC
    const needDirect = kind === 'direct' && videoProgress < 0.8
    const canMark =
      kind === 'unknown'
        ? iframeWatchSec >= 15
        : kind === 'youtube' || kind === 'vimeo'
          ? !needIframeWatch
          : kind === 'direct'
            ? !needDirect
            : iframeWatchSec >= 15

    return (
      <div>
        <p className="text-sm text-neutral-600">{c.caption}</p>
        {yt ? (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              title="Video"
              src={yt}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : vm ? (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe title="Video" src={vm} className="h-full w-full" allowFullScreen />
          </div>
        ) : kind === 'direct' ? (
          <video
            className="mt-4 w-full rounded-xl"
            src={url}
            controls
            onTimeUpdate={(e) => {
              const el = e.currentTarget
              if (el.duration) setVideoProgress(el.currentTime / el.duration)
            }}
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm"
          >
            <Play className="size-4" /> Open media
          </a>
        )}
        {(kind === 'youtube' || kind === 'vimeo') && needIframeWatch ? (
          <p className="mt-2 text-xs text-neutral-500">
            Watch at least {IFRAME_MIN_WATCH_SEC}s before marking complete ({iframeWatchSec}s / {IFRAME_MIN_WATCH_SEC}s)
          </p>
        ) : null}
        {kind === 'direct' && needDirect ? (
          <p className="mt-2 text-xs text-neutral-500">
            Watch at least 80% of the video before marking complete ({Math.round(videoProgress * 100)}%)
          </p>
        ) : null}
        {kind === 'unknown' ? (
          <p className="mt-2 text-xs text-neutral-500">Stay on this page ~15s or open the link, then confirm below.</p>
        ) : null}
        <button
          type="button"
          disabled={!canMark}
          onClick={() => onComplete()}
          className="mt-6 block w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Mark viewed
        </button>
      </div>
    )
  }

  if (c.kind === 'checklist') {
    const allChecked = c.items.every((it) => checkDone[it.id])
    return (
      <ul className="space-y-2">
        {c.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCheckDone((s) => ({ ...s, [it.id]: !s[it.id] }))
              }
              className={`flex size-8 items-center justify-center rounded-full border-2 ${
                checkDone[it.id] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300'
              }`}
            >
              {checkDone[it.id] ? <Check className="size-4" /> : null}
            </button>
            <span>{it.label}</span>
          </li>
        ))}
        <button
          type="button"
          disabled={!allChecked}
          onClick={() => onComplete()}
          className="mt-4 w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Complete checklist
        </button>
      </ul>
    )
  }

  if (c.kind === 'tips') {
    const prompt = c.reflectionPrompt?.trim()
    const canTip =
      !prompt || tipsPick !== null

    return (
      <div>
        <ul className="space-y-2">
          {c.items.map((t, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  setTipsPick(i)
                  patchModuleProgress(course.id, mod.id, { tipsReflectionIndex: i })
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm text-amber-950 ${
                  tipsPick === i ? 'ring-2 ring-amber-500' : 'bg-amber-50'
                }`}
              >
                💡 {t}
              </button>
            </li>
          ))}
        </ul>
        {prompt ? (
          <p className="mt-3 text-xs text-neutral-600">{prompt}</p>
        ) : null}
        <button
          type="button"
          disabled={!canTip}
          onClick={() => onComplete()}
          className="mt-4 w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Continue
        </button>
      </div>
    )
  }

  if (c.kind === 'on_job') {
    const allFilled = c.tasks.every((t) => (onJobNotes[t.id] ?? '').trim().length >= 2)
    return (
      <div className="space-y-3">
        {c.tasks.map((t) => (
          <div key={t.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-neutral-600">{t.description}</div>
            <label className="mt-2 block text-xs text-neutral-500">
              Initials / note (audit)
              <input
                value={onJobNotes[t.id] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setOnJobNotes((s) => {
                    const next = { ...s, [t.id]: v }
                    patchModuleProgress(course.id, mod.id, { onJobTaskNotes: next })
                    return next
                  })
                }}
                className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          disabled={!allFilled}
          onClick={() => onComplete()}
          className="w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Confirm on-the-job review
        </button>
      </div>
    )
  }

  if (c.kind === 'other') {
    const otherHtml = sanitizeLearningHtml(normalizeModuleHtml(c.body))
    return (
      <div>
        <h3 className="font-medium">{c.title}</h3>
        <div
          className="prose prose-sm mt-2 max-w-none text-neutral-700 [&_a]:text-emerald-800 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: otherHtml }}
        />
        <button
          type="button"
          onClick={() => onComplete()}
          className="mt-4 w-full rounded-full py-3 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Continue
        </button>
      </div>
    )
  }

  return null
}
