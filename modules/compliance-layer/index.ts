// Compliance Layer module — public exports.
//
// Mirrors `modules/compliance/index.ts` shape so consumers import the
// same way ("types + hooks + pages"). Page components are exported as
// named exports so the App.tsx route table can import them by name.

export type {
  RegulationClauseRow,
  InternalControlRow,
  ControlClauseRow,
  ControlBindingRow,
  ControlExecutionRow,
  ControlStatusViewRow,
  ComplianceEvidenceViewRow,
  ControlFamily,
  ControlStatus,
  ControlCoverageLevel,
  ControlBindingSourceKind,
  ControlBindingRequirementKind,
  ControlBindingSourceTemplateTable,
  ControlFrequencyHint,
  ControlStatusLabel,
  ComplianceLayerKpiSummary,
} from './types'

export {
  CONTROL_FAMILIES,
  CONTROL_STATUSES,
  CONTROL_COVERAGE_LEVELS,
  CONTROL_BINDING_SOURCE_KINDS,
  CONTROL_BINDING_REQUIREMENT_KINDS,
  CONTROL_BINDING_SOURCE_TEMPLATE_TABLES,
  CONTROL_FREQUENCY_HINTS,
  CONTROL_STATUS_LABELS,
} from './types'

export {
  RegulationClauseRowSchema,
  InternalControlRowSchema,
  ControlClauseRowSchema,
  ControlBindingRowSchema,
  ControlExecutionRowSchema,
  ControlStatusViewRowSchema,
  ComplianceEvidenceViewRowSchema,
  parseRows,
} from './schema'

export { useInternalControls } from './useInternalControls'
export type { UseInternalControlsReturn } from './useInternalControls'

export { useControlClauses } from './useControlClauses'
export type { UseControlClausesReturn } from './useControlClauses'

export { useControlBindings } from './useControlBindings'
export type { UseControlBindingsReturn } from './useControlBindings'

export { useControlEvidence } from './useControlEvidence'
export type { UseControlEvidenceReturn } from './useControlEvidence'

export { useComplianceLayerNav } from './useComplianceLayerNav'
export type { UseComplianceLayerNavReturn } from './useComplianceLayerNav'

export { ControlsHubLanding } from './ControlsHubLanding'
export { ControlsListPage } from './ControlsListPage'
export { ControlDetailPage } from './ControlDetailPage'
export { ControlEditorPanel } from './ControlEditorPanel'

export { KontrollerInnstillingerPage } from './admin/KontrollerInnstillingerPage'
export { BindingEditorPanel } from './admin/BindingEditorPanel'
export { ClauseMappingPanel } from './admin/ClauseMappingPanel'
export { ShareControlsWithAuditorButton } from './admin/ShareControlsWithAuditorButton'

export { ComplianceLayerAnalysePage } from './ComplianceLayerAnalysePage'
