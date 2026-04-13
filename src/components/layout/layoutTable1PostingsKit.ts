import type { CSSProperties } from 'react'

const FOREST = '#1a3d32'

export const LAYOUT_TABLE1_POSTINGS_HEADER_ROW =
  'border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500'

export const LAYOUT_TABLE1_POSTINGS_TH = 'px-5 py-3 text-left'

export const LAYOUT_TABLE1_POSTINGS_BODY_ROW = 'border-b border-neutral-100 hover:bg-neutral-50/80'

export const LAYOUT_TABLE1_POSTINGS_TD = 'px-5 py-3 align-middle text-sm'

export function layoutTable1PostingsPrimaryButtonClass() {
  return 'rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white'
}

export function layoutTable1PostingsPrimaryButtonStyle(): CSSProperties {
  return { backgroundColor: FOREST }
}
