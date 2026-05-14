// Alternative 1 — "Focus Reader". Typography-first course player inspired by
// Stripe Docs and long-form reading apps. Constrained 760 px body, calm
// progress strip, key-takeaway pullquote, one primary CTA per screen.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { MOCK_COURSE, moduleTimeLabel, type MockModule } from './mockCourse'

const ACCENT = '#0e7490'

export function PlatformCoursePlayerFocusPage() {
  const [idx, setIdx] = useState(0)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [reflections, setReflections] = useState<Record<string, string>>({})

  const course = MOCK_COURSE
  const mod = course.modules[idx]
  const total = course.modules.length
  const completedCount = Object.values(completed).filter(Boolean).length
  const overall = completedCount / total

  const [finished, setFinished] = useState(false)

  const isQuiz = mod.kind === 'quiz'
  const quizScore = useMemo(() => {
    if (mod.kind !== 'quiz') return null
    const total = mod.questions.length
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    return { right, total, ratio: right / total }
  }, [mod, quizAnswers])

  const canAdvance = (() => {
    if (mod.kind === 'quiz') return quizSubmitted && quizScore && quizScore.ratio >= 2 / 3
    if (mod.kind === 'reflection') {
      return mod.prompts.every((p) => (reflections[p.id] ?? '').trim().length >= 10)
    }
    return true
  })()

  function markCompleteAndNext() {
    setCompleted((c) => ({ ...c, [mod.id]: true }))
    if (idx < total - 1) {
      setIdx(idx + 1)
      setQuizSubmitted(false)
    } else {
      setFinished(true)
    }
  }

  function goPrev() {
    if (idx > 0) {
      setIdx(idx - 1)
      setQuizSubmitted(false)
    }
  }

  // Keyboard shortcuts — power-users expect ArrowLeft/Right between modules.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight' && canAdvance) markCompleteAndNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, canAdvance])

  const disabledHint = (() => {
    if (mod.kind === 'quiz' && !quizSubmitted) return 'Sjekk svarene først for å gå videre.'
    if (mod.kind === 'quiz' && quizScore && quizScore.ratio < 2 / 3)
      return 'Du må ha minst 2 riktige for å gå videre.'
    if (mod.kind === 'reflection' && !canAdvance) return 'Skriv minst 10 tegn i hvert felt.'
    return null
  })()

  return (
    <div className="-mx-4 -my-8 md:-mx-8">
      {/* Player canvas — paper-feel, lives inside the dark platform-admin chrome */}
      <div className="min-h-[calc(100vh-100px)] bg-[#f7f5ee] text-[#1f2421]">
        {/* Sticky progress strip — the calmest possible orientation signal */}
        <div
          className="sticky top-0 z-20 h-[3px] w-full"
          style={{ backgroundColor: '#e3ddcc' }}
          aria-hidden
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${overall * 100}%`, backgroundColor: ACCENT }}
          />
        </div>

        {/* Top utility band */}
        <div className="border-b border-[#e8e2d2] bg-[#fdfcf7]">
          <div className="mx-auto flex max-w-[1040px] items-center justify-between px-6 py-4">
            <Link
              to="/platform-admin/course-player"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1f2421]/70 hover:text-[#1f2421]"
            >
              <ChevronLeft className="size-3.5" />
              Tilbake til oversikt
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-[#1f2421]/60">
                {completedCount} av {total} fullført
              </span>
              <button
                type="button"
                aria-label="Lagre fremgang og avslutt"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#1f2421]/70 hover:bg-[#efe9d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e7490]"
              >
                <Bookmark className="size-3.5" /> Lagre & avslutt
              </button>
            </div>
          </div>
        </div>

        {/* Body — single reading column, optional outline rail on xl+ */}
        <div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-10 px-6 py-12 xl:grid-cols-[1fr_240px]">
          <article className="mx-auto w-full max-w-[760px]">
            {finished ? <FinishedBanner onRestart={() => { setFinished(false); setIdx(0); setCompleted({}); setQuizAnswers({}); setQuizSubmitted(false); setReflections({}) }} /> : null}
            <header className="space-y-4">
              <p
                className="text-[11px] font-semibold uppercase tracking-[2.5px]"
                style={{ color: ACCENT }}
              >
                {mod.eyebrow}
              </p>
              <h1 className="text-[34px] font-semibold leading-[1.15] text-[#0f1311]">{mod.title}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#1f2421]/70">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {moduleTimeLabel(mod.durationMinutes)}
                </span>
                {mod.lawRefs.map((r) => (
                  <span key={r} className="rounded-sm bg-[#efe9d8] px-2 py-0.5 font-mono text-[11px]">
                    {r}
                  </span>
                ))}
              </div>
            </header>

            <hr className="my-8 border-[#e8e2d2]" />

            <FocusModuleBody
              mod={mod}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              quizSubmitted={quizSubmitted}
              setQuizSubmitted={setQuizSubmitted}
              reflections={reflections}
              setReflections={setReflections}
            />

            {/* Pager — one big primary, prev as ghost */}
            {!finished ? (
              <>
                <div className="mt-14 flex flex-col-reverse items-stretch gap-3 border-t border-[#e8e2d2] pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={idx === 0}
                    aria-label="Gå til forrige modul (pil venstre)"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#dcd4be] bg-[#fdfcf7] px-4 py-2.5 text-sm font-medium text-[#1f2421] transition hover:bg-[#efe9d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e7490] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="size-4" /> Forrige
                  </button>
                  <button
                    type="button"
                    onClick={markCompleteAndNext}
                    disabled={!canAdvance || (isQuiz && !quizSubmitted)}
                    aria-describedby={disabledHint ? 'focus-disabled-hint' : undefined}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e7490] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[280px]"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {idx === total - 1 ? 'Fullfør kurset' : 'Marker fullført og fortsett'}
                    <ArrowRight className="size-4" />
                  </button>
                </div>

                {/* Inline disabled hint + microcopy nudge */}
                <p
                  id="focus-disabled-hint"
                  className="mt-4 text-center text-xs sm:text-right"
                  style={{ color: disabledHint ? '#b3382a' : '#1f2421a0' }}
                  role={disabledHint ? 'status' : undefined}
                  aria-live={disabledHint ? 'polite' : undefined}
                >
                  {disabledHint ??
                    (idx === total - 1
                      ? 'Siste modul – kursbeviset ditt utstedes når du fullfører.'
                      : `Du har ${total - idx - 1} ${total - idx - 1 === 1 ? 'modul' : 'moduler'} igjen i dag.`)}
                </p>
              </>
            ) : null}
          </article>

          {/* Outline rail — collapses below xl */}
          <aside className="hidden xl:block">
            <div className="sticky top-12 space-y-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[#1f2421]/50">
                  {course.title}
                </p>
                <p className="mt-1 text-xs text-[#1f2421]/60">{course.audience}</p>
              </div>
              <ol className="space-y-1">
                {course.modules.map((m, i) => {
                  const done = completed[m.id]
                  const isCurrent = i === idx
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setIdx(i)}
                        className={`flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-xs transition ${
                          isCurrent
                            ? 'bg-[#0e7490]/10 text-[#0f1311]'
                            : 'text-[#1f2421]/70 hover:bg-[#efe9d8]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                            done
                              ? 'border-transparent bg-[#0e7490] text-white'
                              : isCurrent
                                ? 'border-[#0e7490] bg-white'
                                : 'border-[#dcd4be] bg-[#fdfcf7]'
                          }`}
                        >
                          {done ? <Check className="size-2.5" /> : null}
                        </span>
                        <span className={isCurrent ? 'font-semibold' : ''}>{m.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div className="rounded-lg border border-[#e8e2d2] bg-[#fdfcf7] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#1f2421]/60">
                  <Sparkles className="size-3" /> Etter kurset
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#1f2421]/80">
                  Du får et signert kursbevis og 3 nye kompetansepoeng på profilen.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <DesignNotes />
      </div>
    </div>
  )
}

function FinishedBanner({ onRestart }: { onRestart: () => void }) {
  return (
    <div
      role="status"
      className="mb-8 rounded-2xl border p-6"
      style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}0d` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: ACCENT }}
        >
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-[#0f1311]">Kurset er fullført</p>
          <p className="text-xs text-[#1f2421]/70">
            Kursbeviset er utstedt og lagret på profilen din.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Last ned kursbevis (PDF)
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#dcd4be] bg-white px-3 py-1.5 text-xs font-medium text-[#1f2421] hover:bg-[#efe9d8]"
        >
          Start på nytt
        </button>
      </div>
    </div>
  )
}

function FocusModuleBody({
  mod,
  quizAnswers,
  setQuizAnswers,
  quizSubmitted,
  setQuizSubmitted,
  reflections,
  setReflections,
}: {
  mod: MockModule
  quizAnswers: Record<string, number>
  setQuizAnswers: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  quizSubmitted: boolean
  setQuizSubmitted: (v: boolean) => void
  reflections: Record<string, string>
  setReflections: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  if (mod.kind === 'text') {
    return (
      <div className="space-y-7">
        <p className="text-xl leading-relaxed text-[#0f1311]">{mod.lead}</p>
        {mod.body.map((p, i) => (
          <p key={i} className="text-[17px] leading-[1.75] text-[#2a2f2b]">
            {p}
          </p>
        ))}

        <aside
          className="my-8 rounded-r-xl border-l-[3px] bg-[#fdfcf7] p-6"
          style={{ borderColor: ACCENT }}
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#0f1311]">
            <Lightbulb className="size-3.5" style={{ color: ACCENT }} />
            Nøkkelpunkter
          </div>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[#1f2421]">
            {mod.keyTakeaways.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                />
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    )
  }

  if (mod.kind === 'quiz') {
    const total = mod.questions.length
    const right = mod.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length
    const passed = right / total >= 2 / 3
    return (
      <div className="space-y-7">
        <p className="text-[17px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
        {mod.questions.map((q, qi) => {
          const picked = quizAnswers[q.id]
          return (
            <fieldset key={q.id} className="space-y-3">
              <legend className="text-base font-semibold text-[#0f1311]">
                {qi + 1}. {q.question}
              </legend>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = picked === oi
                  const showCorrect = quizSubmitted && oi === q.correctIndex
                  const showWrong = quizSubmitted && selected && oi !== q.correctIndex
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-[#fdfcf7] px-4 py-3 text-[15px] transition ${
                        showCorrect
                          ? 'border-[#0e7490] bg-[#0e7490]/5'
                          : showWrong
                            ? 'border-[#b3382a] bg-[#b3382a]/5'
                            : selected
                              ? 'border-[#0e7490]'
                              : 'border-[#dcd4be] hover:border-[#0e7490]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => setQuizAnswers((p) => ({ ...p, [q.id]: oi }))}
                        disabled={quizSubmitted}
                        className="mt-1 size-4 accent-[#0e7490]"
                      />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </div>
              {quizSubmitted ? (
                <p className="rounded-md bg-[#efe9d8]/60 px-3 py-2 text-[13px] leading-relaxed text-[#1f2421]">
                  {q.explanation}
                </p>
              ) : null}
            </fieldset>
          )
        })}

        {!quizSubmitted ? (
          <button
            type="button"
            onClick={() => setQuizSubmitted(true)}
            disabled={Object.keys(quizAnswers).length < total}
            className="inline-flex items-center gap-2 rounded-md border border-[#0e7490] bg-white px-4 py-2 text-sm font-semibold text-[#0e7490] hover:bg-[#0e7490]/5 disabled:opacity-40"
          >
            Sjekk svarene
          </button>
        ) : (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              passed ? 'border-[#0e7490]/30 bg-[#0e7490]/5' : 'border-[#b3382a]/30 bg-[#b3382a]/5'
            }`}
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: passed ? ACCENT : '#b3382a' }} />
            <div className="text-sm">
              <p className="font-semibold text-[#0f1311]">
                {right} av {total} riktig — {passed ? 'bestått' : 'ikke bestått ennå'}
              </p>
              <p className="mt-1 text-[#1f2421]/80">
                {passed
                  ? 'Du kan gå videre til neste modul.'
                  : 'Du må ha minst 2 riktige for å gå videre. Prøv igjen.'}
              </p>
              {!passed ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers(() => ({}))
                    setQuizSubmitted(false)
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0e7490] hover:underline"
                >
                  <RotateCcw className="size-3.5" /> Prøv på nytt
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  // reflection
  return (
    <div className="space-y-7">
      <p className="text-[17px] leading-relaxed text-[#1f2421]">{mod.intro}</p>
      {mod.prompts.map((p) => {
        const v = reflections[p.id] ?? ''
        return (
          <div key={p.id} className="space-y-2">
            <label className="block text-base font-semibold text-[#0f1311]" htmlFor={p.id}>
              {p.prompt}
            </label>
            <textarea
              id={p.id}
              value={v}
              onChange={(e) => setReflections((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={p.placeholder}
              rows={4}
              className="w-full rounded-lg border border-[#dcd4be] bg-[#fdfcf7] px-4 py-3 text-[15px] leading-relaxed text-[#1f2421] placeholder:text-[#1f2421]/40 focus:border-[#0e7490] focus:outline-none focus:ring-2 focus:ring-[#0e7490]/20"
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

function DesignNotes() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-[#e8e2d2] bg-[#fdfcf7]">
      <div className="mx-auto max-w-[1040px] px-6 py-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-semibold uppercase tracking-[1.5px] text-[#0e7490]"
        >
          {open ? 'Skjul' : 'Vis'} designnotater
        </button>
        {open ? (
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-[#1f2421]/80 md:grid-cols-2">
            <li>
              <strong>Lese-først.</strong> 760 px innholdsbredde gir 65–75 tegn per linje – det sterkeste
              forskningsfunnet i lesbarhet (Bringhurst, Nielsen Norman).
            </li>
            <li>
              <strong>Én CTA.</strong> Primær handling er stor og høyrejustert (Fitts' law). «Forrige»
              forblir nøytral og venstre.
            </li>
            <li>
              <strong>Pullquote som anker.</strong> Nøkkelpunkter-blokken bryter lesetekst med
              skanne-vennlig sammendrag – fungerer både for fokusert lesning og repetisjon.
            </li>
            <li>
              <strong>Microcopy som engasjement.</strong> «Du har 2 moduler igjen i dag» gir framdrift
              uten å være konkurranseorientert (i motsetning til streak-mekanikk).
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  )
}
