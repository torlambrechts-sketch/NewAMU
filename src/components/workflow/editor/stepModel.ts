// Step view-model used by the drawer + fullscreen editors.
// Flattens a WorkflowFlowDocument.linearSteps into a row-per-card list
// so the UI matches the «sjekkliste» mockup (one step = one card).

import {
  Bell,
  Building2,
  Clock,
  FileCheck,
  GitFork,
  Hourglass,
  ListChecks,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'
import type { WorkflowFlowDocument, WorkflowFlowStep } from '../../../lib/workflowFlowTypes'
import { newFlowStepId } from '../../../lib/workflowFlowTypes'
import { summarizeAction } from '../workflowActionDefaults'

export type EditorStepKind = 'trigger' | 'condition' | 'action' | 'logic'

export type EditorStep = {
  /** Stable per session — derived from flow step id + action index. */
  uiKey: string
  kind: EditorStepKind
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  /** Accent for icon background. */
  accent: 'violet' | 'amber' | 'blue' | 'green' | 'rose' | 'slate'
  /** Locked rows (trigger) can't be removed or moved. */
  locked: boolean
  /** Marks pre-trigger setup as "completed" for the progress chip in fullscreen. */
  completed: boolean
  /** Source pointer back into the flow document (null for the synthetic trigger row). */
  source:
    | { type: 'trigger' }
    | { type: 'condition'; flowStepId: string }
    | { type: 'action'; flowStepId: string; actionIndex: number }
}

const ACTION_ICON_BY_TYPE: Record<string, ComponentType<{ className?: string }>> = {
  send_email: Mail,
  send_notification: Bell,
  call_webhook: Webhook,
  create_task: ListChecks,
  create_task_item: ListChecks,
  create_deviation: FileCheck,
  create_ros_draft: ShieldCheck,
  add_amu_agenda_item: Users,
  request_signature: FileCheck,
  request_approval: ShieldCheck,
  wait_delay: Hourglass,
  wait_until: Clock,
  parallel: GitFork,
  escalate: ShieldAlert,
  on_error: ShieldAlert,
  log_only: StickyNote,
  rapporter_alvorlig_skade_arbeidstilsynet: Building2,
  meld_personvernbrudd_datatilsynet: Building2,
  varsel_ldo_export: Building2,
  nav_sykefravar_oppfolging: Building2,
  altinn_send_melding: Building2,
}

const ACTION_ACCENT_BY_TYPE: Record<string, EditorStep['accent']> = {
  send_email: 'blue',
  send_notification: 'blue',
  call_webhook: 'slate',
  create_task: 'green',
  create_task_item: 'green',
  create_deviation: 'rose',
  create_ros_draft: 'amber',
  add_amu_agenda_item: 'green',
  request_signature: 'green',
  request_approval: 'green',
  wait_delay: 'amber',
  wait_until: 'amber',
  parallel: 'slate',
  escalate: 'rose',
  on_error: 'rose',
  log_only: 'slate',
}

const LOGIC_ACTION_TYPES = new Set(['wait_delay', 'wait_until'])

function actionTitle(a: WorkflowAction): string {
  switch (a.type) {
    case 'send_email':
      return 'Send e-post'
    case 'send_notification':
      return 'Send varsling'
    case 'call_webhook':
      return 'Kall webhook'
    case 'create_task':
      return 'Opprett oppgave'
    case 'create_task_item':
      return 'Opprett oppgave (pakke)'
    case 'create_deviation':
      return 'Opprett avvik'
    case 'create_ros_draft':
      return 'Opprett ROS-utkast'
    case 'add_amu_agenda_item':
      return 'AMU-sak'
    case 'request_signature':
      return 'Be om signatur'
    case 'request_approval':
      return 'Be om godkjenning'
    case 'wait_delay':
      return `Vent ${a.amount} ${a.unit}`
    case 'wait_until':
      return 'Vent til tidspunkt'
    case 'parallel':
      return 'Parallelle grener'
    case 'escalate':
      return 'Eskaler'
    case 'on_error':
      return 'Ved feil'
    case 'log_only':
      return 'Logg'
    case 'rapporter_alvorlig_skade_arbeidstilsynet':
      return 'Rapporter til Arbeidstilsynet'
    case 'meld_personvernbrudd_datatilsynet':
      return 'Meld til Datatilsynet'
    case 'varsel_ldo_export':
      return 'LDO-eksport'
    case 'nav_sykefravar_oppfolging':
      return 'NAV-oppfølging'
    case 'altinn_send_melding':
      return 'Altinn-melding'
    default:
      return 'Handling'
  }
}

function actionKind(a: WorkflowAction): EditorStepKind {
  return LOGIC_ACTION_TYPES.has(a.type) ? 'logic' : 'action'
}

function conditionSubtitle(c: WorkflowCondition): string {
  switch (c.match) {
    case 'always':
      return 'Kjør alltid'
    case 'field_equals':
      return `${c.path} = «${c.value}»`
    case 'array_any': {
      const keys = Object.keys(c.where)
      if (keys.length === 0) return c.path
      const first = keys[0]
      const val = (c.where as Record<string, unknown>)[first]
      return `${c.path}[*].${first} = «${String(val)}»`
    }
    case 'and':
      return `${c.conditions.length} betingelser (alle)`
    case 'or':
      return `${c.conditions.length} betingelser (en)`
    case 'xor':
      return `${c.conditions.length} grener`
  }
}

export function buildEditorSteps(
  doc: WorkflowFlowDocument,
  triggerLabel: string,
  triggerEvent: string | null,
): EditorStep[] {
  const out: EditorStep[] = [
    {
      uiKey: 'trigger',
      kind: 'trigger',
      title: triggerLabel,
      subtitle: triggerEvent ? 'Utløser · låst' : 'Utløser (ingen hendelse valgt)',
      icon: Zap,
      accent: 'violet',
      locked: true,
      completed: true,
      source: { type: 'trigger' },
    },
  ]

  for (const s of doc.linearSteps) {
    if (s.kind === 'condition') {
      out.push({
        uiKey: `cond:${s.id}`,
        kind: 'condition',
        title: s.label || 'Betingelse',
        subtitle: conditionSubtitle(s.condition),
        icon: GitFork,
        accent: 'amber',
        locked: false,
        completed: s.condition.match !== 'always',
        source: { type: 'condition', flowStepId: s.id },
      })
    } else {
      s.actions.forEach((a, idx) => {
        out.push({
          uiKey: `act:${s.id}:${idx}`,
          kind: actionKind(a),
          title: actionTitle(a),
          subtitle: summarizeAction(a),
          icon: ACTION_ICON_BY_TYPE[a.type] ?? Sparkles,
          accent: ACTION_ACCENT_BY_TYPE[a.type] ?? 'slate',
          locked: false,
          completed: false,
          source: { type: 'action', flowStepId: s.id, actionIndex: idx },
        })
      })
    }
  }

  return out
}

export function getActionAt(
  doc: WorkflowFlowDocument,
  flowStepId: string,
  actionIndex: number,
): WorkflowAction | null {
  const s = doc.linearSteps.find((x) => x.id === flowStepId)
  if (!s || s.kind !== 'actions') return null
  return s.actions[actionIndex] ?? null
}

export function patchAction(
  doc: WorkflowFlowDocument,
  flowStepId: string,
  actionIndex: number,
  next: WorkflowAction,
): WorkflowFlowDocument {
  return {
    ...doc,
    linearSteps: doc.linearSteps.map((s) => {
      if (s.id !== flowStepId || s.kind !== 'actions') return s
      const actions = s.actions.slice()
      actions[actionIndex] = next
      return { ...s, actions }
    }),
  }
}

export function patchCondition(
  doc: WorkflowFlowDocument,
  flowStepId: string,
  next: WorkflowCondition,
): WorkflowFlowDocument {
  return {
    ...doc,
    linearSteps: doc.linearSteps.map((s) =>
      s.id === flowStepId && s.kind === 'condition' ? { ...s, condition: next } : s,
    ),
  }
}

export function removeStep(doc: WorkflowFlowDocument, step: EditorStep): WorkflowFlowDocument {
  if (step.source.type === 'condition') {
    const { flowStepId } = step.source
    return {
      ...doc,
      linearSteps: doc.linearSteps.filter((s) => s.id !== flowStepId),
    }
  }
  if (step.source.type === 'action') {
    const { flowStepId, actionIndex } = step.source
    return {
      ...doc,
      linearSteps: doc.linearSteps
        .map((s) => {
          if (s.id !== flowStepId || s.kind !== 'actions') return s
          const actions = s.actions.filter((_, i) => i !== actionIndex)
          return { ...s, actions }
        })
        .filter((s) => !(s.kind === 'actions' && s.actions.length === 0)),
    }
  }
  return doc
}

export function appendAction(doc: WorkflowFlowDocument, action: WorkflowAction): WorkflowFlowDocument {
  const last = doc.linearSteps[doc.linearSteps.length - 1]
  if (last && last.kind === 'actions') {
    return {
      ...doc,
      linearSteps: doc.linearSteps.map((s) =>
        s.id === last.id && s.kind === 'actions' ? { ...s, actions: [...s.actions, action] } : s,
      ),
    }
  }
  const next: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'actions',
    label: 'Handlinger',
    actions: [action],
  }
  return { ...doc, linearSteps: [...doc.linearSteps, next] }
}

export function appendCondition(
  doc: WorkflowFlowDocument,
  condition: WorkflowCondition,
  label = 'Betingelse',
): WorkflowFlowDocument {
  const next: WorkflowFlowStep = {
    id: newFlowStepId(),
    kind: 'condition',
    label,
    condition,
  }
  return { ...doc, linearSteps: [...doc.linearSteps, next] }
}

export function isXorEnvelope(
  a: WorkflowAction[] | WorkflowXorActionsEnvelope | undefined | null,
): a is WorkflowXorActionsEnvelope {
  return !!a && !Array.isArray(a) && (a as WorkflowXorActionsEnvelope).mode === 'xor_branches'
}
