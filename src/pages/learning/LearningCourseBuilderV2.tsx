// LearningCourseBuilderV2 — Notion-style page editor for one course. Outline
// rail on the left, lesson editor in the middle, settings + palette + changelog
// on the right, sticky save bar at the bottom. Replaces the legacy
// LearningCourseBuilder at /learning/courses/:courseId.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  AlignLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileDown,
  GitBranch,
  HelpCircle,
  Info,
  ListChecks,
  Loader2,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  Send,
  Square,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { ModulePageShell } from '../../components/module'
import {
  LESSON_BLOCK_PALETTE,
  blockToModuleKind,
  moduleKindToBlock,
  type LessonBlockKind,
} from '../../lib/learning/elearningDesignKit'
import { Card } from '../../components/ui/elearningPrimitives'
import type {
  ChecklistItem,
  CourseModule,
  ModuleContent,
  ModuleKind,
  QuizQuestion,
} from '../../types/learning'

const SHARED_SERIF = "'Libre Baskerville', Georgia, serif"

export function LearningCourseBuilderV2() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId: string }>()
  const learning = useLearning()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const {
    courses,
    learningLoading,
    learningError,
    addModule,
    updateModule,
    deleteModule,
    reorderModules,
    updateCourse,
    publishOrgCourseVersion,
  } = learning
  const [publishStatus, setPublishStatus] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string } | { kind: 'ok' }>(
    { kind: 'idle' },
  )

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId])
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [bumpMajor, setBumpMajor] = useState(false)
  const [changelog, setChangelog] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Auto-select first lesson when the course changes or the active selection is no longer valid.
  // Calculated during render (cheap derivation) to avoid the cascading set-state-in-effect anti-pattern.
  if (course) {
    if (course.modules.length === 0 && activeLessonId !== null) {
      setActiveLessonId(null)
    } else if (
      course.modules.length > 0 &&
      (!activeLessonId || !course.modules.some((m) => m.id === activeLessonId))
    ) {
      setActiveLessonId(course.modules[0]?.id ?? null)
    }
  }

  if (learningLoading || !course) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert', to: '/' }, { label: 'Opplæring', to: '/learning' }, { label: 'Bygger' }]}
        title={<span className="inline-flex items-center gap-2"><Pencil className="h-5 w-5 text-[#1a3d32]" />Kursbygger</span>}
        description={null}
        loading={learningLoading}
        loadingLabel="Henter kurs…"
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

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert', to: '/' }, { label: 'Opplæring', to: '/learning' }, { label: 'Bygger' }]}
        title="Du har ikke tilgang"
        description="Kursbyggeren krever rollen «learning.manage» eller administrator."
      >
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          Be en administrator om å gi deg tilgang til å redigere e-læringskurs.
        </div>
      </ModulePageShell>
    )
  }

  const courseRow = course
  const sortedModules = [...courseRow.modules].sort((a, b) => a.order - b.order)
  const major = courseRow.localeVersionMajor ?? courseRow.courseVersion ?? 1
  const minor = courseRow.localeVersionMinor ?? courseRow.courseVersionMinor ?? 0
  const nextVersion = bumpMajor ? `${major + 1}.0` : `${major}.${minor + 1}`
  const activeLesson = sortedModules.find((m) => m.id === activeLessonId) ?? sortedModules[0] ?? null
  const totalMinutes = sortedModules.reduce((a, m) => a + (m.durationMinutes || 0), 0)

  function noteSaved() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setSavedAt(`${hh}:${mm}`)
  }

  function handleAddLesson() {
    const mod = addModule(courseRow.id, 'text', `Leksjon ${sortedModules.length + 1}`, null)
    if (mod) {
      setActiveLessonId(mod.id)
      noteSaved()
    }
  }

  function handleRemoveLesson(modId: string) {
    if (!window.confirm('Slett denne leksjonen?')) return
    deleteModule(courseRow.id, modId)
    const remaining = sortedModules.filter((m) => m.id !== modId)
    if (remaining.length === 0) setActiveLessonId(null)
    else if (modId === activeLessonId) setActiveLessonId(remaining[0]?.id ?? null)
    noteSaved()
  }

  function handleMoveLesson(modId: string, dir: -1 | 1) {
    const ids = sortedModules.map((m) => m.id)
    const idx = ids.indexOf(modId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    reorderModules(courseRow.id, next)
    noteSaved()
  }

  function handleUpdateLesson(modId: string, patch: Partial<CourseModule>) {
    updateModule(courseRow.id, modId, patch)
    noteSaved()
  }

  function handleAddBlock(kind: LessonBlockKind) {
    // Each module is one block in this mapping (1:1). "Add block" creates a
    // NEW module so the outline grows — does NOT replace the current module's
    // content. If the user wants to change the active block's type, they can
    // use the kind switcher inside the BlockEditor instead.
    const mod = addModule(courseRow.id, blockToModuleKind(kind), defaultBlockTitle(kind), null)
    if (mod) {
      setActiveLessonId(mod.id)
      noteSaved()
    }
  }

  async function handlePublish() {
    if (publishStatus.kind === 'busy') return
    setPublishStatus({ kind: 'busy' })
    const result = await publishOrgCourseVersion({
      courseId: courseRow.id,
      versionMajor: bumpMajor ? major + 1 : major,
      versionMinor: bumpMajor ? 0 : minor + 1,
      isMajor: bumpMajor,
      changeNotesMd: changelog || 'Ingen endringslogg notert.',
    })
    if (!result.ok) {
      // Permission gate falls through with "Krever tilgang." — surface a
      // local notice rather than relying on the parent error banner.
      setPublishStatus({ kind: 'error', message: result.error })
      return
    }
    // Promote to published even if it already was — keeps the status
    // consistent with the version bump.
    updateCourse(courseRow.id, { status: 'published' })
    noteSaved()
    setPublishStatus({ kind: 'ok' })
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Klarert', to: '/' },
        { label: 'Opplæring', to: '/learning' },
        { label: courseRow.title, to: `/learning/courses/${courseRow.id}/detail` },
        { label: 'Bygger' },
      ]}
      title={<span className="inline-flex items-center gap-2"><Pencil className="h-5 w-5 text-[#1a3d32]" />Kursbygger</span>}
      description={`Endringer publiseres som v${nextVersion}. ${sortedModules.length} leksjoner · ${sortedModules.length} innholdsblokker · ${totalMinutes} min.`}
      headerActions={
        <>
          <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => navigate(`/learning/courses/${courseRow.id}/detail`)}>
            Avbryt
          </Button>
          <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => navigate(`/learning/play/${courseRow.id}`)}>
            Forhåndsvis
          </Button>
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} onClick={noteSaved}>
            Lagre kladd
          </Button>
          <Button
            variant="primary"
            icon={publishStatus.kind === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            onClick={handlePublish}
            disabled={publishStatus.kind === 'busy'}
          >
            {publishStatus.kind === 'busy' ? 'Publiserer…' : `Publiser v${nextVersion}`}
          </Button>
        </>
      }
    >
      {learningError ? (
        <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1">{learningError}</span>
        </div>
      ) : null}
      {publishStatus.kind === 'error' ? (
        <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1">Publisering feilet: {publishStatus.message}</span>
        </div>
      ) : null}
      {publishStatus.kind === 'ok' ? (
        <div className="flex items-start gap-2.5 rounded-md border border-green-300 bg-green-50 px-3 py-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <span className="flex-1">Ny versjon publisert. Læringer ser endringene umiddelbart.</span>
        </div>
      ) : null}
      <Card className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-2 py-1 font-semibold tabular-nums">
            v{major}.{minor}
            <ArrowRight className="h-3 w-3 text-neutral-400" />
            v{nextVersion}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-neutral-600 hover:text-neutral-900">
            <StandardInput
              type="checkbox"
              checked={bumpMajor}
              onChange={(e) => setBumpMajor(e.target.checked)}
              className="h-3 w-3"
            />
            <span>Stor revisjon</span>
          </label>
          <span className="text-neutral-400">·</span>
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-green-700">
              <Save className="h-3 w-3" /> Automatisk lagret {savedAt}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-neutral-500">
              <Save className="h-3 w-3" /> Endringer lagres når du redigerer
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside>
          <Card>
            <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Leksjoner</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddLesson}
                aria-label="Legg til leksjon"
                className="!p-1 text-neutral-400 hover:!bg-neutral-100 hover:text-[#1a3d32]"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <ul className="py-1">
              {sortedModules.length === 0 ? (
                <li className="px-3 py-3 text-[11px] text-neutral-500">Ingen leksjoner ennå. Legg til den første under.</li>
              ) : null}
              {sortedModules.map((m, i) => {
                const isActive = m.id === activeLessonId
                return (
                  <li key={m.id} className="group">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveLessonId(m.id)}
                      className={[
                        '!justify-start w-full !gap-2 !rounded-none !px-3 !py-2 text-left text-xs !font-normal',
                        isActive
                          ? '!bg-[#e7efe9] !font-semibold text-[#1a3d32]'
                          : '!bg-transparent text-neutral-700 hover:!bg-neutral-50',
                      ].join(' ')}
                      style={isActive ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                    >
                      <span className="tabular-nums text-neutral-400">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="shrink-0 text-[9px] tabular-nums text-neutral-400">1b</span>
                      {isActive ? (
                        <span className="hidden items-center gap-0.5 group-hover:inline-flex">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveLesson(m.id, -1)
                            }}
                            className="!rounded !p-0.5 hover:!bg-white"
                          >
                            <ChevronUp className="h-2.5 w-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveLesson(m.id, 1)
                            }}
                            className="!rounded !p-0.5 hover:!bg-white"
                          >
                            <ChevronDown className="h-2.5 w-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveLesson(m.id)
                            }}
                            className="!rounded !p-0.5 text-red-600 hover:!bg-white"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </span>
                      ) : null}
                    </Button>
                  </li>
                )
              })}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddLesson}
              className="m-2 flex w-[calc(100%-1rem)] items-center justify-center !gap-1 !rounded-md !border !border-dashed !border-neutral-300 !bg-transparent px-2 py-1.5 text-[11px] !font-semibold text-neutral-500 hover:!border-[#1a3d32] hover:text-[#1a3d32]"
            >
              <Plus className="h-3 w-3" /> Ny leksjon
            </Button>
          </Card>

          <div className="mt-3 rounded-md p-3 text-[11px]" style={{ background: '#fbf9f3' }}>
            <div className="font-semibold text-neutral-900">Statistikk</div>
            <ul className="mt-1.5 space-y-0.5 text-neutral-600">
              <li className="flex justify-between"><span>Leksjoner</span><span className="font-semibold tabular-nums text-neutral-900">{sortedModules.length}</span></li>
              <li className="flex justify-between"><span>Innholdsblokker</span><span className="font-semibold tabular-nums text-neutral-900">{sortedModules.length}</span></li>
              <li className="flex justify-between"><span>Total varighet</span><span className="font-semibold tabular-nums text-neutral-900">{Math.round((totalMinutes / 60) * 10) / 10}t</span></li>
              <li className="flex justify-between"><span>Quizer</span><span className="font-semibold tabular-nums text-neutral-900">{sortedModules.filter((m) => m.kind === 'quiz').length}</span></li>
            </ul>
          </div>
        </aside>

        <article
          className="mx-auto w-full max-w-[680px] rounded-xl bg-white px-10 py-8 ring-1 ring-neutral-200/70"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)', fontFamily: SHARED_SERIF }}
        >
          {activeLesson ? (
            <LessonEditor
              lesson={activeLesson}
              total={sortedModules.length}
              index={sortedModules.indexOf(activeLesson)}
              onUpdate={(patch) => handleUpdateLesson(activeLesson.id, patch)}
            />
          ) : (
            <div className="rounded-md border-2 border-dashed border-neutral-200 px-6 py-12 text-center">
              <Plus className="mx-auto h-6 w-6 text-neutral-400" />
              <h3 className="mt-2 text-sm font-semibold text-neutral-900">Ingen leksjoner ennå</h3>
              <p className="mt-1 text-[12px] text-neutral-500">Legg til en leksjon for å begynne å bygge kurset.</p>
              <Button variant="primary" size="sm" className="mt-3" icon={<Plus className="h-3 w-3" />} onClick={handleAddLesson}>
                Legg til leksjon
              </Button>
            </div>
          )}
        </article>

        <aside className="space-y-3">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Legg til blokk</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">Velg innholdstype å legge til i {activeLesson?.title ?? 'leksjonen'}.</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {LESSON_BLOCK_PALETTE.map((p) => (
                <Button
                  key={p.type}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddBlock(p.type)}
                  className="flex flex-col items-center !gap-1 !rounded-md !border !border-neutral-200 !bg-white !p-2 !font-normal hover:!border-[#1a3d32] hover:!bg-[#e7efe9]/30"
                >
                  <BlockIcon type={p.type} />
                  <span className="text-[10px] font-medium text-neutral-700">{p.label}</span>
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Leksjon-innstillinger</h3>
            <ul className="mt-2 space-y-2.5">
              <ToggleRow label="Krev at forrige leksjon er fullført" hint="UI-visning, ikke lagret" />
              <ToggleRow label="Lås før dato" hint="UI-visning, ikke lagret" />
              <ToggleRow label="Anbefalt for verneombud" defaultOn hint="UI-visning, ikke lagret" />
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Endringslogg</h3>
            <StandardTextarea
              rows={3}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              className="mt-2 bg-neutral-50 p-2 text-xs"
              placeholder={`Hva endret i v${nextVersion}?`}
            />
          </Card>
        </aside>
      </div>

      <Card className="sticky bottom-0 z-10 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {savedAt ? 'Endringer lagret som kladd' : 'Ingen endringer lagret ennå'}
          </span>
          <span className="text-neutral-400">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-neutral-600">
            v{major}.{minor} → v{nextVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate(`/learning/courses/${courseRow.id}/detail`)}>
            Avbryt
          </Button>
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} onClick={noteSaved}>
            Lagre kladd
          </Button>
          <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={handlePublish}>
            Publiser v{nextVersion}
          </Button>
        </div>
      </Card>
    </ModulePageShell>
  )
}

// Lesson-level settings toggle. NB: these toggles are visual scaffolding for
// the design — the per-lesson rules (prerequisites, lock-before-date,
// recommended-for-role) don't have DB columns yet, so flipping them only
// updates local state. When the matching `learning_modules` columns ship
// (prereq_module_id, available_at, recommended_for_role), wire onChange
// here to call `updateModule`.
function ToggleRow({
  label,
  defaultOn = false,
  hint,
}: {
  label: string
  defaultOn?: boolean
  hint?: string
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-neutral-700">
        {label}
        {hint ? <span className="ml-1 text-[10px] text-neutral-400">({hint})</span> : null}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOn(!on)}
        aria-pressed={on}
        title={hint ?? label}
        className={[
          'relative !h-4 !w-7 cursor-pointer !rounded-full !p-0 transition-colors',
          on ? '!bg-[#1a3d32]' : '!bg-neutral-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
            on ? 'translate-x-3.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </Button>
    </li>
  )
}

function LessonEditor({
  lesson,
  total,
  index,
  onUpdate,
}: {
  lesson: CourseModule
  total: number
  index: number
  onUpdate: (patch: Partial<CourseModule>) => void
}) {
  return (
    <>
      <div className="border-b border-neutral-100 pb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="text-[12px] font-medium text-neutral-400">Leksjon {index + 1} av {total}</div>
        <StandardInput
          type="text"
          value={lesson.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="mt-2 !border-none !bg-transparent !p-0 text-3xl !font-bold leading-tight tracking-tight text-neutral-900 focus:!bg-amber-50/40"
          placeholder="Leksjonens tittel…"
          style={{ fontFamily: 'inherit' }}
        />
        <div className="mt-3 flex items-center gap-3 text-[12px]">
          <label className="flex items-center gap-2 text-neutral-600">
            <Clock className="h-3 w-3" />
            <StandardInput
              type="number"
              min={1}
              value={lesson.durationMinutes}
              onChange={(e) => onUpdate({ durationMinutes: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 !rounded-md !bg-neutral-50 !px-1.5 !py-0.5 text-xs tabular-nums"
            />
            <span>min</span>
          </label>
        </div>
      </div>
      <div className="mt-5 space-y-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <BlockEditor lesson={lesson} onUpdate={onUpdate} />
      </div>
    </>
  )
}

function BlockEditor({ lesson, onUpdate }: { lesson: CourseModule; onUpdate: (patch: Partial<CourseModule>) => void }) {
  const block = moduleKindToBlock(lesson.kind)
  const palette = LESSON_BLOCK_PALETTE.find((p) => p.type === block)!

  function changeKind(next: LessonBlockKind) {
    const kind = blockToModuleKind(next)
    onUpdate({ kind, content: defaultContentFor(kind, lesson.title) })
  }

  function updateContent(content: ModuleContent) {
    onUpdate({ content })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-[#1a3d32]/40">
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: palette.color + '14', color: palette.color }}
        >
          <BlockIcon type={block} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: palette.color }}>{palette.label}</span>
            <SearchableSelect
              value={block}
              options={LESSON_BLOCK_PALETTE.map((p) => ({ value: p.type, label: p.label }))}
              onChange={(v) => changeKind(v as LessonBlockKind)}
              triggerClassName="!py-0.5 !px-2 !text-[10px] font-semibold"
              className="min-w-[120px]"
            />
          </div>

          {/* Content-type specific editors */}
          {lesson.content.kind === 'text' ? (
            <TextEditor
              content={lesson.content}
              onChange={(c) => updateContent(c)}
            />
          ) : null}
          {lesson.content.kind === 'video' ? (
            <VideoEditor
              content={lesson.content}
              onChange={(c) => updateContent(c)}
            />
          ) : null}
          {lesson.content.kind === 'quiz' ? (
            <QuizEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'checklist' ? (
            <ChecklistEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'tips' ? (
            <CalloutEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'flashcard' ? (
            <InteractiveEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'scenario' ? (
            <ScenarioEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'event' ? (
            <DownloadEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'on_job' ? (
            <PracticalEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'image' ? (
            <ImageEditor content={lesson.content} onChange={(c) => updateContent(c)} />
          ) : null}
          {lesson.content.kind === 'other' ? (
            <StandardTextarea
              value={lesson.content.body}
              onChange={(e) =>
                updateContent({ kind: 'other', title: lesson.content.kind === 'other' ? lesson.content.title : '', body: e.target.value })
              }
              className="mt-3 resize-none !bg-neutral-50 !p-2"
              rows={4}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function defaultBlockTitle(kind: LessonBlockKind): string {
  switch (kind) {
    case 'video':
      return 'Ny video'
    case 'text':
      return 'Ny tekst'
    case 'quiz':
      return 'Ny quiz'
    case 'checklist':
      return 'Ny sjekkliste'
    case 'interactive':
      return 'Ny interaktiv'
    case 'scenario':
      return 'Nytt scenario'
    case 'callout':
      return 'Ny callout'
    case 'download':
      return 'Ny nedlasting'
    case 'practical':
      return 'Ny praktisk øvelse'
  }
}

function defaultContentFor(kind: ModuleKind, title: string): ModuleContent {
  switch (kind) {
    case 'video':
      return { kind: 'video', url: '', caption: title }
    case 'quiz':
      return {
        kind: 'quiz',
        questions: [
          {
            id: cryptoUuid(),
            question: 'Hva er hovedformålet med arbeidsmiljøloven (AML § 1-1)?',
            options: [
              'Å regulere lønnsforhold',
              'Å sikre et trygt og helsefremmende arbeidsmiljø',
              'Å fastsette arbeidstid',
              'Å pålegge medlemskap i fagforening',
            ],
            correctIndex: 1,
          },
        ],
        validation: { requiredScore: 80, allowRetry: true },
      }
    case 'checklist':
      return { kind: 'checklist', items: [{ id: cryptoUuid(), label: 'Første sjekkpunkt' }] }
    case 'tips':
      return { kind: 'tips', items: ['Skriv din callout-tekst her.'] }
    case 'flashcard':
      return {
        kind: 'flashcard',
        slides: [{ id: cryptoUuid(), front: 'Begrep', back: 'Forklaring' }],
      }
    case 'scenario':
      return {
        kind: 'scenario',
        intro: 'Beskriv situasjonen…',
        passingImpactScore: 0,
        steps: [
          {
            id: cryptoUuid(),
            prompt: 'Hva gjør du?',
            choices: [
              { id: cryptoUuid(), label: 'Alternativ A', impactScore: 5, feedback: 'God beslutning.' },
              { id: cryptoUuid(), label: 'Alternativ B', impactScore: -3, feedback: 'Ikke optimalt.' },
            ],
          },
        ],
      }
    case 'event':
      return { kind: 'event', instructions: '<p>Beskriv øvelsen, sted og forberedelser.</p>' }
    case 'on_job':
      return {
        kind: 'on_job',
        tasks: [{ id: cryptoUuid(), title, description: 'Beskriv praktisk øvelse.' }],
      }
    case 'image':
      return { kind: 'image', caption: title, imageUrl: '' }
    case 'text':
    default:
      return { kind: 'text', body: '', bodyMarkdown: '' }
  }
}

function cryptoUuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function TextEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'text' }>
  onChange: (c: ModuleContent) => void
}) {
  const value = content.bodyMarkdown ?? content.body ?? ''
  return (
    <StandardTextarea
      rows={4}
      value={value}
      onChange={(e) => onChange({ ...content, bodyMarkdown: e.target.value, bodyFormat: 'markdown' })}
      placeholder="Skriv brødtekst (markdown støttes)…"
      className="mt-3 resize-none !bg-neutral-50 !p-2 leading-relaxed"
    />
  )
}

function VideoEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'video' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400">
        <div className="text-center text-xs">
          <Upload className="mx-auto h-5 w-5" />
          <div className="mt-1">Last opp eller lim inn video-lenke</div>
        </div>
      </div>
      <StandardInput
        type="text"
        value={content.url ?? content.media?.url ?? ''}
        onChange={(e) =>
          onChange({
            ...content,
            url: e.target.value,
            media: content.media ? { ...content.media, url: e.target.value } : undefined,
          })
        }
        placeholder="https://…"
        className="!bg-neutral-50 !px-2 !py-1 text-xs"
      />
    </div>
  )
}

function QuizEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'quiz' }>
  onChange: (c: ModuleContent) => void
}) {
  function update(i: number, partial: Partial<QuizQuestion>) {
    const next = content.questions.map((q, j) => (j === i ? { ...q, ...partial } : q))
    onChange({ ...content, questions: next })
  }
  function addQuestion() {
    onChange({
      ...content,
      questions: [
        ...content.questions,
        { id: cryptoUuid(), question: 'Nytt spørsmål', options: ['Svar A', 'Svar B'], correctIndex: 0 },
      ],
    })
  }
  function removeQuestion(i: number) {
    onChange({ ...content, questions: content.questions.filter((_, j) => j !== i) })
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3 text-xs text-neutral-600">
        <label className="inline-flex items-center gap-1.5">
          <span>Bestått (%):</span>
          <StandardInput
            type="number"
            min={0}
            max={100}
            value={content.validation?.requiredScore ?? 80}
            onChange={(e) =>
              onChange({
                ...content,
                validation: {
                  requiredScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  allowRetry: content.validation?.allowRetry ?? true,
                },
              })
            }
            className="w-14 !bg-neutral-50 !px-1.5 !py-0.5 tabular-nums"
          />
        </label>
        <label className="inline-flex items-center gap-1.5">
          <StandardInput
            type="checkbox"
            checked={!!content.validation?.allowRetry}
            onChange={(e) =>
              onChange({
                ...content,
                validation: {
                  requiredScore: content.validation?.requiredScore ?? 80,
                  allowRetry: e.target.checked,
                },
              })
            }
            className="h-3 w-3"
          />
          <span>Tillat nytt forsøk</span>
        </label>
      </div>
      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 text-[11px] text-blue-900">
        <HelpCircle className="mr-1 inline h-3 w-3" />
        {content.questions.length} spørsmål · {content.validation?.requiredScore ?? 80}% for å bestå · {content.validation?.allowRetry === false ? '1 forsøk' : 'ubegrenset forsøk'}
      </div>
      <ul className="space-y-2">
        {content.questions.map((q, i) => (
          <li key={q.id} className="rounded-md border border-neutral-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-neutral-500">Spørsmål {i + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(i)}
                className="ml-auto !rounded !p-1 text-neutral-400 hover:!bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <StandardInput
              value={q.question}
              onChange={(e) => update(i, { question: e.target.value })}
              className="mt-1 !bg-neutral-50 !px-2 !py-1 text-xs"
              placeholder="Spørsmålet…"
            />
            <ul className="mt-1.5 space-y-1">
              {q.options.map((opt, oi) => (
                <li key={oi} className="flex items-center gap-1.5">
                  <StandardInput
                    type="radio"
                    name={`q-${q.id}-correct`}
                    checked={q.correctIndex === oi}
                    onChange={() => update(i, { correctIndex: oi })}
                    className="h-3 w-3"
                  />
                  <StandardInput
                    value={opt}
                    onChange={(e) => {
                      const next = [...q.options]
                      next[oi] = e.target.value
                      update(i, { options: next })
                    }}
                    className="flex-1 !bg-neutral-50 !px-2 !py-1 text-xs"
                    placeholder={`Svar ${oi + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const next = q.options.filter((_, j) => j !== oi)
                      const correctNext = q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex
                      update(i, { options: next, correctIndex: correctNext })
                    }}
                    className="!rounded !p-1 text-neutral-400 hover:!bg-neutral-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </li>
              ))}
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update(i, { options: [...q.options, 'Nytt alternativ'] })}
                  className="!gap-1 !rounded !px-1.5 !py-1 text-[11px] font-semibold text-neutral-500 hover:!bg-neutral-100 hover:text-[#1a3d32]"
                >
                  <Plus className="h-3 w-3" /> Nytt svar
                </Button>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        onClick={addQuestion}
        className="!gap-1 !rounded !px-1.5 !py-1 text-[11px] font-semibold text-neutral-500 hover:!bg-neutral-100 hover:text-[#1a3d32]"
      >
        <Plus className="h-3 w-3" /> Nytt spørsmål
      </Button>
    </div>
  )
}

function ChecklistEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'checklist' }>
  onChange: (c: ModuleContent) => void
}) {
  function update(i: number, partial: Partial<ChecklistItem>) {
    onChange({ ...content, items: content.items.map((it, j) => (j === i ? { ...it, ...partial } : it)) })
  }
  return (
    <div className="mt-3 space-y-1.5">
      {content.items.map((it, i) => (
        <div key={it.id} className="flex items-center gap-2">
          <Square className="h-3 w-3 shrink-0 text-neutral-400" />
          <StandardInput
            value={it.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Punkt…"
            className="flex-1 !bg-neutral-50 !px-2 !py-1 text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange({ ...content, items: content.items.filter((_, j) => j !== i) })}
            className="!rounded !p-1 text-neutral-400 hover:!bg-red-50 hover:text-red-700"
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...content, items: [...content.items, { id: cryptoUuid(), label: '' }] })}
        className="!gap-1 !rounded !px-1.5 !py-1 text-[11px] font-semibold text-neutral-500 hover:!bg-neutral-100 hover:text-[#1a3d32]"
      >
        <Plus className="h-3 w-3" /> Nytt punkt
      </Button>
    </div>
  )
}

function CalloutEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'tips' }>
  onChange: (c: ModuleContent) => void
}) {
  const text = content.items[0] ?? ''
  const [tone, setTone] = useState<'info' | 'warning' | 'success'>('info')
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tone:</span>
        {(['info', 'warning', 'success'] as const).map((t) => (
          <Button
            key={t}
            variant={tone === t ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTone(t)}
            className={[
              '!gap-0 !rounded-full !px-2 !py-0.5 text-[10px]',
              tone === t ? '' : '!bg-neutral-100 text-neutral-600',
            ].join(' ')}
          >
            {t}
          </Button>
        ))}
      </div>
      <StandardTextarea
        rows={2}
        value={text}
        onChange={(e) => onChange({ kind: 'tips', items: [e.target.value] })}
        placeholder="Callout-tekst…"
        className="resize-none !bg-neutral-50 !p-2"
      />
    </div>
  )
}

function InteractiveEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'flashcard' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-pink-200 bg-pink-50/40 p-3 text-[12px] text-pink-900">
      <div className="flex items-center gap-2">
        <MousePointer2 className="h-3 w-3" />
        <span>Interaktiv (flashcards) · {content.slides.length} kort</span>
      </div>
      <ul className="space-y-2">
        {content.slides.map((s, i) => (
          <li key={s.id} className="grid grid-cols-2 gap-2 rounded-md bg-white p-2">
            <StandardInput
              value={s.front}
              onChange={(e) =>
                onChange({
                  ...content,
                  slides: content.slides.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)),
                })
              }
              className="!bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
              placeholder="Forside"
            />
            <StandardInput
              value={s.back}
              onChange={(e) =>
                onChange({
                  ...content,
                  slides: content.slides.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)),
                })
              }
              className="!bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
              placeholder="Bakside"
            />
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ ...content, slides: [...content.slides, { id: cryptoUuid(), front: '', back: '' }] })}
        className="!gap-1 !rounded !px-1.5 !py-1 text-[11px] font-semibold text-pink-900 hover:!bg-pink-100"
      >
        <Plus className="h-3 w-3" /> Nytt kort
      </Button>
    </div>
  )
}

function ScenarioEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'scenario' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-3 text-[12px] text-amber-900">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3" /> Forgrenet scenario · {content.steps.length} steg
      </div>
      <StandardTextarea
        rows={2}
        value={content.intro ?? ''}
        onChange={(e) => onChange({ ...content, intro: e.target.value })}
        placeholder="Innledning til scenarioet…"
        className="resize-none !bg-white !p-2 text-xs"
      />
      {content.steps.map((step, si) => (
        <div key={step.id} className="rounded-md bg-white p-2">
          <StandardInput
            value={step.prompt}
            onChange={(e) =>
              onChange({
                ...content,
                steps: content.steps.map((x, j) => (j === si ? { ...x, prompt: e.target.value } : x)),
              })
            }
            className="!bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
            placeholder="Hva skjer?"
          />
          <ul className="mt-1.5 space-y-1">
            {step.choices.map((choice, ci) => (
              <li key={choice.id} className="flex items-center gap-1.5">
                <StandardInput
                  value={choice.label}
                  onChange={(e) => {
                    const nextChoices = step.choices.map((c, j) =>
                      j === ci ? { ...c, label: e.target.value } : c,
                    )
                    onChange({
                      ...content,
                      steps: content.steps.map((x, j) =>
                        j === si ? { ...x, choices: nextChoices } : x,
                      ),
                    })
                  }}
                  className="flex-1 !bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
                  placeholder={`Alternativ ${ci + 1}`}
                />
                <StandardInput
                  type="number"
                  value={choice.impactScore}
                  onChange={(e) => {
                    const nextChoices = step.choices.map((c, j) =>
                      j === ci ? { ...c, impactScore: Number(e.target.value) || 0 } : c,
                    )
                    onChange({
                      ...content,
                      steps: content.steps.map((x, j) =>
                        j === si ? { ...x, choices: nextChoices } : x,
                      ),
                    })
                  }}
                  className="w-14 !bg-neutral-50 !px-2 !py-1 text-xs tabular-nums text-neutral-800"
                  title="Impact score"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function DownloadEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'event' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[12px]">
      <div className="flex items-center gap-2">
        <FileDown className="h-4 w-4 text-neutral-500" />
        <span className="text-neutral-700">Konfigurer nedlasting / instruksjoner</span>
      </div>
      <StandardTextarea
        rows={3}
        value={content.instructions}
        onChange={(e) => onChange({ ...content, instructions: e.target.value })}
        className="resize-none !bg-white !p-2"
        placeholder="Instruksjoner (HTML støttes)…"
      />
    </div>
  )
}

function PracticalEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'on_job' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-orange-200 bg-orange-50/50 p-3 text-[12px] text-orange-900">
      <div className="flex items-center gap-1.5">
        <Briefcase className="h-3 w-3" /> Praktisk øvelse — kontrolleres av instruktør
      </div>
      <ul className="space-y-2">
        {content.tasks.map((task, i) => (
          <li key={task.id} className="rounded-md bg-white p-2">
            <StandardInput
              value={task.title}
              onChange={(e) =>
                onChange({
                  ...content,
                  tasks: content.tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                })
              }
              className="!bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
              placeholder="Oppgavetittel"
            />
            <StandardTextarea
              value={task.description}
              onChange={(e) =>
                onChange({
                  ...content,
                  tasks: content.tasks.map((x, j) =>
                    j === i ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
              rows={2}
              className="mt-1 resize-none !bg-neutral-50 !px-2 !py-1 text-xs text-neutral-800"
              placeholder="Beskrivelse…"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImageEditor({
  content,
  onChange,
}: {
  content: Extract<ModuleContent, { kind: 'image' }>
  onChange: (c: ModuleContent) => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <StandardInput
        type="text"
        value={content.imageUrl}
        onChange={(e) => onChange({ ...content, imageUrl: e.target.value })}
        placeholder="Bilde-URL"
        className="!bg-neutral-50 !px-2 !py-1 text-xs"
      />
      <StandardInput
        type="text"
        value={content.caption}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        placeholder="Bildetekst"
        className="!bg-neutral-50 !px-2 !py-1 text-xs"
      />
    </div>
  )
}

function BlockIcon({ type }: { type: LessonBlockKind }) {
  switch (type) {
    case 'video':
      return <Video className="h-4 w-4 text-[#1a3d32]" />
    case 'text':
      return <AlignLeft className="h-4 w-4 text-[#1a3d32]" />
    case 'quiz':
      return <HelpCircle className="h-4 w-4 text-[#1a3d32]" />
    case 'checklist':
      return <ListChecks className="h-4 w-4 text-[#1a3d32]" />
    case 'interactive':
      return <MousePointer2 className="h-4 w-4 text-[#1a3d32]" />
    case 'scenario':
      return <GitBranch className="h-4 w-4 text-[#1a3d32]" />
    case 'callout':
      return <Info className="h-4 w-4 text-[#1a3d32]" />
    case 'download':
      return <Download className="h-4 w-4 text-[#1a3d32]" />
    case 'practical':
      return <Briefcase className="h-4 w-4 text-[#1a3d32]" />
  }
}
