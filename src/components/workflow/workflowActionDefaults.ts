import type { WorkflowAction, WorkflowActionCreateDeviation } from '../../types/workflow'

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

export function summarizeAction(a: WorkflowAction): string {
  switch (a.type) {
    case 'create_task':
      return `Oppgave: ${a.title}`
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
    case 'log_only':
      return a.note ? `Logg: ${a.note}` : 'Kun logg'
    default:
      return 'Ukjent handling'
  }
}
