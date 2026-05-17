// Vernerunder workflow scope — vernerunde-modulen.
//
// "Gamle moduler" UI is gone; this scope file lives in
// src/lib/workflows/scopes/ as a homeless registration. The DB triggers
// in archive/20260730120200_vernerunder_workflow_db_triggers.sql still
// emit ON_VERNERUNDE_PLANNED, ON_VERNERUNDE_COMPLETED and
// ON_FINDING_REGISTERED via workflow_dispatch_db_event(org,
// 'vernerunder', …). The three planned-but-unemitted events
// (ON_VERNERUNDE_CREATED, ON_VERNERUNDE_STATUS_CHANGED,
// ON_FINDING_UPDATED) per specs/workflow-engine-review.md §1 are
// declared with an unstable marker in the label so admins know they
// don't fire yet.

import { registerWorkflowScope } from '../workflowRegistry'

declare module '../workflowTypes' {
  interface WorkflowEventMap {
    'vernerunder.ON_VERNERUNDE_PLANNED': VernerundePayload
    'vernerunder.ON_VERNERUNDE_COMPLETED': VernerundePayload
    'vernerunder.ON_FINDING_REGISTERED': VernerundeFindingPayload
    // Spec'd but currently unemitted — declared for forward compatibility.
    'vernerunder.ON_VERNERUNDE_CREATED': VernerundePayload
    'vernerunder.ON_VERNERUNDE_STATUS_CHANGED': VernerundeStatusPayload
    'vernerunder.ON_FINDING_UPDATED': VernerundeFindingPayload
  }
}

type VernerundePayload = {
  rowId: string
  title: string
  status: 'planned' | 'in_progress' | 'completed' | 'archived'
  plannedFor?: string
  completedAt?: string
  ownerUserId?: string
  area?: string
}

type VernerundeStatusPayload = VernerundePayload & {
  previousStatus: string
  newStatus: string
}

type VernerundeFindingPayload = {
  rowId: string
  vernerundeId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  area?: string
  title?: string
  description?: string
}

registerWorkflowScope({
  scopeId: 'vernerunder',
  label: 'Vernerunder',
  accent: '#15803d',
  description:
    'Vernerunder: planlegging, gjennomføring og funn. AML § 6-2 — verneombudets befaring.',

  events: [
    {
      name: 'vernerunder.ON_VERNERUNDE_PLANNED',
      label: 'Vernerunde planlagt',
      description: 'Vernerunde lagt inn i kalenderen med planlagt dato.',
      lawRefs: ['AML § 6-2'],
      severity: 'info',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        title: 'Kvartalsvis vernerunde — kontor',
        status: 'planned',
        plannedFor: '2026-06-01',
      },
    },
    {
      name: 'vernerunder.ON_VERNERUNDE_COMPLETED',
      label: 'Vernerunde fullført',
      description: 'Vernerunden er signert og avsluttet av verneombud.',
      lawRefs: ['AML § 6-2', 'IK-f § 5 nr. 7'],
      severity: 'info',
    },
    {
      name: 'vernerunder.ON_FINDING_REGISTERED',
      label: 'Funn registrert ved vernerunde',
      description: 'Verneombud / utfører har registrert et funn under runden.',
      lawRefs: ['AML § 6-2', 'AML § 4-1'],
      severity: 'high',
    },
    {
      name: 'vernerunder.ON_VERNERUNDE_CREATED',
      label: 'Vernerunde opprettet (planlagt — fyrer ikke ennå)',
      description:
        'Spec\'d i workflow-engine-review.md §1 men ingen DB-trigger emitter denne enda. Reservert for forward compatibility.',
      severity: 'info',
    },
    {
      name: 'vernerunder.ON_VERNERUNDE_STATUS_CHANGED',
      label: 'Vernerunde — status endret (planlagt — fyrer ikke ennå)',
      description: 'Spec\'d men ikke emittert ennå. Reservert.',
      severity: 'info',
    },
    {
      name: 'vernerunder.ON_FINDING_UPDATED',
      label: 'Vernerunde-funn oppdatert (planlagt — fyrer ikke ennå)',
      description: 'Spec\'d men ikke emittert ennå. Reservert.',
      severity: 'low',
    },
  ],

  actions: [],

  conditionFields: [
    {
      path: 'severity',
      label: 'Alvorlighet (funn)',
      valueType: 'enum',
      enumValues: [
        { value: 'critical', label: 'Kritisk' },
        { value: 'high', label: 'Høy' },
        { value: 'medium', label: 'Middels' },
        { value: 'low', label: 'Lav' },
      ],
    },
    { path: 'area', label: 'Område / lokasjon', valueType: 'string' },
    {
      path: 'status',
      label: 'Vernerunde-status',
      valueType: 'enum',
      enumValues: [
        { value: 'planned', label: 'Planlagt' },
        { value: 'in_progress', label: 'Pågår' },
        { value: 'completed', label: 'Fullført' },
        { value: 'archived', label: 'Arkivert' },
      ],
    },
  ],

  presets: [],

  lawRefs: [
    {
      ref: 'AML § 6-2',
      framework: 'Arbeidsmiljøloven',
      coverage: 'Verneombudets oppgaver — vernerunder er hovedaktiviteten.',
    },
    {
      ref: 'IK-f § 5 nr. 7',
      framework: 'Internkontrollforskriften',
      coverage: 'Overvåking — vernerunden verifiserer at tiltak virker.',
    },
  ],
})
