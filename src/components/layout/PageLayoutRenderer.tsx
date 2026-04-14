import type { ReactNode } from 'react'
import type { ColumnPreset, PageLayout, PageLayoutBlock, PageLayoutColumn, PageLayoutSection } from '../../types/pageLayout'

export type RenderBlockProps = {
  blockId: string
  textOverride?: Record<string, string>
  blockProps?: Record<string, unknown>
}

type Props = {
  layout: PageLayout
  renderBlock: (props: RenderBlockProps) => ReactNode
  editMode?: boolean
  onSectionClick?: (sectionId: string) => void
  onBlockClick?: (sectionId: string, colId: string, blockId: string) => void
}

/**
 * Returns a className string for a section row given its preset.
 * Every class string is a COMPLETE LITERAL so Tailwind v4 JIT always compiles them.
 * No string concatenation, no dynamic class generation.
 */
function sectionClassName(preset: ColumnPreset): string {
  switch (preset) {
    case 'full':      return 'grid grid-cols-1 gap-6 items-start'
    case 'split-2-1': return 'grid grid-cols-3 gap-6 items-start'
    case 'split-1-2': return 'grid grid-cols-3 gap-6 items-start'
    case 'halves':    return 'grid grid-cols-2 gap-6 items-start'
    case 'thirds':    return 'grid grid-cols-3 gap-6 items-start'
    default:          return 'grid grid-cols-1 gap-6 items-start'
  }
}

/**
 * Returns a className for a column cell given its preset and column index.
 * Every class string is a COMPLETE LITERAL.
 */
function colClassName(preset: ColumnPreset, colIdx: number): string {
  if (preset === 'split-2-1') {
    return colIdx === 0 ? 'col-span-2 min-w-0' : 'col-span-1 min-w-0'
  }
  if (preset === 'split-1-2') {
    return colIdx === 0 ? 'col-span-1 min-w-0' : 'col-span-2 min-w-0'
  }
  return 'min-w-0'
}

/**
 * Resolves preset from section data, handling legacy sections (no preset field).
 */
function resolvePreset(section: PageLayoutSection): ColumnPreset {
  if (section.preset) return section.preset
  // Legacy fallback — infer from number of columns
  switch (section.cols?.length) {
    case 2:  return 'halves'
    case 3:  return 'thirds'
    default: return 'full'
  }
}

function BlockShell({
  block, sectionId, colId, editMode, onClick, children,
}: {
  block: PageLayoutBlock; sectionId: string; colId: string
  editMode?: boolean; onClick?: (s: string, c: string, b: string) => void; children: ReactNode
}) {
  if (!editMode) return <>{children}</>
  return (
    <div
      className="group/block relative cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onClick?.(sectionId, colId, block.id) }}
    >
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-transparent group-hover/block:border-[#1a3d32]/60" />
      <div className="pointer-events-none absolute right-2 top-2 z-20 hidden items-center gap-1 rounded bg-[#1a3d32] px-2 py-0.5 text-[10px] font-semibold text-white shadow-md group-hover/block:flex">
        <svg className="size-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M11.7 1.3a1 1 0 0 1 1.4 1.4L4.4 11.4l-2.1.7.7-2.1L11.7 1.3Z" />
        </svg>
        {block.blockId}
      </div>
      {children}
    </div>
  )
}

export function PageLayoutRenderer({ layout, renderBlock, editMode, onSectionClick, onBlockClick }: Props) {
  return (
    <div className="space-y-6">
      {layout.sections.map((section: PageLayoutSection) => {
        const cols = section.cols
        if (!cols || cols.length === 0) return null

        const preset = resolvePreset(section)
        const secClass = sectionClassName(preset)

        return (
          <div
            key={section.id}
            className={secClass}
            onClick={editMode ? (e) => { if (e.target === e.currentTarget) onSectionClick?.(section.id) } : undefined}
          >
            {cols.map((col: PageLayoutColumn, colIdx: number) => {
              const blocks = col.blocks.filter((b: PageLayoutBlock) => b.visible !== false)
              if (!editMode && blocks.length === 0) return null

              const cc = colClassName(preset, colIdx)

              return (
                <div key={col.id} className={cc}>
                  {blocks.length > 0
                    ? (
                      <div className="space-y-4">
                        {blocks.map((block: PageLayoutBlock) => (
                          <BlockShell
                            key={block.id}
                            block={block}
                            sectionId={section.id}
                            colId={col.id}
                            editMode={editMode}
                            onClick={onBlockClick}
                          >
                            {renderBlock({
                              blockId: block.blockId,
                              textOverride: block.textOverride,
                              blockProps: block.blockProps,
                            })}
                          </BlockShell>
                        ))}
                      </div>
                    )
                    : editMode
                      ? (
                        <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                          Tom kolonne
                        </div>
                      )
                      : null
                  }
                </div>
              )
            })}
          </div>
        )
      })}

      {editMode && layout.sections.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-400">
          Ingen seksjoner ennå — legg til en seksjon i editoren
        </div>
      )}
    </div>
  )
}
