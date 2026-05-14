// Alternative 2 — "Cinema Card". Story-driven, fixed 960×640 stage on an
// ambient backdrop. Inspired by Headspace and Apple Keynote. The card is the
// single focal element; controls live outside it. XP reward on completion.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  Flame,
  PartyPopper,
  Sparkles,
  X,
} from 'lucide-react'
import { MOCK_COURSE, type MockModule } from './mockCourse'

const ACCENT = '#1a3d32'
const GOLD = '#c9a227'

export function PlatformCoursePlayerCinemaPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({})
  const [xpToast, setXpToast] = useState<number | null>(null)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [finished, setFinished] = useState(false)

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const overall = completedCount / total

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
    if (mod.kind === 'quiz' && !quizSubmitted[mod.id]) return 'Sjekk svarene først for å gå videre.'
    if (mod.kind === 'quiz' && quizSubmitted[mod.id]) {
      const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
      if (right / mod.questions.length < 2 / 3) return 'Du må ha minst 2 riktige for å gå videre.'
    }
    if (mod.kind === 'reflection' && !canAdvance) return 'Skriv minst 10 tegn i hvert felt.'
    return null
  })()

  function advance() {
    setCompleted((c) => ({ ...c, [mod.id]: true }))
    setXpToast(25)
    if (idx < total - 1) {
      setTimeout(() => {
        setDirection('forward')
        setIdx(idx + 1)
      }, 250)
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

  // Keyboard nav — ArrowLeft / ArrowRight
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

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      <div
        className="relative min-h-[calc(100vh-100px)] overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at top, #1f3b3a 0%, #0f1e1d 40%, #050b0a 100%)',
        }}
      >
        {/* Ambient texture / vignette */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(201,162,39,0.18), transparent 40%), radial-gradient(circle at 80% 70%, rgba(26,61,50,0.4), transparent 50%)',
          }}
        />

        {/* Top chrome */}
        <div className="relative z-10 mx-auto flex max-w-[1100px] items-center justify-between px-6 py-6">
          <Link
            to="/platform-admin/course-player"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white"
          >
            <ChevronLeft className="size-3.5" /> Tilbake til oversikt
          </Link>
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span className="hidden font-medium uppercase tracking-[2px] sm:inline">
              {course.title}
            </span>
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1">
              <Flame className="size-3.5" style={{ color: GOLD }} />
              <span className="font-semibold text-white">3 dagers streak</span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-white/80 hover:bg-white/5"
            >
              <X className="size-3.5" /> Avslutt
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div className="relative z-10 mx-auto flex max-w-[1100px] items-center justify-center gap-2 pb-6">
          {course.modules.map((m, i) => {
            const done = completed[m.id]
            const isCurrent = i === idx
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setDirection(i > idx ? 'forward' : 'backward')
                  setIdx(i)
                }}
                title={`Modul ${i + 1}: ${m.title}`}
                aria-label={`Gå til modul ${i + 1}: ${m.title}${done ? ' (fullført)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isCurrent ? 'w-10' : done ? 'w-2' : 'w-2'
                }`}
                style={{
                  backgroundColor: isCurrent ? GOLD : done ? 'rgba(201,162,39,0.6)' : 'rgba(255,255,255,0.2)',
                }}
              />
            )
          })}
        </div>

        {/* Stage card */}
        <div className="relative z-10 mx-auto px-6 pb-10">
          {finished ? (
            <div
              role="status"
              className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[#fdfcf7] px-10 py-14 text-center shadow-2xl shadow-black/60"
            >
              <span
                className="flex size-14 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <PartyPopper className="size-6" />
              </span>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-[#0f1311]">Kurset er fullført</h2>
                <p className="text-sm text-[#1f2421]/70">
                  Du fikk +75 XP og kursbeviset er signert. Bra jobba!
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md"
                  style={{ backgroundColor: ACCENT }}
                >
                  Last ned kursbevis (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinished(false)
                    setIdx(0)
                    setCompleted({})
                    setQuizAnswers({})
                    setQuizSubmitted({})
                    setReflections({})
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dcd4be] bg-white px-5 py-2.5 text-sm font-medium text-[#1f2421] hover:bg-[#efe9d8]"
                >
                  Start på nytt
                </button>
              </div>
            </div>
          ) : (
          <div
            key={mod.id}
            className={`mx-auto flex w-full max-w-[960px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#fdfcf7] shadow-2xl shadow-black/60 ${
              direction === 'forward' ? 'animate-cinema-in-right' : 'animate-cinema-in-left'
            }`}
            style={{ minHeight: '560px' }}
          >
            <div className="flex items-center justify-between border-b border-[#e8e2d2] px-10 py-5">
              <p
                className="text-[11px] font-semibold uppercase tracking-[2.5px]"
                style={{ color: ACCENT }}
              >
                {mod.eyebrow}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {mod.lawRefs.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-[#e8e2d2] bg-white px-2.5 py-0.5 font-mono text-[10px] text-[#1f2421]/70"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-6 px-10 py-10">
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

            {/* Stage footer — primary CTA inside the card */}
            <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#e8e2d2] bg-[#f7f5ee] px-10 py-5">
              <span className="text-xs text-[#1f2421]/60">
                Modul {idx + 1} av {total} · {mod.durationMinutes} min
              </span>
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
                  onClick={advance}
                  disabled={!canAdvance}
                  aria-describedby={disabledHint ? 'cinema-disabled-hint' : undefined}
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: ACCENT }}
                >
                  {idx === total - 1 ? 'Avslutt kurset' : 'Fortsett'}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Persistent control bar outside the stage */}
        <div className="relative z-10 mx-auto flex max-w-[1100px] items-center justify-between px-6 pb-10">
          <button
            type="button"
            onClick={goBack}
            disabled={idx === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="size-3.5" /> Forrige
          </button>

          {/* Time ring + percent */}
          <div
            className="flex items-center gap-3 text-xs text-white/70"
            role="group"
            aria-label="Total fremdrift"
          >
            <ProgressRing value={overall} />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-white">{Math.round(overall * 100)}%</span>
              <span className="uppercase tracking-wide text-white/50">fullført</span>
            </div>
          </div>

          <span className="text-xs text-white/50">
            {course.audience}
          </span>
        </div>

        {/* XP reward toast */}
        {xpToast !== null ? (
          <div className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 animate-cinema-xp">
            <div
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-5 py-2.5 text-sm font-semibold backdrop-blur"
              style={{ color: GOLD }}
            >
              <Sparkles className="size-4" /> +{xpToast} XP · modul fullført
            </div>
          </div>
        ) : null}

        <CinemaDesignNotes />
      </div>

      {/* Local CSS for stage transitions — disabled under prefers-reduced-motion */}
      <style>{`
        @keyframes cinemaInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cinemaInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes cinemaXp { 0% { opacity: 0; transform: translate(-50%, 12px); } 20% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -8px); } }
        @media (prefers-reduced-motion: no-preference) {
          .animate-cinema-in-right { animation: cinemaInRight 0.45s ease-out; }
          .animate-cinema-in-left { animation: cinemaInLeft 0.45s ease-out; }
          .animate-cinema-xp { animation: cinemaXp 1.8s ease-out; }
        }
      `}</style>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const size = 36
  const r = 14
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(1, Math.max(0, value)))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={3} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={GOLD}
        strokeWidth={3}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
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
      <>
        <h1 className="text-[32px] font-semibold leading-tight text-[#0f1311]">{mod.title}</h1>
        <p className="text-xl leading-relaxed text-[#1f2421]">{mod.lead}</p>
        <div className="space-y-4 text-[16px] leading-[1.7] text-[#2a2f2b]">
          {mod.body.slice(0, 2).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div
          className="mt-2 rounded-2xl p-5"
          style={{ backgroundColor: `${ACCENT}0d`, border: `1px solid ${ACCENT}22` }}
        >
          <div
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px]"
            style={{ color: ACCENT }}
          >
            <Award className="size-3.5" /> Du tar med deg
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#1f2421]">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color: ACCENT }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </>
    )
  }

  if (mod.kind === 'quiz') {
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    const passed = right / mod.questions.length >= 2 / 3
    const allAnswered = mod.questions.every((q) => quizAnswers[q.id] !== undefined)
    return (
      <>
        <h1 className="text-[28px] font-semibold leading-tight text-[#0f1311]">{mod.title}</h1>
        <p className="text-[15px] leading-relaxed text-[#1f2421]/80">{mod.intro}</p>
        <div className="space-y-5">
          {mod.questions.map((q, qi) => {
            const picked = quizAnswers[q.id]
            return (
              <fieldset key={q.id} className="space-y-2.5">
                <legend className="text-base font-semibold text-[#0f1311]">
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
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a3d32] ${
                          showRight
                            ? 'border-[#1a3d32] bg-[#1a3d32]/10 text-[#0f1311]'
                            : showWrong
                              ? 'border-[#b3382a] bg-[#b3382a]/10 text-[#0f1311]'
                              : selected
                                ? 'border-[#1a3d32] bg-[#1a3d32]/5'
                                : 'border-[#dcd4be] bg-white hover:border-[#1a3d32]/40'
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                              showRight
                                ? 'border-transparent bg-[#1a3d32] text-white'
                                : selected
                                  ? 'border-[#1a3d32] bg-[#1a3d32]/15 text-[#1a3d32]'
                                  : 'border-[#dcd4be] text-[#1f2421]/60'
                            }`}
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
                    className="rounded-lg px-3 py-2 text-[13px] leading-relaxed"
                    style={{
                      backgroundColor:
                        picked === q.correctIndex ? `${ACCENT}10` : '#b3382a10',
                      color: '#1f2421',
                    }}
                  >
                    {q.explanation}
                  </p>
                ) : null}
              </fieldset>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-[#e8e2d2] pt-4">
          {!quizSubmittedForMod ? (
            <button
              type="button"
              onClick={onSubmitQuiz}
              disabled={!allAnswered}
              className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ color: ACCENT, borderColor: ACCENT }}
            >
              Sjekk svarene
            </button>
          ) : (
            <p className="text-sm">
              <span className="font-semibold text-[#0f1311]">
                {right} av {mod.questions.length} riktig
              </span>{' '}
              <span className="text-[#1f2421]/70">
                — {passed ? 'bestått, klar for neste modul.' : 'ikke bestått ennå.'}
              </span>
            </p>
          )}
          {quizSubmittedForMod && !passed ? (
            <button
              type="button"
              onClick={onResetQuiz}
              className="text-xs font-semibold hover:underline"
              style={{ color: ACCENT }}
            >
              Prøv på nytt
            </button>
          ) : null}
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-tight text-[#0f1311]">{mod.title}</h1>
      <p className="text-[15px] leading-relaxed text-[#1f2421]/80">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label htmlFor={p.id} className="block text-sm font-semibold text-[#0f1311]">
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={3}
              className="w-full rounded-xl border border-[#dcd4be] bg-white px-4 py-3 text-sm text-[#1f2421] focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/20"
            />
            <p className="text-right text-[11px] text-[#1f2421]/50">
              {v.length} tegn · minst 10 for å gå videre
            </p>
          </div>
        )
      })}
    </>
  )
}

function CinemaDesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative z-10 mx-auto max-w-[1100px] px-6 pb-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold uppercase tracking-[1.5px] text-amber-300/80 hover:text-amber-200"
      >
        {open ? 'Skjul' : 'Vis'} designnotater
      </button>
      {open ? (
        <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-white/70 md:grid-cols-2">
          <li>
            <strong className="text-white">Scenen er fokus.</strong> Kortet på 960×640 fungerer som en
            visuell forpliktelse – ingenting utenfor er en handling man kan komme bort i.
          </li>
          <li>
            <strong className="text-white">Stegprikker som progresjon.</strong> Erstatter den lange
            sidemenyen – øyet kan telle 3-7 prikker, men ikke en lang liste.
          </li>
          <li>
            <strong className="text-white">+XP-belønning er ikke konkurranse.</strong> Den feirer
            individuell innsats én gang, og forsvinner – ingen poengtavle eller streak-press.
          </li>
          <li>
            <strong className="text-white">Tidsring viser «hvor langt», ikke «hvor fort».</strong>
            Bruker den samme visuelle metaforen som Apple Watch Activity Ring.
          </li>
        </ul>
      ) : null}
    </div>
  )
}
