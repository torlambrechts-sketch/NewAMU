// Sortable block card for the register-type field canvas.
// Mirrors StudioChecklistBlockCard but for RegisterFieldBlock.

import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RegisterFieldBlock } from './registerFieldBlocks'

const KIND_LABEL: Record<RegisterFieldBlock['fieldKind'], string> = {
  text: 'Tekst',
  number: 'Tall',
  date: 'Dato',
  boolean: 'Ja/Nei',
  select: 'Valg',
  select_multi: 'Flervalg',
  doc_ref: 'Dok-ref',
  location_ref: 'Stedref',
}

const KIND_COLOR: Record<RegisterFieldBlock['fieldKind'], string> = {
  text: 'bg-slate-100 text-slate-700',
  number: 'bg-blue-50 text-blue-700',
  date: 'bg-violet-50 text-violet-700',
  boolean: 'bg-emerald-50 text-emerald-700',
  select: 'bg-amber-50 text-amber-700',
  select_multi: 'bg-orange-50 text-orange-700',
  doc_ref: 'bg-sky-50 text-sky-700',
  location_ref: 'bg-teal-50 text-teal-700',
}

type Props = {
  block: RegisterFieldBlock
  index: number
  selected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  disabled?: boolean
}

export function StudioRegisterFieldCard({ block, index, selected, onSelect, onRemove, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const colorClass = KIND_COLOR[block.fieldKind] ?? 'bg-slate-100 text-slate-700'
  const kindLabel = KIND_LABEL[block.fieldKind] ?? block.fieldKind

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Felt ${index + 1}: ${block.label || 'Uten tittel'}`}
      onClick={() => onSelect(block.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(block.id) }}
      className={[
        'group relative flex items-start gap-3 rounded-lg border bg-white px-3 py-2.5 text-sm transition-shadow',
        selected
          ? 'border-[#1a3d32] shadow-md ring-1 ring-[#1a3d32]/20'
          : 'border-neutral-200 shadow-sm hover:border-neutral-300 hover:shadow',
        disabled && 'pointer-events-none opacity-60',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Drag handle */}
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Dra for å flytte"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colorClass}`}>
            {kindLabel}
          </span>
          {block.required && (
            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
              Påkrevd
            </span>
          )}
          <span className="ml-auto text-[10px] text-neutral-300">#{index + 1}</span>
        </div>

        <p className={['mt-1 truncate font-medium', block.label ? 'text-neutral-800' : 'italic text-neutral-400'].join(' ')}>
          {block.label || 'Uten tittel'}
        </p>

        {block.hint && (
          <p className="mt-0.5 truncate text-xs text-neutral-400">{block.hint}</p>
        )}
      </div>

      {/* Delete */}
      {!disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(block.id) }}
          className="mt-0.5 shrink-0 text-neutral-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          aria-label="Fjern felt"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
