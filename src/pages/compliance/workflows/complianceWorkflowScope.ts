// Compliance checklist workflow scope.
//
// Declares the events the compliance/sjekklist module emits, the actions
// it contributes, condition fields the builder can use, and the predefined
// workflow library (Phase B seed payload). Companion scope file pattern
// to src/pages/compliance/dashboards/complianceCompanyDashboardScope.ts.
//
// Side-effect registration: any page that wants the workflow registry
// populated must `import './workflows/complianceWorkflowScope'` (or just
// import `src/lib/workflows/registerScopes` once at app start, which pulls
// in every scope).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

// Declaration merging: bind event names → payload shapes so the builder
// gets strong typing per scope.
declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'compliance.checklist.response_finding_critical': ChecklistFindingPayload
    'compliance.checklist.response_finding_high': ChecklistFindingPayload
    'compliance.checklist.response_finding_medium': ChecklistFindingPayload
    'compliance.checklist.response_finding_low': ChecklistFindingPayload
    'compliance.checklist.execution_signed': ChecklistExecutionPayload
    'compliance.checklist.execution_overdue': ChecklistExecutionPayload
    'compliance.checklist.not_executed_in_window': ChecklistTemplatePayload
  }
}

type ChecklistFindingPayload = {
  rowId: string
  templateSlug: string
  itemKey: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  findingTitle: string
  findingDescription?: string
  responderUserId?: string
  ownerUserId?: string
  lawRefs?: string[]
}

type ChecklistExecutionPayload = {
  rowId: string
  templateSlug: string
  executedAt: string
  signedBy?: string
  pack: 'aml-amu' | 'iso-45001'
}

type ChecklistTemplatePayload = {
  templateSlug: string
  expectedAt: string
  pack: 'aml-amu' | 'iso-45001'
}

registerWorkflowScope({
  scopeId: 'compliance_checklist',
  label: 'Sjekklister (compliance)',
  accent: '#1a3d32',
  description:
    'Sjekklist-relaterte hendelser: kritiske/høye funn ved gjennomføring, signering, og forsinkede sjekklister.',

  events: [
    {
      name: 'compliance.checklist.response_finding_critical',
      label: 'Kritisk funn ved sjekklist',
      description: 'Utfører rapporterer en funn-rad med alvorlighet «kritisk».',
      lawRefs: ['AML § 3-1', 'AML § 4-1', 'IK-f § 5 nr. 7'],
      severity: 'critical',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        templateSlug: 'vernerunde-aarsgjennomgang',
        itemKey: 'fluktveier_klare',
        severity: 'critical',
        findingTitle: 'Fluktvei sperret av lagring',
      },
    },
    {
      name: 'compliance.checklist.response_finding_high',
      label: 'Høyt funn ved sjekklist',
      lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 7'],
      severity: 'high',
    },
    {
      name: 'compliance.checklist.response_finding_medium',
      label: 'Middels funn ved sjekklist',
      severity: 'medium',
    },
    {
      name: 'compliance.checklist.response_finding_low',
      label: 'Lavt funn ved sjekklist',
      severity: 'low',
    },
    {
      name: 'compliance.checklist.execution_signed',
      label: 'Sjekklist signert',
      description: 'Sjekklisten er fullstendig utfylt og signert av ansvarlig.',
      lawRefs: ['IK-f § 5 nr. 7', 'IK-f § 5 nr. 8'],
      severity: 'info',
    },
    {
      name: 'compliance.checklist.execution_overdue',
      label: 'Sjekklist forfalt',
      description: 'Sjekklisten skulle vært utført innen frist; ingen registrert utførelse.',
      lawRefs: ['IK-f § 5 nr. 6', 'IK-f § 5 nr. 7'],
      severity: 'high',
    },
    {
      name: 'compliance.checklist.not_executed_in_window',
      label: 'Sjekklist ikke utført i forventet vindu',
      description: 'For periodiske maler: ingen utførelse innenfor cadence-vinduet.',
      lawRefs: ['IK-f § 5 nr. 6'],
      severity: 'medium',
    },
  ],

  actions: [
    {
      type: 'add_amu_agenda_item',
      label: 'Legg til AMU-sak',
      description: 'Funnet eskaleres som ny sak i AMU-agendaen.',
      category: 'AMU & vedtak',
      defaults: () => ({
        type: 'add_amu_agenda_item',
        agendaItem: 'Oppfølging av kritisk funn',
        priority: 'høy',
      }),
      payloadPaths: ['findingTitle', 'severity', 'templateSlug'],
    },
    {
      type: 'create_ros_draft',
      label: 'Opprett ROS-utkast',
      description: 'Initierer en risikovurdering med funn-kontekst.',
      category: 'ROS',
      defaults: () => ({
        type: 'create_ros_draft',
        template: 'standard 5×5',
        linkSource: true,
      }),
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
    { path: 'templateSlug', label: 'Mal-slug', valueType: 'string' },
    { path: 'itemKey', label: 'Sjekklist-punkt', valueType: 'string' },
    { path: 'pack', label: 'Pakke', valueType: 'enum',
      enumValues: [{ value: 'aml-amu', label: 'AML-AMU' }, { value: 'iso-45001', label: 'ISO 45001' }] },
  ],

  presets: [
    {
      slug: 'compliance.critical_finding_to_amu',
      nameI18n: { nb: 'Kritisk funn → AMU-sak', en: 'Critical finding → AMU agenda' },
      descriptionI18n: {
        nb: 'Ved kritisk funn opprettes oppgave til HMS-leder, ROS-utkast og AMU-sak; vurderer Arbeidstilsynet-melding manuelt.',
      },
      triggerEvent: 'compliance.checklist.response_finding_critical',
      condition: { match: 'always' },
      actions: [
        {
          type: 'create_task',
          title: 'Vurder kritisk funn — eskalering',
          description: 'HMS-leder vurderer om funnet krever melding til Arbeidstilsynet (AML § 5-2).',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 1,
          module: 'compliance',
          sourceType: 'compliance_checklist_finding',
        },
        { type: 'create_ros_draft', template: 'standard 5×5', linkSource: true },
        { type: 'add_amu_agenda_item', agendaItem: 'Kritisk funn — oppfølging og tiltak', priority: 'høy' },
      ],
      lawRefs: ['AML § 3-1', 'AML § 4-1', 'IK-f § 5 nr. 7'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      recommendedFor: ['HMS-leder', 'verneombud'],
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'compliance.checklist_overdue_escalation',
      nameI18n: { nb: 'Sjekklist forfalt → påminnelse + eskalering' },
      descriptionI18n: {
        nb: 'Sjekklist som skulle vært utført er forsinket — påminnelse, så eskalering til HMS-leder etter 7 dager.',
      },
      triggerEvent: 'compliance.checklist.execution_overdue',
      condition: { match: 'always' },
      actions: [
        {
          type: 'send_notification',
          title: 'Sjekklist forfalt',
          body: 'Vennligst utfør sjekklisten {{event.templateSlug}} så snart som mulig.',
          category: 'compliance',
        },
        { type: 'wait_until', delay: { amount: 7, unit: 'days' } },
        {
          type: 'create_task',
          title: 'Eskalering: sjekklist {{event.templateSlug}} fortsatt ikke utført',
          description: 'Avklar årsak og iverksett tiltak.',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 3,
          module: 'compliance',
        },
      ],
      lawRefs: ['IK-f § 5 nr. 6', 'IK-f § 5 nr. 7'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'compliance.signed_archive',
      nameI18n: { nb: 'Sjekklist signert → arkivering + logg' },
      triggerEvent: 'compliance.checklist.execution_signed',
      actions: [
        { type: 'log_only', note: 'Sjekklist signert; arkivering håndtert av modul.' },
      ],
      lawRefs: ['IK-f § 5 nr. 8'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],

  lawRefs: [
    {
      ref: 'AML § 3-1',
      framework: 'Arbeidsmiljøloven',
      coverage: 'Krav til systematisk HMS-arbeid; sjekklister er primært tiltak.',
    },
    {
      ref: 'IK-f § 5 nr. 7',
      framework: 'Internkontrollforskriften',
      coverage: 'Overvåking av at tiltak er iverksatt — sjekklist-eksekvering er kjernen.',
    },
  ],
})
