// Compatible-kind heuristic for the widget editor.
//
// Lifted out of DashboardEditWidgetPanel so Fast Refresh stays happy
// (a component file can only export components). Caller can override
// by passing an explicit list to DashboardEditWidgetPanel.compatibleKinds.

import type { ReportModuleKind } from '../../../types/reportBuilder'

export function defaultCompatibleKinds(kind: ReportModuleKind): ReportModuleKind[] {
  if (kind === 'donut' || kind === 'bar' || kind === 'table') {
    return ['donut', 'bar', 'table']
  }
  if (kind === 'line') return ['line']
  return ['kpi']
}
