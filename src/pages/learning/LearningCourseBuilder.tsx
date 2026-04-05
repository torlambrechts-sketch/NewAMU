import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { learningFlowEntryUrl, qrCodeImageUrl } from '../../lib/learningDeepLink'
import { GripVertical, Layers, Plus, Trash2, Users, BarChart3, FileText, Award } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseModule, ModuleKind } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'

const MODULE_KINDS: { id: ModuleKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All modules' },
  { id: 'flashcard', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'tips', label: 'Practical tips' },
  { id: 'on_job', label: 'On-the-job' },
  { id: 'event', label: 'Event (ILT)' },
  { id: 'other', label: 'Other' },
]

const ADD_KINDS: { kind: ModuleKind; label: string }[] = [
  { kind: 'flashcard', label: 'Flashcard story' },
  { kind: 'quiz', label: 'Quiz' },
  { kind: 'text', label: 'Text' },
  { kind: 'image', label: 'Image' },
  { kind: 'video', label: 'Video' },
  { kind: 'checklist', label: 'Checklist' },
  { kind: 'tips', label: 'Practical tips' },
  { kind: 'on_job', label: 'On-the-job' },
  { kind: 'event', label: 'Event (ILT)' },
  { kind: 'other', label: 'Other' },
]

type MainTab = 'info' | 'modules' | 'cert' | 'participants' | 'insights'

export function LearningCourseBuilder() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId: string }>()
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    courses,
    updateCourse,
    addModule,
    updateModule,
    deleteModule,
    forkSystemCourse,
    learningLoading,
    learningError,
    upsertIltEvent,
    bumpCourseVersion,
  } = useLearning()
  const otherCourses = courses.filter((c) => c.id !== courseId)
  const course = courses.find((c) => c.id === courseId)
  const isSystemCatalog =
    course && course.origin === 'system' && course.sourceSystemCourseId && course.modules.length > 0

  const [mainTab, setMainTab] = useState<MainTab>('modules')
  const [typeFilter, setTypeFilter] = useState<ModuleKind | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const filteredModules = useMemo(() => {
    if (!course) return []
    const sorted = [...course.modules].sort((a, b) => a.order - b.order)
    if (typeFilter === 'all') return sorted
    return sorted.filter((m) => m.kind === typeFilter)
  }, [course, typeFilter])

  const selected = course?.modules.find((m) => m.id === selectedId) ?? null

  if (learningLoading && courseId && !course) {
    return <p className="text-sm text-neutral-600">Laster kurs…</p>
  }

  if (!course) {
    return (
      <p className="text-neutral-600">
        Course not found. <Link to="/learning/courses" className="text-emerald-800 underline">Back</Link>
      </p>
    )
  }

  if (canManage && isSystemCatalog && course?.sourceSystemCourseId) {
    return (
      <div className="max-w-2xl space-y-6">
        <nav className="text-sm text-neutral-600">
          <Link to="/learning/courses" className="hover:text-[#2D403A]">
            Courses
          </Link>
          <span className="mx-2 text-neutral-300">›</span>
          <span className="font-medium text-[#2D403A]">{course.title}</span>
        </nav>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-6">
          <h1 className="font-serif text-2xl font-semibold text-[#2D403A]">Systemkurs</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Dette kurset leveres fra felles katalog og kan ikke redigeres direkte. Kopier det til din organisasjon for å
            tilpasse innhold, rekkefølge og publisering.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PIN_GREEN }}
              onClick={() => {
                void (async () => {
                  const r = await forkSystemCourse(course.sourceSystemCourseId!)
                  if (r.ok && r.newCourseId) {
                    navigate(`/learning/courses/${r.newCourseId}`)
                  } else if (!r.ok) {
                    alert(r.error)
                  }
                })()
              }}
            >
              Kopier og tilpass (mal)
            </button>
            <Link
              to={`/learning/play/${course.id}`}
              className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
            >
              Forhåndsvisning
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <nav className="text-sm text-neutral-600">
          <Link to="/learning/courses" className="hover:text-[#2D403A]">
            Courses
          </Link>
          <span className="mx-2 text-neutral-300">›</span>
          <span className="font-medium text-[#2D403A]">{course.title}</span>
        </nav>
        <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-neutral-800">
          Du har ikke tilgang til kursbyggeren. Bruk <Link to={`/learning/play/${course.id}`} className="font-medium text-emerald-800 underline">forhåndsvisning</Link> for å ta kurset, eller be om rettigheten «E-learning — opprette og redigere kurs».
        </p>
        <Link to="/learning/courses" className="text-sm font-medium text-[#2D403A] hover:underline">
          ← Tilbake til kurslisten
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}
      <nav className="text-sm text-neutral-600">
        <Link to="/learning/courses" className="hover:text-[#2D403A]">
          Courses
        </Link>
        <span className="mx-2 text-neutral-300">›</span>
        <span className="font-medium text-[#2D403A]">{course.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">{course.title}</h1>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase ${
                course.status === 'published'
                  ? 'bg-emerald-100 text-emerald-900'
                  : course.status === 'draft'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {course.status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">{course.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddTaskLink
            title={`Oppfølging: ${course.title}`}
            description="Oppfølgingsoppgave fra kursbygger"
            module="learning"
            sourceType="learning_course"
            sourceId={course.id}
            sourceLabel={course.title}
            ownerRole="Læringsansvarlig"
          />
          <Link
            to={`/learning/play/${course.id}`}
            className="rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
          >
            Preview as learner
          </Link>
        </div>
      </div>

      {/* Primary tabs — Pinpoint style dark bar */}
      <div
        className="flex flex-wrap gap-1 rounded-lg p-1"
        style={{ backgroundColor: PIN_GREEN }}
      >
        {(
          [
            ['info', 'Course info', FileText],
            ['modules', 'Modules', Layers],
            ['cert', 'Certifications', Award],
            ['participants', 'Participants', Users],
            ['insights', 'Insights', BarChart3],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMainTab(id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              mainTab === id
                ? 'bg-white text-[#2D403A] shadow-sm'
                : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'info' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <label className="text-xs font-medium text-neutral-500">Title</label>
          <input
            value={course.title}
            onChange={(e) => updateCourse(course.id, { title: e.target.value })}
            className="mt-1 w-full max-w-xl rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <label className="mt-4 block text-xs font-medium text-neutral-500">Description</label>
          <textarea
            value={course.description}
            onChange={(e) => updateCourse(course.id, { description: e.target.value })}
            rows={4}
            className="mt-1 w-full max-w-2xl rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {course.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    updateCourse(course.id, { tags: course.tags.filter((x) => x !== t) })
                  }
                  className="text-neutral-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) {
                  e.preventDefault()
                  if (!course.tags.includes(tagInput.trim())) {
                    updateCourse(course.id, { tags: [...course.tags, tagInput.trim()] })
                  }
                  setTagInput('')
                }
              }}
              placeholder="+ Add tag"
              className="w-32 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
            />
          </div>
          {otherCourses.length > 0 ? (
            <div className="mt-6 border-t border-neutral-100 pt-4">
              <p className="text-xs font-medium text-neutral-500">Forutsetninger (lås opp dette kurset)</p>
              <p className="mt-1 text-xs text-neutral-500">
                Velg kurs som må fullføres før dette blir tilgjengelig for deltakere.
              </p>
              <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {otherCourses.map((oc) => {
                  const selected = course.prerequisiteCourseIds?.includes(oc.id) ?? false
                  return (
                    <li key={oc.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const cur = course.prerequisiteCourseIds ?? []
                            const next = e.target.checked
                              ? [...cur, oc.id]
                              : cur.filter((x) => x !== oc.id)
                            updateCourse(course.id, { prerequisiteCourseIds: next })
                          }}
                          className="mt-0.5 rounded border-neutral-300"
                        />
                        <span>
                          <span className="font-medium text-[#2D403A]">{oc.title}</span>
                          <span className="ml-2 text-xs text-neutral-500">({oc.status})</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          <div className="mt-6 border-t border-neutral-100 pt-4">
            <p className="text-xs font-medium text-neutral-500">Oppfriskning / sertifisering</p>
            <p className="mt-1 text-xs text-neutral-500">
              Antall måneder til sertifikatet utløper og må fornyes (valgfritt). Brukes for påminnelser og status.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-neutral-700">
                Måneder til fornyelse
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={course.recertificationMonths ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Math.min(120, Math.max(0, Number(e.target.value)))
                    updateCourse(course.id, { recertificationMonths: v })
                  }}
                  placeholder="—"
                  className="ml-2 w-20 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
              <span className="text-xs text-neutral-500">
                Kursversjon: <strong>{course.courseVersion ?? 1}</strong> (økes ved innholdsendringer for revisjon)
              </span>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
                onClick={() => {
                  if (!confirm('Øke kursversjon? Nye fullføringer får ny versjon på sertifikatet.')) return
                  void (async () => {
                    const r = await bumpCourseVersion(course.id)
                    if (!r.ok) alert(r.error)
                  })()
                }}
              >
                Øk versjon
              </button>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'modules' && (
        <>
          {/* Secondary pipeline / type filters */}
          <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
            {MODULE_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setTypeFilter(k.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  typeFilter === k.id
                    ? 'bg-[#2D403A] text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {k.label}
                {k.id !== 'all' && course ? (
                  <span className="ml-1 opacity-70">
                    ({course.modules.filter((m) => m.kind === k.id).length})
                  </span>
                ) : k.id === 'all' ? (
                  <span className="ml-1 opacity-70">({course.modules.length})</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-[#2D403A]">Module builder</h2>
            <div className="flex flex-wrap gap-2">
              {ADD_KINDS.map((a) => (
                <button
                  key={a.kind}
                  type="button"
                  onClick={() => {
                    const mod = addModule(course.id, a.kind, a.label)
                    if (mod) setSelectedId(mod.id)
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
                >
                  <Plus className="size-3.5" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500">
                Modules
              </div>
              <ul className="divide-y divide-neutral-100">
                {filteredModules.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50 ${
                        selectedId === m.id ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <GripVertical className="size-4 shrink-0 text-neutral-300" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#2D403A]">{m.title}</div>
                        <div className="text-xs text-neutral-500">
                          {m.kind} · ~{m.durationMinutes} min
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {filteredModules.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">No modules in this filter.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              {selected ? (
                <ModuleEditor
                  key={selected.id}
                  courseId={course.id}
                  mod={selected}
                  updateModule={updateModule}
                  deleteModule={deleteModule}
                  upsertIltEvent={upsertIltEvent}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : (
                <p className="text-sm text-neutral-500">Select a module to edit content.</p>
              )}
            </div>
          </div>
        </>
      )}

      {mainTab === 'cert' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
          Certificates are issued when a learner completes all modules from the{' '}
          <Link to={`/learning/play/${course.id}`} className="text-emerald-800 underline">
            learner view
          </Link>
          . Manage all certificates under{' '}
          <Link to="/learning/certifications" className="text-emerald-800 underline">
            Certifications
          </Link>
          .
        </div>
      )}

      {mainTab === 'participants' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
          Track enrolments in a future LMS integration. For now, progress is stored per browser in localStorage when learners use Preview.
        </div>
      )}

      {mainTab === 'insights' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            Module count: <strong>{course.modules.length}</strong>. Published:{' '}
            <strong>{course.status === 'published' ? 'Yes' : 'No'}</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

function ModuleEditor({
  courseId,
  mod,
  updateModule,
  deleteModule,
  upsertIltEvent,
  onDeleted,
}: {
  courseId: string
  mod: CourseModule
  updateModule: ReturnType<typeof useLearning>['updateModule']
  deleteModule: ReturnType<typeof useLearning>['deleteModule']
  upsertIltEvent: ReturnType<typeof useLearning>['upsertIltEvent']
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(mod.title)
  const [dur, setDur] = useState(mod.durationMinutes)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-neutral-500">Module title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              updateModule(courseId, mod.id, { title: e.target.value })
            }}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this module?')) {
              deleteModule(courseId, mod.id)
              onDeleted()
            }
          }}
          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500">Duration (minutes)</label>
        <input
          type="number"
          min={1}
          max={15}
          value={dur}
          onChange={(e) => {
            const v = Math.min(15, Math.max(1, Number(e.target.value) || 1))
            setDur(v)
            updateModule(courseId, mod.id, { durationMinutes: v })
          }}
          className="mt-1 w-24 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
        />
        <p className="mt-1 text-[11px] text-neutral-500">Mikrolæring: anbefalt maks ~3 min lesing/seing per modul.</p>
      </div>

      {mod.kind === 'on_job' ? (
        <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold text-[#2D403A]">QR for stedet (flow-of-work)</p>
          <p className="mt-1 text-xs text-neutral-600">
            Skriv ut og fest på f.eks. førstehjelpskasse eller truck. Skanning åpner modulen direkte uten å navigere i
            kursbiblioteket.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <img
              src={qrCodeImageUrl(learningFlowEntryUrl(courseId, mod.id))}
              alt=""
              className="size-36 rounded-lg border border-white bg-white p-1 shadow"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <label className="text-[10px] font-medium uppercase text-neutral-500">Dypelenke (flow)</label>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/learning/flow?course=${encodeURIComponent(courseId)}&module=${encodeURIComponent(mod.id)}`}
                className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 font-mono text-[11px]"
                onFocus={(e) => e.target.select()}
              />
              <p className="text-[10px] text-neutral-500">
                Bruk denne i HMS-hendelser eller automasjon; tildeling lagres i <code>learning_module_assignments</code>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {mod.kind === 'event' ? (
        <IltScheduleForm
          courseId={courseId}
          moduleId={mod.id}
          defaultTitle={mod.title}
          upsertIltEvent={upsertIltEvent}
        />
      ) : null}

      <ContentFields courseId={courseId} mod={mod} updateModule={updateModule} />
    </div>
  )
}

function IltScheduleForm({
  courseId,
  moduleId,
  defaultTitle,
  upsertIltEvent,
}: {
  courseId: string
  moduleId: string
  defaultTitle: string
  upsertIltEvent: ReturnType<typeof useLearning>['upsertIltEvent']
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [locationText, setLocationText] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <p className="text-xs font-semibold text-[#2D403A]">Planlegg ILT / vILT-økt</p>
      <p className="mt-1 text-xs text-neutral-600">
        Én økt per modul. Deltakere kan RSVP og oppmøte registreres i spilleren.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-600">
          Tittel på økt
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600">
          Start (lokal tid)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600">
          Slutt (valgfritt)
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600">
          Sted / rom
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600 sm:col-span-2">
          Teams / Meet-lenke
          <input
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600 sm:col-span-2">
          Instruktør
          <input
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white"
        style={{ backgroundColor: PIN_GREEN }}
        onClick={() => {
          if (!startsAt) {
            setMsg('Velg starttidspunkt.')
            return
          }
          const isoStart = new Date(startsAt).toISOString()
          const isoEnd = endsAt ? new Date(endsAt).toISOString() : null
          void (async () => {
            const r = await upsertIltEvent({
              courseId,
              moduleId,
              title: title.trim() || defaultTitle,
              startsAt: isoStart,
              endsAt: isoEnd,
              locationText: locationText.trim() || null,
              meetingUrl: meetingUrl.trim() || null,
              instructorName: instructorName.trim() || null,
            })
            setMsg(r.ok ? 'Lagret økt.' : r.error)
          })()
        }}
      >
        Lagre økt
      </button>
      {msg ? <p className="mt-2 text-xs text-neutral-700">{msg}</p> : null}
    </div>
  )
}

function ContentFields({
  courseId,
  mod,
  updateModule,
}: {
  courseId: string
  mod: CourseModule
  updateModule: ReturnType<typeof useLearning>['updateModule']
}) {
  const c = mod.content

  if (c.kind === 'flashcard') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-neutral-500">Story-style cards (tap to flip in learner view).</p>
        {c.slides.map((s, idx) => (
          <div key={s.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <div className="text-xs font-medium text-neutral-500">Card {idx + 1}</div>
            <input
              value={s.front}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, front: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Front"
              className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
            <input
              value={s.back}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, back: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Back"
              className="mt-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const slides = [
              ...c.slides,
              { id: crypto.randomUUID(), front: 'Front', back: 'Back' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, slides } })
          }}
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          + Add card
        </button>
      </div>
    )
  }

  if (c.kind === 'quiz') {
    return (
      <div className="space-y-4">
        {c.questions.map((q) => (
          <div key={q.id} className="rounded-lg border border-neutral-100 p-3">
            <input
              value={q.question}
              onChange={(e) => {
                const questions = c.questions.map((x) =>
                  x.id === q.id ? { ...x, question: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, questions } })
              }}
              className="w-full rounded border border-neutral-200 px-2 py-1 text-sm font-medium"
            />
            {q.options.map((opt, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctIndex === i}
                  onChange={() => {
                    const questions = c.questions.map((x) =>
                      x.id === q.id ? { ...x, correctIndex: i } : x,
                    )
                    updateModule(courseId, mod.id, { content: { ...c, questions } })
                  }}
                  className="size-4 border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = [...q.options]
                    options[i] = e.target.value
                    const questions = c.questions.map((x) =>
                      x.id === q.id ? { ...x, options } : x,
                    )
                    updateModule(courseId, mod.id, { content: { ...c, questions } })
                  }}
                  className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const questions = [
              ...c.questions,
              {
                id: crypto.randomUUID(),
                question: 'New question',
                options: ['A', 'B', 'C'],
                correctIndex: 0,
              },
            ]
            updateModule(courseId, mod.id, { content: { ...c, questions } })
          }}
          className="text-sm text-emerald-800 hover:underline"
        >
          + Add question
        </button>
      </div>
    )
  }

  if (c.kind === 'text') {
    return (
      <RichTextEditor
        value={c.body}
        onChange={(html) =>
          updateModule(courseId, mod.id, { content: { kind: 'text', body: html } })
        }
      />
    )
  }

  if (c.kind === 'image') {
    return (
      <div className="space-y-2">
        <input
          value={c.imageUrl}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, imageUrl: e.target.value },
            })
          }
          placeholder="Image URL"
          className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
        />
        <input
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, caption: e.target.value },
            })
          }
          placeholder="Caption"
          className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
        />
        <img src={c.imageUrl} alt="" className="max-h-48 rounded-lg object-cover" />
      </div>
    )
  }

  if (c.kind === 'video') {
    return (
      <div className="space-y-2">
        <input
          value={c.url}
          onChange={(e) =>
            updateModule(courseId, mod.id, { content: { ...c, url: e.target.value } })
          }
          placeholder="Video URL (MP4 or page)"
          className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
        />
        <input
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, { content: { ...c, caption: e.target.value } })
          }
          className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
        />
      </div>
    )
  }

  if (c.kind === 'checklist') {
    return (
      <ul className="space-y-2">
        {c.items.map((it) => (
          <li key={it.id} className="flex gap-2">
            <input
              value={it.label}
              onChange={(e) => {
                const items = c.items.map((x) =>
                  x.id === it.id ? { ...x, label: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, items } })
              }}
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
            />
          </li>
        ))}
        <button
          type="button"
          onClick={() => {
            const items = [...c.items, { id: crypto.randomUUID(), label: 'New item' }]
            updateModule(courseId, mod.id, { content: { ...c, items } })
          }}
          className="text-sm text-emerald-800 hover:underline"
        >
          + Item
        </button>
      </ul>
    )
  }

  if (c.kind === 'tips') {
    return (
      <ul className="space-y-2">
        {c.items.map((tip, i) => (
          <li key={i}>
            <input
              value={tip}
              onChange={(e) => {
                const items = [...c.items]
                items[i] = e.target.value
                updateModule(courseId, mod.id, { content: { ...c, items } })
              }}
              className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
          </li>
        ))}
        <button
          type="button"
          onClick={() =>
            updateModule(courseId, mod.id, {
              content: { ...c, items: [...c.items, 'New tip'] },
            })
          }
          className="text-sm text-emerald-800 hover:underline"
        >
          + Tip
        </button>
      </ul>
    )
  }

  if (c.kind === 'event') {
    return (
      <RichTextEditor
        value={c.instructions}
        onChange={(html) => updateModule(courseId, mod.id, { content: { kind: 'event', instructions: html } })}
      />
    )
  }

  if (c.kind === 'on_job') {
    return (
      <div className="space-y-3">
        {c.tasks.map((t) => (
          <div key={t.id} className="rounded-lg border p-2">
            <input
              value={t.title}
              onChange={(e) => {
                const tasks = c.tasks.map((x) =>
                  x.id === t.id ? { ...x, title: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, tasks } })
              }}
              className="w-full font-medium"
            />
            <textarea
              value={t.description}
              onChange={(e) => {
                const tasks = c.tasks.map((x) =>
                  x.id === t.id ? { ...x, description: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, tasks } })
              }}
              rows={2}
              className="mt-1 w-full text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const tasks = [
              ...c.tasks,
              { id: crypto.randomUUID(), title: 'Task', description: '' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, tasks } })
          }}
          className="text-sm text-emerald-800 hover:underline"
        >
          + Task
        </button>
      </div>
    )
  }

  if (c.kind === 'other') {
    return (
      <div>
        <input
          value={c.title}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, title: e.target.value },
            })
          }
          className="mb-2 w-full rounded border px-2 py-1 text-sm font-medium"
        />
        <RichTextEditor
          value={c.body}
          onChange={(html) =>
            updateModule(courseId, mod.id, { content: { ...c, body: html } })
          }
        />
      </div>
    )
  }

  return null
}
