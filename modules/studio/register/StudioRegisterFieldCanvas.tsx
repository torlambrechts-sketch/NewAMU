// Sortable field canvas for the register-type Studio editor.
// Accepts drops from the palette (PALETTE_DRAG_PREFIX ids) and
// reorders existing fields via DnD-kit SortableContext.

import { PlusCircle } from 'lucide-react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { PALETTE_DRAG_PREFIX } from '../StudioBlockPalette'
import { StudioRegisterFieldCard } from './StudioRegisterFieldCard'
import type { RegisterFieldBlock, RegisterPaletteItem } from './registerFieldBlocks'
import { REGISTER_FIELD_PALETTE } from './registerFieldBlocks'
import { freshId } from '../../../src/lib/dashboards/freshId'

export const REGISTER_CANVAS_DROP_ZONE_ID = 'register-canvas-drop-zone'
export const REGISTER_CANVAS_TAIL_ID = 'register-canvas-tail'

export function buildNewRegisterFieldBlock(item: RegisterPaletteItem): Omit<RegisterFieldBlock, 'id'> {
  return {
    kind: 'register_field',
    key: freshId('fld'),
    label: '',
    fieldKind: item.fieldKind,
    required: false,
    options: item.fieldKind === 'select' || item.fieldKind === 'select_multi' ? [] : undefined,
  }
}

type Props = {
  blocks: RegisterFieldBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  disabled?: boolean
}

export function StudioRegisterFieldCanvas({ blocks, selectedId, onSelect, onRemove, disabled }: Props) {
  const { setNodeRef: setTailRef, isOver: isTailOver } = useDroppable({
    id: REGISTER_CANVAS_TAIL_ID,
    disabled,
  })
  const { setNodeRef: setZoneRef, isOver: isZoneOver } = useDroppable({
    id: REGISTER_CANVAS_DROP_ZONE_ID,
    disabled,
  })

  const ids = blocks.map((b) => b.id)

  if (blocks.length === 0) {
    return (
      <div
        ref={setZoneRef}
        className={[
          'flex h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isZoneOver
            ? 'border-[#1a3d32] bg-[#1a3d32]/5'
            : 'border-neutral-200 bg-neutral-50/40',
        ].join(' ')}
      >
        <PlusCircle className="h-8 w-8 text-neutral-300" />
        <div>
          <p className="font-medium text-neutral-500">Ingen felt ennå</p>
          <p className="mt-1 text-sm text-neutral-400">
            Klikk eller dra felttyper fra venstre for å bygge registertypen
          </p>
        </div>
        {!disabled && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {REGISTER_FIELD_PALETTE.slice(0, 4).map((item) => (
              <span
                key={`${PALETTE_DRAG_PREFIX}${item.fieldKind}`}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500 shadow-sm"
              >
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-1">
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {blocks.map((block, index) => (
          <StudioRegisterFieldCard
            key={block.id}
            block={block}
            index={index}
            selected={selectedId === block.id}
            onSelect={onSelect}
            onRemove={onRemove}
            disabled={disabled}
          />
        ))}
      </SortableContext>

      {/* Drop target at the end */}
      <div
        ref={setTailRef}
        className={[
          'flex h-10 items-center justify-center rounded-lg border-2 border-dashed text-xs text-neutral-400 transition-colors',
          isTailOver ? 'border-[#1a3d32] bg-[#1a3d32]/5 text-[#1a3d32]' : 'border-neutral-200',
        ].join(' ')}
      >
        Slipp her for å legge til på slutten
      </div>
    </div>
  )
}
