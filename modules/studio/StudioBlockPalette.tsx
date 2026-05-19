// Left panel of the Studio editor — draggable block type chips.
//
// Simple mode shows 5 essential types; Advanced adds branching and all
// question variants. Each chip is a useDraggable source; dropping on the
// canvas inserts a new block of that type.

import {
  AlignLeft,
  GitBranch,
  Heading,
  LayoutList,
  List,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { PaletteItem } from './types'
import { SURVEY_PALETTE } from './types'

export const PALETTE_DRAG_PREFIX = 'palette:'

const PALETTE_ICONS: Record<string, LucideIcon> = {
  section: Heading,
  single_select: List,
  multi_select: LayoutList,
  likert_5: SlidersHorizontal,
  likert_7: SlidersHorizontal,
  scale_10: SlidersHorizontal,
  text: AlignLeft,
  branch: GitBranch,
  yes_no: List,
  matrix: LayoutList,
  ranking: LayoutList,
  voting: List,
}

function paletteItemId(item: PaletteItem) {
  return `${PALETTE_DRAG_PREFIX}${item.kind}:${item.questionType ?? ''}`
}

function PaletteChip({
  item,
  disabled,
  onAdd,
}: {
  item: PaletteItem
  disabled: boolean
  onAdd?: (item: PaletteItem) => void
}) {
  const id = paletteItemId(item)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { paletteItem: item },
    disabled,
  })

  const key = item.questionType ?? item.kind
  const Icon = PALETTE_ICONS[key] ?? List

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      onClick={() => onAdd?.(item)}
      {...listeners}
      {...attributes}
      className={[
        'flex w-full items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition',
        'hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3d32]/40',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-50 shadow-md' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="font-medium text-neutral-900">{item.label}</span>
        <span className="text-[11px] text-neutral-400">{item.hint}</span>
      </span>
    </button>
  )
}

type Props = {
  advanced: boolean
  disabled?: boolean
  onAdd?: (item: PaletteItem) => void
  /** Override the default SURVEY_PALETTE. Useful for checklist / other editors. */
  items?: PaletteItem[]
  /** Override the hint text shown below the "Blokker" heading. */
  hintText?: string
}

export function StudioBlockPalette({
  advanced,
  disabled = false,
  onAdd,
  items,
  hintText,
}: Props) {
  const source = items ?? SURVEY_PALETTE
  const visibleItems = source.filter((item) => advanced || !item.advancedOnly)

  return (
    <aside className="flex h-full w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-200 bg-[#fafaf9] p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        Blokker
      </p>
      <p className="mb-2 text-[11px] text-neutral-400">
        {hintText ?? 'Dra inn blokker for spørreundersøkelse.'}
      </p>
      {visibleItems.map((item) => (
        <PaletteChip
          key={paletteItemId(item)}
          item={item}
          disabled={disabled}
          onAdd={onAdd}
        />
      ))}
    </aside>
  )
}
