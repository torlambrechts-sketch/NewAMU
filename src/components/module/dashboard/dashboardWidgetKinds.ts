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
  if (kind === 'heatmap') return ['heatmap']
  // Scorecard og bowtie konsumerer samme dataset-form (rows med
  // id/label/title/obligation/status, valgfritt byKind+proof for
  // bowtie-barrierer), så de er gjensidig utskiftbare i edit-panelet.
  if (kind === 'scorecard' || kind === 'bowtie') return ['scorecard', 'bowtie']
  // Benchmark har sin egen datasett-form (org-egen + bench-bøtte per
  // måned) og kan derfor bare instansieres som benchmark.
  if (kind === 'benchmark') return ['benchmark']
  return ['kpi']
}
