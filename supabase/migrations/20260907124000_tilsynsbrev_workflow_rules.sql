-- Tilsynsbrev-parser — system workflow rule: triage-oppgave til HMS-leder
-- når et tilsynsbrev lastes opp. Følger samme mønster som de øvrige
-- system-reglene (seed via on conflict do update), så regelen er
-- garantert aktiv også for orgs som ble onboardet før denne migrasjonen.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 18-6 (frister for å rette pålegg —
--   triage skal ikke vente på at parsing er ferdig, derfor en
--   ON_TILSYNSBREV_UPLOADED-regel som kjører umiddelbart); IK-f § 5 nr.
--   7 (sporbar HMS-doku — workflow_runs gir audit-trail på hvem som ble
--   varslet); GDPR Art. 58 (3) c (Datatilsynets kontroller —
--   tilsvarende triage på datatilsynet-saker).
--   Restrisiko deferred: regelen tildeler kun til rolle ''hms_leder'';
--   personvernombud (DPO) for Datatilsynet-saker bør på sikt få egen
--   gren via condition_json på source_type='datatilsynet'.

set local search_path = public, pg_catalog;

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values
(
  'tilsynsbrev-uploaded-triage',
  'AML',
  'Kap. 18 — Tilsyn',
  1810,
  'AML § 18-6 / GDPR Art. 58 — Tilsynsbrev mottatt',
  'Tilsynsbrev mottatt — triage-oppgave til HMS-leder',
  'Når et tilsynsbrev lastes opp (ON_TILSYNSBREV_UPLOADED) opprettes en triage-oppgave til HMS-leder med 3 dagers frist for å gjennomgå automatisk parsing, bekrefte/justere ekstraherte pålegg og delegere videre oppfølging. Regelen kjører før parser er ferdig — payload kan være tom; HMS-leder kan re-kjøre parser fra detalj-siden eller redigere manuelt.',
  'AML § 18-6: pålagt at virksomheten retter forhold påvist av Arbeidstilsynet innen frist. Manglende rask triage er hyppigste årsak til at frister glipper. Tilsvarende for Datatilsynet (GDPR Art. 58 (1) e — vil ofte ha 14d svarfrist) og Helsetilsynet. Triage-oppgaven er ikke selve påleggs-oppfølgningen — den er steg 1 (gjennomgang + tildeling).',
  'tilsynsbrev', 'db_event', 'ON_TILSYNSBREV_UPLOADED', null, 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Tilsynsbrev mottatt — gjennomgang av automatisk parsing","description":"Et nytt tilsynsbrev er lastet opp. Gå til /admin/tilsynsbrev for å se ekstraherte pålegg og frister. Bekreft eller juster parsingen og delegér oppfølgings-oppgaver per pålegg.","assignee":"HMS-leder","ownerRole":"hms_leder","dueInDays":3,"module":"tilsynsbrev","sourceType":"tilsynsbrev-triage","lawRefs":["AML § 18-6","IK-forskriften § 5 nr. 7"]},
    {"type":"send_notification","title":"Tilsynsbrev mottatt","body":"Et tilsynsbrev er lastet opp og venter på gjennomgang. Sjekk Tilsynssaker.","category":"compliance","toRole":"hms_leder"}
  ]'::jsonb,
  ARRAY['AML § 18-6', 'IK-forskriften § 5 nr. 7', 'GDPR Art. 58'],
  ARRAY['aml-amu'],
  'do', null, 'restricted',
  true,
  'Regelen fyrer på selve opplastningen (parsed_status=pending) slik at triage starter umiddelbart. ON_TILSYNSBREV_PARSED fyrer separat når parser er ferdig — eventuelle per-pålegg auto-oppgaver legges på den eventen (default off i v0).'
)

on conflict (slug) do update set
  framework = excluded.framework,
  category = excluded.category,
  category_order = excluded.category_order,
  subcategory = excluded.subcategory,
  name = excluded.name,
  description = excluded.description,
  rationale = excluded.rationale,
  source_module = excluded.source_module,
  trigger_type = excluded.trigger_type,
  trigger_event_name = excluded.trigger_event_name,
  schedule_cron = excluded.schedule_cron,
  trigger_on = excluded.trigger_on,
  condition_json = excluded.condition_json,
  actions_json = excluded.actions_json,
  law_refs = excluded.law_refs,
  frameworks = excluded.frameworks,
  pdca_phase = excluded.pdca_phase,
  applies_if_employee_count_gte = excluded.applies_if_employee_count_gte,
  confidentiality_level = excluded.confidentiality_level,
  enabled = excluded.enabled,
  notes = excluded.notes,
  updated_at = now();
