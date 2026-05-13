// Documents workflow scope — dokumenter-modulen.

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'documents.ON_DOCUMENT_PUBLISHED': DocPayload
    'documents.ON_DOCUMENT_REVISION_DUE': DocPayload
    'documents.ON_DOCUMENT_REVISION_OVERDUE': DocPayload
    'documents.ON_DOCUMENT_ACK_COMPLETE': DocPayload
    'documents.ON_DOCUMENT_ACCESS_REQUESTED': DocAccessPayload
    'documents.ON_ANNUAL_REVIEW_STARTED': DocPayload
    'documents.ON_ANNUAL_REVIEW_COMPLETED': DocPayload
  }
}

type DocPayload = { rowId: string; documentSlug: string; title: string; legalBasis?: string[]; revisionAt?: string }
type DocAccessPayload = DocPayload & { requestedByUserId: string; requestedAt: string }

registerWorkflowScope({
  scopeId: 'documents',
  label: 'Dokumenter',
  accent: '#0f766e',
  description: 'Dokumentpublisering, kvitteringer, revisjoner og årlig gjennomgang.',
  events: [
    { name: 'documents.ON_DOCUMENT_PUBLISHED', label: 'Dokument publisert', severity: 'info' },
    { name: 'documents.ON_DOCUMENT_REVISION_DUE', label: 'Revisjonsfrist nådd', severity: 'medium' },
    { name: 'documents.ON_DOCUMENT_REVISION_OVERDUE', label: 'Revisjon forfalt', severity: 'high' },
    { name: 'documents.ON_DOCUMENT_ACK_COMPLETE', label: 'Alle kvitteringer mottatt', severity: 'info' },
    {
      name: 'documents.ON_DOCUMENT_ACCESS_REQUESTED',
      label: 'Tilgangssøknad mottatt',
      description: 'Bruker har bedt om tilgang til et begrenset dokument.',
      severity: 'low',
    },
    { name: 'documents.ON_ANNUAL_REVIEW_STARTED', label: 'Årsgjennomgang startet', severity: 'info' },
    { name: 'documents.ON_ANNUAL_REVIEW_COMPLETED', label: 'Årsgjennomgang fullført', severity: 'info' },
  ],
  actions: [
    {
      type: 'request_signature',
      label: 'Be om signatur',
      category: 'Dokument',
      defaults: () => ({ type: 'request_signature', document: '', deadlineDays: 14 }),
    },
  ],
  conditionFields: [
    { path: 'documentSlug', label: 'Dokument-slug', valueType: 'string' },
    { path: 'legalBasis', label: 'Lovgrunnlag (array)', valueType: 'string' },
  ],
  presets: [
    {
      slug: 'documents.published_requires_signature',
      nameI18n: { nb: 'Nytt dokument publisert → kvittering + påminnelse' },
      triggerEvent: 'documents.ON_DOCUMENT_PUBLISHED',
      actions: [
        { type: 'request_signature', document: '{{event.documentSlug}}', deadlineDays: 14 },
        { type: 'wait_until', delay: { amount: 7, unit: 'days' } },
        {
          type: 'send_notification',
          title: 'Påminnelse: les og kvitter for {{event.title}}',
          body: 'Det er 7 dager igjen til frist.',
          category: 'documents',
        },
      ],
      lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 1'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'documents.revision_overdue_escalation',
      nameI18n: { nb: 'Revisjon forfalt → eskalering' },
      triggerEvent: 'documents.ON_DOCUMENT_REVISION_OVERDUE',
      actions: [
        {
          type: 'create_task',
          title: 'Dokumentrevisjon forfalt: {{event.title}}',
          assignee: 'HMS-leder',
          ownerRole: 'HMS',
          dueInDays: 7,
          module: 'documents',
          sourceType: 'document',
        },
        { type: 'escalate', toRole: 'daglig_leder', note: 'Revisjon ikke gjennomført på tid.' },
      ],
      lawRefs: ['IK-f § 5 nr. 8'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'documents.dpia_triggered',
      nameI18n: { nb: 'DPIA påkrevd → opprett Datatilsynet-vurdering' },
      descriptionI18n: { nb: 'Når et dokument peker på personvernkonsekvensutredning (GDPR Art. 35) opprettes oppgaven for personvernombud.' },
      triggerEvent: 'documents.ON_DOCUMENT_PUBLISHED',
      condition: { match: 'array_any', path: 'legalBasis', where: { value: 'GDPR Art. 35' } },
      actions: [
        {
          type: 'create_task',
          title: 'DPIA-vurdering — {{event.title}}',
          assignee: 'Personvernombud',
          ownerRole: 'GDPR',
          dueInDays: 10,
          module: 'documents',
          sourceType: 'dpia',
        },
      ],
      lawRefs: ['GDPR Art. 35'],
      frameworks: ['gdpr'],
      pack: 'gdpr',
      confidentialityLevel: 'restricted',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'IK-f § 5 nr. 8', framework: 'Internkontrollforskriften', coverage: 'Skriftlig dokumentasjon og gjennomgang.' },
    { ref: 'GDPR Art. 35', framework: 'Personvernforordningen', coverage: 'DPIA-trigger ved nye behandlinger.' },
  ],
})
