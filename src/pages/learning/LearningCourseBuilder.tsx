import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { learningFlowEntryUrl, qrCodeImageUrl } from '../../lib/learningDeepLink'
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  CircleDot,
  FileText,
  GripVertical,
  HelpCircle,
  Image,
  Layers,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
  Video,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseModule, ModuleKind } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'

const MODULE_KINDS: { id: ModuleKind | 'all'; label: string; icon: HubMenu1Item['icon'] }[] = [
  { id: 'all', label: 'Alle moduler', icon: Layers },
  { id: 'flashcard', label: 'Flashkort', icon: CircleDot },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'text', label: 'Tekst', icon: BookOpen },
  { id: 'image', label: 'Bilder', icon: Image },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'checklist', label: 'Sjekkliste', icon: ListChecks },
  { id: 'tips', label: 'Praktiske tips', icon: Lightbulb },
  { id: 'on_job', label: 'I jobben', icon: Briefcase },
  { id: 'event', label: 'Arrangement (ILT)', icon: Calendar },
  { id: 'other', label: 'Annet', icon: MoreHorizontal },
]

const ADD_KINDS: { kind: ModuleKind; label: string }[] = [
  { kind: 'flashcard', label: 'Flashkort' },
  { kind: 'quiz', label: 'Quiz' },
  { kind: 'text', label: 'Tekst' },
  { kind: 'image', label: 'Bilde' },
  { kind: 'video', label: 'Video' },
  { kind: 'checklist', label: 'Sjekkliste' },
  { kind: 'tips', label: 'Praktiske tips' },
  { kind: 'on_job', label: 'I jobben' },
  { kind: 'event', label: 'Arrangement (ILT)' },
  { kind: 'other', label: 'Annet' },
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

  const moduleKindFilterItems: HubMenu1Item[] = useMemo(() => {
    if (!course) return []
    return MODULE_KINDS.map((k) => {
      const count =
        k.id === 'all'
          ? course.modules.length
          : course.modules.filter((m) => m.kind === k.id).length
      return {
        key: k.id,
        label: k.label,
        icon: k.icon,
        active: typeFilter === k.id,
        badgeCount: count,
        onClick: () => setTypeFilter(k.id),
      }
    })
  }, [course, typeFilter])

  const selected = course?.modules.find((m) => m.id === selectedId) ?? null

  if (learningLoading && courseId && !course) {
    return <p className="text-sm text-[#6b6f68]">Laster kurs…</p>
  }

  if (!course) {
    return (
      <p className="text-[#6b6f68]">
        Kurs ikke funnet. <Link to="/learning/courses" className="text-[#1a3d32] underline">Tilbake</Link>
      </p>
    )
  }

  if (canManage && isSystemCatalog && course?.sourceSystemCourseId) {
    return (
      <div className="max-w-2xl space-y-6">
        <nav className="text-sm text-[#6b6f68]">
          <Link to="/learning/courses" className="hover:text-[#1a3d32]">
            Kurs
          </Link>
          <span className="mx-2 text-neutral-300">›</span>
          <span className="font-medium text-[#1d1f1c]">{course.title}</span>
        </nav>
        <div className="rounded-lg border border-[#c5d3c8] bg-[#e7efe9] p-6">
          <h1 className="font-serif text-2xl font-semibold text-[#1a3d32]">Systemkurs</h1>
          <p className="mt-2 text-sm text-[#1d1f1c]">
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
              className="inline-flex items-center rounded-md border border-[#e3ddcc] bg-[#fbf9f3] px-4 py-2 text-sm font-medium text-[#1d1f1c] hover:bg-[#f7f5ee]"
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
        <nav className="text-sm text-[#6b6f68]">
          <Link to="/learning/courses" className="hover:text-[#1a3d32]">
            Kurs
          </Link>
          <span className="mx-2 text-neutral-300">›</span>
          <span className="font-medium text-[#1d1f1c]">{course.title}</span>
        </nav>
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-[#1d1f1c]">
          Du har ikke tilgang til kursbyggeren. Bruk <Link to={`/learning/play/${course.id}`} className="font-medium text-[#1a3d32] underline">forhåndsvisning</Link> for å ta kurset, eller be om rettigheten «E-learning — opprette og redigere kurs».
        </p>
        <Link to="/learning/courses" className="text-sm font-medium text-[#1a3d32] hover:underline">
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
      {learningLoading ? <p className="text-sm text-[#6b6f68]">Laster…</p> : null}
      <nav className="text-sm text-[#6b6f68]">
        <Link to="/learning/courses" className="hover:text-[#1a3d32]">
          Courses
        </Link>
        <span className="mx-2 text-neutral-300">›</span>
        <span className="font-medium text-[#1d1f1c]">{course.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold text-[#1d1f1c]">{course.title}</h1>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                course.status === 'published'
                  ? 'bg-[#e7efe9] text-[#1a3d32]'
                  : course.status === 'draft'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-neutral-200 text-[#1d1f1c]'
              }`}
            >
              {course.status === 'published' ? 'Publisert' : course.status === 'draft' ? 'Utkast' : 'Arkivert'}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[#6b6f68]">{course.description}</p>
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
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
          >
            Forhåndsvisning
          </Link>
        </div>
      </div>

      <HubMenu1Bar
        ariaLabel="Kursbygger — seksjoner"
        items={(
          [
            ['info', 'Kursinfo', FileText],
            ['modules', 'Moduler', Layers],
            ['cert', 'Sertifisering', Award],
            ['participants', 'Deltakere', Users],
            ['insights', 'Innsikt', BarChart3],
          ] as const
        ).map(([id, label, Icon]) => ({
          key: id,
          label,
          icon: Icon,
          active: mainTab === id,
          onClick: () => setMainTab(id),
        }))}
      />

      {mainTab === 'info' && (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
          <label className="text-xs font-medium text-[#6b6f68]">Tittel</label>
          <input
            value={course.title}
            onChange={(e) => updateCourse(course.id, { title: e.target.value })}
            className="mt-1 w-full max-w-xl rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 text-sm"
          />
          <label className="mt-4 block text-xs font-medium text-[#6b6f68]">Beskrivelse</label>
          <textarea
            value={course.description}
            onChange={(e) => updateCourse(course.id, { description: e.target.value })}
            rows={4}
            className="mt-1 w-full max-w-2xl rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 text-sm"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {course.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-[#f7f5ee] px-2 py-0.5 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    updateCourse(course.id, { tags: course.tags.filter((x) => x !== t) })
                  }
                  className="text-[#6b6f68] hover:text-red-600"
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
              placeholder="+ Legg til etikett"
              className="w-36 rounded-full border border-dashed border-[#e3ddcc] px-2 py-0.5 text-xs"
            />
          </div>
          {otherCourses.length > 0 ? (
            <div className="mt-6 border-t border-[#e3ddcc] pt-4">
              <p className="text-xs font-medium text-[#6b6f68]">Forutsetninger (lås opp dette kurset)</p>
              <p className="mt-1 text-xs text-[#6b6f68]">
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
                          className="mt-0.5 rounded border-[#e3ddcc]"
                        />
                        <span>
                          <span className="font-medium text-[#1d1f1c]">{oc.title}</span>
                          <span className="ml-2 text-xs text-[#6b6f68]">({oc.status === 'published' ? 'Publisert' : oc.status === 'draft' ? 'Utkast' : 'Arkivert'})</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          <div className="mt-6 border-t border-[#e3ddcc] pt-4">
            <p className="text-xs font-medium text-[#6b6f68]">Oppfriskning / sertifisering</p>
            <p className="mt-1 text-xs text-[#6b6f68]">
              Antall måneder til sertifikatet utløper og må fornyes (valgfritt). Brukes for påminnelser og status.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-[#1d1f1c]">
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
                  className="ml-2 w-20 rounded-lg border border-[#e3ddcc] px-2 py-1 text-sm"
                />
              </label>
              <span className="text-xs text-[#6b6f68]">
                Kursversjon: <strong>{course.courseVersion ?? 1}</strong> (økes ved innholdsendringer for revisjon)
              </span>
              <button
                type="button"
                className="rounded-md border border-[#e3ddcc] bg-[#fbf9f3] px-3 py-1.5 text-xs font-medium text-[#1d1f1c] hover:bg-[#f7f5ee]"
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
          <HubMenu1Bar ariaLabel="Moduler — typefilter" items={moduleKindFilterItems} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold text-[#1d1f1c]">Modulbygger</h2>
            <div className="flex flex-wrap gap-2">
              {ADD_KINDS.map((a) => (
                <button
                  key={a.kind}
                  type="button"
                  onClick={() => {
                    const mod = addModule(course.id, a.kind, a.label)
                    if (mod) setSelectedId(mod.id)
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[#e3ddcc] bg-[#fbf9f3] px-3 py-1.5 text-xs font-medium text-[#1d1f1c] hover:bg-[#f7f5ee]"
                >
                  <Plus className="size-3.5" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-[#e3ddcc] bg-[#fbf9f3]">
              <div className="border-b border-[#e3ddcc] bg-[#f7f5ee] px-4 py-2 text-xs font-medium text-[#6b6f68]">
                Moduler
              </div>
              <ul className="divide-y divide-[#e3ddcc]">
                {filteredModules.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#f7f5ee] ${
                        selectedId === m.id ? 'bg-[#e7efe9]' : ''
                      }`}
                    >
                      <GripVertical className="size-4 shrink-0 text-[#6b6f68]" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#1d1f1c]">{m.title}</div>
                        <div className="text-xs text-[#6b6f68]">
                          {m.kind} · ~{m.durationMinutes} min
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {filteredModules.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[#6b6f68]">Ingen moduler i dette filteret.</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-5">
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
                <p className="text-sm text-[#6b6f68]">Velg en modul for å redigere innhold.</p>
              )}
            </div>
          </div>
        </>
      )}

      {mainTab === 'cert' && (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6 text-sm text-[#6b6f68]">
          Kursbevis utstedes når en deltaker fullfører alle moduler i{' '}
          <Link to={`/learning/play/${course.id}`} className="text-[#1a3d32] underline">
            deltakervisten
          </Link>
          . Administrer alle kursbevis under{' '}
          <Link to="/learning/certifications" className="text-[#1a3d32] underline">
            Sertifiseringer
          </Link>
          .
        </div>
      )}

      {mainTab === 'participants' && (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6 text-sm text-[#6b6f68]">
          Deltakeroversikt kobles til organisasjonens Supabase-profiler. Fremdrift for påmeldte vises i{' '}
          <Link to="/learning/participants" className="text-[#1a3d32] underline">Deltakere</Link>.
        </div>
      )}

      {mainTab === 'insights' && (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
          <p className="text-sm text-[#6b6f68]">
            Antall moduler: <strong className="text-[#1d1f1c]">{course.modules.length}</strong> · Publisert:{' '}
            <strong className="text-[#1d1f1c]">{course.status === 'published' ? 'Ja' : 'Nei'}</strong>.
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
          <label className="text-xs font-medium text-[#6b6f68]">Modultittel</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              updateModule(courseId, mod.id, { title: e.target.value })
            }}
            className="mt-1 w-full rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 text-sm font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Slett denne modulen?')) {
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
        <label className="text-xs font-medium text-[#6b6f68]">Varighet (minutter)</label>
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
          className="mt-1 w-24 rounded-lg border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
        />
        <p className="mt-1 text-[11px] text-[#6b6f68]">Mikrolæring: anbefalt maks ~3 min lesing/seing per modul.</p>
      </div>

      {mod.kind === 'on_job' ? (
        <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold text-[#1d1f1c]">QR for stedet (flow-of-work)</p>
          <p className="mt-1 text-xs text-[#6b6f68]">
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
              <label className="text-[10px] font-medium uppercase text-[#6b6f68]">Dypelenke (flow)</label>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/learning/flow?course=${encodeURIComponent(courseId)}&module=${encodeURIComponent(mod.id)}`}
                className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1.5 font-mono text-[11px]"
                onFocus={(e) => e.target.select()}
              />
              <p className="text-[10px] text-[#6b6f68]">
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
      <p className="text-xs font-semibold text-[#1d1f1c]">Planlegg ILT / vILT-økt</p>
      <p className="mt-1 text-xs text-[#6b6f68]">
        Én økt per modul. Deltakere kan RSVP og oppmøte registreres i spilleren.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#6b6f68]">
          Tittel på økt
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[#6b6f68]">
          Start (lokal tid)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[#6b6f68]">
          Slutt (valgfritt)
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[#6b6f68]">
          Sted / rom
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[#6b6f68] sm:col-span-2">
          Teams / Meet-lenke
          <input
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-[#6b6f68] sm:col-span-2">
          Instruktør
          <input
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
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
      {msg ? <p className="mt-2 text-xs text-[#1d1f1c]">{msg}</p> : null}
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
        <p className="text-xs text-[#6b6f68]">Kortbasert (trykk for å snu i deltakervisten).</p>
        {c.slides.map((s, idx) => (
          <div key={s.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-3">
            <div className="text-xs font-medium text-[#6b6f68]">Kort {idx + 1}</div>
            <input
              value={s.front}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, front: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Forside"
              className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
            />
            <input
              value={s.back}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, back: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Bakside"
              className="mt-2 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const slides = [
              ...c.slides,
              { id: crypto.randomUUID(), front: 'Forside', back: 'Bakside' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, slides } })
          }}
          className="text-sm font-medium text-[#1a3d32] hover:underline"
        >
          + Legg til kort
        </button>
      </div>
    )
  }

  if (c.kind === 'quiz') {
    return (
      <div className="space-y-4">
        {c.questions.map((q) => (
          <div key={q.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-3">
            <input
              value={q.question}
              onChange={(e) => {
                const questions = c.questions.map((x) =>
                  x.id === q.id ? { ...x, question: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, questions } })
              }}
              className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm font-medium"
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
                  className="size-4 border-[#e3ddcc] text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
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
                  className="flex-1 rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
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
                question: 'Nytt spørsmål',
                options: ['A', 'B', 'C'],
                correctIndex: 0,
              },
            ]
            updateModule(courseId, mod.id, { content: { ...c, questions } })
          }}
          className="text-sm text-[#1a3d32] hover:underline"
        >
          + Legg til spørsmål
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
          placeholder="Bilde-URL"
          className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
        />
        <input
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, caption: e.target.value },
            })
          }
          placeholder="Bildetekst"
          className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
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
          placeholder="Video-URL (MP4 eller side)"
          className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
        />
        <input
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, { content: { ...c, caption: e.target.value } })
          }
          placeholder="Bildetekst (valgfritt)"
          className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
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
              className="flex-1 rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
            />
          </li>
        ))}
        <button
          type="button"
          onClick={() => {
            const items = [...c.items, { id: crypto.randomUUID(), label: 'Nytt punkt' }]
            updateModule(courseId, mod.id, { content: { ...c, items } })
          }}
          className="text-sm text-[#1a3d32] hover:underline"
        >
          + Punkt
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
              className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
            />
          </li>
        ))}
        <button
          type="button"
          onClick={() =>
            updateModule(courseId, mod.id, {
              content: { ...c, items: [...c.items, 'Nytt tips'] },
            })
          }
          className="text-sm text-[#1a3d32] hover:underline"
        >
          + Tips
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
          <div key={t.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-2">
            <input
              value={t.title}
              onChange={(e) => {
                const tasks = c.tasks.map((x) =>
                  x.id === t.id ? { ...x, title: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, tasks } })
              }}
              className="w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm font-medium"
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
              className="mt-1 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const tasks = [
              ...c.tasks,
              { id: crypto.randomUUID(), title: 'Oppgave', description: '' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, tasks } })
          }}
          className="text-sm text-[#1a3d32] hover:underline"
        >
          + Oppgave
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
          className="mb-2 w-full rounded border border-[#e3ddcc] bg-white px-2 py-1 text-sm font-medium"
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
