// Descriptor types each module declares to register a workflow scope.
//
// A scope file (e.g. compliance/workflows/complianceWorkflowScope.ts) calls
// registerWorkflowScope({ scopeId, label, events, actions, conditionFields,
// presets, lawRefs }). The unified builder reads only from the registry —
// the engine itself doesn't know about module-specific events.
//
// WorkflowEventMap is a declaration-merging interface: each scope augments
// it so adding an event auto-surfaces in the builder *and* gives the action
// handler strong typing for the payload. The pattern is the same one the
// dashboard registry would have used if it had been built today.

import type { WorkflowAction, WorkflowCondition } from '../../types/workflow'

// ────────────────────────────────────────────────────────────────────────────
// Event map (declaration merging — extend per scope)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Global event map. Each scope module augments this interface to bind
 * its event names to their payload shapes. Example:
 *
 *   declare module '../../lib/workflows/workflowTypes' {
 *     interface WorkflowEventMap {
 *       'finding_critical': { rowId: string; severity: 'critical'; ... }
 *     }
 *   }
 *
 * The registry uses keyof WorkflowEventMap when callers ask "what events
 * exist?" so adding one lights up the builder + dry-run + library auto-
 * matically without editing a central registry file.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkflowEventMap {}

/** All known event names, derived from the augmented event map. */
export type WorkflowEventName = keyof WorkflowEventMap & string

/** Strongly-typed payload for a known event. */
export type WorkflowEventPayload<E extends WorkflowEventName> = WorkflowEventMap[E]

// ────────────────────────────────────────────────────────────────────────────
// Event descriptor — what an event LOOKS like in the builder
// ────────────────────────────────────────────────────────────────────────────

export type WorkflowEventDescriptor = {
  /** Stable event name. Must be a key of WorkflowEventMap once augmented. */
  name: string
  /** User-facing label (nb). */
  label: string
  /** Sentence explaining when the event fires. (nb). */
  description?: string
  /** AML/IK-f/GDPR/… citations the event is most often used with. */
  lawRefs?: string[]
  /** Severity hint for the builder badge (critical / high / medium / low / info). */
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  /**
   * Sample payload — feeds the Dry-Run panel as a default when the user
   * hasn't picked a real workflow_runs row yet. Shape must match
   * WorkflowEventMap[name] once the scope is augmented.
   */
  samplePayload?: Record<string, unknown>
}

// ────────────────────────────────────────────────────────────────────────────
// Action descriptor — what the builder shows in "Add action"
// ────────────────────────────────────────────────────────────────────────────

export type WorkflowActionDescriptor = {
  /** Action type key matching the discriminant in WorkflowAction. */
  type: string
  /** User-facing label (nb). */
  label: string
  /** Sentence explaining the side effect. (nb). */
  description?: string
  /** Grouping in the action picker (e.g. 'Oppgave', 'Varsling', 'Statlig melding'). */
  category: string
  /** TRUE marks gov-reporting actions; builder shows a regulator badge + extra warning. */
  isGovernment?: boolean
  /** Default payload the builder inserts when the user picks this action. */
  defaults: () => WorkflowAction
  /**
   * Optional editor hint: which scope field paths can be referenced in the
   * action's input templating (e.g. {{event.severity}}). The Dry-Run panel
   * uses this to autocomplete payload paths.
   */
  payloadPaths?: string[]
}

// ────────────────────────────────────────────────────────────────────────────
// Condition field — what the condition builder offers as paths/operators
// ────────────────────────────────────────────────────────────────────────────

export type ConditionFieldDescriptor = {
  /** Dotted path into the event payload (e.g. 'severity' or 'findings.0.title'). */
  path: string
  /** Label shown in the condition picker. */
  label: string
  /** Value type — drives the operator picker. */
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'enum'
  /** For enum types, the allowed values. */
  enumValues?: { value: string; label: string }[]
  /** Optional sentence describing what the field captures. */
  description?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Preset (= predefined-workflow seed, but lighter than a catalog row)
// ────────────────────────────────────────────────────────────────────────────

export type WorkflowPresetSeed = {
  /** Stable slug used as workflow_rule_catalog.slug. */
  slug: string
  /** Display title (nb / en). */
  nameI18n: { nb: string; en?: string }
  descriptionI18n?: { nb: string; en?: string }
  /** Which event in this scope fires the preset. */
  triggerEvent: string
  /** Condition the preset narrows down to (defaults to always). */
  condition?: WorkflowCondition
  /** Actions to run. May include cross-scope action types (e.g. gov). */
  actions: WorkflowAction[]
  /** AML/IK-f/GDPR/… citations the preset implements. */
  lawRefs: string[]
  /** Framework tags (aml-amu, iso-45001, gdpr, hovedavtalen, …). */
  frameworks?: string[]
  /** Cadence hint when the preset is a scheduled rule (cron-driven). */
  cadenceHint?: 'arlig' | 'halvarlig' | 'kvartalsvis' | 'manedlig' | 'ukentlig' | 'ad_hoc'
  /** Confidentiality classification (defaults to standard). */
  confidentialityLevel?: 'standard' | 'restricted' | 'confidential'
  /** Marks presets that include any gov-reporting action. */
  containsGovAction?: boolean
  /** Roles the preset is typically run by ('HMS-leder', 'verneombud', …). */
  recommendedFor?: string[]
  /** Pack the preset belongs to ('aml-amu' | 'iso-45001' | 'gdpr' | …). */
  pack?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Law-ref binding — declarative mapping for the gap-and-audit planner
// ────────────────────────────────────────────────────────────────────────────

export type LawRefBinding = {
  /** Exact citation matching CLAUDE.md format ('AML § 5-2'). */
  ref: string
  /** Human-readable framework name (e.g. 'Arbeidsmiljøloven'). */
  framework: string
  /** Short note (nb) explaining how this scope covers the ref. */
  coverage: string
}

// ────────────────────────────────────────────────────────────────────────────
// The scope itself
// ────────────────────────────────────────────────────────────────────────────

export type WorkflowScope = {
  /** Stable scope id. Matches workflow_rules.source_module value. */
  scopeId: string
  /** User-facing scope label (nb). */
  label: string
  /** Optional accent (mirrors dashboard scope accents). */
  accent?: string
  /** Module short description (nb), shown in the scope picker. */
  description?: string
  /** Events the module emits — feed the builder's trigger picker. */
  events: WorkflowEventDescriptor[]
  /** Actions the module contributes — feed the action picker. */
  actions: WorkflowActionDescriptor[]
  /** Condition fields against the event payloads. */
  conditionFields: ConditionFieldDescriptor[]
  /** Predefined workflow templates seeded into workflow_rule_catalog. */
  presets: WorkflowPresetSeed[]
  /** Static law-ref bindings for the gap-and-audit planner. */
  lawRefs: LawRefBinding[]
}
