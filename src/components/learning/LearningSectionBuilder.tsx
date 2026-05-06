import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  BookOpen,
  Briefcase,
  Calendar,
  CircleDot,
  Folder,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BEIGE_NAV,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  ModuleRecordsTableShell,
  WikiFolderNavRow,
} from '../module'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { InfoBox } from '../ui/AlertBox'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SlidePanel } from '../layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'
import type { useLearning } from '../../hooks/useLearning'
import type { CourseModule, CourseSection, ModuleKind } from '../../types/learning'

type LearningHook = ReturnType<typeof useLearning>

type Props = {
  /** Whole hook (so the builder can call addModule / reorderModules / addSection etc.). */
  learning: LearningHook
  courseId: string
  /** Modules currently on the course. Sorted by order before rendering. */
  modules: CourseModule[]
  /** Current sections on the course. */
  sections: CourseSection[]
  isLocked: boolean
  /** Callback fired when a module row is clicked — opens the per-module editor. */
  onSelectModule: (moduleId: string) => void
  selectedModuleId?: string | null
}

type LearningPaletteItem = { kind: ModuleKind; label: string; hint: string; icon: LucideIcon }

/**
 * Palette of module kinds — drag onto the table to create a new module of that
 * kind in the currently-selected section. Mirrors {@link SURVEY_BUILDER_PALETTE}.
 *
 * Kept private to this file (re-exported from a sibling helper if other callers
 * need it) so React Fast Refresh can keep treating this module as
 * components-only.
 */
const LEARNING_BUILDER_PALETTE: LearningPaletteItem[] = [
  { kind: 'flashcard', label: 'Flashkort', hint: 'Front + bakside', icon: CircleDot },
  { kind: 'quiz', label: 'Quiz', hint: 'Kontrollspørsmål', icon: HelpCircle },
  { kind: 'text', label: 'Tekst', hint: 'Lesemodul', icon: BookOpen },
  { kind: 'image', label: 'Bilde', hint: 'Bilde + caption', icon: ImageIcon },
  { kind: 'video', label: 'Video', hint: 'Lenke + caption', icon: Video },
  { kind: 'checklist', label: 'Sjekkliste', hint: 'Kryss av', icon: ListChecks },
  { kind: 'tips', label: 'Praktiske tips', hint: 'Kort liste', icon: Lightbulb },
  { kind: 'on_job', label: 'I jobben', hint: 'Praktiske oppgaver', icon: Briefcase },
  { kind: 'event', label: 'Arrangement (ILT)', hint: 'Klasseromsøkt', icon: Calendar },
  { kind: 'other', label: 'Annet', hint: 'Egendefinert', icon: MoreHorizontal },
]

const KIND_LABEL: Record<ModuleKind, string> = LEARNING_BUILDER_PALETTE.reduce(
  (acc, p) => {
    acc[p.kind] = p.label
    return acc
  },
  {} as Record<ModuleKind, string>,
)

const PALETTE_PREFIX = 'palette:'
const SECTION_PREFIX = 'section:'
const QUESTION_DROP_ZONE_ID = 'learning-modules-empty-drop'
const SECTION_ROOT_NAV_ID = 'learning-section-root-nav'

function ModulesEmptyDropZone({
  activePaletteDrop,
  disabled,
}: {
  activePaletteDrop: boolean
  disabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: QUESTION_DROP_ZONE_ID,
    disabled,
  })
  return (
    <tr ref={setNodeRef}>
      <td
        colSpan={5}
        className={[
          'px-5 py-10 text-center text-sm transition',
          !disabled && isOver && activePaletteDrop
            ? 'bg-emerald-50/80 ring-2 ring-inset ring-[#1a3d32]/25'
            : 'text-neutral-500',
        ].join(' ')}
      >
        Ingen moduler her — dra en type hit fra paletten, eller bruk «Ny modul».
      </td>
    </tr>
  )
}

function SectionRootNavDropWrap({
  selected,
  moduleCount,
  isLocked,
  onSelect,
}: {
  selected: boolean
  moduleCount: number
  isLocked: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: SECTION_ROOT_NAV_ID,
    disabled: isLocked,
  })
  return (
    <div
      ref={setNodeRef}
      className={`mb-2 rounded-md ${isOver && !isLocked ? 'ring-2 ring-[#1a3d32]/25' : ''}`}
    >
      <WikiFolderNavRow
        label="Uten seksjon"
        sub={`${moduleCount} ${moduleCount === 1 ? 'modul' : 'moduler'}`}
        active={selected}
        onSelect={onSelect}
      />
    </div>
  )
}

function PaletteDragItem({
  kind,
  label,
  hint,
  icon: Icon,
  disabled,
}: {
  kind: ModuleKind
  label: string
  hint: string
  icon: LucideIcon
  disabled: boolean
}) {
  const id = `${PALETTE_PREFIX}${kind}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: 'palette', moduleKind: kind },
    disabled,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={[
        'flex flex-col items-start rounded-lg border border-neutral-200 bg-[#f7faf8] px-2 py-2 text-left text-xs shadow-sm',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[#1a3d32]/35',
        isDragging ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="flex items-center gap-1.5 font-semibold text-neutral-900">
        <Icon className="h-3.5 w-3.5 text-[#1a3d32]" aria-hidden />
        {label}
      </span>
      <span className="text-[10px] text-neutral-500">{hint}</span>
    </button>
  )
}

function SortableSectionRow({
  sec,
  selected,
  moduleCount,
  onSelect,
  onEdit,
  isLocked,
}: {
  sec: CourseSection
  selected: boolean
  moduleCount: number
  onSelect: () => void
  onEdit: () => void
  isLocked: boolean
}) {
  const id = `${SECTION_PREFIX}${sec.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isLocked,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-80' : ''}>
      <WikiFolderNavRow
        label={sec.title}
        sub={
          sec.description?.trim()
            ? sec.description
            : `${moduleCount} ${moduleCount === 1 ? 'modul' : 'moduler'}`
        }
        active={selected}
        onSelect={onSelect}
        actions={
          !isLocked ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-neutral-500 hover:text-neutral-800"
                title="Flytt seksjon"
                aria-label={`Flytt seksjon ${sec.title}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-neutral-500 hover:text-neutral-800"
                title="Rediger seksjon"
                aria-label={`Rediger seksjon ${sec.title}`}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  )
}

function SortableModuleTableRow({
  mod,
  isLocked,
  active,
  onRowClick,
}: {
  mod: CourseModule
  isLocked: boolean
  active: boolean
  onRowClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
    disabled: isLocked,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${MODULE_TABLE_TR_BODY} cursor-pointer ${isDragging ? 'opacity-70' : ''} ${
        active ? 'bg-[#e7efe9]/40' : ''
      }`}
      onClick={onRowClick}
    >
      <td className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
        {!isLocked ? (
          <button
            type="button"
            className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-50"
            aria-label="Flytt modul"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
      </td>
      <td className="px-5 py-3 font-medium text-neutral-900">{mod.title}</td>
      <td className="px-5 py-3">
        <Badge variant="info" className="text-[10px]">
          {KIND_LABEL[mod.kind] ?? mod.kind}
        </Badge>
      </td>
      <td className="px-5 py-3 text-neutral-600">~{mod.durationMinutes} min</td>
      <td className="px-5 py-3 text-neutral-500">{mod.order}</td>
    </tr>
  )
}

export function LearningSectionBuilder({
  learning,
  courseId,
  modules,
  sections: rawSections,
  isLocked,
  onSelectModule,
  selectedModuleId,
}: Props) {
  const sections = useMemo(
    () => [...rawSections].sort((a, b) => a.order - b.order),
    [rawSections],
  )

  const [selectedKey, setSelectedKey] = useState<string>('root')
  const selectedSectionId = selectedKey === 'root' ? null : selectedKey

  const [sectionQuery, setSectionQuery] = useState('')

  const [sectionPanelOpen, setSectionPanelOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null)
  const [secTitle, setSecTitle] = useState('')
  const [secDesc, setSecDesc] = useState('')
  const [secOrder, setSecOrder] = useState('0')

  const modulesInView = useMemo(() => {
    const filtered =
      selectedSectionId === null
        ? modules.filter((m) => !m.sectionId)
        : modules.filter((m) => m.sectionId === selectedSectionId)
    return [...filtered].sort((a, b) => a.order - b.order)
  }, [modules, selectedSectionId])

  const moduleCountBySectionKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const mod of modules) {
      const key = mod.sectionId ?? '__root__'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [modules])

  const rootModuleCount = moduleCountBySectionKey.get('__root__') ?? 0

  const sectionIds = useMemo(() => sections.map((s) => `${SECTION_PREFIX}${s.id}`), [sections])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    if (String(args.active.id).startsWith(PALETTE_PREFIX)) {
      const within = pointerWithin(args)
      if (within.length > 0) return within
    }
    return closestCenter(args)
  }, [])

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = e
      const aid = String(active.id)
      const overId = over ? String(over.id) : null

      // Palette → tabell: opprett ny modul i valgt seksjon.
      if (aid.startsWith(PALETTE_PREFIX)) {
        if (isLocked) return
        const kind = aid.slice(PALETTE_PREFIX.length) as ModuleKind
        const label = KIND_LABEL[kind] ?? 'Ny modul'
        const created = learning.addModule(courseId, kind, label, selectedSectionId)
        if (created) onSelectModule(created.id)
        return
      }

      // Section → reorder; drop on root nav slot puts the section at the end.
      if (aid.startsWith(SECTION_PREFIX)) {
        if (!overId || isLocked) return
        const oldIndex = sectionIds.indexOf(aid)
        if (oldIndex < 0) return
        let newIndex = -1
        if (overId === SECTION_ROOT_NAV_ID) {
          newIndex = sections.length - 1
        } else if (overId.startsWith(SECTION_PREFIX)) {
          newIndex = sectionIds.indexOf(overId)
        }
        if (newIndex < 0 || oldIndex === newIndex) return
        const ids = sections.map((s) => s.id)
        const newOrder = arrayMove(ids, oldIndex, newIndex)
        learning.reorderSections(courseId, newOrder)
        return
      }

      // Module row → reorder within current section view.
      if (!overId || isLocked) return
      const ids = modulesInView.map((m) => m.id)
      const oldQi = ids.indexOf(aid)
      const newQi = ids.indexOf(overId)
      if (oldQi < 0 || newQi < 0 || oldQi === newQi) return
      const newOrderInSection = arrayMove(ids, oldQi, newQi)
      // Build a full module-id order: keep modules outside the current section in
      // their existing positions, then splice in the new section order.
      const outside = modules
        .filter((m) =>
          selectedSectionId === null ? Boolean(m.sectionId) : m.sectionId !== selectedSectionId,
        )
        .sort((a, b) => a.order - b.order)
        .map((m) => m.id)
      const fullOrder = [...outside, ...newOrderInSection]
      learning.reorderModules(courseId, fullOrder)
    },
    [courseId, isLocked, learning, modules, modulesInView, onSelectModule, sectionIds, sections, selectedSectionId],
  )

  const openNewSection = () => {
    setEditingSection(null)
    setSecTitle('')
    setSecDesc('')
    setSecOrder(String(sections.length))
    setSectionPanelOpen(true)
  }

  const openEditSection = (s: CourseSection) => {
    setEditingSection(s)
    setSecTitle(s.title)
    setSecDesc(s.description ?? '')
    setSecOrder(String(s.order))
    setSectionPanelOpen(true)
  }

  const saveSection = () => {
    const trimmedTitle = secTitle.trim() || 'Seksjon'
    const order = Number.parseInt(secOrder, 10)
    if (editingSection) {
      learning.updateSection(courseId, editingSection.id, {
        title: trimmedTitle,
        description: secDesc.trim() || null,
        order: Number.isFinite(order) ? order : editingSection.order,
      })
    } else {
      learning.addSection(courseId, trimmedTitle, secDesc.trim() || undefined)
    }
    setSectionPanelOpen(false)
    setEditingSection(null)
  }

  const removeSection = () => {
    if (!editingSection) return
    if (!window.confirm(`Slette seksjonen «${editingSection.title}»? Modulene flyttes til kursrota.`)) {
      return
    }
    learning.deleteSection(courseId, editingSection.id)
    setSelectedKey('root')
    setSectionPanelOpen(false)
    setEditingSection(null)
  }

  const tableTitle =
    selectedSectionId === null
      ? 'Moduler uten seksjon'
      : sections.find((s) => s.id === selectedSectionId)?.title ?? 'Seksjon'

  const filteredSections = useMemo(() => {
    const q = sectionQuery.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => s.title.toLowerCase().includes(q))
  }, [sections, sectionQuery])

  const sectionSearchActive = sectionQuery.trim() !== ''
  const showEmptySectionSearch = sectionSearchActive && filteredSections.length === 0

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(ev: DragStartEvent) => setActiveDragId(String(ev.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm lg:grid-cols-[minmax(200px,22%)_1fr]">
          <aside
            className="border-b border-neutral-200 lg:border-b-0 lg:border-r lg:border-neutral-200/80"
            style={{ backgroundColor: BEIGE_NAV }}
          >
            <div className="border-b border-neutral-200/60 p-2.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Seksjoner</p>
                {!isLocked ? (
                  <Button type="button" variant="secondary" size="sm" onClick={openNewSection}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Ny
                  </Button>
                ) : null}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <StandardInput
                  type="search"
                  className="w-full py-2 pl-8 text-xs"
                  placeholder="Søk i seksjoner…"
                  value={sectionQuery}
                  onChange={(e) => setSectionQuery(e.target.value)}
                  aria-label="Søk i seksjoner"
                />
              </div>
            </div>
            <nav
              className="max-h-[min(70vh,32rem)] overflow-y-auto p-2"
              aria-label="Kursseksjoner"
            >
              <p className="mb-2 px-1 text-[11px] leading-snug text-neutral-600">
                Samme layout som dokumentmapper — dra håndtaket for å endre rekkefølge på seksjoner.
              </p>
              <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                <SectionRootNavDropWrap
                  selected={selectedKey === 'root'}
                  moduleCount={rootModuleCount}
                  isLocked={isLocked || sectionSearchActive}
                  onSelect={() => setSelectedKey('root')}
                />
                <div className="space-y-0.5">
                  {filteredSections.map((sec) => (
                    <SortableSectionRow
                      key={sec.id}
                      sec={sec}
                      selected={selectedKey === sec.id}
                      moduleCount={moduleCountBySectionKey.get(sec.id) ?? 0}
                      onSelect={() => setSelectedKey(sec.id)}
                      onEdit={() => openEditSection(sec)}
                      isLocked={isLocked || sectionSearchActive}
                    />
                  ))}
                </div>
              </SortableContext>
              {showEmptySectionSearch ? (
                <p className="px-3 py-4 text-center text-xs text-neutral-500">
                  Ingen seksjoner matcher søket.
                </p>
              ) : null}
            </nav>
          </aside>

          <div className="min-w-0 bg-white p-4 md:p-6">
            <div className="space-y-4">
              <InfoBox>
                Dra en modultype fra paletten under til tabellen (tom liste eller eksisterende rad), eller
                bruk «Ny modul» for sidemenyen.
              </InfoBox>

              <ModuleRecordsTableShell
                wrapInCard={false}
                title={tableTitle}
                titleTypography="sans"
                description="Samme tabellstil som spørsmålslisten i undersøkelsesbyggeren."
                toolbar={
                  !isLocked ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const created = learning.addModule(
                          courseId,
                          'text',
                          'Ny tekstmodul',
                          selectedSectionId,
                        )
                        if (created) onSelectModule(created.id)
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Ny modul
                    </Button>
                  ) : null
                }
                footer={
                  <span className="text-sm text-neutral-500">
                    {modulesInView.length} {modulesInView.length === 1 ? 'modul' : 'moduler'} i visningen
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        <th className={`${MODULE_TABLE_TH} w-10`} aria-hidden />
                        <th
                          className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Folder className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
                            Modul
                          </span>
                        </th>
                        <th
                          className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}
                        >
                          Type
                        </th>
                        <th
                          className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}
                        >
                          Varighet
                        </th>
                        <th
                          className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}
                        >
                          Indeks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modulesInView.length === 0 ? (
                        <ModulesEmptyDropZone
                          activePaletteDrop={Boolean(activeDragId?.startsWith(PALETTE_PREFIX))}
                          disabled={isLocked}
                        />
                      ) : (
                        <SortableContext
                          items={modulesInView.map((m) => m.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {modulesInView.map((m) => (
                            <SortableModuleTableRow
                              key={m.id}
                              mod={m}
                              isLocked={isLocked}
                              active={m.id === selectedModuleId}
                              onRowClick={() => onSelectModule(m.id)}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </tbody>
                  </table>
                </div>
              </ModuleRecordsTableShell>

              <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Modultyper
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Dra til tabellen over (rad eller tom liste).
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {LEARNING_BUILDER_PALETTE.map((p) => (
                    <PaletteDragItem
                      key={p.kind}
                      kind={p.kind}
                      label={p.label}
                      hint={p.hint}
                      icon={p.icon}
                      disabled={isLocked}
                    />
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragId?.startsWith(PALETTE_PREFIX) ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">
              Ny: {KIND_LABEL[activeDragId.slice(PALETTE_PREFIX.length) as ModuleKind] ?? '…'}
            </div>
          ) : activeDragId?.startsWith(SECTION_PREFIX) ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">Flytt seksjon</div>
          ) : activeDragId ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">Flytter modul…</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SlidePanel
        open={sectionPanelOpen}
        onClose={() => {
          setSectionPanelOpen(false)
          setEditingSection(null)
        }}
        titleId="learning-section-panel-title"
        title={editingSection ? 'Rediger seksjon' : 'Ny seksjon'}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSectionPanelOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={saveSection}
              disabled={!secTitle.trim()}
            >
              Lagre
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-sec-title">
              Tittel
            </label>
            <StandardInput
              id="learning-sec-title"
              value={secTitle}
              onChange={(e) => setSecTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-sec-desc">
              Beskrivelse (valgfritt)
            </label>
            <StandardTextarea
              id="learning-sec-desc"
              value={secDesc}
              onChange={(e) => setSecDesc(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-sec-ord">
              Rekkefølge (indeks blant seksjoner)
            </label>
            <StandardInput
              id="learning-sec-ord"
              type="number"
              value={secOrder}
              onChange={(e) => setSecOrder(e.target.value)}
              min={0}
            />
          </div>
          {editingSection ? (
            <Button
              type="button"
              variant="ghost"
              icon={<Trash2 className="h-4 w-4" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={removeSection}
            >
              Slett seksjon
            </Button>
          ) : null}
        </div>
      </SlidePanel>
    </>
  )
}

