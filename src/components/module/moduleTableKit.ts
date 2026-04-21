/**
 * Canonical table cell/row classes for module records tables (ROS tiltak,
 * ROS farekilder, Inspeksjonsrunder avvik, …).
 *
 * Use these instead of redeclaring `const TH = ...` in every module file so
 * every table in every module has identical header typography, cell padding
 * and hover behaviour.
 */

export const MODULE_TABLE_TH =
  'border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'

export const MODULE_TABLE_TR_BODY =
  'border-b border-neutral-100 last:border-b-0 transition-colors hover:bg-neutral-50'

/** Standard cell padding for body cells. */
export const MODULE_TABLE_TD = 'px-5 py-4 align-middle'

/** Right-aligned action cell. */
export const MODULE_TABLE_TD_ACTION = 'px-5 py-4 text-right align-middle'
