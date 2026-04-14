import type { ReactNode } from 'react'
import type { PageLayout, PageLayoutBlock, PageLayoutColumn, PageLayoutSection } from '../../types/pageLayout'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {layout.sections.map((section: PageLayoutSection) => {
        const cols = section.cols
        if (!cols || cols.length === 0) return null

        return (
          /*
           * Flexbox row — each column gets flex: N (colSpan value).
           * This is the direct flexbox equivalent of CSS Grid `Nfr`:
           * available width is distributed proportionally to N values.
           * flex-basis: 0 (included in shorthand `flex: N`) means the
           * space is divided purely by ratio, ignoring content size.
           * minWidth: 0 on each child allows shrinking below content width.
           */
          <div
            key={section.id}
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: '1.5rem',
              alignItems: 'flex-start',
              width: '100%',
            }}
            onClick={editMode ? (e) => { if (e.target === e.currentTarget) onSectionClick?.(section.id) } : undefined}
          >
            {cols.map((col: PageLayoutColumn) => {
              const span = Math.max(1, Number(col.colSpan) || 1)
              const blocks = col.blocks.filter((b: PageLayoutBlock) => b.visible !== false)

              if (!editMode && blocks.length === 0) return null

              return (
                <div
                  key={col.id}
                  style={{ flex: span, minWidth: 0 }}
                >
                  {blocks.length > 0
                    ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                        <div style={{ display: 'flex', minHeight: 60, alignItems: 'center', justifyContent: 'center', border: '1px dashed #d4d4d4', borderRadius: 8, background: '#fafafa', fontSize: 12, color: '#a3a3a3' }}>
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
        <div style={{ display: 'flex', minHeight: 120, alignItems: 'center', justifyContent: 'center', border: '2px dashed #d4d4d4', borderRadius: 12, background: '#fafafa', fontSize: 14, color: '#a3a3a3' }}>
          Ingen seksjoner ennå — legg til en seksjon i editoren
        </div>
      )}
    </div>
  )
}
