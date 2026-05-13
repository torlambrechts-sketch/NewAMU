// Meetings workflow scope — møter-modulen (AMU, vernerunder, MUS, drøftinger).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'meetings.ON_MEETING_SCHEDULED': MeetingPayload
    'meetings.ON_MEETING_SIGNED': MeetingPayload
    'meetings.ON_MEETING_DECISION_LOGGED': MeetingDecisionPayload
  }
}

type MeetingPayload = {
  rowId: string
  meetingType: string
  title: string
  scheduledAt: string
  signedBy?: string
  lawRefs?: string[]
  confidentialityLevel?: 'standard' | 'restricted' | 'confidential'
}
type MeetingDecisionPayload = MeetingPayload & {
  decisionId: string
  decisionText: string
  ownerUserId?: string
  dueDate?: string
}

registerWorkflowScope({
  scopeId: 'meetings',
  label: 'Møter (AMU, vernerunder, MUS, …)',
  accent: '#4338ca',
  description: 'AMU, vernerunder, MUS, drøftinger, varslingsutvalg — møtelivssyklus.',
  events: [
    { name: 'meetings.ON_MEETING_SCHEDULED', label: 'Møte planlagt', severity: 'info' },
    { name: 'meetings.ON_MEETING_SIGNED', label: 'Protokoll signert', severity: 'info' },
    {
      name: 'meetings.ON_MEETING_DECISION_LOGGED',
      label: 'Vedtak registrert',
      description: 'Et vedtak fra et møte er logget — opprett oppgaver til ansvarlige.',
      lawRefs: ['AML § 7-2', 'IK-f § 5 nr. 8'],
      severity: 'high',
    },
  ],
  actions: [],
  conditionFields: [
    { path: 'meetingType', label: 'Møtetype', valueType: 'string' },
    {
      path: 'confidentialityLevel',
      label: 'Fortrolighet',
      valueType: 'enum',
      enumValues: [
        { value: 'standard', label: 'Standard' },
        { value: 'restricted', label: 'Begrenset' },
        { value: 'confidential', label: 'Konfidensielt' },
      ],
    },
  ],
  presets: [
    {
      slug: 'meetings.decision_to_tasks',
      nameI18n: { nb: 'AMU-vedtak → oppgaver til ansvarlige + publiser protokoll' },
      triggerEvent: 'meetings.ON_MEETING_DECISION_LOGGED',
      actions: [
        {
          type: 'create_task',
          title: 'Følge opp vedtak: {{event.decisionText}}',
          assignee: '{{event.ownerUserId}}',
          ownerRole: 'AMU',
          dueInDays: 30,
          module: 'meetings',
          sourceType: 'amu_decision',
        },
      ],
      lawRefs: ['AML § 7-2', 'IK-f § 5 nr. 8'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'meetings.annual_review_certificate',
      nameI18n: { nb: 'Årsgjennomgang signert → kompetansebevis' },
      triggerEvent: 'meetings.ON_MEETING_SIGNED',
      condition: { match: 'field_equals', path: 'meetingType', value: 'amu-arsmote' },
      actions: [
        {
          type: 'create_task',
          title: 'Generer årsbevis for HMS',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 5,
          module: 'meetings',
          sourceType: 'amu_arsmote',
        },
      ],
      lawRefs: ['AML § 7-2', 'IK-f § 5 nr. 8'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'arlig',
    },
  ],
  lawRefs: [
    { ref: 'AML § 7-2', framework: 'Arbeidsmiljøloven', coverage: 'AMU — arbeidsmiljøutvalg.' },
    { ref: 'IK-f § 5 nr. 8', framework: 'Internkontrollforskriften', coverage: 'Skriftlig dokumentasjon — protokoller.' },
  ],
})
