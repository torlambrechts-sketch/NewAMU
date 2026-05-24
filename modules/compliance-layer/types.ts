// Compliance Layer module · types re-export.
//
// Re-exports the canonical row types from `src/types/complianceLayer.ts`
// so module-internal imports use the short path. Keep this file as a
// thin pass-through; new domain types belong in `src/types/`.

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
  CompliancePackSlug,
} from '../../src/types/complianceLayer'

export {
  CONTROL_FAMILIES,
  CONTROL_STATUSES,
  CONTROL_COVERAGE_LEVELS,
  CONTROL_BINDING_SOURCE_KINDS,
  CONTROL_BINDING_REQUIREMENT_KINDS,
  CONTROL_BINDING_SOURCE_TEMPLATE_TABLES,
  CONTROL_FREQUENCY_HINTS,
  CONTROL_STATUS_LABELS,
} from '../../src/types/complianceLayer'
