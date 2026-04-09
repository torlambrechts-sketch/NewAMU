import type { WorkflowAction, WorkflowCondition, WorkflowRuleRow, WorkflowXorActionsEnvelope } from '../types/workflow'
import { summarizeCondition } from './workflowConditionSummary'
import { summarizeAction } from '../components/workflow/workflowActionDefaults'
import { WORKFLOW_SOURCE_MODULES } from '../types/workflow'

function isXorEnvelope(a: WorkflowAction[] | WorkflowXorActionsEnvelope): a is WorkflowXorActionsEnvelope {
  return typeof a === 'object' && a !== null && !Array.isArray(a) && (a as WorkflowXorActionsEnvelope).mode === 'xor_branches'
}

export function sourceModuleLabel(value: string): string {
  const row = WORKFLOW_SOURCE_MODULES.find((m) => m.value === value)
  return row?.label ?? value
}

export function triggerLabel(t: WorkflowRuleRow['trigger_on']): string {
  switch (t) {
    case 'insert':
      return 'Kun ny lagring'
    case 'update':
      return 'Kun oppdatering'
    case 'both':
      return 'Ny + oppdatering'
    default:
      return t
  }
}

export function summarizeRuleCondition(c: WorkflowCondition): string {
  return summarizeCondition(c)
}

export function summarizeRuleActions(actions: WorkflowAction[] | WorkflowXorActionsEnvelope): string {
  if (isXorEnvelope(actions)) {
    const n = actions.branches.length
    if (n === 0) return 'XOR (ingen grener)'
    const first = actions.branches[0]?.actions?.[0]
    const hint = first ? summarizeAction(first) : '—'
    return n === 1 ? `XOR: 1 gren (${hint})` : `XOR: ${n} grener (første: ${hint})`
  }
  if (actions.length === 0) return 'Ingen handling'
  return actions.map((a) => summarizeAction(a)).join(' · ')
}
