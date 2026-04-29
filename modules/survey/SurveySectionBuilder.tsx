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
import { Folder, GripVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
} from '../../src/components/module'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { InfoBox } from '../../src/components/ui/AlertBox'
import { StandardInput } from '../../src/components/ui/Input'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SURVEY_BUILDER_PALETTE, questionTypeLabel } from './surveyLabels'
import { defaultQuestionPayload } from './surveyQuestionDefaults'
import { fullOrderAfterSectionReorder } from './surveyQuestionGlobalOrder'
import type { UseSurveyState } from './useSurvey'
import type { OrgSurveyQuestionRow, SurveyQuestionType, SurveySectionRow } from './types'

type Props = {
  survey: UseSurveyState
  surveyId: string
  isLocked: boolean
  onEditQuestion: (q: OrgSurveyQuestionRow) => void
  onAddQuestion: (sectionId: string | null) => void
}

const PALETTE_PREFIX = 'palette:'
const SECTION_PREFIX = 'section:'
const QUESTION_DROP_ZONE_ID = 'survey-questions-empty-drop'
const SECTION_ROOT_NAV_ID = 'survey-section-root-nav'

function SurveyQuestionsEmptyDropZone({ activePaletteDrop, disabled }: { activePaletteDrop: boolean; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: QUESTION_DROP_ZONE_ID,
    disabled,
  })
  return (
    <tr ref={setNodeRef}>
      <td
        colSpan={6}
        className={[
          'px-5 py-10 text-center text-sm transition',
          !disabled && isOver && activePaletteDrop
            ? 'bg-emerald-50/80 ring-2 ring-inset ring-[#1a3d32]/25'
            : 'text-neutral-500',
        ].join(' ')}
      >
        Ingen spørsmål her — dra en type hit fra paletten, eller opprett nytt.
      </td>
    </tr>
  )
}

function SectionRootNavDropWrap({
  selected,
  questionCount,
  isLocked,
  onSelect,
}: {
  selected: boolean
  questionCount: number
  isLocked: boolean
  onSelect: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: SECTION_ROOT_NAV_ID,
    disabled: isLocked,
  })
  return (
    <div ref={setNodeRef} className={`mb-2 rounded-md ${isOver && !isLocked ? 'ring-2 ring-[#1a3d32]/25' : ''}`}>
      <WikiFolderNavRow
        label="Uten seksjon"
        sub={`${questionCount} spørsmål`}
        active={selected}
        onSelect={onSelect}
      />
    </div>
  )
}

function PaletteDragItem({
  type,
  label,
  hint,
  disabled,
}: {
  type: SurveyQuestionType
  label: string
  hint: string
  disabled: boolean
}) {
  const id = `${PALETTE_PREFIX}${type}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: 'palette', questionType: type },
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
      <span className="font-semibold text-neutral-900">{label}</span>
      <span className="text-[10px] text-neutral-500">{hint}</span>
    </button>
  )
}

function SortableSectionRow({
  sec,
  selected,
  questionCount,
  onSelect,
  onEdit,
  isLocked,
}: {
  sec: SurveySectionRow
  selected: boolean
  questionCount: number
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
        sub={sec.description?.trim() ? sec.description : `${questionCount} spørsmål`}
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

function SortableQuestionTableRow({
  q,
  isLocked,
  onRowClick,
}: {
  q: OrgSurveyQuestionRow
  isLocked: boolean
  onRowClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
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
      className={`${MODULE_TABLE_TR_BODY} cursor-pointer ${isDragging ? 'opacity-70' : ''}`}
      onClick={onRowClick}
    >
      <td className="w-10 px-2 py-3" onClick={(e) => e.stopPropagation()}>
        {!isLocked ? (
          <button
            type="button"
            className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-50"
            aria-label="Flytt"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
      </td>
      <td className="px-5 py-3 font-medium text-neutral-900">{q.question_text}</td>
      <td className="px-5 py-3">
        <Badge variant="info" className="text-[10px]">
          {questionTypeLabel(q.question_type)}
        </Badge>
      </td>
      <td className="px-5 py-3">
        {q.is_mandatory && q.mandatory_law ? (
          <Badge variant="danger" className="text-[10px]">
            {q.mandatory_law === 'AML_4_3' ? 'AML § 4-3' : q.mandatory_law}
          </Badge>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-neutral-600">{q.is_required ? 'Ja' : 'Nei'}</td>
      <td className="px-5 py-3 text-neutral-500">{q.order_index}</td>
    </tr>
  )
}

export function SurveySectionBuilder({ survey, surveyId, isLocked, onEditQuestion, onAddQuestion }: Props) {
  const sections = useMemo(
    () => [...survey.surveySections].sort((a, b) => a.order_index - b.order_index),
    [survey.surveySections],
  )

  const [selectedKey, setSelectedKey] = useState<string>('root')
  const selectedSectionId = selectedKey === 'root' ? null : selectedKey

  const [sectionQuery, setSectionQuery] = useState('')

  const [sectionPanelOpen, setSectionPanelOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<SurveySectionRow | null>(null)
  const [secTitle, setSecTitle] = useState('')
  const [secDesc, setSecDesc] = useState('')
  const [secOrder, setSecOrder] = useState('0')
  const [secSaving, setSecSaving] = useState(false)

  const questionsInView = useMemo(() => {
    const qs = survey.questions.filter((q) => q.survey_id === surveyId)
    const filtered =
      selectedSectionId === null
        ? qs.filter((q) => q.section_id == null)
        : qs.filter((q) => q.section_id === selectedSectionId)
    return [...filtered].sort((a, b) => a.order_index - b.order_index)
  }, [survey.questions, surveyId, selectedSectionId])

  const questionCountBySectionKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of survey.questions) {
      if (q.survey_id !== surveyId) continue
      const key = q.section_id ?? '__root__'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [survey.questions, surveyId])

  const rootQuestionCount = questionCountBySectionKey.get('__root__') ?? 0

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
    async (e: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = e
      const aid = String(active.id)
      const overId = over ? String(over.id) : null

      if (aid.startsWith(PALETTE_PREFIX)) {
        if (isLocked) return
        const type = aid.slice(PALETTE_PREFIX.length) as SurveyQuestionType
        const { questionText, config } = defaultQuestionPayload(type)
        const nextIndex =
          questionsInView.length === 0 ? 0 : Math.max(...questionsInView.map((q) => q.order_index)) + 1
        await survey.upsertQuestion({
          surveyId,
          questionText,
          questionType: type,
          orderIndex: nextIndex,
          isRequired: true,
          config,
          sectionId: selectedSectionId,
        })
        return
      }

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
        await survey.reorderSections(surveyId, newOrder)
        return
      }

      if (!overId || isLocked) return
      const qIds = questionsInView.map((q) => q.id)
      const oldQi = qIds.indexOf(aid)
      const newQi = qIds.indexOf(overId)
      if (oldQi < 0 || newQi < 0 || oldQi === newQi) return
      const newOrderInSection = arrayMove(qIds, oldQi, newQi)
      const full = fullOrderAfterSectionReorder(
        survey.questions,
        surveyId,
        sections,
        selectedSectionId,
        newOrderInSection,
      )
      await survey.reorderQuestions(surveyId, full)
    },
    [isLocked, survey.questions, survey, surveyId, questionsInView, sections, sectionIds, selectedSectionId],
  )

  const openNewSection = () => {
    setEditingSection(null)
    setSecTitle('')
    setSecDesc('')
    setSecOrder(String(sections.length))
    setSectionPanelOpen(true)
  }

  const openEditSection = (s: SurveySectionRow) => {
    setEditingSection(s)
    setSecTitle(s.title)
    setSecDesc(s.description ?? '')
    setSecOrder(String(s.order_index))
    setSectionPanelOpen(true)
  }

  const saveSection = async () => {
    setSecSaving(true)
    const order = Number.parseInt(secOrder, 10)
    await survey.upsertSection({
      id: editingSection?.id,
      surveyId,
      title: secTitle.trim() || 'Seksjon',
      description: secDesc.trim() || null,
      orderIndex: Number.isFinite(order) ? order : 0,
    })
    setSecSaving(false)
    setSectionPanelOpen(false)
    setEditingSection(null)
  }

  const deleteSection = async () => {
    if (!editingSection) return
    if (!window.confirm(`Slette seksjonen «${editingSection.title}»? Spørsmål flyttes til rot.`)) return
    await survey.deleteSection(editingSection.id, surveyId)
    setSelectedKey('root')
    setSectionPanelOpen(false)
    setEditingSection(null)
  }

  if (!survey.canManage) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
        Du har ikke tilgang til å redigere byggeren.
      </div>
    )
  }

  const tableTitle =
    selectedSectionId === null
      ? 'Spørsmål uten seksjon'
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
        onDragEnd={(ev) => void onDragEnd(ev)}
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
            <nav className="max-h-[min(70vh,32rem)] overflow-y-auto p-2" aria-label="Undersøkelseseksjoner">
              <p className="mb-2 px-1 text-[11px] leading-snug text-neutral-600">
                Samme layout som dokumentmapper — dra håndtaket for å endre rekkefølge på seksjoner.
              </p>
              <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                <SectionRootNavDropWrap
                  selected={selectedKey === 'root'}
                  questionCount={rootQuestionCount}
                  isLocked={isLocked || sectionSearchActive}
                  onSelect={() => setSelectedKey('root')}
                />
                <div className="space-y-0.5">
                  {filteredSections.map((sec) => (
                    <SortableSectionRow
                      key={sec.id}
                      sec={sec}
                      selected={selectedKey === sec.id}
                      questionCount={questionCountBySectionKey.get(sec.id) ?? 0}
                      onSelect={() => setSelectedKey(sec.id)}
                      onEdit={() => openEditSection(sec)}
                      isLocked={isLocked || sectionSearchActive}
                    />
                  ))}
                </div>
              </SortableContext>
              {showEmptySectionSearch ? (
                <p className="px-3 py-4 text-center text-xs text-neutral-500">Ingen seksjoner matcher søket.</p>
              ) : null}
            </nav>
          </aside>

          <div className="min-w-0 bg-white p-4 md:p-6">
            <div className="space-y-4">
              <InfoBox>
                Dra en spørsmålstype fra paletten under til tabellen (tom liste eller eksisterende rad), eller bruk «Nytt
                spørsmål» for sidemenyen.
              </InfoBox>

              <ModuleRecordsTableShell
                wrapInCard={false}
                title={tableTitle}
                titleTypography="sans"
                description="Samme tabellstil som dokumentliste i wiki-mapper."
                toolbar={
                  !isLocked ? (
                    <Button type="button" variant="primary" size="sm" onClick={() => onAddQuestion(selectedSectionId)}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Nytt spørsmål
                    </Button>
                  ) : null
                }
                footer={<span className="text-sm text-neutral-500">{questionsInView.length} spørsmål i visningen</span>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        <th className={`${MODULE_TABLE_TH} w-10`} aria-hidden />
                        <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>
                          <span className="inline-flex items-center gap-2">
                            <Folder className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
                            Spørsmål
                          </span>
                        </th>
                        <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Type</th>
                        <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Lovkrav</th>
                        <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Påkrevd</th>
                        <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Indeks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionsInView.length === 0 ? (
                        <SurveyQuestionsEmptyDropZone
                          activePaletteDrop={Boolean(activeDragId?.startsWith(PALETTE_PREFIX))}
                          disabled={isLocked}
                        />
                      ) : (
                        <SortableContext items={questionsInView.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                          {questionsInView.map((q) => (
                            <SortableQuestionTableRow
                              key={q.id}
                              q={q}
                              isLocked={isLocked}
                              onRowClick={() => onEditQuestion(q)}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </tbody>
                  </table>
                </div>
              </ModuleRecordsTableShell>

              <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Spørsmålstyper</p>
                <p className="mt-1 text-xs text-neutral-500">Dra til tabellen over (rad eller tom liste).</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SURVEY_BUILDER_PALETTE.map((p) => (
                    <PaletteDragItem key={p.type} type={p.type} label={p.label} hint={p.hint} disabled={isLocked} />
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragId?.startsWith(PALETTE_PREFIX) ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">
              Ny: {questionTypeLabel(activeDragId.slice(PALETTE_PREFIX.length) as SurveyQuestionType)}
            </div>
          ) : activeDragId?.startsWith(SECTION_PREFIX) ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">Flytt seksjon</div>
          ) : activeDragId ? (
            <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">Flytter spørsmål…</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <SlidePanel
        open={sectionPanelOpen}
        onClose={() => {
          setSectionPanelOpen(false)
          setEditingSection(null)
        }}
        titleId="survey-section-panel-title"
        title={editingSection ? 'Rediger seksjon' : 'Ny seksjon'}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSectionPanelOpen(false)} disabled={secSaving}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" onClick={() => void saveSection()} disabled={secSaving || !secTitle.trim()}>
              {secSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sec-title">
              Tittel
            </label>
            <StandardInput id="sec-title" value={secTitle} onChange={(e) => setSecTitle(e.target.value)} />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sec-desc">
              Beskrivelse (valgfritt)
            </label>
            <StandardTextarea id="sec-desc" value={secDesc} onChange={(e) => setSecDesc(e.target.value)} rows={3} />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sec-ord">
              Rekkefølge (indeks blant seksjoner)
            </label>
            <StandardInput id="sec-ord" type="number" value={secOrder} onChange={(e) => setSecOrder(e.target.value)} min={0} />
          </div>
          {editingSection ? (
            <Button type="button" variant="ghost" className="text-red-600" onClick={() => void deleteSection()}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              Slett seksjon
            </Button>
          ) : null}
        </div>
      </SlidePanel>
    </>
  )
}
