import type { ReactNode } from 'react'
import type { PageLayout, PageLayoutBlock, PageLayoutColumn, PageLayoutSection } from '../../types/pageLayout'

/**
 * Renders a PageLayout — one row per Section, columns driven by each
 * column's `colSpan` proportion. The inline `gridTemplateColumns` style
 * is the single source of truth; children must NOT carry Tailwind col-span
 * classes (those only work with Tailwind's grid-cols-* parent).
 *
 * The `renderBlock` prop is provided by the owning page so real data and
 * components are injected into the generic layout shell.
 *
 * When `editMode` is true each block shows a hover outline + label badge.
 */

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
      className="group/block relative cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onClick?.(sectionId, colId, block.id) }}
    >
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-transparent transition-colors group-hover/block:border-[#1a3d32]/60" />
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

export function PageLayoutRenderer({
  layout,
  renderBlock,
  editMode,
  onSectionClick,
  onBlockClick,
}: Props) {
  return (
    <div className="min-w-0 space-y-6">
      {layout.sections.map((section: PageLayoutSection) => {
        const visibleCols = section.cols.filter((c) => c.blocks.some((b) => b.visible !== false) || editMode)
        const total = visibleCols.reduce((s, c) => s + Math.max(1, c.colSpan || 1), 0)

        const gridStyle: React.CSSProperties = {
          display: 'grid',
          gridTemplateColumns: visibleCols.map((c) => `${Math.max(1, c.colSpan || 1)}fr`).join(' '),
          gap: '1.5rem',
          alignItems: 'start',
        }
        // Prevent total = 0 crash when all columns are empty in non-edit mode
        if (total === 0) return null

        return (
          <div
            key={section.id}
            style={gridStyle}
            className={editMode ? 'group/section relative' : ''}
            onClick={editMode ? (e) => { if (e.target === e.currentTarget) onSectionClick?.(section.id) } : undefined}
          >
            {editMode && (
              <div className="pointer-events-none absolute -inset-2 z-0 rounded-xl border border-dashed border-[#1a3d32]/20 group-hover/section:border-[#1a3d32]/40" />
            )}
            {section.cols.map((col: PageLayoutColumn) => {
              const blocks = col.blocks.filter((b: PageLayoutBlock) => b.visible !== false)
              if (!editMode && blocks.length === 0) return null
              return (
                <div key={col.id} className="min-w-0 space-y-4">
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

                  {editMode && blocks.length === 0 && (
                    <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
                      Tom kolonne
                    </div>
                  )}
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
