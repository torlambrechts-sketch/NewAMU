// Center panel of the Studio editor — sortable block list plus a drop zone
// for palette items. Uses @dnd-kit with the same pattern as LearningSectionBuilder.

import { useRef } from 'react'
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
  type DragOverEvent,
  type Active,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { StudioSurveyBlockCard } from './StudioSurveyBlockCard'
import { PALETTE_DRAG_PREFIX } from './StudioBlockPalette'
import type { PaletteItem, StudioBlock } from './types'

const CANVAS_DROP_ZONE_ID = 'studio-canvas-empty'

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
  const overIndexRef = useRef<number>(-1)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const ids = blocks.map((b) => b.id)

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active)
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) { overIndexRef.current = -1; return }
    const overIndex = ids.indexOf(String(over.id))
    overIndexRef.current = overIndex
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    overIndexRef.current = -1

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Palette drop → insert new block
    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const item: PaletteItem | undefined = active.data.current?.paletteItem
      if (!item) return
      const newBlock = buildNewBlock(item)
      const insertAt = overId === CANVAS_DROP_ZONE_ID ? undefined : ids.indexOf(overId)
      onAdd(newBlock, insertAt === -1 ? undefined : insertAt ?? undefined)
      return
    }

    // Sort existing block
    if (activeId !== overId) {
      const fromIndex = ids.indexOf(activeId)
      const toIndex = ids.indexOf(overId)
      if (fromIndex !== -1 && toIndex !== -1) onMove(fromIndex, toIndex)
    }
  }

  // Drag overlay content
  const overlayBlock = activeItem
    ? blocks.find((b) => b.id === String(activeItem.id))
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
      </DragOverlay>
    </DndContext>
  )
}
