// Internal-control workflow scope — internkontroll-årsgjennomgang.
//
// NOTE: the engine historically dispatches with module='internkontroll'.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'internkontroll.ON_ANNUAL_REVIEW_SIGNED': AnnualReviewPayload
  }
}

type AnnualReviewPayload = { rowId: string; year: number; signedBy: string; signedAt: string; framework: string }

registerWorkflowScope({
  scopeId: 'internkontroll',
  label: 'Internkontroll — årsgjennomgang',
  description: 'IK-f § 5 nr. 8 — årlig gjennomgang av internkontrollsystemet.',
  events: [
    {
      name: 'internkontroll.ON_ANNUAL_REVIEW_SIGNED',
      label: 'Årlig gjennomgang signert',
      lawRefs: ['IK-f § 5 nr. 8'],
      severity: 'info',
    },
  ],
  actions: [],
  conditionFields: [
    { path: 'year', label: 'År', valueType: 'number' },
    { path: 'framework', label: 'Rammeverk', valueType: 'string' },
  ],
  presets: [
    {
      slug: 'internkontroll.annual_review_signed_next',
      nameI18n: { nb: 'Årlig gjennomgang signert → bestill neste rytme' },
      triggerEvent: 'internkontroll.ON_ANNUAL_REVIEW_SIGNED',
      actions: [
        {
          type: 'create_task',
          title: 'Planlegg neste årlige gjennomgang',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 300,
          module: 'internkontroll',
          sourceType: 'annual_review',
        },
      ],
      lawRefs: ['IK-f § 5 nr. 8'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'arlig',
    },
  ],
  lawRefs: [
    { ref: 'IK-f § 5 nr. 8', framework: 'Internkontrollforskriften', coverage: 'Skriftlig dokumentasjon og gjennomgang.' },
  ],
})
