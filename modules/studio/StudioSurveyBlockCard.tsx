// A single block row in the Studio canvas — numbered, type-badged,
// with a grip handle for reordering and a delete button.

import {
  AlignLeft,
  GitBranch,
  GripVertical,
  Heading,
  LayoutList,
  List,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { StudioBlock } from './types'

const KIND_ICON: Record<string, LucideIcon> = {
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

const KIND_LABEL: Record<string, string> = {
  section: 'Seksjon',
  single_select: 'Enkeltvalg',
  multi_select: 'Flervalg',
  likert_5: 'Skala',
  likert_7: 'Skala 1–7',
  scale_10: 'Skala 0–10',
  text: 'Fritekst',
  branch: 'Forgrening',
  yes_no: 'Ja / Nei',
  matrix: 'Matrise',
  ranking: 'Rangering',
  voting: 'Votering',
}

const KIND_ACCENT: Record<string, string> = {
  section: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  branch: 'bg-amber-50 text-amber-700 border-amber-200',
  question: 'bg-[#f0f7f4] text-[#1a3d32] border-[#c6ddd6]',
}

function blockKey(block: StudioBlock) {
  if (block.kind === 'question') return block.questionType
  return block.kind
}

function blockLabel(block: StudioBlock) {
  return KIND_LABEL[blockKey(block)] ?? block.kind
}

function blockPreview(block: StudioBlock): string {
  if (block.kind === 'section') return block.title || 'Seksjon uten tittel'
  if (block.kind === 'branch') return block.label || 'Forgrening'
  return block.text || 'Spørsmål uten tekst'
}

function blockSubtitle(block: StudioBlock): string {
  if (block.kind === 'question') {
    const parts: string[] = []
    if (block.options?.length) parts.push(`${block.options.length} svaralternativer`)
    if (block.required) parts.push('obligatorisk')
    return parts.join(' · ')
  }
  if (block.kind === 'branch') {
    return block.condition.sourceBlockId ? 'Forgrening til oppfølgingsspørsmål.' : ''
  }
  return block.description ?? ''
}

function blockBadgeClass(block: StudioBlock): string {
  if (block.kind === 'section') return KIND_ACCENT.section
  if (block.kind === 'branch') return KIND_ACCENT.branch
  return KIND_ACCENT.question
}

type Props = {
  block: StudioBlock
  index: number
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  disabled?: boolean
}

export function StudioSurveyBlockCard({
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

  const key = blockKey(block)
  const Icon = KIND_ICON[key] ?? List
  const badgeClass = blockBadgeClass(block)

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
      {/* Number badge */}
      <span
        className={[
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          block.kind === 'section'
            ? 'bg-neutral-200 text-neutral-600'
            : block.kind === 'branch'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-[#1a3d32] text-white',
        ].join(' ')}
      >
        {index + 1}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${badgeClass}`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {blockLabel(block)}
          </span>
        </div>
        <p className="truncate text-sm font-medium text-neutral-900">{blockPreview(block)}</p>
        {blockSubtitle(block) && (
          <p className="mt-0.5 text-xs text-neutral-400">{blockSubtitle(block)}</p>
        )}
        {/* Options preview for question blocks */}
        {block.kind === 'question' && block.options && block.options.length > 0 && (
          <ul className="mt-2 space-y-1">
            {block.options.slice(0, 4).map((opt, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-300 bg-white" />
                {opt}
              </li>
            ))}
            {block.options.length > 4 && (
              <li className="text-xs text-neutral-400">+{block.options.length - 4} til</li>
            )}
          </ul>
        )}
        {/* Likert scale preview */}
        {block.kind === 'question' &&
          (block.questionType === 'likert_5' ||
            block.questionType === 'likert_7' ||
            block.questionType === 'scale_10') && (
            <div className="mt-2 flex items-center gap-1">
              {Array.from({
                length: block.questionType === 'likert_5' ? 5 : block.questionType === 'likert_7' ? 7 : 11,
              }).map((_, i) => (
                <span
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 text-[10px] text-neutral-400"
                >
                  {block.questionType === 'scale_10' ? i : i + 1}
                </span>
              ))}
              {block.anchors && (
                <span className="ml-1 text-[10px] text-neutral-400">
                  {block.anchors.low} → {block.anchors.high}
                </span>
              )}
            </div>
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
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
