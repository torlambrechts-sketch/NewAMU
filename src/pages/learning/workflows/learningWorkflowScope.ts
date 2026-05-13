// Learning workflow scope — e-læring (kurs, sertifikater).

import { registerWorkflowScope } from '../../../lib/workflows/workflowRegistry'

declare module '../../../lib/workflows/workflowTypes' {
  interface WorkflowEventMap {
    'learning.ON_COURSE_STARTED': CoursePayload
    'learning.ON_COURSE_COMPLETED': CoursePayload
    'learning.ON_CERTIFICATE_ISSUED': CertificatePayload
  }
}

type CoursePayload = { rowId: string; courseSlug: string; title: string; userId: string; lawRefs?: string[] }
type CertificatePayload = CoursePayload & { certificateId: string; expiresAt?: string }

registerWorkflowScope({
  scopeId: 'learning',
  label: 'E-læring',
  accent: '#0e7490',
  description: 'Kurs, fullføring, sertifikater og kompetanse-utløp.',
  events: [
    { name: 'learning.ON_COURSE_STARTED', label: 'Kurs startet', severity: 'info' },
    { name: 'learning.ON_COURSE_COMPLETED', label: 'Kurs fullført', severity: 'info' },
    {
      name: 'learning.ON_CERTIFICATE_ISSUED',
      label: 'Sertifikat utstedt',
      description: 'Et sertifikat er gyldig. Når et er nær utløp brukes et eget cron-trigger.',
      lawRefs: ['AML § 3-2', 'IK-f § 5 nr. 2'],
      severity: 'info',
    },
  ],
  actions: [],
  conditionFields: [
    { path: 'courseSlug', label: 'Kurs-slug', valueType: 'string' },
    { path: 'expiresAt', label: 'Utløper', valueType: 'date' },
  ],
  presets: [
    {
      slug: 'learning.course_completed_log',
      nameI18n: { nb: 'Kurs fullført → kompetansebevis logget' },
      triggerEvent: 'learning.ON_COURSE_COMPLETED',
      actions: [{ type: 'log_only', note: 'Sertifikat utstedes av modul.' }],
      lawRefs: ['AML § 3-2', 'IK-f § 5 nr. 2'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'learning.certificate_expiring_60d',
      nameI18n: { nb: 'Sertifikat utløper om 60 dager → re-tildeling (planlagt)' },
      descriptionI18n: { nb: 'Cron-regel: daglig sjekk av sertifikater som utløper innen 60 dager.' },
      triggerEvent: 'learning.ON_CERTIFICATE_ISSUED',
      actions: [
        {
          type: 'create_task',
          title: 'Re-tildel kurs: {{event.title}}',
          assignee: '{{event.userId}}',
          ownerRole: 'HMS',
          dueInDays: 60,
          module: 'learning',
          sourceType: 'certificate_expiry',
        },
      ],
      lawRefs: ['AML § 3-2', 'IK-f § 5 nr. 2'],
      frameworks: ['aml-amu', 'iso-45001'],
      pack: 'aml-amu',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'AML § 3-2', framework: 'Arbeidsmiljøloven', coverage: 'Opplæring og kompetanse.' },
    { ref: 'IK-f § 5 nr. 2', framework: 'Internkontrollforskriften', coverage: 'Krav til kompetanse.' },
  ],
})
