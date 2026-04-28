import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { SURVEY_BUILDER_PALETTE, questionTypeLabel } from './surveyLabels'
import { defaultQuestionPayload } from './surveyQuestionDefaults'
import type { UseSurveyState } from './useSurvey'
import type { OrgSurveyQuestionRow, SurveyQuestionType } from './types'

const STAGE_ID = 'survey-builder-stage'
const PALETTE_PREFIX = 'palette:'

type Props = {
  survey: UseSurveyState
  surveyId: string
  isLocked: boolean
  onEditQuestion: (q: OrgSurveyQuestionRow) => void
  onAddQuestion: () => void
}

function PaletteItem({
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
        'flex w-full flex-col items-start gap-0.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[#1a3d32]/35 hover:bg-[#f7faf8]',
        isDragging ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="text-xs font-semibold text-neutral-900">{label}</span>
      <span className="text-[10px] text-neutral-500">{hint}</span>
    </button>
  )
}

function StageDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: STAGE_ID })
  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-[280px] rounded-xl border-2 border-dashed bg-white p-4 transition-colors',
        isOver ? 'border-[#1a3d32]/50 bg-[#f9faf9]' : 'border-neutral-200',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function SortableQuestionRow({
  q,
  index,
  isLocked,
  onEdit,
}: {
  q: OrgSurveyQuestionRow
  index: number
  isLocked: boolean
  onEdit: () => void
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
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm',
        isDragging ? 'z-10 opacity-90 ring-2 ring-[#1a3d32]/20' : '',
      ].join(' ')}
    >
      {!isLocked ? (
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
          aria-label="Flytt"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-6" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-neutral-400">{index + 1}.</span>
          <Badge variant="info" className="text-[10px]">
            {questionTypeLabel(q.question_type)}
          </Badge>
          {q.is_required ? (
            <Badge variant="danger" className="text-[10px]">
              Påkrevd
            </Badge>
          ) : (
            <span className="text-[10px] text-neutral-400">Valgfritt</span>
          )}
          {q.is_mandatory ? (
            <Badge variant="danger" className="text-[10px]">
              AML § 4-3
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-900">{q.question_text}</p>
      </div>
      {!isLocked ? (
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Egenskaper
        </Button>
      ) : null}
    </div>
  )
}

export function SurveyBuilderStage({ survey, surveyId, isLocked, onEditQuestion, onAddQuestion }: Props) {
  const items = useMemo(
    () => [...survey.questions].sort((a, b) => a.order_index - b.order_index),
    [survey.questions],
  )
  const itemIds = useMemo(() => items.map((q) => q.id), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const draggingPalette = String(args.active.id).startsWith(PALETTE_PREFIX)
    if (draggingPalette) {
      const within = pointerWithin(args)
      if (within.length > 0) return within
    }
    return closestCenter(args)
  }, [])

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }, [])

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = e
      const aid = String(active.id)

      // Palette → stage: insert even when collision misses the droppable (pointerWithin helps; this is a fallback).
      if (aid.startsWith(PALETTE_PREFIX)) {
        if (isLocked) return
        const type = aid.slice(PALETTE_PREFIX.length) as SurveyQuestionType
        const { questionText, config } = defaultQuestionPayload(type)
        const nextIndex = items.length

        const row = await survey.upsertQuestion({
          surveyId,
          questionText,
          questionType: type,
          orderIndex: nextIndex,
          isRequired: true,
          config,
        })
        if (!row) return

        if (!over) return

        const overId = String(over.id)
        if (overId === STAGE_ID || overId === row.id) return
        if (itemIds.includes(overId)) {
          const at = itemIds.indexOf(overId)
          if (at >= 0) {
            const reordered = [...itemIds.slice(0, at), row.id, ...itemIds.slice(at)]
            void survey.reorderQuestions(surveyId, reordered)
          }
        }
        return
      }

      if (!over) return
      if (isLocked) return
      if (active.id === over.id) return
      const oldIndex = itemIds.indexOf(String(active.id))
      const newIndex = itemIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      const newOrder = arrayMove(itemIds, oldIndex, newIndex)
      void survey.reorderQuestions(surveyId, newOrder)
    },
    [isLocked, itemIds, items.length, survey, surveyId],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={(ev) => void onDragEnd(ev)}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Spørsmål (rekkefølge)</p>
              <p className="text-xs text-neutral-500">
                Dra spørsmål for å endre rekkefølge. Slipp en type fra høyre på flaten under for å legge til.
              </p>
            </div>
            {!isLocked && survey.canManage ? (
              <Button type="button" variant="secondary" size="sm" onClick={onAddQuestion}>
                <Plus className="h-4 w-4" aria-hidden />
                Manuelt spørsmål
              </Button>
            ) : null}
          </div>

          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <StageDropZone>
              {items.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm text-neutral-500">
                    {isLocked
                      ? 'Ingen spørsmål.'
                      : 'Tomt skjema — dra inn spørsmålstyper fra høyre, eller bruk «Manuelt spørsmål».'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((q, idx) => (
                    <SortableQuestionRow
                      key={q.id}
                      q={q}
                      index={idx}
                      isLocked={isLocked}
                      onEdit={() => onEditQuestion(q)}
                    />
                  ))}
                </div>
              )}
            </StageDropZone>
          </SortableContext>
        </div>

        <aside className="lg:sticky lg:top-4 h-fit space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Spørsmålstyper</p>
            <p className="mt-1 text-xs text-neutral-500">Dra inn på skjemaet til venstre (som i wiki-redigering).</p>
          </div>
          <div className="space-y-2">
            {SURVEY_BUILDER_PALETTE.map((p) => (
              <PaletteItem key={p.type} type={p.type} label={p.label} hint={p.hint} disabled={isLocked} />
            ))}
          </div>
          {isLocked ? <p className="text-xs text-amber-700">Publisert/lukket — spørsmål kan ikke endres.</p> : null}
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeId?.startsWith(PALETTE_PREFIX) ? (
          <div className="rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm shadow-xl">
            Nytt: {questionTypeLabel(activeId.slice(PALETTE_PREFIX.length) as SurveyQuestionType)}
          </div>
        ) : activeId ? (
          <div className="rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm shadow-xl">
            Flytter spørsmål…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
