// Inspection workflow scope — inspeksjonsrunder + funn.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'inspection.round_created': RoundPayload
    'inspection.round_activated': RoundPayload
    'inspection.round_signed': RoundPayload
    'inspection.finding_critical': FindingPayload
    'inspection.finding_high': FindingPayload
    'inspection.finding_medium': FindingPayload
    'inspection.finding_low': FindingPayload
  }
}

type RoundPayload = { rowId: string; roundType: string; title: string; assignedTo?: string; lawRefs?: string[] }
type FindingPayload = {
  rowId: string
  roundId: string
  title: string
  description?: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location?: string
}

registerWorkflowScope({
  scopeId: 'inspection',
  label: 'Inspeksjon (vernerunder, kontrollrunder)',
  description: 'Inspeksjonsrunder, funn, signering. Kritiske funn eskaleres til ROS + AMU.',
  events: [
    { name: 'inspection.round_created', label: 'Runde opprettet', severity: 'info' },
    { name: 'inspection.round_activated', label: 'Runde aktivert', severity: 'info' },
    { name: 'inspection.round_signed', label: 'Runde signert', severity: 'info' },
    { name: 'inspection.finding_critical', label: 'Kritisk funn', severity: 'critical', lawRefs: ['AML § 5-2'] },
    { name: 'inspection.finding_high', label: 'Høy-alvorlighet funn', severity: 'high' },
    { name: 'inspection.finding_medium', label: 'Middels-alvorlighet funn', severity: 'medium' },
    { name: 'inspection.finding_low', label: 'Lav-alvorlighet funn', severity: 'low' },
  ],
  actions: [
    {
      type: 'create_deviation',
      label: 'Opprett avvik',
      description: 'Skaper et formelt avvik i deviation-modulen.',
      category: 'Avvik',
      defaults: () => ({ type: 'create_deviation', titlePrefix: 'Inspeksjonsfunn', dueInDays: 14, assignFromRound: true }),
    },
    {
      type: 'add_amu_agenda_item',
      label: 'AMU-agenda — fra inspeksjon',
      category: 'AMU & vedtak',
      defaults: () => ({ type: 'add_amu_agenda_item', agendaItem: 'Inspeksjonsfunn til drøfting', priority: 'høy' }),
    },
  ],
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
    { path: 'roundType', label: 'Runde-type', valueType: 'string' },
    { path: 'location', label: 'Lokasjon', valueType: 'string' },
  ],
  presets: [
    {
      slug: 'inspection.critical_finding_chain',
      nameI18n: { nb: 'Kritisk inspeksjonsfunn → avvik + ROS + AMU' },
      triggerEvent: 'inspection.finding_critical',
      actions: [
        { type: 'create_deviation', titlePrefix: 'Kritisk inspeksjonsfunn', dueInDays: 1, assignFromRound: true },
        { type: 'create_ros_draft', template: 'standard 5×5', linkSource: true },
        { type: 'add_amu_agenda_item', agendaItem: 'Kritisk inspeksjonsfunn — straks-tiltak', priority: 'høy' },
        {
          type: 'create_task',
          title: 'Vurder Arbeidstilsynet-melding (AML § 5-2)',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 1,
          module: 'inspection',
          sourceType: 'critical_finding',
        },
      ],
      lawRefs: ['AML § 5-2', 'AML § 6-2', 'IK-f § 5 nr. 7'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'AML § 6-2', framework: 'Arbeidsmiljøloven', coverage: 'Verneombudets oppgaver — vernerunder.' },
    { ref: 'AML § 5-2', framework: 'Arbeidsmiljøloven', coverage: 'Meldeplikt til Arbeidstilsynet ved alvorlig skade.' },
  ],
})
