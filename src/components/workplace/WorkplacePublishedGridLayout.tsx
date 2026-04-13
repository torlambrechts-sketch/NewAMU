import type { ReactNode } from 'react'
import type { GridRowPersist } from '../../lib/layoutGridComposerStorage'

/**
 * Renders a published grid composer layout (rows × columns with `fr` weights).
 * Same column template as {@link PlatformGridComposer} preview — without editor chrome.
 */
export function WorkplacePublishedGridLayout({
  rows,
  renderBlock,
  rowGapClass = 'space-y-8',
  columnGapClass = 'gap-4',
}: {
  rows: GridRowPersist[]
  renderBlock: (blockId: string) => ReactNode
  rowGapClass?: string
  columnGapClass?: string
}) {
  return (
    <div className={rowGapClass}>
      {rows.map((row) => (
        <div
          key={row.id}
          className={`grid min-w-0 ${columnGapClass}`}
          style={{
            gridTemplateColumns: row.columns.map((c) => `minmax(0,${c.flex}fr)`).join(' '),
          }}
        >
          {row.columns.map((cell) => {
            const content = cell.blockId ? renderBlock(cell.blockId) : null
            return (
              <div key={cell.id} className="min-w-0">
                {content}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
