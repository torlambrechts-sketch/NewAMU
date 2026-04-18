/**
 * Shared surface + form chrome for module pages (SJA, Internkontroll, …)
 * so detail views match {@link InspectionModuleView} / layout-hub list pages.
 */
import { WORKPLACE_CREAM } from './WorkplaceChrome'
import { LAYOUT_SCORE_STAT_CREAM } from './platformLayoutKit'

export const WORKPLACE_MODULE_CANVAS_BG = WORKPLACE_CREAM

/** Subtle panel on white (same fill as {@link LayoutScoreStatRow} KPI tiles) */
export const WORKPLACE_MODULE_SUBTLE_PANEL =
  'rounded-xl border border-neutral-200/80 px-4 py-3 md:px-5 md:py-4'

export const WORKPLACE_MODULE_SUBTLE_PANEL_STYLE = {
  backgroundColor: LAYOUT_SCORE_STAT_CREAM,
} as const

/** White content card */
export const WORKPLACE_MODULE_CARD =
  'rounded-xl border border-neutral-200/80 bg-white shadow-sm'

export const WORKPLACE_MODULE_CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/** Form fields — rounded-lg like inspection search / table toolbars */
export const WORKPLACE_MODULE_FIELD =
  'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-[#1a3d32]/25'
