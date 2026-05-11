-- Meetings — ISO + GDPR template completeness (H3).
--
-- Why
--   Supervisor review identified missing mandatory inputs in the ISO
--   management-review templates and the GDPR DPIA/ROPA templates. This
--   migration adds them so a customer using these templates would meet
--   the certification audit baseline by replacing only their company
--   name. Idempotent additive UPDATEs.
--
-- Scope
--   ISO 9001:2015 § 9.3.2 — add missing c.3, c.4, c.5, c.7, e
--   ISO 45001:2018 § 9.3 — add missing d.1, d.2, d.3, d.4, f
--   ISO 14001:2015 § 9.3 — add missing audits, monitoring,
--                          communications, improvements
--   GDPR DPIA (Art. 35) — add Art. 35 (2), (8), (9)
--   GDPR ROPA (Art. 30) — add Art. 30 (1) f, Art. 26, Art. 32
--
-- Out-of-scope (gated per H0 §10)
--   ISO/IEC 27001:2022 § 9.3.2 sub-letter relabels — paywalled
--   standard, training-knowledge only. Will ship in a follow-up H3b
--   once a reviewer confirms the 2022 clause structure.
--
-- Strategy
--   Idempotent INSERT-via-concat with `jsonb_path_exists` guards on
--   the agendaItems' key. New defaultPosition values use gaps between
--   existing positions so the sort order stays predictable without
--   renumbering existing items.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. ISO 9001:2015 § 9.3.2 — add missing c.3, c.4, c.5, c.7, e             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- c.3 process performance and conformity of products/services
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'process_performance',
          'title', 'Prosessytelse og produktkonformitet',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.3',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "process_performance")');

-- c.4 nonconformities and corrective actions
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'nonconformities',
          'title', 'Avvik og korrigerende tiltak',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.4',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "nonconformities")');

-- c.5 monitoring and measurement results
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'monitoring_measurement',
          'title', 'Overvåkings- og måleresultater',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.5',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "monitoring_measurement")');

-- c.7 performance of external providers (suppliers)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'external_providers',
          'title', 'Eksterne leverandørers ytelse',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.7',
          'defaultPosition', 65
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "external_providers")');

-- e effectiveness of actions to address risks and opportunities
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'risk_opportunity_actions',
          'title', 'Effektiviteten av tiltak mot risiko og muligheter (§ 6.1)',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 e',
          'defaultPosition', 75
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "risk_opportunity_actions")');

-- Refresh law_refs[]
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 9001:2015 § 9.3.2 c.3',
      'ISO 9001:2015 § 9.3.2 c.4',
      'ISO 9001:2015 § 9.3.2 c.5',
      'ISO 9001:2015 § 9.3.2 c.7',
      'ISO 9001:2015 § 9.3.2 e'
    ])),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not ('ISO 9001:2015 § 9.3.2 c.4' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. ISO 45001:2018 § 9.3 — add d.1, d.2, d.3, d.4, f                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- d.1 incidents and corrective actions
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_incidents',
          'title', 'Hendelser og avvik — HMS-ytelse',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.1',
          'defaultPosition', 42
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_incidents")');

-- d.2 monitoring and measurement
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_monitoring',
          'title', 'Overvåking og målinger',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.2',
          'defaultPosition', 44
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_monitoring")');

-- d.3 evaluation of compliance with legal requirements
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_compliance_eval',
          'title', 'Evaluering av etterlevelse mot lovkrav',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.3',
          'defaultPosition', 46
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_compliance_eval")');

-- d.4 audit results
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_audit_results',
          'title', 'Revisjonsresultater',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.4',
          'defaultPosition', 48
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_audit_results")');

-- f relevant communications with interested parties
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_communications',
          'title', 'Relevant kommunikasjon med interessenter',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 f',
          'defaultPosition', 72
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_communications")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 45001:2018 § 9.3 d.1',
      'ISO 45001:2018 § 9.3 d.2',
      'ISO 45001:2018 § 9.3 d.3',
      'ISO 45001:2018 § 9.3 d.4',
      'ISO 45001:2018 § 9.3 f'
    ])),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not ('ISO 45001:2018 § 9.3 d.1' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. ISO 14001:2015 § 9.3 — add audits, monitoring, communications,        │
-- │                            improvements                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_audits',
          'title', 'Revisjonsresultater',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 d',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_audits")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_monitoring',
          'title', 'Overvåking og målinger — miljø',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 d',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_monitoring")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_communications',
          'title', 'Relevant kommunikasjon med interessenter, inkl. klager',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 f',
          'defaultPosition', 65
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_communications")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_improvement',
          'title', 'Forbedringsmuligheter',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 g',
          'defaultPosition', 80
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_improvement")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 14001:2015 § 9.3 d',
      'ISO 14001:2015 § 9.3 f',
      'ISO 14001:2015 § 9.3 g'
    ])),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not ('ISO 14001:2015 § 9.3 d' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. GDPR DPIA — add Art. 35 (2), (8), (9)                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Art. 35 (2) — DPO involvement as agenda item (currently only checklist)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'dpo_advice',
          'title', 'Personvernombudets råd — gjennomgang og bekreftelse',
          'description', 'Bekreft og protokollfør DPOs vurdering. GDPR Art. 35 (2) krever at DPO blir konsultert ved DPIA.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 35 (2)',
          'defaultPosition', 15
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "dpo_advice")');

-- Art. 35 (9) — views of data subjects sought "where appropriate"
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'data_subject_views',
          'title', 'Synspunkter fra de registrerte (der det er hensiktsmessig)',
          'description', 'GDPR Art. 35 (9) — innhent og dokumenter synspunkter fra registrerte eller deres representanter.',
          'isMandatory', false,
          'lawRef', 'GDPR Art. 35 (9)',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "data_subject_views")');

-- Art. 35 (8) — code of conduct compliance review (where applicable)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'code_of_conduct',
          'title', 'Etterlevelse av godkjente atferdsnormer (Art. 40)',
          'description', 'GDPR Art. 35 (8) — der virksomheten har sluttet seg til en godkjent atferdsnorm, skal etterlevelse vurderes.',
          'isMandatory', false,
          'lawRef', 'GDPR Art. 35 (8)',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "code_of_conduct")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'GDPR Art. 35 (2)',
      'GDPR Art. 35 (8)',
      'GDPR Art. 35 (9)'
    ])),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not ('GDPR Art. 35 (2)' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. GDPR ROPA — add Art. 30 (1) f, Art. 26, Art. 32                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Art. 30 (1) f — categories of personal data
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'data_categories',
          'title', 'Personopplysningskategorier — oversikt og endringer',
          'description', 'GDPR Art. 30 (1) f — listen over kategorier registrerte og personopplysninger som behandles.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 30 (1) f',
          'defaultPosition', 15
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "data_categories")');

-- Art. 26 — joint controllers
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'joint_controllers',
          'title', 'Felles behandlingsansvarlige — avtaler og oversikt (Art. 26)',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 26',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "joint_controllers")');

-- Art. 32 — security measures review (cross-ref from ROPA)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'security_measures',
          'title', 'Tekniske og organisatoriske sikkerhetstiltak (Art. 32)',
          'description', 'GDPR Art. 30 (1) g + Art. 32 — generell beskrivelse av sikkerhetstiltak, samt vurdering av effektivitet.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 32',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "security_measures")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'GDPR Art. 26',
      'GDPR Art. 30 (1) f',
      'GDPR Art. 32'
    ])),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not ('GDPR Art. 32' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Verification queries (run by hand)                                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: 14 agendaItems (was 9, +5 new) for ISO 9001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-9001-ledelsens-gjennomgang';

-- expected: 13 agendaItems (was 8, +5 new) for ISO 45001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-45001-ledelsens-gjennomgang';

-- expected: 11 agendaItems (was 7, +4 new) for ISO 14001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-14001-miljogjennomgang';

-- expected: 9 agendaItems (was 6, +3 new) for GDPR DPIA
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'gdpr-dpia-gjennomgang';

-- expected: 9 agendaItems (was 6, +3 new) for GDPR ROPA
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'gdpr-ropa-arsgjennomgang';
