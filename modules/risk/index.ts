// Risk module — Phase 2.
// Aggregate-only risk visibility dashboard, reading from the
// `risk_register_summary_v` view (P2 migration 20260913100000) with a
// client-side fold over compliance findings + tasks + deviations +
// inspection_findings + alert_cases as the fallback path.

export { RiskAnalysePage } from './RiskAnalysePage'
export { RiskRegisterPage } from './RiskRegisterPage'
export {
  RISK_DASHBOARD_SCOPE_ID,
  STYRET_PRESET_LAYOUT,
  VERNEOMBUD_PRESET_LAYOUT,
  HMS_LEDER_PRESET_LAYOUT,
} from './dashboards/riskDashboardScope'
export { useRiskDatasets, buildRiskDatasets, foldSourcesToRows } from './dashboards/useRiskDatasets'
export type { UnifiedRiskRow, RiskSource } from './dashboards/useRiskDatasets'
export { useRiskDashboardRows } from './dashboards/useRiskDashboardRows'
export { HAZARD_CATEGORIES, HAZARD_CATEGORY_OPTIONS } from './dashboards/hazardCategories'
export type { HazardCategoryId, HazardCategory } from './dashboards/hazardCategories'

// Side-effect import to ensure the scope registers on module load
// even when callers import only types or hooks.
import './dashboards/riskDashboardScope'
