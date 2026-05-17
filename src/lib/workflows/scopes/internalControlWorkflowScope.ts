// Internal-control workflow scope — internkontroll / årlig gjennomgang.
//
// "Gamle moduler" UI is gone; this scope file is a homeless registration
// at src/lib/workflows/scopes/. The DB trigger in
// archive/20260729120000_ik_annual_review_core.sql (line 109) emits
// ON_ANNUAL_REVIEW_SIGNED via workflow_dispatch_db_event(org,
// 'internkontroll', …). The seeded system rule in
// _122200_workflow_system_rules_seed_aml.sql:379 also stores
// source_module='internkontroll'. So the scopeId here MUST be
// 'internkontroll' (Norwegian, legacy) — not the English 'internal_control'
// from the spec. The spec terminology stays for prose/docs; the runtime
// key is the Norwegian one.

import { registerWorkflowScope } from '../workflowRegistry'

declare module '../workflowTypes' {
  interface WorkflowEventMap {
    'internkontroll.ON_ANNUAL_REVIEW_SIGNED': AnnualReviewPayload
    'internkontroll.ON_ANNUAL_REVIEW_STARTED': AnnualReviewPayload
  }
}

type AnnualReviewPayload = {
  rowId: string
  reviewYear: number
  status: 'draft' | 'in_review' | 'signed'
  signedAt?: string
  signedBy?: string
  ownerUserId?: string
}

registerWorkflowScope({
  scopeId: 'internkontroll',
  label: 'Internkontroll — årlig gjennomgang',
  accent: '#1e40af',
  description:
    'Internkontroll: årlig gjennomgang av HMS-systemet. IK-f § 5 nr. 8 — skriftlig dokumentasjon og oppdatering.',

  events: [
    {
      name: 'internkontroll.ON_ANNUAL_REVIEW_SIGNED',
      label: 'Årsgjennomgang signert',
      description:
        'Daglig leder har signert årets gjennomgang av internkontrollen.',
      lawRefs: ['IK-f § 5 nr. 8'],
      severity: 'info',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        reviewYear: 2026,
        status: 'signed',
        signedAt: '2026-12-15T10:00:00Z',
      },
    },
    {
      name: 'internkontroll.ON_ANNUAL_REVIEW_STARTED',
      label: 'Årsgjennomgang startet (planlagt — fyrer ikke ennå)',
      description:
        'Spec\'d i workflow-engine-review.md men ingen DB-trigger emitter denne enda. Reservert for forward compatibility.',
      lawRefs: ['IK-f § 5 nr. 8'],
      severity: 'info',
    },
  ],

  actions: [],

  conditionFields: [
    { path: 'reviewYear', label: 'År', valueType: 'number' },
    {
      path: 'status',
      label: 'Status',
      valueType: 'enum',
      enumValues: [
        { value: 'draft', label: 'Utkast' },
        { value: 'in_review', label: 'Under vurdering' },
        { value: 'signed', label: 'Signert' },
      ],
    },
  ],

  presets: [],

  lawRefs: [
    {
      ref: 'IK-f § 5 nr. 8',
      framework: 'Internkontrollforskriften',
      coverage:
        'Krav om skriftlig dokumentasjon og årlig gjennomgang av internkontrollen.',
    },
  ],
})
