// Vernerunder workflow scope — vernerunder (HMS-runder).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'vernerunder.ON_VERNERUNDE_CREATED': VrPayload
    'vernerunder.ON_VERNERUNDE_PLANNED': VrPayload
    'vernerunder.ON_VERNERUNDE_COMPLETED': VrPayload
    'vernerunder.ON_STATUS_CHANGED': VrStatusPayload
    'vernerunder.ON_FINDING_REGISTERED': VrFindingPayload
    'vernerunder.ON_FINDING_UPDATED': VrFindingPayload
  }
}

type VrPayload = { rowId: string; title: string; scheduledAt?: string; completedAt?: string; lawRefs?: string[] }
type VrStatusPayload = VrPayload & { previousStatus: string; newStatus: string }
type VrFindingPayload = {
  rowId: string
  vernerundeId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

registerWorkflowScope({
  scopeId: 'vernerunder',
  label: 'Vernerunder',
  description: 'HMS-runder ledet av verneombud — runden + funnene.',
  events: [
    { name: 'vernerunder.ON_VERNERUNDE_CREATED', label: 'Vernerunde opprettet', severity: 'info' },
    { name: 'vernerunder.ON_VERNERUNDE_PLANNED', label: 'Vernerunde planlagt', severity: 'info' },
    { name: 'vernerunder.ON_VERNERUNDE_COMPLETED', label: 'Vernerunde fullført', severity: 'info' },
    { name: 'vernerunder.ON_STATUS_CHANGED', label: 'Statusendring', severity: 'info' },
    { name: 'vernerunder.ON_FINDING_REGISTERED', label: 'Funn registrert', severity: 'medium' },
    { name: 'vernerunder.ON_FINDING_UPDATED', label: 'Funn oppdatert', severity: 'low' },
  ],
  actions: [],
  conditionFields: [
    {
      path: 'severity',
      label: 'Alvorlighet',
      valueType: 'enum',
      enumValues: [
        { value: 'critical', label: 'Kritisk' },
        { value: 'high', label: 'Høy' },
        { value: 'medium', label: 'Middels' },
        { value: 'low', label: 'Lav' },
      ],
    },
  ],
  presets: [
    {
      slug: 'vernerunder.critical_finding_to_ros',
      nameI18n: { nb: 'Vernerunde kritisk funn → ROS + Arbeidstilsynet-vurdering' },
      triggerEvent: 'vernerunder.ON_FINDING_REGISTERED',
      condition: { match: 'field_equals', path: 'severity', value: 'critical' },
      actions: [
        { type: 'create_ros_draft', template: 'standard 5×5', linkSource: true },
        {
          type: 'create_task',
          title: 'Vurder § 5-2 melding — kritisk vernerunde-funn',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 1,
          module: 'vernerunder',
          sourceType: 'vr_finding_critical',
        },
      ],
      lawRefs: ['AML § 5-2', 'AML § 6-2', 'IK-f § 5 nr. 7'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [{ ref: 'AML § 6-2', framework: 'Arbeidsmiljøloven', coverage: 'Verneombud — vernerunder.' }],
})
