// Gov scope — statlig rapportering.
//
// This scope publishes the five government-reporting *actions* — it does
// not declare its own events. Other scopes' events feed into rules that
// USE these actions. The builder shows them with a regulator badge
// ("⚖️ Statlig melding") and activating a rule containing any of these
// requires the workflows.activate_external permission (enforced by
// trg_workflow_rules_activation_guard in migration _20260905120900).

import { registerWorkflowScope } from '../workflowRegistry'

registerWorkflowScope({
  scopeId: 'gov',
  label: 'Statlig rapportering',
  accent: '#991b1b',
  description:
    'Altinn / Arbeidstilsynet (AML § 5-2) / Datatilsynet (GDPR Art. 33) / NAV / LDO. Rule-aktivering krever workflows.activate_external og dobbel godkjenning.',
  events: [],
  actions: [
    {
      type: 'rapporter_alvorlig_skade_arbeidstilsynet',
      label: 'Rapporter alvorlig skade — Arbeidstilsynet',
      description: 'AML § 5-2: melding ved alvorlig personskade. Frist: 24 timer.',
      category: 'Statlig melding',
      isGovernment: true,
      defaults: () => ({
        type: 'rapporter_alvorlig_skade_arbeidstilsynet',
        melderRolle: 'arbeidsgiver',
        reminderHoursBeforeDeadline: [12, 4, 1],
      }),
      payloadPaths: ['hendelseDato', 'skadetype', 'personskadeKategori'],
    },
    {
      type: 'meld_personvernbrudd_datatilsynet',
      label: 'Meld personvernbrudd — Datatilsynet',
      description: 'GDPR Art. 33 / § 26: melding innen 72 timer fra det øyeblikket bruddet ble kjent.',
      category: 'Statlig melding',
      isGovernment: true,
      defaults: () => ({
        type: 'meld_personvernbrudd_datatilsynet',
        reminderHoursBeforeDeadline: [24, 4, 1],
      }),
      payloadPaths: ['awareAt', 'natureOfBreach', 'affectedCategories'],
    },
    {
      type: 'varsel_ldo_export',
      label: 'LDO — eksporter dokumentasjon (manuell innsending)',
      description: 'Likestillings- og diskrimineringsombudet har ingen API. Genererer signert evidence pack for manuell innsending.',
      category: 'Statlig melding',
      isGovernment: true,
      defaults: () => ({ type: 'varsel_ldo_export', category: 'diskriminering' }),
    },
    {
      type: 'nav_sykefravar_oppfolging',
      label: 'NAV — sykefraværsoppfølging',
      description: 'Sykefraværsoppfølging via Altinn DSOP (dialogmøte 2 ved 8 uker, …).',
      category: 'Statlig melding',
      isGovernment: true,
      defaults: () => ({ type: 'nav_sykefravar_oppfolging', triggerWeek: 8 }),
    },
    {
      type: 'altinn_send_melding',
      label: 'Altinn — send generisk melding',
      description: 'Generisk Altinn 3 envelope (Maskinporten + virksomhetssertifikat).',
      category: 'Statlig melding',
      isGovernment: true,
      defaults: () => ({
        type: 'altinn_send_melding',
        tjeneste: '',
        skjema: '',
        environment: 'tt02',
      }),
      payloadPaths: ['recipientOrgnr', 'bodyJson'],
    },
  ],
  conditionFields: [],
  presets: [
    {
      slug: 'gov.critical_injury_arbeidstilsynet',
      nameI18n: { nb: 'Alvorlig skade → Arbeidstilsynet (AML § 5-2) innen 24t' },
      descriptionI18n: { nb: 'Trigget av kritisk inspeksjonsfunn med personskade. Krever workflows.activate_external + dobbel godkjenning før aktivering.' },
      triggerEvent: 'inspection.finding_critical',
      actions: [
        {
          type: 'request_approval',
          approverRole: 'daglig_leder',
          message: 'Bekreft melding til Arbeidstilsynet (AML § 5-2).',
          escalateAfterHours: 6,
          escalateToRole: 'hms_leder',
        },
        {
          type: 'rapporter_alvorlig_skade_arbeidstilsynet',
          melderRolle: 'arbeidsgiver',
          reminderHoursBeforeDeadline: [12, 4, 1],
        },
      ],
      lawRefs: ['AML § 5-2'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      containsGovAction: true,
      recommendedFor: ['HMS-leder', 'daglig_leder'],
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'gov.gdpr_breach_72h',
      nameI18n: { nb: 'Personvernbrudd → Datatilsynet (GDPR Art. 33) innen 72t' },
      descriptionI18n: { nb: 'Trigget av et registrert personvernbrudd. 72-timers timer starter ved aware_at.' },
      triggerEvent: 'compliance.checklist.response_finding_critical',
      condition: { match: 'array_any', path: 'lawRefs', where: { value: 'GDPR Art. 33' } },
      actions: [
        {
          type: 'request_approval',
          approverRole: 'daglig_leder',
          message: 'Bekreft melding til Datatilsynet (GDPR Art. 33).',
          escalateAfterHours: 12,
          escalateToRole: 'hms_leder',
        },
        {
          type: 'meld_personvernbrudd_datatilsynet',
          reminderHoursBeforeDeadline: [24, 4, 1],
        },
      ],
      lawRefs: ['GDPR Art. 33', 'Personopplysningsloven § 26'],
      frameworks: ['gdpr'],
      pack: 'gdpr',
      containsGovAction: true,
      confidentialityLevel: 'restricted',
      recommendedFor: ['Personvernombud', 'daglig_leder'],
      cadenceHint: 'ad_hoc',
    },
    {
      slug: 'gov.nav_sick_leave_8w',
      nameI18n: { nb: 'Sykefravær 8 uker → NAV dialogmøte 2-forberedelse' },
      triggerEvent: 'compliance.checklist.execution_signed',
      condition: { match: 'field_equals', path: 'templateSlug', value: 'sykefravar-8uker' },
      actions: [
        { type: 'nav_sykefravar_oppfolging', triggerWeek: 8 },
      ],
      lawRefs: ['Folketrygdloven § 25-2', 'AML § 4-6'],
      frameworks: ['aml-amu'],
      pack: 'aml-amu',
      containsGovAction: true,
      confidentialityLevel: 'restricted',
      cadenceHint: 'ad_hoc',
    },
  ],
  lawRefs: [
    { ref: 'AML § 5-2', framework: 'Arbeidsmiljøloven', coverage: 'Meldeplikt til Arbeidstilsynet ved alvorlig skade.' },
    { ref: 'GDPR Art. 33', framework: 'Personvernforordningen', coverage: 'Meldeplikt til Datatilsynet ved personvernbrudd.' },
    { ref: 'AML § 4-6', framework: 'Arbeidsmiljøloven', coverage: 'Tilrettelegging og oppfølging ved sykefravær.' },
  ],
})
