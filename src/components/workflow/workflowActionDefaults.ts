import type {
  WorkflowAction,
  WorkflowActionAltinnSendMelding,
  WorkflowActionArbeidstilsynetReport,
  WorkflowActionCreateDeviation,
  WorkflowActionDatatilsynetBreach,
  WorkflowActionEscalate,
  WorkflowActionLdoExport,
  WorkflowActionNavSykefravar,
  WorkflowActionOnError,
  WorkflowActionParallel,
  WorkflowActionRequestApproval,
  WorkflowActionWaitUntil,
} from '../../types/workflow'

export function defaultTaskAction(): Extract<WorkflowAction, { type: 'create_task' }> {
  return {
    type: 'create_task',
    title: 'Oppfølgingsoppgave',
    description: 'Automatisert fra arbeidsflyt',
    assignee: 'HMS',
    dueInDays: 7,
    module: 'hse',
    sourceType: 'manual',
    requiresManagementSignOff: false,
  }
}

export function defaultSendEmailAction(): Extract<WorkflowAction, { type: 'send_email' }> {
  return {
    type: 'send_email',
    fromAddress: 'noreply@bedrift.no',
    toAddress: 'hms@bedrift.no',
    subject: 'Arbeidsflyt — hendelse',
    body: 'Dette er en planlagt e-post fra arbeidsflyt. Faktisk utsending krever server.',
    contentType: 'text/plain',
  }
}

export function defaultNotificationAction(): Extract<WorkflowAction, { type: 'send_notification' }> {
  return {
    type: 'send_notification',
    title: 'Arbeidsflyt',
    body: 'En regel ble utløst. Sjekk modulen som utløste hendelsen.',
    category: 'workflow',
    channels: ['in_app'],
  }
}

export function defaultWebhookAction(): Extract<WorkflowAction, { type: 'call_webhook' }> {
  return {
    type: 'call_webhook',
    url: 'https://example.com/webhook',
    method: 'POST',
    headersJson: '{"Content-Type":"application/json"}',
    body: '{}',
  }
}

export function defaultCreateDeviationAction(): WorkflowActionCreateDeviation {
  return {
    type: 'create_deviation',
    dueInDays: 1,
    assignFromRound: true,
  }
}

export function defaultLogOnlyAction(): Extract<WorkflowAction, { type: 'log_only' }> {
  return { type: 'log_only', note: 'Kun logging' }
}

// ─── New action types (Phase A substrate) ──────────────────────────────────

export function defaultWaitUntilAction(): WorkflowActionWaitUntil {
  return { type: 'wait_until', delay: { amount: 1, unit: 'days' } }
}

export function defaultRequestApprovalAction(): WorkflowActionRequestApproval {
  return {
    type: 'request_approval',
    approverRole: 'hms_leder',
    message: 'Bekreft handling før videre kjøring.',
    escalateAfterHours: 24,
    escalateToRole: 'daglig_leder',
  }
}

export function defaultEscalateAction(): WorkflowActionEscalate {
  return { type: 'escalate', toRole: 'hms_leder', note: 'Krever umiddelbar oppmerksomhet.' }
}

export function defaultParallelAction(): WorkflowActionParallel {
  return {
    type: 'parallel',
    branches: [
      { label: 'Gren A', actions: [defaultTaskAction()] },
      { label: 'Gren B', actions: [defaultNotificationAction()] },
    ],
  }
}

export function defaultOnErrorAction(): WorkflowActionOnError {
  return {
    type: 'on_error',
    actions: [
      { type: 'log_only', note: 'Tidligere handling feilet — varsler HMS-leder.' },
      defaultNotificationAction(),
    ],
  }
}

// ─── Government actions ────────────────────────────────────────────────────

export function defaultArbeidstilsynetAction(): WorkflowActionArbeidstilsynetReport {
  return {
    type: 'rapporter_alvorlig_skade_arbeidstilsynet',
    melderRolle: 'arbeidsgiver',
    reminderHoursBeforeDeadline: [12, 4, 1],
  }
}

export function defaultDatatilsynetAction(): WorkflowActionDatatilsynetBreach {
  return {
    type: 'meld_personvernbrudd_datatilsynet',
    natureOfBreach: '',
    affectedCategories: [],
    reminderHoursBeforeDeadline: [24, 4, 1],
  }
}

export function defaultLdoExportAction(): WorkflowActionLdoExport {
  return { type: 'varsel_ldo_export', category: 'diskriminering' }
}

export function defaultNavSykefravarAction(): WorkflowActionNavSykefravar {
  return { type: 'nav_sykefravar_oppfolging', triggerWeek: 8 }
}

export function defaultAltinnAction(): WorkflowActionAltinnSendMelding {
  return { type: 'altinn_send_melding', tjeneste: '', skjema: '', environment: 'tt02' }
}

export function summarizeAction(a: WorkflowAction): string {
  switch (a.type) {
    case 'create_task':
      return `Oppgave: ${a.title}`
    case 'create_task_item':
      return `Oppgave (${a.pack}/${a.sourceCategory}): ${a.title}`
    case 'send_email':
      return `E-post → ${a.toAddress}`
    case 'send_notification':
      return `Varsling: ${a.title}`
    case 'call_webhook': {
      const u = a.url ?? ''
      return `Webhook ${a.method ?? 'POST'} ${u.slice(0, 40)}${u.length > 40 ? '…' : ''}`
    }
    case 'create_deviation':
      return `Avvik (frist ${a.dueInDays ?? 1}d${a.assignFromRound !== false ? ', arv tildelt' : ''})`
    case 'create_ros_draft':
      return `ROS-utkast (${a.template})`
    case 'add_amu_agenda_item':
      return `AMU-sak: ${a.agendaItem} (${a.priority})`
    case 'request_signature':
      return `Be om signatur (${a.deadlineDays}d frist)`
    case 'wait_delay':
      return `Vent ${a.amount} ${a.unit}`
    case 'wait_until':
      return a.at
        ? `Vent til ${a.at}`
        : `Vent ${a.delay?.amount ?? '?'} ${a.delay?.unit ?? 'days'}`
    case 'request_approval':
      return `Godkjenning fra ${a.approverRole ?? 'rolle?'}${a.escalateAfterHours ? ` (eskalert etter ${a.escalateAfterHours}t)` : ''}`
    case 'escalate':
      return `Eskaler til ${a.toRole ?? a.toUserId ?? '?'}`
    case 'parallel':
      return `Parallelt: ${a.branches.length} grener`
    case 'on_error':
      return `Ved feil: ${a.actions.length} handlinger`
    case 'rapporter_alvorlig_skade_arbeidstilsynet':
      return `⚖️ Arbeidstilsynet — alvorlig skade (AML § 5-2, 24t)`
    case 'meld_personvernbrudd_datatilsynet':
      return `⚖️ Datatilsynet — personvernbrudd (GDPR Art. 33, 72t)`
    case 'varsel_ldo_export':
      return `⚖️ LDO — eksport (manuell innsending)`
    case 'nav_sykefravar_oppfolging':
      return `⚖️ NAV — sykefravær uke ${a.triggerWeek}`
    case 'altinn_send_melding':
      return `⚖️ Altinn — ${a.tjeneste}/${a.skjema}`
    case 'log_only':
      return a.note ? `Logg: ${a.note}` : 'Kun logg'
    default:
      return 'Ukjent handling'
  }
}
