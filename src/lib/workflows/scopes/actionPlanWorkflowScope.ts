// Action-plan workflow scope — handlingsplan / tiltak.
//
// Legacy module without a TS UI surface (Gamle moduler is gone), but
// archive/20260730000000_action_plan_module_v2.sql (lines 145+) still
// emits ON_MEASURE_CREATED / ON_MEASURE_RESOLVED / ON_MEASURE_OVERDUE
// via workflow_dispatch_db_event(org, 'action_plan', …). This scope
// surfaces those events to the unified builder.

import { registerWorkflowScope } from '../workflowRegistry'

declare module '../workflowTypes' {
  interface WorkflowEventMap {
    'action_plan.ON_MEASURE_CREATED': MeasurePayload
    'action_plan.ON_MEASURE_RESOLVED': MeasurePayload
    'action_plan.ON_MEASURE_OVERDUE': MeasurePayload
  }
}

type MeasurePayload = {
  rowId: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'resolved' | 'overdue'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  pdcaPhase?: 'plan' | 'do' | 'check' | 'act'
  dueDate?: string
  ownerUserId?: string
  sourceType?: string
  sourceId?: string
}

registerWorkflowScope({
  scopeId: 'action_plan',
  label: 'Handlingsplan / tiltak',
  accent: '#b45309',
  description:
    'PDCA-tiltak i handlingsplanen: opprettet, lukket eller forfalt.',

  events: [
    {
      name: 'action_plan.ON_MEASURE_CREATED',
      label: 'Tiltak opprettet',
      description: 'Nytt tiltak lagt til handlingsplanen.',
      lawRefs: ['IK-f § 5 nr. 7'],
      severity: 'info',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        title: 'Bytt sperret fluktvei-skilting',
        status: 'open',
        priority: 'high',
        pdcaPhase: 'do',
      },
    },
    {
      name: 'action_plan.ON_MEASURE_RESOLVED',
      label: 'Tiltak lukket',
      description: 'Tiltaket er gjennomført og verifisert.',
      lawRefs: ['IK-f § 5 nr. 7', 'IK-f § 5 nr. 8'],
      severity: 'info',
    },
    {
      name: 'action_plan.ON_MEASURE_OVERDUE',
      label: 'Tiltak forfalt',
      description: 'Tiltaket har passert frist uten å være lukket.',
      lawRefs: ['IK-f § 5 nr. 7'],
      severity: 'high',
    },
  ],

  actions: [],

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
      path: 'status',
      label: 'Status',
      valueType: 'enum',
      enumValues: [
        { value: 'open', label: 'Åpen' },
        { value: 'in_progress', label: 'Pågår' },
        { value: 'resolved', label: 'Lukket' },
        { value: 'overdue', label: 'Forfalt' },
      ],
    },
    {
      path: 'pdcaPhase',
      label: 'PDCA-fase',
      valueType: 'enum',
      enumValues: [
        { value: 'plan', label: 'Plan' },
        { value: 'do', label: 'Do' },
        { value: 'check', label: 'Check' },
        { value: 'act', label: 'Act' },
      ],
    },
    { path: 'sourceType', label: 'Kilde-type', valueType: 'string' },
  ],

  presets: [],

  lawRefs: [
    {
      ref: 'IK-f § 5 nr. 7',
      framework: 'Internkontrollforskriften',
      coverage:
        'Overvåking av at iverksatte tiltak virker — handlingsplanen samler tiltakene.',
    },
    {
      ref: 'IK-f § 5 nr. 8',
      framework: 'Internkontrollforskriften',
      coverage: 'Skriftlig dokumentasjon — tiltakshistorikk i handlingsplanen.',
    },
  ],
})
