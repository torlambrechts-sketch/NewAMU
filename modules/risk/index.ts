// Risk module — Phase 1.
// Aggregate-only risk visibility dashboard. No new write surface yet —
// reads from compliance findings, tasks (avvik/nestenulykke/risiko/tiltak),
// deviations, inspection_findings, and alert_cases.

export { RiskAnalysePage } from './RiskAnalysePage'
export { RiskRegisterPage } from './RiskRegisterPage'
export {
  RISK_DASHBOARD_SCOPE_ID,
  STYRET_PRESET_LAYOUT,
  VERNEOMBUD_PRESET_LAYOUT,
  HMS_LEDER_PRESET_LAYOUT,
} from './dashboards/riskDashboardScope'
export { useRiskDatasets } from './dashboards/useRiskDatasets'
export { HAZARD_CATEGORIES, HAZARD_CATEGORY_OPTIONS } from './dashboards/hazardCategories'
export type { HazardCategoryId, HazardCategory } from './dashboards/hazardCategories'

// Side-effect import to ensure the scope registers on module load
// even when callers import only types or hooks.
import './dashboards/riskDashboardScope'
