// Action plan workflow scope — tiltakshåndtering.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'action_plan.ON_MEASURE_CREATED': MeasurePayload
    'action_plan.ON_MEASURE_RESOLVED': MeasurePayload
    'action_plan.ON_MEASURE_OVERDUE': MeasurePayload
  }
}

type MeasurePayload = { rowId: string; title: string; ownerUserId?: string; dueDate?: string; severity?: string }

registerWorkflowScope({
  scopeId: 'action_plan',
  label: 'Handlingsplan — tiltak',
  description: 'PDCA-tiltak fra ROS, inspeksjoner, sjekklister og AMU.',
  events: [
    { name: 'action_plan.ON_MEASURE_CREATED', label: 'Tiltak opprettet', severity: 'info' },
    { name: 'action_plan.ON_MEASURE_RESOLVED', label: 'Tiltak løst / verifisert', severity: 'info' },
    { name: 'action_plan.ON_MEASURE_OVERDUE', label: 'Tiltak forfalt', severity: 'high' },
  ],
  actions: [],
  conditionFields: [{ path: 'severity', label: 'Alvorlighet', valueType: 'string' }],
  presets: [
    {
      slug: 'action_plan.overdue_escalation',
      nameI18n: { nb: 'Tiltak forfalt → eskalering' },
      triggerEvent: 'action_plan.ON_MEASURE_OVERDUE',
      actions: [
        { type: 'escalate', toRole: 'hms_leder', note: 'Tiltak ikke gjennomført på tid.' },
        {
          type: 'send_notification',
          title: 'Tiltak forfalt: {{event.title}}',
          body: 'Bes fulgt opp omgående.',
          category: 'action_plan',
        },
      ],
      lawRefs: ['IK-f § 5 nr. 7'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'IK-f § 5 nr. 7', framework: 'Internkontrollforskriften', coverage: 'Iverksettelse av tiltak.' },
  ],
})
