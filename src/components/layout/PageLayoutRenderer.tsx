import type { ReactNode } from 'react'
import type { PageLayout, PageLayoutBlock, PageLayoutColumn, PageLayoutSection } from '../../types/pageLayout'

/**
 * Renders a PageLayout using CSS grid — one row per Section, columns driven
 * by each column's `colSpan` (out of 12 total units in the section).
 *
 * The `renderBlock` prop is provided by the page that owns the layout
 * (e.g. HseModule for vernerunder) so real data and components can be injected.
 *
 * When `editMode` is true, each block shows a handle bar used by InPageLayoutEditor.
 */

type RenderBlockProps = {
  blockId: string
  textOverride?: Record<string, string>
}

type Props = {
  layout: PageLayout
  renderBlock: (props: RenderBlockProps) => ReactNode
  editMode?: boolean
  onSectionClick?: (sectionId: string) => void
  onBlockClick?: (sectionId: string, colId: string, blockId: string) => void
}

const COL_SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
}

function colSpanClass(span: number): string {
  return COL_SPAN_CLASS[Math.min(12, Math.max(1, span))] ?? 'col-span-12'
}

function totalSpan(cols: PageLayoutColumn[]): number {
  return cols.reduce((s, c) => s + (c.colSpan || 1), 0)
}

function BlockShell({
  block,
  sectionId,
  colId,
  editMode,
  onClick,
  children,
}: {
  block: PageLayoutBlock
  sectionId: string
  colId: string
  editMode?: boolean
  onClick?: (sectionId: string, colId: string, blockId: string) => void
  children: ReactNode
}) {
  if (!editMode) return <>{children}</>
  return (
    <div
      className="group relative"
      onClick={() => onClick?.(sectionId, colId, block.id)}
    >
      {/* Edit handle shown in edit mode */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded border-2 border-transparent transition-colors group-hover:border-[#1a3d32]/50" />
      <div className="pointer-events-none absolute right-2 top-2 z-20 hidden items-center gap-1 rounded bg-[#1a3d32] px-2 py-0.5 text-[10px] font-semibold text-white shadow group-hover:flex">
        <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
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
    <div className="min-w-0 space-y-6">
      {layout.sections.map((section: PageLayoutSection) => {
        const total = totalSpan(section.cols)
        const gridStyle = {
          display: 'grid',
          gridTemplateColumns: section.cols.map((c) => `${((c.colSpan || 1) / total) * 100}%`).join(' '),
          gap: '1.5rem',
          alignItems: 'start',
        }

        return (
          <div
            key={section.id}
            className={editMode ? 'group/section relative rounded-lg' : ''}
            style={gridStyle}
            onClick={editMode ? () => onSectionClick?.(section.id) : undefined}
          >
            {editMode && (
              <div className="pointer-events-none absolute -left-2 -right-2 -top-2 bottom-0 z-0 rounded-lg border border-dashed border-[#1a3d32]/20 bg-[#1a3d32]/[0.02] group-hover/section:border-[#1a3d32]/40" />
            )}
            {section.cols.map((col: PageLayoutColumn) => (
              <div key={col.id} className={`min-w-0 space-y-4 ${colSpanClass(col.colSpan)}`}>
                {col.blocks
                  .filter((b: PageLayoutBlock) => b.visible !== false)
                  .map((block: PageLayoutBlock) => (
                    <BlockShell
                      key={block.id}
                      block={block}
                      sectionId={section.id}
                      colId={col.id}
                      editMode={editMode}
                      onClick={onBlockClick}
                    >
                      {renderBlock({ blockId: block.blockId, textOverride: block.textOverride })}
                    </BlockShell>
                  ))}

                {editMode && col.blocks.filter((b) => b.visible !== false).length === 0 && (
                  <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                    Tom kolonne — dra en blokk hit
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}

      {editMode && layout.sections.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-400">
          Ingen seksjoner ennå — legg til en seksjon i editoren
        </div>
      )}
    </div>
  )
}
