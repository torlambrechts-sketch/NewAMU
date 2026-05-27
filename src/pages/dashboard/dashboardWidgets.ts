// Re-export av alle widgets samlet. dashboardCatalog.ts importerer
// herfra slik at vi har én stabil import-bane.

export {
  TimelineWidget,
  TaskTemplateDetailWidget,
  DelegationRulesWidget,
  GovernanceModelWidget,
} from './widgets/cadenceWidgets'

export {
  GanttWidget,
  CriticalPathWidget,
  StageGateWidget,
} from './widgets/timeWidgets'

export {
  KanbanWidget,
  LeanVsmWidget,
  CapacityWidget,
} from './widgets/flowWidgets'

export {
  SprintBurndownWidget,
  OkrWidget,
} from './widgets/goalWidgets'

export {
  RaidWidget,
  ApprovalChainsWidget,
  EscalationLadderWidget,
  AuditStreamWidget,
} from './widgets/riskWidgets'

export {
  RaciMatrixWidget,
} from './widgets/roleWidgets'

export {
  PreviewCalendarWidget,
} from './widgets/previewWidgets'

export {
  MethodComparisonWidget,
} from './widgets/metaWidgets'
