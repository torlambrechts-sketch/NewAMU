import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import type { CourseModule } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

export function LearningPlayer() {
  const { courseId } = useParams<{ courseId: string }>()
  const {
    courses,
    certificates,
    progress,
    ensureProgress,
    setModuleCompleted,
    issueCertificate,
  } = useLearning()
  const course = courses.find((c) => c.id === courseId)

  const [idx, setIdx] = useState(0)
  const [learnerName, setLearnerName] = useState('')
  const [flashFlipped, setFlashFlipped] = useState(false)
  const [flashIdx, setFlashIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [checkDone, setCheckDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (courseId) ensureProgress(courseId)
  }, [courseId, ensureProgress])

  const modules = useMemo(() => {
    if (!course) return []
    return [...course.modules].sort((a, b) => a.order - b.order)
  }, [course])

  const current = modules[idx]

  useEffect(() => {
    queueMicrotask(() => {
      setFlashFlipped(false)
      setFlashIdx(0)
      setQuizAnswers({})
    })
  }, [idx, current?.id])

  const courseProgress = progress.find((p) => p.courseId === course?.id)
  const modulesComplete = Boolean(
    course &&
      course.modules.length > 0 &&
      course.modules.every((m) => courseProgress?.moduleProgress[m.id]?.completed),
  )
  const hasCert = course
    ? certificates.some((c) => c.courseId === course.id)
    : false

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

      <div className="flex flex-wrap gap-2">
        {modules.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setIdx(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === idx ? 'text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
            style={i === idx ? { backgroundColor: PIN_GREEN } : {}}
          >
            {i + 1}. {m.kind}
          </button>
        ))}
      </div>

      {current && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-[#2D403A]">{current.title}</h2>
          <p className="text-xs text-neutral-500">~{current.durationMinutes} min · {current.kind}</p>
          <div className="mt-6">
            <ModulePlayer
              mod={current}
              flashFlipped={flashFlipped}
              setFlashFlipped={setFlashFlipped}
              flashIdx={flashIdx}
              setFlashIdx={setFlashIdx}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              checkDone={checkDone}
              setCheckDone={setCheckDone}
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
          Mark each module complete with the button inside the module. When finished, enter your name for a demo
          certificate.
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
              if (cert !== null) alert(`Certificate issued! Code: ${cert.verifyCode}`)
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: PIN_GREEN }}
          >
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
    </div>
  )
}

function ModulePlayer({
  mod,
  flashFlipped,
  setFlashFlipped,
  flashIdx,
  setFlashIdx,
  quizAnswers,
  setQuizAnswers,
  checkDone,
  setCheckDone,
  onComplete,
}: {
  mod: CourseModule
  flashFlipped: boolean
  setFlashFlipped: (v: boolean) => void
  flashIdx: number
  setFlashIdx: Dispatch<SetStateAction<number>>
  quizAnswers: Record<string, number>
  setQuizAnswers: Dispatch<SetStateAction<Record<string, number>>>
  checkDone: Record<string, boolean>
  setCheckDone: Dispatch<SetStateAction<Record<string, boolean>>>
  onComplete: (extra?: { score?: number; lastAnswers?: Record<string, number> }) => void
}) {
  const c = mod.content

  if (c.kind === 'flashcard') {
    const slide = c.slides[Math.min(flashIdx, Math.max(0, c.slides.length - 1))]
    if (!slide) return <p>No cards</p>
    const last = flashIdx >= c.slides.length - 1
    return (
      <div className="space-y-4">
        <div className="text-center text-xs text-neutral-500">
          Card {flashIdx + 1} / {c.slides.length}
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
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={flashIdx <= 0}
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
              setFlashIdx((i) => Math.min(c.slides.length - 1, i + 1))
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
    return (
      <div className="space-y-6">
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
                      onClick={() => setQuizAnswers((s) => ({ ...s, [q.id]: i }))}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        sel === i ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'
                      }`}
                    >
                      {o}
                    </button>
                  </li>
                ))}
              </ul>
              {sel !== undefined && (
                <p className={`mt-2 text-sm ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  {ok ? 'Correct' : 'Incorrect'}
                </p>
              )}
            </div>
          )
        })}
        {answered ? (
          <p className="text-sm font-medium text-[#2D403A]">
            Score: {correctCount}/{c.questions.length} ({scorePct}%)
          </p>
        ) : null}
        <button
          type="button"
          disabled={!answered}
          onClick={() => onComplete({ score: scorePct, lastAnswers })}
          className="w-full rounded-full py-3 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Complete quiz
        </button>
      </div>
    )
  }

  if (c.kind === 'text') {
    const html = sanitizeLearningHtml(normalizeModuleHtml(c.body))
    return (
      <div>
        <div
          className="prose prose-sm max-w-none text-neutral-800 [&_a]:text-emerald-800 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <button
          type="button"
          onClick={() => onComplete()}
          className="mt-6 w-full rounded-full py-3 text-sm font-medium text-white"
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
    return (
      <div>
        <p className="text-sm text-neutral-600">{c.caption}</p>
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm"
        >
          <Play className="size-4" /> Open media
        </a>
        <button
          type="button"
          onClick={() => onComplete()}
          className="mt-6 block w-full rounded-full py-3 text-sm font-medium text-white"
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
    return (
      <ul className="space-y-2">
        {c.items.map((t, i) => (
          <li key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            💡 {t}
          </li>
        ))}
        <button
          type="button"
          onClick={() => onComplete()}
          className="mt-4 w-full rounded-full py-3 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Continue
        </button>
      </ul>
    )
  }

  if (c.kind === 'on_job') {
    return (
      <div className="space-y-3">
        {c.tasks.map((t) => (
          <div key={t.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-neutral-600">{t.description}</div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onComplete()}
          className="w-full rounded-full py-3 text-sm font-medium text-white"
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
