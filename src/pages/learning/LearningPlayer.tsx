import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react'
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
              void (async () => {
                const cert = await issueCertificate(activeCourse.id, learnerName)
                if (cert !== null) alert(`Certificate issued! Code: ${cert.verifyCode}`)
              })()
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
    return <VideoPlayer url={c.url} caption={c.caption} onComplete={onComplete} />
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

// ─── VideoPlayer — inline embed with watch-progress tracking ─────────────────

type VideoKind = 'youtube' | 'vimeo' | 'mp4' | 'external'

function detectVideoKind(url: string): VideoKind {
  if (/youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/.test(url)) return 'youtube'
  if (/vimeo\.com/.test(url)) return 'vimeo'
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return 'mp4'
  return 'external'
}

function youtubeEmbedUrl(url: string): string {
  // Handle youtu.be/ID, youtube.com/watch?v=ID, already-embed URLs
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}?enablejsapi=1&rel=0&modestbranding=1`
  const longMatch = url.match(/[?&]v=([^&]+)/)
  if (longMatch) return `https://www.youtube.com/embed/${longMatch[1]}?enablejsapi=1&rel=0&modestbranding=1`
  if (url.includes('/embed/')) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}enablejsapi=1&rel=0&modestbranding=1`
  }
  return url
}

function vimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(\d+)/)
  if (match) return `https://player.vimeo.com/video/${match[1]}?api=1&title=0&byline=0&portrait=0`
  return url
}

function VideoPlayer({
  url,
  caption,
  onComplete,
}: {
  url: string
  caption: string
  onComplete: () => void
}) {
  const [watchedPct, setWatchedPct] = useState(0)
  const [manualOverride, setManualOverride] = useState(false)
  const [started, setStarted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const kind = detectVideoKind(url)
  const THRESHOLD = 80 // percent required to unlock

  const unlocked = watchedPct >= THRESHOLD || manualOverride

  // ── MP4 / native video tracking ─────────────────────────────────────
  function handleTimeUpdate() {
    const v = videoRef.current
    if (!v || !v.duration) return
    const pct = Math.round((v.currentTime / v.duration) * 100)
    setWatchedPct((prev) => Math.max(prev, pct))
    if (!started && pct > 0) setStarted(true)
  }

  // Progress ring SVG helper
  const RING_R = 18
  const RING_CIRC = 2 * Math.PI * RING_R
  const ringOffset = RING_CIRC - (watchedPct / 100) * RING_CIRC

  const progressColour = watchedPct >= THRESHOLD ? '#10b981' : watchedPct > 40 ? '#f59e0b' : '#6b7280'

  return (
    <div className="space-y-4">
      {/* Caption */}
      {caption && <p className="text-sm text-neutral-600">{caption}</p>}

      {/* ── YouTube embed ──────────────────────────────────────────────── */}
      {kind === 'youtube' && (
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={youtubeEmbedUrl(url)}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video"
              onLoad={() => setStarted(true)}
            />
          </div>
          {/* YouTube: can't track time via iframe without YT IFrame API + postMessage;
              show a self-report checkbox after the video has had time to load */}
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(e) => setManualOverride(e.target.checked)}
                className="size-4 rounded border-neutral-300"
                style={{ accentColor: PIN_GREEN }}
              />
              <span>
                Jeg har sett hele videoen{' '}
                <span className="text-xs text-neutral-400">(bekreft etter visning)</span>
              </span>
              {manualOverride && <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />}
            </label>
          </div>
        </div>
      )}

      {/* ── Vimeo embed ─────────────────────────────────────────────────── */}
      {kind === 'vimeo' && (
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={vimeoEmbedUrl(url)}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="Video"
              onLoad={() => setStarted(true)}
            />
          </div>
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(e) => setManualOverride(e.target.checked)}
                className="size-4 rounded border-neutral-300"
                style={{ accentColor: PIN_GREEN }}
              />
              <span>
                Jeg har sett hele videoen{' '}
                <span className="text-xs text-neutral-400">(bekreft etter visning)</span>
              </span>
              {manualOverride && <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />}
            </label>
          </div>
        </div>
      )}

      {/* ── Native MP4 — full progress tracking ─────────────────────────── */}
      {kind === 'mp4' && (
        <div className="overflow-hidden rounded-2xl shadow-lg bg-black">
          <video
            ref={videoRef}
            src={url}
            controls
            className="w-full"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setStarted(true)}
            onEnded={() => setWatchedPct(100)}
            style={{ maxHeight: '480px' }}
          />
          {/* Progress bar */}
          <div className="bg-neutral-900 px-4 py-3 flex items-center gap-3">
            {/* Ring progress */}
            <svg width="44" height="44" className="shrink-0 -rotate-90">
              <circle cx="22" cy="22" r={RING_R} fill="none" stroke="#374151" strokeWidth="3" />
              <circle
                cx="22" cy="22" r={RING_R} fill="none"
                stroke={progressColour} strokeWidth="3"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
              />
              <text x="22" y="26" textAnchor="middle"
                style={{ fontSize: 10, fill: 'white', transform: 'rotate(90deg)', transformOrigin: '22px 22px' }}>
                {watchedPct}%
              </text>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-700">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${watchedPct}%`, backgroundColor: progressColour }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                {watchedPct >= THRESHOLD
                  ? '✓ Tilstrekkelig sett — kan markeres fullført'
                  : `Se minst ${THRESHOLD}% for å låse opp fullføring (${watchedPct}% sett)`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── External / unrecognised URL ──────────────────────────────────── */}
      {kind === 'external' && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200">
              <Play className="size-5 text-neutral-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-800 text-sm">Eksternt video-innhold</p>
              <p className="mt-0.5 text-xs text-neutral-500 break-all">{url}</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2D403A] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={() => setStarted(true)}
              >
                <ExternalLink className="size-4" />
                Åpne video i ny fane
              </a>
            </div>
          </div>
          {started && (
            <div className="mt-4 border-t border-neutral-200 pt-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={manualOverride}
                  onChange={(e) => setManualOverride(e.target.checked)}
                  className="size-4 rounded border-neutral-300"
                  style={{ accentColor: PIN_GREEN }}
                />
                Jeg har sett hele videoen
                {manualOverride && <CheckCircle2 className="size-4 text-emerald-600" />}
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Complete button ─────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={!unlocked}
        onClick={() => onComplete()}
        className="w-full rounded-full py-3 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: PIN_GREEN }}
        title={unlocked ? undefined : `Se minst ${THRESHOLD}% av videoen for å gå videre`}
      >
        {unlocked ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="size-4" />
            {kind === 'mp4' ? `Fullført (${watchedPct}% sett)` : 'Fullført — fortsett'}
          </span>
        ) : (
          kind === 'mp4'
            ? `Se ${THRESHOLD - watchedPct}% til for å fortsette`
            : 'Bekreft at du har sett videoen ovenfor'
        )}
      </button>
    </div>
  )
}

