import type { WorkflowAction, WorkflowCondition } from '../types/workflow'
import {
  defaultWorkflowFlowDocument,
  newBranchId,
  newFlowStepId,
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
} from './workflowFlowTypes'

/**
 * Best-effort: bygg visuelt dokument fra lagret condition_json + actions_json (bakoverkompatibilitet).
 */
export function flowDocumentFromLegacy(
  condition: WorkflowCondition,
  actions: WorkflowAction[] | Record<string, unknown>,
): WorkflowFlowDocument {
  const base = defaultWorkflowFlowDocument()
  const condStep: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'condition',
    label: 'Betingelse (fra database)',
    condition,
  }
  const actList = Array.isArray(actions) ? actions : []
  const actStep: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'actions',
    label: 'Handlinger (fra database)',
    actions: actList.length ? actList : [{ type: 'log_only', note: 'Ingen handlinger' }],
  }

  if (
    !Array.isArray(actions) &&
    typeof actions === 'object' &&
    actions !== null &&
    (actions as { mode?: string }).mode === 'xor_branches'
  ) {
    const env = actions as { branches?: { actions?: WorkflowAction[] }[] }
    const br = env.branches ?? []
    const conds =
      condition.match === 'xor' && Array.isArray((condition as { conditions?: WorkflowCondition[] }).conditions)
        ? (condition as { conditions: WorkflowCondition[] }).conditions
        : []
    const xorBranches = br.map((b, i) => ({
      id: newBranchId(),
      label: `Gren ${i + 1}`,
      steps: [
        {
          id: newFlowStepId(),
          kind: 'condition' as const,
          label: 'Betingelse',
          condition: conds[i] ?? { match: 'always' },
        },
        {
          id: newFlowStepId(),
          kind: 'actions' as const,
          label: 'Handlinger',
          actions: b.actions ?? [],
        },
      ],
    }))
    return {
      version: 1,
      mode: 'xor',
      linearSteps: [],
      xorBranches: xorBranches.length >= 2 ? xorBranches : base.xorBranches,
    }
  }

  return {
    version: 1,
    mode: 'linear',
    linearSteps: [condStep, actStep],
    xorBranches: base.xorBranches,
  }
}
