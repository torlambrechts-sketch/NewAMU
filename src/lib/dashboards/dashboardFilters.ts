// Dashboard filter primitives — chip data model + dimension contract.
//
// A dashboard's filter state is `DashboardFilter[]`, one chip per
// active filter. Chips are persisted on dashboard_layouts.filters
// alongside the layout, so a saved dashboard reproduces with its
// filter set intact.
//
// Each filter targets a `DashboardDimension` declared by the scope —
// e.g. for compliance_checklist: { id: 'pack', label: 'Pakke',
// kind: 'enum', loadOptions: () => [...] }. The runtime doesn't know
// about packs or templates; it just hands the active filter list back
// to the page's `computeDatasets(filters)` callback.

import { freshId } from './freshId'

export type DashboardFilterOperator = 'is' | 'is_not' | 'in' | 'between' | 'after' | 'before'

export type DashboardFilter = {
  /** Stable id for this chip — generated at chip creation time. */
  id: string
  /** Reference to a DashboardDimension.id. */
  dimensionId: string
  operator: DashboardFilterOperator
  /**
   * Operand(s). Typed as unknown so date-range, multi-enum, and free
   * text all share one shape. Convention:
   *   - 'is' / 'is_not': `value` is a single string (the option id)
   *   - 'in': `value` is a string[] of option ids
   *   - 'between': `value` is `{ from: ISO; to: ISO }`
   *   - 'after' / 'before': `value` is a single ISO date string
   */
  value: unknown
}

export type DashboardDimensionKind = 'enum' | 'date_range' | 'text'

export type DashboardDimensionOption = {
  id: string
  label: string
}

export type DashboardDimension = {
  id: string
  label: string
  /** Optional sentence in the picker so users know what the dimension means. */
  description?: string
  kind: DashboardDimensionKind
  /**
   * For enum dimensions — function returning the choosable options.
   * Async so the page can read live data (e.g. the org's pack list).
   * Should be cheap / idempotent — it's called from the picker UI.
   */
  loadOptions?: () => DashboardDimensionOption[] | Promise<DashboardDimensionOption[]>
  /**
   * For enum dimensions — default operator when adding a chip
   * (defaults to 'is' / 'in' depending on operatorOptions).
   */
  defaultOperator?: DashboardFilterOperator
  /** Operators allowed for this dimension. */
  operatorOptions?: DashboardFilterOperator[]
}

/**
 * Pure helper: does `filters` differ from `prev` (deep-ish equality)?
 * Used in compute-on-change callbacks to skip recompute when the chip
 * bar fires a no-op update.
 */
export function filtersEqual(a: DashboardFilter[], b: DashboardFilter[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (x.dimensionId !== y.dimensionId || x.operator !== y.operator) return false
    if (JSON.stringify(x.value) !== JSON.stringify(y.value)) return false
  }
  return true
}

export function makeFilter(
  dimensionId: string,
  operator: DashboardFilterOperator,
  value: unknown,
): DashboardFilter {
  return { id: freshId('f'), dimensionId, operator, value }
}
