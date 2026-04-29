import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  ModuleRecordsTableShell,
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
  onSelect,
  onEdit,
  isLocked,
}: {
  sec: SurveySectionRow
  selected: boolean
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
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition',
        selected ? 'border-[#1a3d32]/40 bg-[#f7faf8]' : 'border-transparent bg-white hover:bg-neutral-50',
        isDragging ? 'opacity-70' : '',
      ].join(' ')}
    >
      {!isLocked ? (
        <button
          type="button"
          className="cursor-grab rounded p-1 text-neutral-400 hover:text-neutral-700"
          aria-label="Flytt seksjon"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-6" aria-hidden />
      )}
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium text-neutral-900"
        onClick={onSelect}
      >
        {sec.title}
      </button>
      {!isLocked ? (
        <button
          type="button"
          className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          aria-label="Rediger seksjon"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}
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
        if (!over || isLocked) return
        const oldIndex = sectionIds.indexOf(aid)
        const overStr = String(over.id)
        const newIndex = sectionIds.indexOf(overStr.startsWith(SECTION_PREFIX) ? overStr : aid)
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
        const ids = sections.map((s) => s.id)
        const newOrder = arrayMove(ids, oldIndex, newIndex)
        await survey.reorderSections(surveyId, newOrder)
        return
      }

      if (!over || isLocked) return
      const qIds = questionsInView.map((q) => q.id)
      const oldQi = qIds.indexOf(aid)
      const newQi = qIds.indexOf(String(over.id))
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

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-[260px] lg:border-r lg:border-neutral-200 lg:pr-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Seksjoner</p>
            {!isLocked ? (
              <Button type="button" variant="secondary" size="sm" onClick={openNewSection}>
                <Plus className="h-4 w-4" aria-hidden />
                Ny
              </Button>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-neutral-500">
            Mapper som i wiki — velg en seksjon for å liste og redigere spørsmål der.
          </p>
          <button
            type="button"
            onClick={() => setSelectedKey('root')}
            className={[
              'mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition',
              selectedKey === 'root'
                ? 'border-[#1a3d32]/40 bg-[#f7faf8]'
                : 'border-neutral-200 bg-white hover:bg-neutral-50',
            ].join(' ')}
          >
            Uten seksjon
          </button>

          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {sections.map((sec) => (
                <SortableSectionRow
                  key={sec.id}
                  sec={sec}
                  selected={selectedKey === sec.id}
                  onSelect={() => setSelectedKey(sec.id)}
                  onEdit={() => openEditSection(sec)}
                  isLocked={isLocked}
                />
              ))}
            </div>
          </SortableContext>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <InfoBox>
            Dra en spørsmålstype fra paletten under til rekkefølgen i tabellen (slipp på en rad), eller bruk «Nytt
            spørsmål» for sidemenyen.
          </InfoBox>

          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={(ev: DragStartEvent) => setActiveDragId(String(ev.active.id))}
            onDragEnd={(ev) => void onDragEnd(ev)}
            onDragCancel={() => setActiveDragId(null)}
          >
            <ModuleRecordsTableShell
              title={tableTitle}
              description="Samme tabellstil som dokumentliste i wiki-mapper."
              toolbar={
                !isLocked ? (
                  <Button type="button" variant="primary" size="sm" onClick={() => onAddQuestion(selectedSectionId)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Nytt spørsmål
                  </Button>
                ) : null
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      <th className={`${MODULE_TABLE_TH} w-10`} aria-hidden />
                      <th className={MODULE_TABLE_TH}>Spørsmål</th>
                      <th className={MODULE_TABLE_TH}>Type</th>
                      <th className={MODULE_TABLE_TH}>Påkrevd</th>
                      <th className={MODULE_TABLE_TH}>Indeks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionsInView.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-neutral-500">
                          Ingen spørsmål her — dra inn en type eller opprett nytt.
                        </td>
                      </tr>
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

            <DragOverlay dropAnimation={null}>
              {activeDragId?.startsWith(PALETTE_PREFIX) ? (
                <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">
                  Ny: {questionTypeLabel(activeDragId.slice(PALETTE_PREFIX.length) as SurveyQuestionType)}
                </div>
              ) : activeDragId ? (
                <div className="rounded border bg-white px-3 py-2 text-sm shadow-lg">Flytter…</div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Spørsmålstyper</p>
            <p className="mt-1 text-xs text-neutral-500">Dra til en rad i tabellen over.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SURVEY_BUILDER_PALETTE.map((p) => (
                <PaletteDragItem key={p.type} type={p.type} label={p.label} hint={p.hint} disabled={isLocked} />
              ))}
            </div>
          </aside>
        </div>
      </div>

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
