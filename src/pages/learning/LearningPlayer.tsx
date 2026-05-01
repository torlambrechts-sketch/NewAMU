import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react'
import { useLearning, type IltEventRow } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseModule, ModuleCompleteMeta } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)))
  return (
    <div className="space-y-1">
      {label ? <div className="text-[11px] font-semibold uppercase tracking-[0.7px] text-[#6b6f68]">{label}</div> : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Fremdrift'}
        className="h-[6px] w-full overflow-hidden rounded-sm border border-[#e3ddcc] bg-[#f7f5ee]"
      >
        <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: '#1a3d32' }} />
      </div>
    </div>
  )
}

const KIND_LABELS: Record<string, string> = {
  flashcard: 'Flashkort', quiz: 'Quiz', text: 'Lese', image: 'Bilde',
  video: 'Video', checklist: 'Sjekkliste', tips: 'Tips',
  on_job: 'I praksis', event: 'Arrangement', other: 'Annet',
}

export function LearningPlayer() {
  const { courseId } = useParams<{ courseId: string }>()
  const [searchParams] = useSearchParams()
  const { can, supabase, organization, profile } = useOrgSetupContext()
  const canManageLearning = can('learning.manage')
  const {
    courses,
    certificates,
    progress,
    ensureProgress,
    setModuleCompleted,
    issueCertificate,
    isCourseUnlocked,
    iltEvents,
    setIltRsvp,
    setIltAttendance,
  } = useLearning()
  const course = courses.find((c) => c.id === courseId)

  const [idx, setIdx] = useState(0)
  const [learnerName, setLearnerName] = useState('')
  const [flashFlipped, setFlashFlipped] = useState(false)
  const [flashIdx, setFlashIdx] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [checkDone, setCheckDone] = useState<Record<string, boolean>>({})
  const [peerProfiles, setPeerProfiles] = useState<{ id: string; display_name: string }[]>([])
  const [peerProfilesError, setPeerProfilesError] = useState<string | null>(null)
  const [certFeedback, setCertFeedback] = useState<
    null | { kind: 'success'; verifyCode: string } | { kind: 'error'; message: string }
  >(null)

  useEffect(() => {
    if (courseId) ensureProgress(courseId)
  }, [courseId, ensureProgress])

  useEffect(() => {
    if (!canManageLearning || !supabase || !organization?.id) {
      queueMicrotask(() => {
        setPeerProfiles([])
        setPeerProfilesError(null)
      })
      return
    }
    void (async () => {
      setPeerProfilesError(null)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('organization_id', organization.id)
        .order('display_name')
      if (error) {
        setPeerProfiles([])
        setPeerProfilesError('Kunne ikke laste deltakerliste for oppmøteregistrering.')
        return
      }
      setPeerProfiles((data ?? []) as { id: string; display_name: string }[])
    })()
  }, [canManageLearning, supabase, organization?.id])

  useEffect(() => {
    const name = profile?.display_name?.trim()
    if (!name) return
    queueMicrotask(() => {
      setLearnerName((prev) => (prev.trim() === '' ? name : prev))
    })
  }, [profile?.display_name])

  const modules = useMemo(() => {
    if (!course) return []
    return [...course.modules].sort((a, b) => a.order - b.order)
  }, [course])

  const chapters = useMemo(() => {
    const chunk = 5
    const out: { title: string; startIdx: number; endIdx: number }[] = []
    for (let i = 0; i < modules.length; i += chunk) {
      const level = out.length + 1
      out.push({
        title: `Nivå ${level}`,
        startIdx: i,
        endIdx: Math.min(i + chunk - 1, modules.length - 1),
      })
    }
    return out
  }, [modules.length])

  const current = modules[idx]

  useEffect(() => {
    const mid = searchParams.get('module')
    if (!mid || modules.length === 0) return
    const i = modules.findIndex((m) => m.id === mid)
    if (i >= 0) {
      queueMicrotask(() => setIdx(i))
    }
  }, [searchParams, modules])

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

  useEffect(() => {
    if (hasCert) queueMicrotask(() => setCertFeedback(null))
  }, [hasCert])

  const totalDuration = useMemo(
    () => modules.reduce((acc, m) => acc + (m.durationMinutes || 0), 0),
    [modules],
  )

  const overallProgress = useMemo(() => {
    if (!course || modules.length === 0) return 0
    const done = modules.filter((m) => courseProgress?.moduleProgress[m.id]?.completed).length
    return done / modules.length
  }, [course, modules, courseProgress?.moduleProgress])

  if (!course || course.status !== 'published') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          {course ? (
            <>
              Dette kurset er ikke publisert.{' '}
              <Link to={`/learning/courses/${course.id}`} className="underline">
                Åpne kursbygger
              </Link>
            </>
          ) : (
            'Kurset ble ikke funnet.'
          )}
        </div>
      </div>
    )
  }

  if (!isCourseUnlocked(course.id)) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6 text-sm text-[#1d1f1c]">
          <p className="font-medium text-[#1d1f1c]">Dette kurset er låst</p>
          <p className="mt-2 text-[#6b6f68]">
            Fullfør forutsetningskursene som er valgt for dette kurset, eller kontakt kursansvarlig.
          </p>
          <Link to="/learning/courses" className="mt-4 inline-block text-[#1a3d32] underline">
            Tilbake til kurslisten
          </Link>
        </div>
      </div>
    )
  }

  const activeCourse = course

  function completeCurrent(extra?: ModuleCompleteMeta) {
    if (!current) return
    setModuleCompleted(activeCourse.id, current.id, extra)
    if (idx < modules.length - 1) setIdx(idx + 1)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="text-sm">
        <Link to="/learning/courses" className="text-[#1a3d32] hover:underline">
          ← Kurs
        </Link>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(220px,280px)_1fr] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div>
            <h1 className="font-serif text-xl font-semibold leading-snug text-[#2D403A]">{activeCourse.title}</h1>
            <p className="mt-2 text-xs text-[#6b6f68] line-clamp-4">{activeCourse.description}</p>
            {totalDuration > 0 ? (
              <p className="mt-2 text-xs text-[#6b6f68]">~{totalDuration} min totalt</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Fremdrift</p>
            <div className="mt-3">
              <ProgressBar value={overallProgress} label="Hele kurset" />
            </div>
          </div>

          <nav aria-label="Innhold" className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Innhold</p>
            <div className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto pr-1">
              {chapters.map((ch) => (
                <div key={ch.title}>
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {ch.title}{' '}
                    <span className="font-normal text-neutral-400">
                      ({ch.startIdx + 1}–{ch.endIdx + 1})
                    </span>
                  </p>
                  <ol className="space-y-1">
                    {modules.slice(ch.startIdx, ch.endIdx + 1).map((m, j) => {
                      const i = ch.startIdx + j
                      const done = !!courseProgress?.moduleProgress[m.id]?.completed
                      const isActive = i === idx
                      return (
                        <li key={m.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIdx(i)}
                            className={`flex h-auto w-full flex-col gap-1 rounded-lg px-2 py-2 text-left text-sm font-normal transition-colors ${
                              isActive ? 'bg-emerald-50 text-[#2D403A]' : 'text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span className="flex items-start gap-2">
                              <span className="mt-0.5 shrink-0 text-xs text-neutral-400">{i + 1}.</span>
                              <span className="min-w-0 flex-1 font-medium leading-snug">{m.title}</span>
                              {done ? (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Fullført" />
                              ) : null}
                            </span>
                            <div className="pl-7">
                              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${done ? 100 : isActive ? 40 : 0}%`,
                                    backgroundColor: PIN_GREEN,
                                  }}
                                />
                              </div>
                            </div>
                          </Button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {current && (
            <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl font-semibold text-[#1d1f1c]">{current.title}</h2>
                <span className="text-xs text-[#6b6f68]">
                  ~{current.durationMinutes} min · {KIND_LABELS[current.kind] ?? current.kind}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={courseProgress?.moduleProgress[current.id]?.completed ? 1 : 0}
                  label="Denne seksjonen"
                />
              </div>
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
                  courseId={activeCourse.id}
                  iltEvents={iltEvents}
                  setIltRsvp={setIltRsvp}
                  setIltAttendance={setIltAttendance}
                  canManageLearning={canManageLearning}
                  peerProfiles={peerProfiles}
                  peerProfilesError={peerProfilesError}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={idx <= 0}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
            >
              Forrige
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={idx >= modules.length - 1}
              onClick={() => setIdx((i) => Math.min(modules.length - 1, i + 1))}
            >
              Neste modul
            </Button>
          </div>

          <div className="rounded-lg border border-[#c5d3c8] bg-[#e7efe9] p-5">
            <h3 className="font-semibold text-[#2D403A]">Kursbevis</h3>
            <p className="mt-1 text-sm text-[#6b6f68]">
              Fullfør hver modul med knappen inne i modulen. Når du er ferdig, kontroller navnet på kursbeviset (hentes
              fra profilen din når du er innlogget) og trykk «Hent kursbevis».
            </p>
            {certFeedback?.kind === 'success' ? (
              <div className="mt-3">
                <InfoBox>
                  Kursbevis er utstedt. Verifiseringskode: <span className="font-mono font-semibold">{certFeedback.verifyCode}</span>
                </InfoBox>
              </div>
            ) : null}
            {certFeedback?.kind === 'error' ? (
              <div className="mt-3">
                <WarningBox>{certFeedback.message}</WarningBox>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="learning-learner-name" className="sr-only">
                  Navn på kursbevis
                </label>
                <StandardInput
                  id="learning-learner-name"
                  value={learnerName}
                  onChange={(e) => {
                    setLearnerName(e.target.value)
                    setCertFeedback(null)
                  }}
                  placeholder="Fullt navn på kursbeviset"
                  disabled={!modulesComplete || hasCert}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={!modulesComplete || hasCert}
                onClick={() => {
                  void (async () => {
                    setCertFeedback(null)
                    const r = await issueCertificate(activeCourse.id, learnerName)
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
            <p className="mt-2 text-xs text-[#6b6f68]">
              {!modulesComplete
                ? 'Fullfør alle moduler for å låse opp kursbeviset.'
                : hasCert
                  ? 'Du har allerede et kursbevis for dette kurset.'
                  : 'Du kan nå hente kursbeviset ditt.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EventModuleSection({
  ev,
  instructionsHtml,
  setIltRsvp,
  setIltAttendance,
  canManageLearning,
  peerProfiles,
  peerProfilesError,
  onComplete,
}: {
  ev: IltEventRow | undefined
  instructionsHtml: string
  setIltRsvp: ReturnType<typeof useLearning>['setIltRsvp']
  setIltAttendance: ReturnType<typeof useLearning>['setIltAttendance']
  canManageLearning: boolean
  peerProfiles: { id: string; display_name: string }[]
  peerProfilesError: string | null
  onComplete: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [rsvpMsg, setRsvpMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!ev?.id || !supabase || !canManageLearning) {
      queueMicrotask(() => {
        setAttendance({})
        setAttendanceError(null)
      })
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('learning_ilt_attendance')
        .select('user_id, present')
        .eq('event_id', ev.id)
      if (error) {
        setAttendanceError('Kunne ikke laste oppmøteregistrering.')
        return
      }
      setAttendanceError(null)
      const next: Record<string, boolean> = {}
      for (const row of data ?? []) {
        next[(row as { user_id: string; present: boolean }).user_id] = (row as { present: boolean }).present
      }
      setAttendance(next)
    })()
  }, [ev?.id, supabase, canManageLearning])

  return (
    <div className="space-y-6">
      <div
        className="prose prose-sm w-full max-w-none text-neutral-800 [&_a]:text-emerald-800 [&_a]:underline [&_li]:my-1"
        dangerouslySetInnerHTML={{ __html: instructionsHtml }}
      />

      {ev ? (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4 text-sm">
          <p className="font-semibold text-[#2D403A]">{ev.title}</p>
          <p className="mt-1 text-neutral-600">
            {new Date(ev.startsAt).toLocaleString()}
            {ev.endsAt ? ` – ${new Date(ev.endsAt).toLocaleString()}` : ''}
          </p>
          {ev.locationText ? <p className="mt-1 text-neutral-600">Sted: {ev.locationText}</p> : null}
          {ev.instructorName ? <p className="text-neutral-600">Instruktør: {ev.instructorName}</p> : null}
          {ev.meetingUrl ? (
            <a
              href={ev.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-emerald-800 underline"
            >
              Åpne møtelenke <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['going', 'declined', 'waitlist'] as const).map((st) => (
              <Button
                key={st}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void (async () => {
                    const r = await setIltRsvp(ev.id, st)
                    setRsvpMsg(r.ok ? (st === 'going' ? 'Du er påmeldt.' : 'Oppdatert.') : r.error)
                  })()
                }}
              >
                {st === 'going' ? 'Meld på' : st === 'declined' ? 'Avslå' : 'Venteliste'}
              </Button>
            ))}
          </div>
          {rsvpMsg ? <p className="mt-2 text-xs text-neutral-600">{rsvpMsg}</p> : null}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Ingen økt planlagt ennå — kursansvarlig legger inn tid og sted i kursbyggeren.
        </p>
      )}

      {canManageLearning && ev && peerProfilesError ? (
        <div className="mt-3">
          <WarningBox>{peerProfilesError}</WarningBox>
        </div>
      ) : null}

      {canManageLearning && ev && peerProfiles.length > 0 ? (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Oppmøte (instruktør)</p>
          {attendanceError ? (
            <div className="mt-3">
              <WarningBox>{attendanceError}</WarningBox>
            </div>
          ) : null}
          <ul className="mt-3 divide-y divide-neutral-100">
            {peerProfiles.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">{p.display_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-600">Tilstede</span>
                  <ToggleSwitch
                    checked={!!attendance[p.id]}
                    onChange={(v) => {
                      setAttendance((s) => ({ ...s, [p.id]: v }))
                      void setIltAttendance(ev.id, p.id, v)
                    }}
                    label={`Tilstede: ${p.display_name}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        type="button"
        variant="primary"
        className="w-full rounded-full"
        style={{ backgroundColor: PIN_GREEN }}
        onClick={() => onComplete()}
      >
        Fullfør modul
      </Button>
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
  courseId,
  iltEvents,
  setIltRsvp,
  setIltAttendance,
  canManageLearning,
  peerProfiles,
  peerProfilesError,
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
  onComplete: (extra?: ModuleCompleteMeta) => void
  courseId: string
  iltEvents: IltEventRow[]
  setIltRsvp: ReturnType<typeof useLearning>['setIltRsvp']
  setIltAttendance: ReturnType<typeof useLearning>['setIltAttendance']
  canManageLearning: boolean
  peerProfiles: { id: string; display_name: string }[]
  peerProfilesError: string | null
}) {
  const c = mod.content

  if (c.kind === 'flashcard') {
    const slide = c.slides[Math.min(flashIdx, Math.max(0, c.slides.length - 1))]
    if (!slide) return <p>Ingen kort i dette settet.</p>
    const last = flashIdx >= c.slides.length - 1
    return (
      <div className="space-y-4">
        <div className="text-center text-xs text-neutral-500">
          Kort {flashIdx + 1} av {c.slides.length}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setFlashFlipped(!flashFlipped)}
          className="relative mx-auto block aspect-[9/16] w-full max-w-sm overflow-hidden rounded-lg border border-[#e3ddcc] p-0"
          style={{
            background: flashFlipped
              ? 'linear-gradient(160deg, #1e3d35 0%, #2D403A 100%)'
              : 'linear-gradient(160deg, #3d5a52 0%, #2D403A 100%)',
          }}
        >
          <div className="flex h-full flex-col justify-between p-6 text-white">
            <div className="text-xs uppercase tracking-widest opacity-70">
              {flashFlipped ? 'Svar' : 'Spørsmål'}
            </div>
            <p className="text-center font-serif text-xl leading-snug">
              {flashFlipped ? slide.back : slide.front}
            </p>
            <div className="text-center text-xs opacity-70">Klikk for å snu</div>
          </div>
        </Button>
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={flashIdx <= 0}
            onClick={() => {
              setFlashIdx((i) => Math.max(0, i - 1))
              setFlashFlipped(false)
            }}
            aria-label="Forrige kort"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={last}
            onClick={() => {
              setFlashIdx((i) => Math.min(c.slides.length - 1, i + 1))
              setFlashFlipped(false)
            }}
            aria-label="Neste kort"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="primary"
          className="w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Fullfør kortsett
        </Button>
      </div>
    )
  }

  if (c.kind === 'quiz') {
    if (c.questions.length === 0) return <p>Ingen spørsmål i quizen.</p>
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
            <div key={q.id} className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4">
              <p className="font-medium text-neutral-900">{q.question}</p>
              <ul className="mt-3 space-y-2">
                {q.options.map((o, i) => (
                  <li key={i}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setQuizAnswers((s) => ({ ...s, [q.id]: i }))}
                      className={`h-auto w-full justify-start whitespace-normal py-2 text-left text-sm font-normal ${
                        sel === i
                          ? sel === q.correctIndex
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-red-400 bg-red-50'
                          : 'border-[#e3ddcc] bg-[#fbf9f3]'
                      }`}
                    >
                      {o}
                    </Button>
                  </li>
                ))}
              </ul>
              {sel !== undefined && (
                <p className={`mt-2 text-sm ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  {ok ? 'Riktig ✓' : 'Feil ✗'}
                </p>
              )}
            </div>
          )
        })}
        {answered ? (
          <p className="text-sm font-medium text-[#2D403A]">
            Resultat: {correctCount} av {c.questions.length} ({scorePct}%)
          </p>
        ) : null}
        <Button
          type="button"
          variant="primary"
          className="w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          disabled={!answered}
          onClick={() =>
            onComplete({
              score: scorePct,
              lastAnswers,
              quizQuestions: c.questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex })),
            })
          }
        >
          Fullfør quiz
        </Button>
      </div>
    )
  }

  if (c.kind === 'text') {
    const html = sanitizeLearningHtml(normalizeModuleHtml(c.body))
    return (
      <div>
        <div
          className="prose prose-sm w-full max-w-none text-neutral-800 [&_a]:text-emerald-800 [&_a]:underline [&_li]:my-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Button
          type="button"
          variant="primary"
          className="mt-6 w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Fortsett
        </Button>
      </div>
    )
  }

  if (c.kind === 'image') {
    return (
      <div>
        <img src={c.imageUrl} alt={c.caption || 'Kursbilde'} loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
        <p className="mt-2 text-sm text-neutral-600">{c.caption}</p>
        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Fortsett
        </Button>
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
            <Button
              type="button"
              variant={checkDone[it.id] ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setCheckDone((s) => ({ ...s, [it.id]: !s[it.id] }))}
              className={`size-8 rounded-full border-2 p-0 ${
                checkDone[it.id] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300'
              }`}
              aria-label={checkDone[it.id] ? 'Fjern avkrysning' : 'Kryss av'}
            >
              {checkDone[it.id] ? <Check className="size-4" /> : null}
            </Button>
            <span>{it.label}</span>
          </li>
        ))}
        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          disabled={!allChecked}
          onClick={() => onComplete()}
        >
          Fullfør sjekkliste
        </Button>
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
        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Fortsett
        </Button>
      </ul>
    )
  }

  if (c.kind === 'event') {
    const ev = iltEvents.find((e) => e.courseId === courseId && e.moduleId === mod.id)
    const html = sanitizeLearningHtml(normalizeModuleHtml(c.instructions))
    return (
      <EventModuleSection
        ev={ev}
        instructionsHtml={html}
        setIltRsvp={setIltRsvp}
        setIltAttendance={setIltAttendance}
        canManageLearning={canManageLearning}
        peerProfiles={peerProfiles}
        peerProfilesError={peerProfilesError}
        onComplete={onComplete}
      />
    )
  }

  if (c.kind === 'on_job') {
    return (
      <div className="space-y-3">
        {c.tasks.map((t) => (
          <div key={t.id} className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-3">
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-neutral-600">{t.description}</div>
          </div>
        ))}
        <Button
          type="button"
          variant="primary"
          className="w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Bekreft gjennomført
        </Button>
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
        <Button
          type="button"
          variant="primary"
          className="mt-4 w-full rounded-full"
          style={{ backgroundColor: PIN_GREEN }}
          onClick={() => onComplete()}
        >
          Fortsett
        </Button>
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
        <div className="overflow-hidden rounded-lg border border-[#e3ddcc]">
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700">
              <ToggleSwitch
                checked={manualOverride}
                onChange={setManualOverride}
                label="Bekreft at du har sett hele YouTube-videoen"
              />
              <span>
                Jeg har sett hele videoen{' '}
                <span className="text-xs text-neutral-400">(bekreft etter visning)</span>
              </span>
              {manualOverride ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden /> : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Vimeo embed ─────────────────────────────────────────────────── */}
      {kind === 'vimeo' && (
        <div className="overflow-hidden rounded-lg border border-[#e3ddcc]">
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700">
              <ToggleSwitch
                checked={manualOverride}
                onChange={setManualOverride}
                label="Bekreft at du har sett hele Vimeo-videoen"
              />
              <span>
                Jeg har sett hele videoen{' '}
                <span className="text-xs text-neutral-400">(bekreft etter visning)</span>
              </span>
              {manualOverride ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden /> : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Native MP4 — full progress tracking ─────────────────────────── */}
      {kind === 'mp4' && (
        <div className="overflow-hidden rounded-lg border border-[#e3ddcc] bg-black">
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
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-5">
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
            <div className="mt-4 border-t border-[#e3ddcc] pt-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700">
                <ToggleSwitch
                  checked={manualOverride}
                  onChange={setManualOverride}
                  label="Bekreft at du har sett hele videoen"
                />
                <span>Jeg har sett hele videoen</span>
                {manualOverride ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Complete button ─────────────────────────────────────────────── */}
      <Button
        type="button"
        variant="primary"
        className="w-full rounded-full"
        style={{ backgroundColor: PIN_GREEN }}
        disabled={!unlocked}
        onClick={() => onComplete()}
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
      </Button>
    </div>
  )
}

