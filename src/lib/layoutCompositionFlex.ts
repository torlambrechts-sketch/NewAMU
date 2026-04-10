import type { CSSProperties } from 'react'
import type { LayoutCompositionRow, LayoutCompositionSlot } from '../types/layoutComposition'

export function flexAlignItemsCss(v: LayoutCompositionRow['alignItems']): string {
  switch (v) {
    case 'start':
      return 'flex-start'
    case 'center':
      return 'center'
    case 'end':
      return 'flex-end'
    default:
      return 'stretch'
  }
}

export function alignSelfCss(slot: LayoutCompositionSlot): string {
  switch (slot.align) {
    case 'start':
      return 'flex-start'
    case 'center':
      return 'center'
    case 'end':
      return 'flex-end'
    default:
      return 'stretch'
  }
}

export function cellFlexStyle(
  span: LayoutCompositionSlot['span'],
  columnMode: LayoutCompositionRow['columnMode'],
  nCells: number,
): CSSProperties {
  if (columnMode === 'equal') {
    const pct = nCells > 0 ? 100 / nCells : 100
    return { flex: `1 1 ${pct}%`, minWidth: 0, maxWidth: '100%' }
  }
  switch (span) {
    case 'half':
      return { flex: '1 1 calc(50% - 8px)', minWidth: 'min(100%, 280px)' }
    case 'third':
      return { flex: '1 1 calc(33.333% - 8px)', minWidth: 'min(100%, 200px)' }
    case 'auto':
      return { flex: '1 1 0', minWidth: 0 }
    default:
      return { flex: '1 1 100%', minWidth: 0 }
  }
}
