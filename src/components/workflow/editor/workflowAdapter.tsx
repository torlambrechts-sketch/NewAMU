// Workflow adapter — plugs WorkflowFlowDocument into the shared
// StepListEditorShell. All workflow-specific knowledge (action types,
// trigger handling, XOR detection, compile to condition_json + actions_json)
// lives here so the shell stays generic.

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import {
  compileWorkflowFlow,
  defaultWorkflowFlowDocument,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../lib/workflowFlowTypes'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowAction, WorkflowRuleRow } from '../../../types/workflow'
import {
  defaultNotificationAction,
  defaultSendEmailAction,
  defaultTaskAction,
} from '../workflowActionDefaults'
import {
  appendAction,
  appendCondition,
  buildEditorSteps,
  getActionAt,
  isXorEnvelope,
  patchAction,
  patchCondition,
  removeStep,
} from './stepModel'
import {
  ConditionFields,
  CreateRosDraftFields,
  CreateTaskFields,
  EmailFields,
  GenericActionPreview,
  NotificationFields,
  WaitDelayFields,
  variablesFor,
} from './StepFieldEditors'
import type {
  AdapterEscapeHatch,
  AdapterMeta,
  EditorStep,
  TemplateEditorAdapter,
} from '../../templates/editor/types'

export type WorkflowAdapterDeps = {
  supabase: SupabaseClient | null
  orgId: string | null
  canEdit: boolean
  /** Called when the shell detects an XOR rule and offers to redirect. */
  onOpenAdvanced: (ruleId: string) => void
}

export type WorkflowDraft = {
  rule: WorkflowRuleRow
  doc: WorkflowFlowDocument
}

export function createWorkflowAdapter(
  deps: WorkflowAdapterDeps,
): TemplateEditorAdapter<WorkflowDraft> {
  const { supabase, canEdit, onOpenAdvanced } = deps

  return {
    source: 'workflow',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('workflow_rules')
        .select('*')
        .eq('id', rowId)
        .maybeSingle()
      if (error || !data) return null
      const rule = data as WorkflowRuleRow
      const doc =
        (rule.flow_graph_json ? parseFlowDocument(rule.flow_graph_json as unknown) : null) ??
        defaultWorkflowFlowDocument()

      const meta: AdapterMeta = {
        title: rule.name,
        subtitle:
          'Steg til venstre — som å fylle ut en oppgave med deloppgaver. Velg ett for å redigere detaljene til høyre.',
        lawRefs: rule.law_refs ?? [],
        versionLabel: rule.is_active ? 'Aktiv' : 'Utkast',
        accent: 'violet',
      }

      let escapeHatch: AdapterEscapeHatch | null = null
      if (isXorEnvelope(rule.actions_json)) {
        escapeHatch = {
          label: 'Åpne i avansert visning',
          reason:
            'Denne regelen har XOR-grenstruktur som ikke kan vises i den enkle steg-listen.',
          onOpen: () => onOpenAdvanced(rule.id),
        }
      }

      return {
        draft: { rule, doc },
        canEdit,
        meta,
        escapeHatch,
      }
    },

    buildSteps(draft) {
      return buildEditorSteps(
        draft.doc,
        draft.rule.name,
        draft.rule.trigger_event_name ?? null,
      )
    },

    renderStepDetail(step, draft, patch) {
      return renderWorkflowStepDetail(step, draft, patch)
    },

    addStepOptions() {
      return [
        { id: 'condition', label: 'Betingelse', hint: 'Begrens hva regelen treffer' },
        { id: 'email', label: 'Send e-post' },
        { id: 'task', label: 'Opprett oppgave' },
        { id: 'notification', label: 'Send varsling' },
        { id: 'wait', label: 'Vent / forsinkelse' },
      ]
    },

    applyAddStep(draft, optionId) {
      if (optionId === 'condition') {
        return { ...draft, doc: appendCondition(draft.doc, { match: 'always' }) }
      }
      let action: WorkflowAction
      switch (optionId) {
        case 'email':
          action = defaultSendEmailAction()
          break
        case 'task':
          action = defaultTaskAction()
          break
        case 'notification':
          action = defaultNotificationAction()
          break
        case 'wait':
          action = { type: 'wait_delay', amount: 1, unit: 'days' }
          break
        default:
          return draft
      }
      return { ...draft, doc: appendAction(draft.doc, action) }
    },

    applyRemoveStep(draft, step) {
      return { ...draft, doc: removeStep(draft.doc, step) }
    },

    validate(draft) {
      const compiled = compileWorkflowFlow(draft.doc)
      if ('error' in compiled) return compiled.error
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const compiled = compileWorkflowFlow(draft.doc)
      if ('error' in compiled) return { ok: false, error: compiled.error }
      const { error } = await supabase
        .from('workflow_rules')
        .update({
          condition_json: compiled.condition_json as unknown as Record<string, unknown>,
          actions_json: compiled.actions_json as unknown as Record<string, unknown>,
          flow_graph_json: draft.doc as unknown as Record<string, unknown>,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      // Workflow doesn't have a draft column today — auto-save already
      // writes to the live row. «Publiser» here is equivalent to flipping
      // is_active = true (or no-op if already active).
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const compiled = compileWorkflowFlow(draft.doc)
      if ('error' in compiled) return { ok: false, error: compiled.error }
      const { error } = await supabase
        .from('workflow_rules')
        .update({
          condition_json: compiled.condition_json as unknown as Record<string, unknown>,
          actions_json: compiled.actions_json as unknown as Record<string, unknown>,
          flow_graph_json: draft.doc as unknown as Record<string, unknown>,
          is_active: true,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    variables(draft) {
      return variablesFor(draft.rule.source_module)
    },
  }
}

function renderWorkflowStepDetail(
  step: EditorStep,
  draft: WorkflowDraft,
  patch: (next: WorkflowDraft) => void,
): ReactNode {
  const setDoc = (next: WorkflowFlowDocument) => patch({ ...draft, doc: next })

  if (step.kind === 'trigger') {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="h-3.5 w-3.5" />
          Utløser er bundet til regelens modul ({draft.rule.source_module})
        </p>
        {draft.rule.trigger_event_name ? (
          <p className="mt-1 font-mono text-xs text-neutral-600">{draft.rule.trigger_event_name}</p>
        ) : (
          <p className="mt-1 text-xs text-neutral-500">
            Ingen hendelse valgt — sett i regelens innstillinger.
          </p>
        )}
      </div>
    )
  }

  const source = (step as EditorStep & { source?: unknown }).source
  // The workflow stepModel attaches a `source` field to each EditorStep
  // it builds. Narrow defensively in case the shape changes.
  const src = source as
    | { type: 'condition'; flowStepId: string }
    | { type: 'action'; flowStepId: string; actionIndex: number }
    | undefined
  if (!src) return null

  if (src.type === 'condition') {
    const { flowStepId } = src
    const flowStep = draft.doc.linearSteps.find((s) => s.id === flowStepId)
    if (!flowStep || flowStep.kind !== 'condition') return null
    return (
      <ConditionFields
        value={flowStep.condition}
        onChange={(next) => setDoc(patchCondition(draft.doc, flowStepId, next))}
      />
    )
  }

  const { flowStepId, actionIndex } = src
  const action = getActionAt(draft.doc, flowStepId, actionIndex)
  if (!action) return null
  const onPatchAction = (next: WorkflowAction) =>
    setDoc(patchAction(draft.doc, flowStepId, actionIndex, next))

  switch (action.type) {
    case 'send_email':
      return <EmailFields a={action} onPatch={onPatchAction} showCc />
    case 'create_ros_draft':
      return <CreateRosDraftFields a={action} onPatch={onPatchAction} />
    case 'create_task':
      return <CreateTaskFields a={action} onPatch={onPatchAction} />
    case 'send_notification':
      return <NotificationFields a={action} onPatch={onPatchAction} />
    case 'wait_delay':
      return <WaitDelayFields a={action} onPatch={onPatchAction} />
    default:
      return <GenericActionPreview a={action} />
  }
}
