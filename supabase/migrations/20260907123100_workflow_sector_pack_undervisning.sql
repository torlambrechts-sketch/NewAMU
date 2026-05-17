-- Sector pack: undervisning (grunnskole/vgs/SFO + voksenopplæring).
--
-- 5 ikke-valgfrie system-regler + 2 katalog-maler som binder undervisnings-
-- sektor-spesifikke krav til allerede emitterte workflow-event. Ett forward-
-- migration (idempotent). `frameworks=ARRAY['undervisning']` lar gap- og-
-- revisjons-planneren plukke pakken ut i en egen kolonne på matrisen.
--
-- Statsforvalter-/Fylkesmann-/Utdanningsdirektoratet self-audit:
--   Pålegg-grunner addressed: Opplæringsloven § 9 A-4 (skolens aktivitets-
--   plikt + handlingsplan + 5-dagers-frist for tiltak), § 9 A-5 (skjerpet
--   aktivitetsplikt ved involvering av personale), § 9 A-10 (årlig
--   rapportering om elevenes skolemiljø), § 2-1 + forskrift til
--   opplæringsloven § 3-3 (fraværsgrense / fraværsoppfølging).
--   Restrisiko deferred: ingen API mot Statsforvalteren / Udir — § 9A-saker
--   som meldes videre er manuell prosess. Konfidensialitet for varslers
--   identitet (§ 9 A-4 (8)) håndteres via confidentiality_level='confidential'
--   på alle alerts.kind='mobbevarsling'-runs.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values

-- ─── 1. Opplæringsloven § 9 A-4/5 — årlig trivselsundersøkelse ─────────
(
  'undervisning-9a-trivselsundersokelse',
  'Opplæringsloven',
  'Undervisning — Elevenes skolemiljø',
  600,
  'Opplæringsloven § 9 A-4 / § 9 A-5 — Årlig trivselsundersøkelse',
  'Undervisning § 9 A — Årlig elevundersøkelse (1. oktober)',
  'Hvert år 1. oktober 08:00 opprettes oppgave til rektor om å sende ut trivselsundersøkelse (Elevundersøkelsen / lokal § 9 A-undersøkelse) + opprettelse av survey fra mal-slug ''opplaringsloven-9a-trivsel''. Notifikasjon til rektor + skoleeier.',
  'Opplæringsloven § 9 A-4 fjerde ledd: «Skolen skal jobbe kontinuerleg og systematisk for å fremje helsa, miljøet og tryggleiken til elevane …» Den årlege trivselsundersøkinga er den vanligste dokumentasjon-en Statsforvalteren ber om ved § 9 A-tilsyn. Manglende undersøkelse er pålegg-grunn.',
  'meetings', 'schedule', null, '0 8 1 10 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"§ 9 A — send ut årlig trivselsundersøkelse","description":"Opplæringsloven § 9 A-4. Bruk Elevundersøkelsen (Udir) eller lokal § 9 A-undersøkelse. Survey-mal: opplaringsloven-9a-trivsel.","assignee":"Rektor","ownerRole":"rektor","dueInDays":30,"module":"survey","sourceType":"undervisning-§9A-trivsel","lawRefs":["Opplæringsloven § 9 A-4","Opplæringsloven § 9 A-5"]},
    {"type":"send_notification","title":"§ 9 A — undersøkelses-sesong","body":"Årlig elevundersøkelse skal sendes ut i oktober. Forbered Elevundersøkelsen / lokal trivselsundersøkelse.","category":"compliance","toRole":"rektor"}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-4', 'Opplæringsloven § 9 A-5'],
  ARRAY['undervisning'],
  'plan', null, 'standard',
  true,
  'Cron 1. oktober treffer Udir sin Elevundersøkelse-vindu (medio okt — primo des). Survey-mal-slug må eksistere i survey_template_catalog — seedes i en separat content-migration.'
),

-- ─── 2. Opplæringsloven § 9 A-4 — mobbevarsling konfidensiell ──────────
(
  'undervisning-9a-mobbevarsling-konfidensiell',
  'Opplæringsloven',
  'Undervisning — Elevenes skolemiljø',
  601,
  'Opplæringsloven § 9 A-4 / § 9 A-5 — Aktivitetsplikt ved mobbing',
  'Undervisning § 9 A-4 — Mobbevarsling → konfidensiell triage + 5-dagers frist',
  'Alert med kind=''mobbevarsling'' submittes → konfidensiell triage til skolelder + skoleeier (kommune-varslingskomité). 5-dagers frist for skriftlig handlingsplan/tiltak iht. § 9 A-4 sjette ledd.',
  'Opplæringsloven § 9 A-4 sjette ledd: «Skolen skal lage ein skriftleg plan når det skal gjerast tiltak i ein sak.» § 9 A-5 skjerper aktivitetsplikten når personale er involvert (varsling går da direkte til skoleeier). Manglende handlingsplan = brudd på aktivitetsplikten = vedtak fra Statsforvalter.',
  'alerts', 'db_event', 'ON_ALERT_SUBMITTED', null, 'insert',
  '{"match":"field_equals","path":"kind","value":"mobbevarsling"}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] § 9 A-4 — triage mobbevarsling, lag handlingsplan","description":"Opplæringsloven § 9 A-4 sjette ledd: skriftlig handlingsplan kreves. § 9 A-5: varsel skoleeier hvis personale er involvert. 5 dagers frist for tiltak.","assignee":"Rektor","ownerRole":"rektor","dueInDays":5,"module":"alerts","sourceType":"undervisning-§9A-4","lawRefs":["Opplæringsloven § 9 A-4","Opplæringsloven § 9 A-5"]},
    {"type":"send_notification","title":"§ 9 A-4 — varsel mottatt","body":"Mobbe-/skolemiljø-varsel mottatt. Konfidensiell behandling — kun rektor og skoleeier-varslingskomité.","category":"compliance","toRole":"rektor"},
    {"type":"escalate","toRole":"skoleeier","note":"§ 9 A-5: hvis personale involvert skal skoleeier varsles direkte."}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-4', 'Opplæringsloven § 9 A-5'],
  ARRAY['undervisning'],
  'do', null, 'confidential',
  true,
  '5-dagers frist tar utgangspunkt i § 9 A-4 (6): «utan ugrunna opphald». Statsforvalterens praksis er 5 virkedager — strengere intervall enn AML § 2A-7.'
),

-- ─── 3. Forskrift til opplæringsloven § 3-3 — fraværsoppfølging ────────
(
  'undervisning-fravarsoppfolging-folkeregister',
  'Opplæringsloven',
  'Undervisning — Fravær',
  602,
  'Forskrift til opplæringsloven § 3-3 — Fraværsgrense 15 %',
  'Undervisning — Fraværsgrense → faglærer + helsesykepleier',
  'Task opprettet med sourceType=''fravær_15_prosent'' → oppfølgings-oppgave til faglærer + helsesykepleier (10-dagers frist) for samtale + tiltaksplan iht. forskrift § 3-3.',
  'Forskrift til opplæringsloven § 3-3 (fraværsgrensa): elev som passerer 10 % i et fag mister vurdering med mindre dokumentasjon foreligger. Oppfølgings-plikt før det går til 15 %. Opplæringsloven § 2-1 sammenholdt med § 9 A-4: skolen plikter å avdekke årsak (mobbing, helse, hjem). Manglende oppfølging er pålegg-grunn ved Statsforvalter-tilsyn.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"fravær_15_prosent"}'::jsonb,
  '[
    {"type":"create_task","title":"Fraværsoppfølging — samtale + tiltaksplan","description":"Forskrift til opplæringsloven § 3-3 + opplæringsloven § 2-1. Faglærer kaller inn til samtale; vurder § 9 A-4 om mobbing kan være årsak.","assignee":"Faglærer","ownerRole":"faglærer","dueInDays":10,"module":"tasks","sourceType":"undervisning-fravar","lawRefs":["Opplæringsloven § 2-1","Forskrift til opplæringsloven § 3-3"]},
    {"type":"create_task","title":"Helsesykepleier-konsultasjon ved høyt fravær","description":"Vurder helserelaterte årsaker. Konfidensiell behandling iht. helsepersonelloven § 21.","assignee":"Helsesykepleier","ownerRole":"helsesykepleier","dueInDays":14,"module":"tasks","sourceType":"undervisning-helsesykepleier","lawRefs":["Forskrift til opplæringsloven § 3-3"]}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 2-1', 'Forskrift til opplæringsloven § 3-3'],
  ARRAY['undervisning'],
  'do', null, 'restricted',
  true,
  '15 %-flagget settes typisk av skoleadministrativt-system; her bare oppfølgings-leg. 10 %-varsling ligger i samme mønster men håndteres lokalt i SAS — utenfor scope.'
),

-- ─── 4. Opplæringsloven § 9 A-4 — ukentlig handlingsplan-revisjon ──────
(
  'undervisning-9a-handlingsplan-ukentlig',
  'Opplæringsloven',
  'Undervisning — Elevenes skolemiljø',
  603,
  'Opplæringsloven § 9 A-4 sjette ledd — Ukentlig handlingsplan-revisjon',
  'Undervisning § 9 A — Ukentlig sjekk på åpne mobbe-saker',
  'Hver mandag 09:00 sjekkes om åpne alert_cases med kind=''mobbevarsling'' (status ikke ''closed''/''dismissed'') eldre enn 7 dager mangler oppdatert handlingsplan. Hvis ja → eskalering til skoleeier + AMU-agendapost.',
  'Opplæringsloven § 9 A-4 sjette ledd: «Skolen skal lage ein skriftleg plan når det skal gjerast tiltak i ein sak. Planen skal innehalde kva problem som skal løysast, kva tiltak skolen har planlagt, når tiltaka skal gjennomførast, kven som er ansvarleg for gjennomføringa av tiltaka, og når tiltaka skal evaluerast.» Ukentlig kadens er beste praksis fra Udir for å unngå at saker glir.',
  'meetings', 'schedule', null, '0 9 * * 1', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Ukentlig § 9 A — gjennomgang av åpne handlingsplaner","description":"Opplæringsloven § 9 A-4 sjette ledd. Bekreft at alle åpne mobbe-saker har en oppdatert skriftlig handlingsplan med tiltak, ansvarlig, frist + evalueringspunkt.","assignee":"Rektor","ownerRole":"rektor","dueInDays":3,"module":"alerts","sourceType":"undervisning-§9A-ukentlig","lawRefs":["Opplæringsloven § 9 A-4"]},
    {"type":"add_amu_agenda_item","agendaItem":"§ 9 A — handlingsplaner i pågående saker","priority":"høy"}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-4'],
  ARRAY['undervisning'],
  'check', null, 'restricted',
  true,
  'Cron-regel produserer task uavhengig av om det finnes åpne saker — rektor må selv sjekke listen. En post-processor kan senere skipe tasken hvis ingen åpne saker finnes (analysis-job).'
),

-- ─── 5. Opplæringsloven § 9 A-10 — årsrapport elevenes skolemiljø ──────
(
  'undervisning-arsrapport-elevenes-skolemiljo',
  'Opplæringsloven',
  'Undervisning — Elevenes skolemiljø',
  604,
  'Opplæringsloven § 9 A-10 — Årlig rapport om elevenes skolemiljø',
  'Undervisning § 9 A-10 — Årsrapport (15. juni)',
  'Hvert år 15. juni 09:00 (rett etter skoleårsslutt) opprettes oppgave til rektor om årlig rapport om elevenes skolemiljø iht. opplæringsloven § 9 A-10. Rapport skal forelegges skoleeier + foreldreutvalg + elevråd.',
  'Opplæringsloven § 9 A-10: «Skolen skal kvart skuleår skrive ein rapport om elevane sitt skulemiljø.» Statsforvalter ber rutinemessig om denne rapporten — manglende rapport er pålegg-grunn. 15. juni gir 6 uker til årsskifte / nytt skoleår for å fullføre + behandle.',
  'meetings', 'schedule', null, '0 9 15 6 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"§ 9 A-10 — utarbeid årsrapport om elevenes skolemiljø","description":"Opplæringsloven § 9 A-10. Rapporten skal inkludere status, mobbe-saker, handlingsplaner, evaluering av tiltak. Foreleggas skoleeier, FAU og elevråd.","assignee":"Rektor","ownerRole":"rektor","dueInDays":45,"module":"meetings","sourceType":"undervisning-§9A-10","lawRefs":["Opplæringsloven § 9 A-10"]},
    {"type":"add_amu_agenda_item","agendaItem":"§ 9 A-10 årsrapport — gjennomgang","priority":"høy"},
    {"type":"send_notification","title":"§ 9 A-10 årsrapport","body":"Årsrapport om elevenes skolemiljø skal være ferdigstilt før 1. september.","category":"compliance","toRole":"rektor"}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-10'],
  ARRAY['undervisning'],
  'check', null, 'standard',
  true,
  '15. juni er etter Norges-bredt skoleårsslutt; 45 dager gir buffer for inn-/utskriving + behandling før neste skoleår starter.'
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

-- ─── Katalog-maler ──────────────────────────────────────────────────────

insert into public.workflow_rule_catalog (
  slug, scope_id, name_i18n, description_i18n,
  source_module, trigger_type, trigger_event_name, trigger_on,
  condition_json, actions_json,
  law_refs, frameworks, pack, cadence_hint, recommended_for,
  confidentiality_level, contains_gov_action, catalog_version, is_published
) values
(
  'undervisning.9a_handlingsplan_template',
  'alerts',
  '{"nb":"§ 9 A — handlingsplan-mal til mobbevarsel","en":"§ 9 A — action plan template for bullying report"}'::jsonb,
  '{"nb":"Når mobbevarsel mottas → konfidensiell oppgave til rektor med handlingsplan-mal forhåndsutfyllt iht. § 9 A-4 sjette ledd."}'::jsonb,
  'alerts', 'db_event', 'ON_ALERT_SUBMITTED', 'insert',
  '{"match":"field_equals","path":"kind","value":"mobbevarsling"}'::jsonb,
  '[
    {"type":"create_task","title":"§ 9 A handlingsplan — fyll inn problem/tiltak/ansvar/frist","assignee":"Rektor","ownerRole":"rektor","dueInDays":5,"module":"alerts","sourceType":"undervisning-§9A-handlingsplan","lawRefs":["Opplæringsloven § 9 A-4"]}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-4'],
  ARRAY['undervisning'], 'undervisning', 'ad_hoc',
  ARRAY['Rektor','Skoleeier'],
  'confidential', false, 1, true
),
(
  'undervisning.skolestart_hms_runde',
  'inspection',
  '{"nb":"Skolestart — § 9 A vernerunde","en":"School start — § 9 A safety round"}'::jsonb,
  '{"nb":"15. august hvert år: vernerunde med fokus på elevenes fysiske + psykososiale skolemiljø før første skoledag."}'::jsonb,
  'inspection', 'schedule', null, 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Skolestart-vernerunde — § 9 A fokus","assignee":"Verneombud","ownerRole":"verneombud","dueInDays":7,"module":"inspection","sourceType":"undervisning-skolestart","lawRefs":["Opplæringsloven § 9 A-2"]}
  ]'::jsonb,
  ARRAY['Opplæringsloven § 9 A-2','AML § 4-1'],
  ARRAY['undervisning'], 'undervisning', 'arlig',
  ARRAY['Verneombud','Rektor'],
  'standard', false, 1, true
)

on conflict (slug) do update set
  scope_id              = excluded.scope_id,
  name_i18n             = excluded.name_i18n,
  description_i18n      = excluded.description_i18n,
  source_module         = excluded.source_module,
  trigger_type          = excluded.trigger_type,
  trigger_event_name    = excluded.trigger_event_name,
  trigger_on            = excluded.trigger_on,
  condition_json        = excluded.condition_json,
  actions_json          = excluded.actions_json,
  law_refs              = excluded.law_refs,
  frameworks            = excluded.frameworks,
  pack                  = excluded.pack,
  cadence_hint          = excluded.cadence_hint,
  recommended_for       = excluded.recommended_for,
  confidentiality_level = excluded.confidentiality_level,
  contains_gov_action   = excluded.contains_gov_action,
  catalog_version       = excluded.catalog_version,
  is_published          = excluded.is_published,
  updated_at            = now();
