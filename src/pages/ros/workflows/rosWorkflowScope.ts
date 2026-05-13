// ROS workflow scope — risikovurdering.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'ros.ON_ROS_CREATED': RosPayload
    'ros.ON_ROS_CRITICAL_RISK': RosCriticalPayload
    'ros.ON_ROS_APPROVED': RosPayload
  }
}

type RosPayload = { rowId: string; rosSlug: string; title: string; template?: string; ownerUserId?: string }
type RosCriticalPayload = RosPayload & { riskCategory: string; severity: number; likelihood: number }

registerWorkflowScope({
  scopeId: 'ros',
  label: 'ROS — risikovurdering',
  description: 'Risiko- og sårbarhetsanalyser. Kritisk risiko utløser AMU + Arbeidstilsynet-vurdering.',
  events: [
    { name: 'ros.ON_ROS_CREATED', label: 'ROS opprettet', severity: 'info' },
    { name: 'ros.ON_ROS_CRITICAL_RISK', label: 'Kritisk risiko i ROS', severity: 'critical', lawRefs: ['AML § 4-1', 'IK-f § 5 nr. 6'] },
    { name: 'ros.ON_ROS_APPROVED', label: 'ROS godkjent', severity: 'info' },
  ],
  actions: [],
  conditionFields: [
    { path: 'riskCategory', label: 'Risikokategori', valueType: 'string' },
    { path: 'severity', label: 'Konsekvens (1-5)', valueType: 'number' },
    { path: 'likelihood', label: 'Sannsynlighet (1-5)', valueType: 'number' },
  ],
  presets: [
    {
      slug: 'ros.critical_risk_to_amu',
      nameI18n: { nb: 'Kritisk risiko → AMU-sak + tiltaksplan' },
      triggerEvent: 'ros.ON_ROS_CRITICAL_RISK',
      actions: [
        { type: 'add_amu_agenda_item', agendaItem: 'Kritisk risiko fra ROS — tiltak', priority: 'kritisk' },
        {
          type: 'create_task',
          title: 'Tiltaksplan for kritisk risiko: {{event.riskCategory}}',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 7,
          module: 'ros',
          sourceType: 'critical_risk',
        },
      ],
      lawRefs: ['AML § 4-1', 'IK-f § 5 nr. 6', 'IK-f § 5 nr. 7'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'AML § 4-1', framework: 'Arbeidsmiljøloven', coverage: 'Generelt krav til arbeidsmiljø — risikovurdering.' },
    { ref: 'IK-f § 5 nr. 6', framework: 'Internkontrollforskriften', coverage: 'Kartlegging av risiko.' },
  ],
})
