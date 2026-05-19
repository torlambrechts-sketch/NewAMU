// Storybook proxy for the Endringslogg engine — P1 exit gate.
//
// Renders the six sample events from specs/endringslogg-spec.md §7
// in the production EntityTimeline so we can verify every diff variant
// + chip + actor swatch + a11y bar without needing a real DB connection.
// Hosted under /platform-admin/endringslogg-demo (admin-only via the
// existing PlatformAdminLayout gate).

import type { AuditEvent } from '../../lib/audit/diffShape'
import { EntityTimeline } from '../../components/audit/EntityTimeline'

const SAMPLE_EVENTS: AuditEvent[] = [
  {
    id: 'evt_01',
    occurred_at: '2026-05-19T14:32:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: 'usr_kn',
      name: 'Kari Nordmann',
      initials: 'KN',
      role: 'verneombud',
      is_external: false,
    },
    action: 'lukket',
    location: 'Avdeling Oslo / Lager 2',
    summary_nb: 'Kari Nordmann lukket sjekkpunktet',
    diff: {
      kind: 'single_field',
      field_label_nb: 'Status',
      before: { display: 'I arbeid', semantic: 'status' },
      after: { display: 'Lukket', semantic: 'status' },
    },
    privileged: false,
  },
  {
    id: 'evt_02',
    occurred_at: '2026-05-19T11:08:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: 'usr_po',
      name: 'Per Olsen',
      initials: 'PO',
      role: 'leder',
      is_external: false,
    },
    action: 'omfordelt',
    location: null,
    summary_nb: 'Per Olsen omfordelte oppgaven til Lise Hansen',
    diff: {
      kind: 'multi_field',
      changes: [
        {
          field_label_nb: 'Tildelt',
          before: { display: 'Tor Andersen', semantic: 'user' },
          after: { display: 'Lise Hansen', semantic: 'user' },
        },
        {
          field_label_nb: 'Frist',
          before: { display: '15. mai 2026', semantic: 'date', raw: '2026-05-15' },
          after: { display: '22. mai 2026', semantic: 'date', raw: '2026-05-22' },
        },
      ],
    },
    privileged: false,
  },
  {
    id: 'evt_03',
    occurred_at: '2026-05-18T16:45:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: null,
      name: 'Årshjul-runner',
      initials: 'ÅR',
      role: 'system',
      is_external: false,
    },
    action: 'eskalert',
    location: null,
    summary_nb: 'Årshjul-runner eskalerte saken til AMU-leder etter 14 dager uten handling',
    diff: null,
    privileged: false,
  },
  {
    id: 'evt_04',
    occurred_at: '2026-05-17T09:12:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: 'usr_lh',
      name: 'Lise Hansen',
      initials: 'LH',
      role: 'hms_radgiver',
      is_external: false,
    },
    action: 'endret',
    location: null,
    summary_nb: 'Lise Hansen oppdaterte beskrivelsen av tiltaket',
    diff: {
      kind: 'text_block',
      field_label_nb: 'Tiltak',
      before: 'Vindu på lageret må byttes. Verneombud varsler driftsleder.',
      after:
        'Vindu på lageret må byttes innen utgangen av mai. ' +
        'Verneombud varsler driftsleder, og HMS-rådgiver bekrefter ' +
        'utskifting før AMU-møtet 5. juni.',
    },
    privileged: false,
  },
  {
    id: 'evt_05',
    occurred_at: '2026-05-15T13:20:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: 'tkn_at_2026_05_12',
      name: 'Arbeidstilsynet (ekstern)',
      initials: 'AT',
      role: 'ekstern',
      is_external: true,
      external_label: 'Tilsyn 2026-05-12',
    },
    action: 'eksportert',
    location: null,
    summary_nb: 'Arbeidstilsynet lastet ned bevisbunten via tilsynslenke',
    diff: null,
    privileged: false,
  },
  {
    id: 'evt_06',
    occurred_at: '2026-05-12T10:00:00+02:00',
    scope_id: 'compliance_checklist',
    entity_kind: 'compliance_checklist_execution',
    entity_id: 'vrf_42',
    actor: {
      id: 'usr_kn',
      name: 'Kari Nordmann',
      initials: 'KN',
      role: 'verneombud',
      is_external: false,
    },
    action: 'opprettet',
    location: 'Avdeling Oslo / Lager 2',
    summary_nb: 'Kari Nordmann registrerte et nytt funn på vernerunden',
    diff: {
      kind: 'multi_field',
      changes: [
        {
          field_label_nb: 'Alvorlighet',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after: { display: 'Middels', semantic: 'severity' },
        },
        {
          field_label_nb: 'Status',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after: { display: 'Åpen', semantic: 'status' },
        },
        {
          field_label_nb: 'Beskrivelse',
          before: { display: '(ingen verdi)', semantic: 'plain' },
          after: { display: 'Sprukket vindu i lagerets nord-vegg', semantic: 'plain' },
        },
      ],
    },
    privileged: false,
  },
]

export function PlatformEndringsloggDemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Endringslogg — demo</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Storybook-proxy for engine + diff-renderere. Rendrer de seks
          eksempelhendelsene fra <code>specs/endringslogg-spec.md §7</code> i
          den faktiske <code>&lt;EntityTimeline /&gt;</code>. Brukes som
          P1-exitgate før vi kobler på live mutasjoner.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-neutral-700">
            Eksempel: sjekkliste-utførelse <code>vrf_42</code>
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Innholdet i hovedflaten er ikke relevant — fokus er panelet til
            høyre. Klikk på en rad for å åpne diff-visningen.
          </p>
        </section>
        <EntityTimeline events={SAMPLE_EVENTS} />
      </div>
    </div>
  )
}
