// Center panel of the Studio editor — sortable block list plus a drop zone
// for palette items. DndContext lives in the parent (KlarertStudioSurveyEditorPage)
// so palette chips (siblings of this component) share the same drag context.

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { StudioSurveyBlockCard } from './StudioSurveyBlockCard'
import type { NewStudioBlock, PaletteItem, StudioBlock } from './types'

export const CANVAS_DROP_ZONE_ID = 'studio-canvas-empty'
export const CANVAS_TAIL_ID = 'studio-canvas-tail'

export function buildNewBlock(item: PaletteItem): NewStudioBlock {
  if (item.kind === 'section') {
    return { kind: 'section', title: '' }
  }
  if (item.kind === 'branch') {
    return {
      kind: 'branch',
      label: '',
      condition: { sourceBlockId: '', operator: 'lt', value: 3 },
    }
  }
  return {
    kind: 'question',
    questionType: item.questionType ?? 'text',
    text: '',
    required: true,
    options:
      item.questionType === 'single_select' || item.questionType === 'multi_select'
        ? ['', '', '']
        : undefined,
  }
}

function EmptyCanvas({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center transition',
        isOver
          ? 'border-[#1a3d32]/40 bg-[#f0f7f4]'
          : 'border-neutral-200 bg-neutral-50',
      ].join(' ')}
    >
      <Plus className="mb-3 h-8 w-8 text-neutral-300" aria-hidden />
      <p className="text-sm font-medium text-neutral-500">Ingen blokker ennå</p>
      <p className="mt-1 text-xs text-neutral-400">
        Dra en blokk fra paletten til venstre, eller klikk på en type.
      </p>
    </div>
  )
}

function EmptyDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROP_ZONE_ID })
  return (
    <div ref={setNodeRef}>
      <EmptyCanvas isOver={isOver} />
    </div>
  )
}

function TailDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_TAIL_ID })
  return (
    <div
      ref={setNodeRef}
      className={[
        'mt-2 rounded-xl border-2 border-dashed py-4 text-center text-xs text-neutral-400 transition',
        isOver ? 'border-[#1a3d32]/40 bg-[#f0f7f4] text-[#1a3d32]' : 'border-neutral-200',
      ].join(' ')}
    >
      Slipp her for å legge til på slutten
    </div>
  )
}

type Props = {
  blocks: StudioBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  disabled?: boolean
}

export function StudioSurveyBlockCanvas({
  blocks,
  selectedId,
  onSelect,
  onRemove,
  disabled = false,
}: Props) {
  const ids = blocks.map((b) => b.id)

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-2xl">
        {blocks.length === 0 ? (
          <EmptyDropZone />
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block, index) => (
                <StudioSurveyBlockCard
                  key={block.id}
                  block={block}
                  index={index}
                  selected={block.id === selectedId}
                  onSelect={() => onSelect(block.id)}
                  onRemove={() => onRemove(block.id)}
                  disabled={disabled}
                />
              ))}
            </div>
            <TailDropZone />
          </SortableContext>
        )}
      </div>
    </div>
  )
}
