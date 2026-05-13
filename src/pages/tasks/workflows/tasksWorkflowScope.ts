// Tasks workflow scope — oppgaver-modulen (inkl. AMU-vedtak og PDCA-tiltak).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'tasks.ON_TASK_CREATED': TaskPayload
    'tasks.ON_TASK_STATUS_CHANGED': TaskStatusPayload
    'tasks.ON_TASK_OVERDUE_MARKED': TaskPayload
    'tasks.ON_TASK_SIGNED': TaskPayload
  }
}

type TaskPayload = {
  rowId: string
  title: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  pack?: 'hms' | 'aml-amu' | 'iso-45001' | 'gdpr'
  assigneeUserId?: string
  ownerRole?: string
  dueDate?: string
  sourceType?: string
  sourceId?: string
}
type TaskStatusPayload = TaskPayload & { previousStatus: string; newStatus: string }

registerWorkflowScope({
  scopeId: 'tasks',
  label: 'Oppgaver',
  accent: '#c2410c',
  description: 'PDCA-oppgaver, vedtak fra AMU/styre, og oppfølging.',
  events: [
    { name: 'tasks.ON_TASK_CREATED', label: 'Oppgave opprettet', severity: 'info' },
    { name: 'tasks.ON_TASK_STATUS_CHANGED', label: 'Status endret', severity: 'info' },
    {
      name: 'tasks.ON_TASK_OVERDUE_MARKED',
      label: 'Oppgave forfalt',
      description: 'Oppgaven har passert forfallsdato uten å være lukket.',
      severity: 'high',
    },
    { name: 'tasks.ON_TASK_SIGNED', label: 'Utfører signert', severity: 'info' },
  ],
  actions: [
    {
      type: 'escalate',
      label: 'Eskalér til leder',
      description: 'Bumper ansvarlig til konfigurert eskaleringsrolle.',
      category: 'Eskalering',
      defaults: () => ({ type: 'escalate', toRole: 'hms_leder', note: 'Forsinket — krever umiddelbar oppmerksomhet.' }),
    },
  ],
  conditionFields: [
    {
      path: 'priority',
      label: 'Prioritet',
      valueType: 'enum',
      enumValues: [
        { value: 'critical', label: 'Kritisk' },
        { value: 'high', label: 'Høy' },
        { value: 'medium', label: 'Middels' },
        { value: 'low', label: 'Lav' },
      ],
    },
    {
      path: 'pack',
      label: 'Pakke',
      valueType: 'enum',
      enumValues: [
        { value: 'hms', label: 'HMS' },
        { value: 'aml-amu', label: 'AML-AMU' },
        { value: 'iso-45001', label: 'ISO 45001' },
        { value: 'gdpr', label: 'GDPR' },
      ],
    },
    { path: 'ownerRole', label: 'Eier-rolle', valueType: 'string' },
    { path: 'sourceType', label: 'Kilde-type', valueType: 'string' },
  ],
  presets: [
    {
      slug: 'tasks.critical_overdue_escalation',
      nameI18n: { nb: 'Kritisk oppgave forsinket → eskalering til leder' },
      triggerEvent: 'tasks.ON_TASK_OVERDUE_MARKED',
      condition: { match: 'field_equals', path: 'priority', value: 'critical' },
      actions: [
        { type: 'escalate', toRole: 'daglig_leder', note: 'Kritisk oppgave overskredet frist.' },
        {
          type: 'send_notification',
          title: 'Kritisk oppgave forsinket',
          body: 'Oppgave «{{event.title}}» er forfalt.',
          category: 'tasks',
        },
      ],
      lawRefs: ['IK-f § 5 nr. 7'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'tasks.signed_archive',
      nameI18n: { nb: 'Oppgave signert → loggføring' },
      triggerEvent: 'tasks.ON_TASK_SIGNED',
      actions: [{ type: 'log_only', note: 'Oppgaven er signert — håndteres av modulen.' }],
      lawRefs: ['IK-f § 5 nr. 8'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'IK-f § 5 nr. 7', framework: 'Internkontrollforskriften', coverage: 'Overvåking av tiltak — oppgaver dekker iverksettelsesleddet.' },
  ],
})
