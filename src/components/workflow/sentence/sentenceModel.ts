// SentenceModel — Norwegian-prose representation of a workflow rule.
//
// The killer-UX insight from the canvas review: a rule should read like
// a Norwegian sentence ("NÅR … HVOR … HVIS … DA … HVIS feiler →"). This
// in-memory shape captures exactly that, and `compile.ts` bidirectionally
// converts to/from the canonical `flow_graph_json` document. Anything the
// sentence shape can't losslessly express bails to advanced (DAG) mode.

import type { WorkflowAction, WorkflowCondition, WorkflowSourceModule } from '../../../types/workflow'

/** Pick from `listWorkflowEvents()` — scope filters the picker. */
export type SentenceTrigger = {
  sourceModule: WorkflowSourceModule
  eventName: string
}

/**
 * Where-filter. v0: "hele organisasjonen" (null) or a single
 * `location_id`/`enhet_id`/`avdeling_id` equality. Anything fancier compiles
 * to the condition_json and is shown in the ConditionChip instead.
 */
export type SentenceScopeFilter =
  | null
  | { kind: 'location'; locationId: string }
  | { kind: 'enhet'; enhetId: string }
  | { kind: 'avdeling'; avdelingId: string }

export type SentenceDelay = {
  unit: 'minutes' | 'hours' | 'days'
  value: number
} | null

export type SentenceStep = {
  /** Stable id (freshId('sn')) — for React keys and selection. */
  id: string
  action: WorkflowAction
  delay: SentenceDelay
}

export type SentenceModel = {
  trigger: SentenceTrigger
  scopeFilter: SentenceScopeFilter
  /** Extra condition (HVIS) on top of the scope filter. */
  condition: WorkflowCondition | null
  /** DA-steps in run order. */
  steps: SentenceStep[]
  /**
   * MVP: a single fallback action when any preceding step fails. Stored as
   * an array so v1 can extend to multi-action escalation chains; null = no
   * on_error branch.
   */
  onError: WorkflowAction[] | null
}
