// Sentence ↔ flow_graph_json compiler.
//
// `sentenceToFlowGraph` always succeeds — it lowers the sentence-model into
// the canonical WorkflowFlowDocument (linear mode, one condition step + one
// actions step). `flowGraphToSentence` is partial: returns null whenever
// the graph contains advanced constructs (XOR branches, multi-condition
// composition, parallel actions, sub-flows, multi-trigger). In that case
// CanvasPanel falls through to advanced/DAG mode and shows the badge.
//
// CLAUDE.md note: the sentence-builder does NOT bypass `compileWorkflowFlow`.
// Save path is sentence → WorkflowFlowDocument → compileWorkflowFlow →
// {condition_json, actions_json, flow_graph_json}. Engine semantics are
// unchanged.

import type {
  WorkflowAction,
  WorkflowActionOnError,
  WorkflowCondition,
  WorkflowSourceModule,
} from '../../../types/workflow'
import {
  WORKFLOW_FLOW_VERSION,
  newFlowStepId,
  type WorkflowFlowDocument,
  type WorkflowFlowStep,
} from '../../../lib/workflowFlowTypes'
import { freshId } from '../../../lib/workflows/freshId'
import type {
  SentenceDelay,
  SentenceModel,
  SentenceScopeFilter,
  SentenceStep,
} from './sentenceModel'

// ─── helpers ────────────────────────────────────────────────────────────────

function scopeFilterToCondition(sf: SentenceScopeFilter): WorkflowCondition | null {
  if (!sf) return null
  if (sf.kind === 'location' && sf.locationId)
    return { match: 'field_equals', path: 'location_id', value: sf.locationId }
  if (sf.kind === 'enhet' && sf.enhetId)
    return { match: 'field_equals', path: 'enhet_id', value: sf.enhetId }
  if (sf.kind === 'avdeling' && sf.avdelingId)
    return { match: 'field_equals', path: 'avdeling_id', value: sf.avdelingId }
  return null
}

function conditionToScopeFilter(c: WorkflowCondition): SentenceScopeFilter | 'condition' {
  // Recognise the patterns scopeFilterToCondition emits, so a round-trip
  // re-populates the scope chip rather than dumping the equality into the
  // generic condition slot.
  if (c.match !== 'field_equals') return 'condition'
  if (c.path === 'location_id') return { kind: 'location', locationId: c.value }
  if (c.path === 'enhet_id') return { kind: 'enhet', enhetId: c.value }
  if (c.path === 'avdeling_id') return { kind: 'avdeling', avdelingId: c.value }
  return 'condition'
}

function combineScopeAndCondition(
  scope: WorkflowCondition | null,
  cond: WorkflowCondition | null,
): WorkflowCondition {
  if (scope && cond) return { match: 'and', conditions: [scope, cond] }
  return scope ?? cond ?? { match: 'always' }
}

function delayToWaitAction(delay: SentenceDelay): WorkflowAction | null {
  if (!delay || delay.value <= 0) return null
  return { type: 'wait_delay', amount: delay.value, unit: delay.unit }
}

function waitActionToDelay(a: WorkflowAction): SentenceDelay {
  if (a.type !== 'wait_delay') return null
  if (a.unit !== 'minutes' && a.unit !== 'hours' && a.unit !== 'days') return null
  return { unit: a.unit, value: a.amount }
}

function flatActionsFromSteps(steps: SentenceStep[]): WorkflowAction[] {
  const out: WorkflowAction[] = []
  for (const s of steps) {
    const w = delayToWaitAction(s.delay)
    if (w) out.push(w)
    out.push(s.action)
  }
  return out
}

function reverseFlatToSteps(actions: WorkflowAction[]): SentenceStep[] | null {
  // Pair adjacent wait_delay + action into a single SentenceStep with delay.
  // Lonely actions get delay = null. Lonely wait_delay (no following action)
  // is allowed — represented as a step with action = wait_delay & delay null
  // so reverse compile is total for trivial flows.
  const out: SentenceStep[] = []
  let i = 0
  while (i < actions.length) {
    const cur = actions[i]
    if (cur.type === 'wait_delay') {
      const next = actions[i + 1]
      if (next && next.type !== 'wait_delay' && next.type !== 'on_error') {
        const d = waitActionToDelay(cur)
        if (!d) return null
        out.push({ id: freshId('sn'), action: next, delay: d })
        i += 2
        continue
      }
      // Lonely wait_delay — keep as its own step so we don't lose data.
      out.push({ id: freshId('sn'), action: cur, delay: null })
      i += 1
      continue
    }
    if (cur.type === 'on_error') {
      // on_error is handled separately by caller (extracted from tail).
      i += 1
      continue
    }
    out.push({ id: freshId('sn'), action: cur, delay: null })
    i += 1
  }
  return out
}

// ─── sentence → flow_graph_json (always succeeds) ───────────────────────────

export function sentenceToFlowGraph(sentence: SentenceModel): WorkflowFlowDocument {
  const scopeCond = scopeFilterToCondition(sentence.scopeFilter)
  const condition = combineScopeAndCondition(scopeCond, sentence.condition)

  const conditionStep: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'condition',
    label: condition.match === 'always' ? 'Alltid' : 'Filter',
    condition,
  }

  const actions = flatActionsFromSteps(sentence.steps)
  if (sentence.onError && sentence.onError.length > 0) {
    const onError: WorkflowActionOnError = { type: 'on_error', actions: sentence.onError }
    actions.push(onError)
  }

  const actionsStep: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'actions',
    label: 'Handlinger',
    actions: actions.length > 0 ? actions : [],
  }

  return {
    version: WORKFLOW_FLOW_VERSION,
    mode: 'linear',
    linearSteps: [conditionStep, actionsStep],
    xorBranches: [],
  }
}

// ─── flow_graph_json → sentence (partial) ───────────────────────────────────

export type ReverseCompileBailReason =
  | 'mode-xor'
  | 'no-actions-step'
  | 'parallel-actions'
  | 'composite-condition'
  | 'multi-on-error'
  | 'reverse-failed'

export type ReverseCompileResult =
  | { ok: true; sentence: SentenceModel }
  | { ok: false; reason: ReverseCompileBailReason }

/**
 * Bail policy:
 *   - mode === 'xor' (more than one terminal branch) → DAG
 *   - any actions step containing `parallel` or nested `on_error` chains → DAG
 *   - condition step using and/or/xor with sub-conditions that don't reduce
 *     to (scope-equality? + simple condition?) → keep as opaque condition
 *     but still allow editing in sentence mode
 *   - more than one actions step → DAG (the sentence model is a flat list)
 */
export function flowGraphToSentence(
  doc: WorkflowFlowDocument,
  sourceModule: WorkflowSourceModule,
  triggerEventName: string,
): ReverseCompileResult {
  if (doc.mode !== 'linear') return { ok: false, reason: 'mode-xor' }

  const condSteps = doc.linearSteps.filter(
    (s): s is Extract<WorkflowFlowStep, { kind: 'condition' }> => s.kind === 'condition',
  )
  const actSteps = doc.linearSteps.filter(
    (s): s is Extract<WorkflowFlowStep, { kind: 'actions' }> => s.kind === 'actions',
  )

  if (actSteps.length > 1) return { ok: false, reason: 'reverse-failed' }
  if (actSteps.length === 0) return { ok: false, reason: 'no-actions-step' }

  // ─── trigger ─────────────────────────────────────────────────────────────
  const trigger = { sourceModule, eventName: triggerEventName }

  // ─── condition split: scope + condition ──────────────────────────────────
  let scopeFilter: SentenceScopeFilter = null
  let condition: WorkflowCondition | null = null
  for (const cs of condSteps) {
    const c = cs.condition
    if (c.match === 'always') continue
    if (c.match === 'and') {
      // Try to split an AND of equality(scope) + other-condition.
      let consumedScope = false
      for (const inner of c.conditions) {
        const maybe = inner.match === 'field_equals' ? conditionToScopeFilter(inner) : 'condition'
        if (maybe !== 'condition' && !consumedScope) {
          scopeFilter = maybe
          consumedScope = true
        } else {
          // Accumulate remainder as condition
          condition = condition
            ? { match: 'and', conditions: [condition, inner] }
            : inner
        }
      }
      continue
    }
    if (c.match === 'or' || c.match === 'xor') {
      return { ok: false, reason: 'composite-condition' }
    }
    if (c.match === 'field_equals') {
      const maybe = conditionToScopeFilter(c)
      if (maybe !== 'condition' && !scopeFilter) {
        scopeFilter = maybe
        continue
      }
    }
    // array_any or unmatched field_equals → opaque condition
    condition = condition
      ? { match: 'and', conditions: [condition, c] }
      : c
  }

  // ─── actions: pair waits with following action; extract on_error tail ───
  const rawActions = actSteps[0].actions
  // Disallow parallel in sentence mode.
  if (rawActions.some((a) => a.type === 'parallel')) {
    return { ok: false, reason: 'parallel-actions' }
  }

  // Multiple on_error or non-tail on_error → DAG.
  const onErrorIndices = rawActions
    .map((a, i) => (a.type === 'on_error' ? i : -1))
    .filter((i) => i >= 0)
  if (onErrorIndices.length > 1) return { ok: false, reason: 'multi-on-error' }
  if (onErrorIndices.length === 1 && onErrorIndices[0] !== rawActions.length - 1) {
    return { ok: false, reason: 'multi-on-error' }
  }

  let onError: WorkflowAction[] | null = null
  const actionsWithoutOnError = [...rawActions]
  if (onErrorIndices.length === 1) {
    const last = actionsWithoutOnError.pop() as WorkflowActionOnError
    onError = last.actions
  }

  const steps = reverseFlatToSteps(actionsWithoutOnError)
  if (steps === null) return { ok: false, reason: 'reverse-failed' }

  return {
    ok: true,
    sentence: {
      trigger,
      scopeFilter,
      condition,
      steps,
      onError,
    },
  }
}

// ─── empty-state helper ─────────────────────────────────────────────────────

export function emptySentence(sourceModule: WorkflowSourceModule, eventName = ''): SentenceModel {
  return {
    trigger: { sourceModule, eventName },
    scopeFilter: null,
    condition: null,
    steps: [],
    onError: null,
  }
}
