import type { WorkflowAction, WorkflowCondition, WorkflowXorActionsEnvelope } from '../types/workflow'

export const WORKFLOW_FLOW_VERSION = 1 as const

/** One step in a path: condition gate and/or terminal actions */
export type WorkflowFlowStep =
  | { id: string; kind: 'condition'; condition: WorkflowCondition; label?: string }
  | { id: string; kind: 'actions'; actions: WorkflowAction[]; label?: string }

export type WorkflowFlowBranch = {
  id: string
  label: string
  steps: WorkflowFlowStep[]
}

/**
 * Visual flow state (stored in workflow_rules.flow_graph_json).
 * Execution still uses compiled condition_json + actions_json.
 */
export type WorkflowFlowDocument = {
  version: typeof WORKFLOW_FLOW_VERSION
  mode: 'linear' | 'xor'
  /** Single path: ordered steps (drag to reorder) */
  linearSteps: WorkflowFlowStep[]
  /** XOR: exactly one branch must match at runtime; each branch has its own action list */
  xorBranches: WorkflowFlowBranch[]
}

export function newFlowStepId() {
  return `st_${crypto.randomUUID().slice(0, 8)}`
}

export function newBranchId() {
  return `br_${crypto.randomUUID().slice(0, 8)}`
}

export function defaultWorkflowFlowDocument(): WorkflowFlowDocument {
  return {
    version: WORKFLOW_FLOW_VERSION,
    mode: 'linear',
    linearSteps: [
      {
        id: newFlowStepId(),
        kind: 'condition',
        label: 'Alltid',
        condition: { match: 'always' },
      },
      {
        id: newFlowStepId(),
        kind: 'actions',
        label: 'Handlinger',
        actions: [
          {
            type: 'create_task',
            title: 'Oppfølgingsoppgave',
            description: 'Opprettet av arbeidsflyt',
            assignee: 'Ansvarlig',
            dueInDays: 7,
            module: 'hse',
            sourceType: 'manual',
          },
        ],
      },
    ],
    xorBranches: [
      { id: newBranchId(), label: 'Gren 1', steps: [] },
      { id: newBranchId(), label: 'Gren 2', steps: [] },
    ],
  }
}

/** AND-combine multiple conditions (skip always-only if single) */
function andConditions(conds: WorkflowCondition[]): WorkflowCondition {
  const nonTrivial = conds.filter((c) => c.match !== 'always')
  if (nonTrivial.length === 0) return { match: 'always' }
  if (nonTrivial.length === 1) return nonTrivial[0]
  return { match: 'and', conditions: nonTrivial }
}

function extractBranchParts(steps: WorkflowFlowStep[]): {
  condition: WorkflowCondition
  actions: WorkflowAction[]
} {
  const condSteps = steps.filter((s): s is Extract<WorkflowFlowStep, { kind: 'condition' }> => s.kind === 'condition')
  const actSteps = steps.filter((s): s is Extract<WorkflowFlowStep, { kind: 'actions' }> => s.kind === 'actions')
  const condition = andConditions(condSteps.map((s) => s.condition))
  const actions = actSteps.flatMap((s) => s.actions)
  return { condition, actions }
}

export type CompiledWorkflowRulePayload = {
  condition_json: WorkflowCondition
  actions_json: WorkflowAction[] | WorkflowXorActionsEnvelope
}

/**
 * Compile visual flow → DB payload. XOR krav: minst 2 grener, hver med minst én betingelse og én handlingsblokk anbefales.
 */
export function compileWorkflowFlow(doc: WorkflowFlowDocument): CompiledWorkflowRulePayload | { error: string } {
  if (doc.mode === 'linear') {
    const { condition, actions } = extractBranchParts(doc.linearSteps)
    if (actions.length === 0) {
      return { error: 'Legg til minst én handlingsblokk (oppgave) i flyten.' }
    }
    return { condition_json: condition, actions_json: actions }
  }

  const branches = doc.xorBranches
  if (branches.length < 2) {
    return { error: 'XOR-modus krever minst to grener.' }
  }
  const conds: WorkflowCondition[] = []
  const branchActions: WorkflowAction[][] = []
  for (const b of branches) {
    const { condition, actions } = extractBranchParts(b.steps)
    if (actions.length === 0) {
      return { error: `Gren «${b.label}» mangler handlingsblokk.` }
    }
    conds.push(condition)
    branchActions.push(actions)
  }
  return {
    condition_json: { match: 'xor', conditions: conds },
    actions_json: {
      mode: 'xor_branches',
      branches: branchActions.map((actions) => ({ actions })),
    },
  }
}

export function parseFlowDocument(raw: unknown): WorkflowFlowDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== WORKFLOW_FLOW_VERSION) return null
  if (o.mode !== 'linear' && o.mode !== 'xor') return null
  if (!Array.isArray(o.linearSteps) || !Array.isArray(o.xorBranches)) return null
  return raw as WorkflowFlowDocument
}
