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
 * Hardcoded Tailwind grid classes — these strings are LITERALS so Tailwind v4
 * JIT always compiles them. Never construct these dynamically.
 *
 * Each preset maps to: [containerClass, ...perColumnClass[]]
 */
const PRESET_CLASSES: Record<ColumnPreset, { container: string; cols: string[] }> = {
  'full':      { container: 'grid grid-cols-1 gap-6',                                 cols: [''] },
  'split-2-1': { container: 'grid gap-6',    cols: ['col-span-2', 'col-span-1'] },    // uses grid-cols-3 below
  'split-1-2': { container: 'grid gap-6',    cols: ['col-span-1', 'col-span-2'] },
  'halves':    { container: 'grid grid-cols-2 gap-6',                                 cols: ['', ''] },
  'thirds':    { container: 'grid grid-cols-3 gap-6',                                 cols: ['', '', ''] },
}

/**
 * For split presets we need grid-cols-3 as parent so col-span-2/col-span-1
 * have a 3-column grid to span within.
 */
function containerClass(preset: ColumnPreset): string {
  const base = PRESET_CLASSES[preset]?.container ?? 'grid grid-cols-1 gap-6'
  if (preset === 'split-2-1' || preset === 'split-1-2') {
    return base + ' grid-cols-3'
  }
  return base
}

function colClass(preset: ColumnPreset, colIdx: number): string {
  return PRESET_CLASSES[preset]?.cols[colIdx] ?? ''
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

/**
 * Resolves a section's preset, falling back gracefully for old saved data
 * that may have no preset (e.g. sections saved before the preset system).
 */
function resolvePreset(section: PageLayoutSection): ColumnPreset {
  if (section.preset) return section.preset
  // Legacy: infer from number of cols
  const n = section.cols?.length ?? 1
  if (n === 2) return 'halves'
  if (n === 3) return 'thirds'
  return 'full'
}

export function PageLayoutRenderer({ layout, renderBlock, editMode, onSectionClick, onBlockClick }: Props) {
  return (
    <div className="space-y-6">
      {layout.sections.map((section: PageLayoutSection) => {
        const cols = section.cols
        if (!cols || cols.length === 0) return null

        const preset = resolvePreset(section)
        const cc = containerClass(preset)

        return (
          <div
            key={section.id}
            className={cc}
            onClick={editMode ? (e) => { if (e.target === e.currentTarget) onSectionClick?.(section.id) } : undefined}
          >
            {cols.map((col: PageLayoutColumn, colIdx: number) => {
              const blocks = col.blocks.filter((b: PageLayoutBlock) => b.visible !== false)
              if (!editMode && blocks.length === 0) return null

              const cc2 = colClass(preset, colIdx)

              return (
                <div key={col.id} className={`min-w-0 ${cc2}`.trim()}>
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
