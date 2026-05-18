// Center panel of the Studio editor — sortable block list plus a drop zone
// for palette items. Uses @dnd-kit with the same pattern as LearningSectionBuilder.

import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type Active,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { StudioSurveyBlockCard } from './StudioSurveyBlockCard'
import { PALETTE_DRAG_PREFIX } from './StudioBlockPalette'
import type { PaletteItem, StudioBlock } from './types'

const CANVAS_DROP_ZONE_ID = 'studio-canvas-empty'
const CANVAS_TAIL_ID = 'studio-canvas-tail'

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

function buildNewBlock(item: PaletteItem): Omit<StudioBlock, 'id'> {
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

type Props = {
  blocks: StudioBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (block: Omit<StudioBlock, 'id'>, atIndex?: number) => string
  onRemove: (id: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
  disabled?: boolean
}

export function StudioSurveyBlockCanvas({
  blocks,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onMove,
  disabled = false,
}: Props) {
  const [activeItem, setActiveItem] = useState<Active | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const ids = blocks.map((b) => b.id)

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Palette drop → insert new block
    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const item: PaletteItem | undefined = active.data.current?.paletteItem
      if (!item) return
      const newBlock = buildNewBlock(item)
      if (overId === CANVAS_DROP_ZONE_ID || overId === CANVAS_TAIL_ID) {
        onAdd(newBlock)
      } else {
        const insertAt = ids.indexOf(overId)
        onAdd(newBlock, insertAt === -1 ? undefined : insertAt)
      }
      return
    }

    // Sort existing block
    if (activeId !== overId) {
      const fromIndex = ids.indexOf(activeId)
      const toIndex = ids.indexOf(overId)
      if (fromIndex !== -1 && toIndex !== -1) onMove(fromIndex, toIndex)
    }
  }

  // For palette drags, show a ghost chip in the overlay; for sort drags show the block card
  const isPaletteDrag =
    activeItem !== null && String(activeItem.id).startsWith(PALETTE_DRAG_PREFIX)
  const overlayBlock =
    !isPaletteDrag && activeItem
      ? blocks.find((b) => b.id === String(activeItem.id))
      : null
  const overlayPaletteItem: PaletteItem | undefined = isPaletteDrag
    ? activeItem?.data.current?.paletteItem
    : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-1 flex-col overflow-y-auto px-8 py-6">
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

      <DragOverlay>
        {overlayBlock && (
          <StudioSurveyBlockCard
            block={overlayBlock}
            index={blocks.findIndex((b) => b.id === overlayBlock.id)}
            selected={false}
            onSelect={() => {}}
            onRemove={() => {}}
            disabled
          />
        )}
        {overlayPaletteItem && (
          <div className="flex items-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg opacity-90">
            <span className="font-medium text-neutral-900">{overlayPaletteItem.label}</span>
            <span className="text-xs text-neutral-400">{overlayPaletteItem.hint}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
