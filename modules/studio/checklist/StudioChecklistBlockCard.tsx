// Canvas card for a single checklist Studio block.
//
// Displays the item type badge, prompt text, and severity colour.
// Reuses the same DnD sortable pattern as StudioSurveyBlockCard.

import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  GripVertical,
  Heading,
  Image,
  PenLine,
  Hash,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChecklistStudioBlock, ChecklistItemBlock, ChecklistSeverity } from './checklistBlocks'

const ITEM_TYPE_ICON: Record<string, LucideIcon> = {
  yes_no_na: CheckSquare,
  text: AlignLeft,
  number: Hash,
  photo: Image,
  signature: PenLine,
  date: CalendarDays,
  section: Heading,
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  yes_no_na: 'Ja / Nei / N/A',
  text: 'Fritekst',
  number: 'Tall',
  photo: 'Foto',
  signature: 'Signatur',
  date: 'Dato',
  section: 'Seksjon',
}

const SEVERITY_CLASSES: Record<ChecklistSeverity, string> = {
  low: 'bg-neutral-100 text-neutral-600',
  medium: 'bg-yellow-50 text-yellow-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
}

const SEVERITY_LABEL: Record<ChecklistSeverity, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

function blockPreview(block: ChecklistStudioBlock): string {
  if (block.kind === 'section') return block.title || 'Seksjon uten tittel'
  return block.prompt || 'Sjekkpunkt uten tekst'
}

function blockSubtitle(block: ChecklistItemBlock): string {
  const parts: string[] = []
  if (block.required) parts.push('obligatorisk')
  if (block.law_ref) parts.push(block.law_ref)
  else if (block.iso_clause) parts.push(`ISO ${block.iso_clause}`)
  return parts.join(' · ')
}

type Props = {
  block: ChecklistStudioBlock
  index: number
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  disabled?: boolean
}

export function StudioChecklistBlockCard({
  block,
  index,
  selected,
  onSelect,
  onRemove,
  disabled = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  })

  const typeKey: string = block.kind === 'section' ? 'section' : block.itemType ?? 'yes_no_na'
  const Icon = ITEM_TYPE_ICON[typeKey] ?? CheckSquare
  const typeLabel = ITEM_TYPE_LABEL[typeKey] ?? typeKey

  const isSection = block.kind === 'section'
  const isItem = block.kind === 'checklist_item'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'group relative flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-shadow',
        isDragging ? 'opacity-60 shadow-lg' : 'shadow-sm',
        selected
          ? 'border-[#1a3d32]/40 ring-2 ring-[#1a3d32]/15'
          : 'border-neutral-200 hover:border-neutral-300 hover:shadow',
      ].join(' ')}
      onClick={onSelect}
    >
      {/* Index badge */}
      <span
        className={[
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isSection ? 'bg-neutral-200 text-neutral-600' : 'bg-[#1a3d32] text-white',
        ].join(' ')}
      >
        {index + 1}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {/* Type badge */}
          <span
            className={[
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium',
              isSection
                ? 'border-neutral-200 bg-neutral-100 text-neutral-600'
                : 'border-[#c6ddd6] bg-[#f0f7f4] text-[#1a3d32]',
            ].join(' ')}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {typeLabel}
          </span>

          {/* Severity badge — only for checklist items */}
          {isItem && block.severity_default && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_CLASSES[block.severity_default]}`}
            >
              {SEVERITY_LABEL[block.severity_default]}
            </span>
          )}
        </div>

        <p className="truncate text-sm font-medium text-neutral-900">{blockPreview(block)}</p>

        {isItem && blockSubtitle(block) && (
          <p className="mt-0.5 text-xs text-neutral-400">{blockSubtitle(block)}</p>
        )}

        {isSection && block.description && (
          <p className="mt-0.5 text-xs text-neutral-400">{block.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab rounded p-1 text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
          aria-label="Dra for å flytte"
          disabled={disabled}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="rounded p-1 text-neutral-300 hover:text-red-500"
          aria-label="Fjern blokk"
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
