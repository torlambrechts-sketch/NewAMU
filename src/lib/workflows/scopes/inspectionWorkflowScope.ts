// Inspection workflow scope — legacy inspeksjon-modulen.
//
// The "Gamle moduler" UI was removed (see CLAUDE.md), so this scope file
// lives here under src/lib/workflows/scopes/ rather than under
// src/pages/inspection/. The DB triggers in
// archive/20260618150000_workflow_db_events.sql (lines 305+) still fire
// and dispatch via workflow_dispatch_db_event(org, 'inspection', …), so
// admins must still be able to compose rules against these events in the
// unified builder. Event names match the trigger payloads verbatim.

import { registerWorkflowScope } from '../workflowRegistry'

declare module '../workflowTypes' {
  interface WorkflowEventMap {
    'inspection.round_created': InspectionRoundPayload
    'inspection.round_activated': InspectionRoundPayload
    'inspection.round_signed': InspectionRoundPayload
    'inspection.finding_critical': InspectionFindingPayload
    'inspection.finding_high': InspectionFindingPayload
    'inspection.finding_medium': InspectionFindingPayload
    'inspection.finding_low': InspectionFindingPayload
  }
}

type InspectionRoundPayload = {
  rowId: string
  title: string
  status: 'draft' | 'active' | 'signed'
  category?: string
  location?: string
  signedAt?: string
}

type InspectionFindingPayload = {
  rowId: string
  roundId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category?: string
  location?: string
  title?: string
  description?: string
}

registerWorkflowScope({
  scopeId: 'inspection',
  label: 'Inspeksjon (legacy — DB-trigger)',
  accent: '#7c2d12',
  description:
    'Inspeksjonsrunder og funn. Hendelsene fyres fra DB-triggere på inspection_rounds / inspection_findings (UI er fjernet, men datalaget lever).',

  events: [
    {
      name: 'inspection.round_created',
      label: 'Inspeksjonsrunde opprettet',
      description: 'Ny inspeksjonsrunde registrert (status = draft).',
      lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 6'],
      severity: 'info',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        title: 'Månedlig sikkerhetsrunde',
        status: 'draft',
      },
    },
    {
      name: 'inspection.round_activated',
      label: 'Inspeksjonsrunde aktivert',
      description: 'Runden er gjort tilgjengelig for utførelse i felt.',
      severity: 'info',
    },
    {
      name: 'inspection.round_signed',
      label: 'Inspeksjonsrunde signert',
      description: 'Runden er ferdig utført og signert av ansvarlig.',
      lawRefs: ['IK-f § 5 nr. 7', 'IK-f § 5 nr. 8'],
      severity: 'info',
    },
    {
      name: 'inspection.finding_critical',
      label: 'Kritisk funn ved inspeksjon',
      description: 'Funn-rad registrert med alvorlighet «kritisk». Kandidat for AML § 5-2-melding.',
      lawRefs: ['AML § 5-2', 'AML § 4-1'],
      severity: 'critical',
      samplePayload: {
        rowId: '00000000-0000-0000-0000-000000000000',
        roundId: '00000000-0000-0000-0000-000000000000',
        severity: 'critical',
        category: 'sikkerhet',
        title: 'Fluktvei sperret',
      },
    },
    {
      name: 'inspection.finding_high',
      label: 'Høyt funn ved inspeksjon',
      lawRefs: ['AML § 4-1', 'IK-f § 5 nr. 7'],
      severity: 'high',
    },
    {
      name: 'inspection.finding_medium',
      label: 'Middels funn ved inspeksjon',
      severity: 'medium',
    },
    {
      name: 'inspection.finding_low',
      label: 'Lavt funn ved inspeksjon',
      severity: 'low',
    },
  ],

  // No scope-specific actions; rules compose the standard create_task /
  // send_notification / escalate / gov actions registered by other scopes.
  actions: [],

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
    { path: 'category', label: 'Kategori', valueType: 'string' },
    { path: 'location', label: 'Lokasjon', valueType: 'string' },
    {
      path: 'status',
      label: 'Runde-status',
      valueType: 'enum',
      enumValues: [
        { value: 'draft', label: 'Utkast' },
        { value: 'active', label: 'Aktiv' },
        { value: 'signed', label: 'Signert' },
      ],
    },
  ],

  presets: [],

  lawRefs: [
    {
      ref: 'AML § 5-2',
      framework: 'Arbeidsmiljøloven',
      coverage: 'Meldeplikt til Arbeidstilsynet ved kritisk inspeksjonsfunn med personskade.',
    },
    {
      ref: 'AML § 4-1',
      framework: 'Arbeidsmiljøloven',
      coverage: 'Generelle krav til arbeidsmiljøet — inspeksjoner verifiserer etterlevelse.',
    },
    {
      ref: 'IK-f § 5 nr. 7',
      framework: 'Internkontrollforskriften',
      coverage: 'Overvåking av at iverksatte tiltak virker — inspeksjonsrunder er kjernen.',
    },
  ],
})
