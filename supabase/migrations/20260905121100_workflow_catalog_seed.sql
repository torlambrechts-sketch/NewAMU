-- Seed workflow_rule_catalog with audit-ready predefined library.
--
-- Phase B's first content payload. The presets in each
-- src/pages/<scope>/workflows/<scope>WorkflowScope.ts file ship the
-- canonical templates as code; this migration ships the same shape as
-- DB rows so the LibraryPanel and provision_workflows_baseline_for_org
-- both find something to work with on a fresh database.
--
-- Conventions per CLAUDE.md template-surface:
--   * on conflict (slug) do update set … so reseeds patch rather than
--     duplicate.
--   * law_refs use exact citation format ('AML § 5-2', 'GDPR Art. 33').
--   * pack labels match the existing compliance pack values
--     ('aml-amu', 'iso-45001', 'gdpr').
--   * contains_gov_action flagged where any action invokes a regulator;
--     activation guard from _20260905120900 then enforces the
--     workflows.activate_external permission.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 — pålagt internkontroll må være
--   dokumentert og iverksatt fra dag én. IK-f § 5 nr. 7 — overvåking +
--   nr. 8 — gjennomgang. GDPR Art. 33 — meldeplikt ved personvernbrudd.
--   AML § 5-2 — meldeplikt til Arbeidstilsynet ved alvorlig skade.
--   Restrisiko deferred: sektorspesifikke maler (helse, transport,
--   bygg) — kommer i sprint-spesifikke pakker når sektor-overlay'ene
--   modnes.

insert into public.workflow_rule_catalog (
  slug, scope_id, name_i18n, description_i18n,
  source_module, trigger_type, trigger_event_name, trigger_on,
  condition_json, actions_json,
  law_refs, frameworks, pack, cadence_hint, recommended_for,
  confidentiality_level, contains_gov_action, catalog_version, is_published
) values

-- ─── Compliance / Sjekklister ───────────────────────────────────────────────
(
  'compliance.critical_finding_to_amu',
  'compliance_checklist',
  '{"nb":"Kritisk funn → AMU-sak","en":"Critical finding → AMU agenda"}'::jsonb,
  '{"nb":"Ved kritisk funn opprettes oppgave til HMS-leder, ROS-utkast og AMU-sak; vurderer Arbeidstilsynet-melding manuelt."}'::jsonb,
  'compliance_checklist', 'db_event', 'response_finding_critical', 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Vurder kritisk funn — eskalering","description":"HMS-leder vurderer om funnet krever melding til Arbeidstilsynet (AML § 5-2).","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":1,"module":"compliance","sourceType":"compliance_checklist_finding"},
    {"type":"create_ros_draft","template":"standard 5×5","linkSource":true},
    {"type":"add_amu_agenda_item","agendaItem":"Kritisk funn — oppfølging og tiltak","priority":"høy"}
  ]'::jsonb,
  ARRAY['AML § 3-1','AML § 4-1','IK-f § 5 nr. 7'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder','verneombud'],
  'standard', false, 1, true
),
(
  'compliance.checklist_overdue_escalation',
  'compliance_checklist',
  '{"nb":"Sjekklist forfalt → påminnelse + eskalering"}'::jsonb,
  '{"nb":"Sjekklist som skulle vært utført er forsinket — påminnelse, så eskalering til HMS-leder etter 7 dager."}'::jsonb,
  'compliance_checklist', 'db_event', 'execution_overdue', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"send_notification","title":"Sjekklist forfalt","body":"Vennligst utfør sjekklisten {{event.templateSlug}} så snart som mulig.","category":"compliance"},
    {"type":"wait_until","delay":{"amount":7,"unit":"days"}},
    {"type":"create_task","title":"Eskalering: sjekklist fortsatt ikke utført","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":3,"module":"compliance"}
  ]'::jsonb,
  ARRAY['IK-f § 5 nr. 6','IK-f § 5 nr. 7'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),
(
  'compliance.signed_archive',
  'compliance_checklist',
  '{"nb":"Sjekklist signert → arkivering + logg"}'::jsonb,
  '{"nb":"Når en sjekkliste er signert logges hendelsen for senere tilsynsdokumentasjon."}'::jsonb,
  'compliance_checklist', 'db_event', 'execution_signed', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"Sjekklist signert; arkivering håndtert av modul."}]'::jsonb,
  ARRAY['IK-f § 5 nr. 8'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Survey ─────────────────────────────────────────────────────────────────
(
  'survey.amu_election_followup',
  'survey',
  '{"nb":"AMU-valg avsluttet → påminnelse om neste valg (12 mnd)"}'::jsonb,
  '{"nb":"50 uker etter AMU-valget lukkes opprettes oppgave til HMS-leder for å forberede neste valg."}'::jsonb,
  'survey', 'db_event', 'ON_SURVEY_CLOSED', 'both',
  '{"match":"field_equals","path":"surveySlug","value":"amu-valg"}'::jsonb,
  '[
    {"type":"wait_until","delay":{"amount":50,"unit":"weeks"}},
    {"type":"create_task","title":"Forbered neste AMU-valg","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":14,"module":"survey","sourceType":"survey_response"}
  ]'::jsonb,
  ARRAY['AML § 6-1','AML § 7-2'],
  ARRAY['aml-amu'], 'aml-amu', 'arlig',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),
(
  'survey.whistleblower_response',
  'survey',
  '{"nb":"Varslersak → konfidensiell triage"}'::jsonb,
  '{"nb":"Anonyme svar til varslingsutvalget håndteres konfidensielt (AML § 2A-7 (5))."}'::jsonb,
  'survey', 'db_event', 'ON_SURVEY_RESPONSE_SUBMITTED', 'insert',
  '{"match":"and","conditions":[{"match":"field_equals","path":"surveySlug","value":"varslingsutvalg"},{"match":"field_equals","path":"isAnonymous","value":"true"}]}'::jsonb,
  '[{"type":"create_task","title":"Triage varslersak","assignee":"Varslingsmottak","ownerRole":"HMS","dueInDays":1,"module":"survey","sourceType":"survey_response"}]'::jsonb,
  ARRAY['AML § 2A-7 (5)'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['Varslingsmottak'],
  'confidential', false, 1, true
),

-- ─── Tasks ──────────────────────────────────────────────────────────────────
(
  'tasks.critical_overdue_escalation',
  'tasks',
  '{"nb":"Kritisk oppgave forsinket → eskalering til leder"}'::jsonb,
  '{"nb":"Eskalerer kritisk oppgave til daglig leder ved forfall."}'::jsonb,
  'tasks', 'db_event', 'ON_TASK_OVERDUE_MARKED', 'both',
  '{"match":"field_equals","path":"priority","value":"critical"}'::jsonb,
  '[
    {"type":"escalate","toRole":"daglig_leder","note":"Kritisk oppgave overskredet frist."},
    {"type":"send_notification","title":"Kritisk oppgave forsinket","body":"Oppgave er forfalt.","category":"tasks"}
  ]'::jsonb,
  ARRAY['IK-f § 5 nr. 7'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Documents ──────────────────────────────────────────────────────────────
(
  'documents.published_requires_signature',
  'documents',
  '{"nb":"Nytt dokument publisert → kvittering + påminnelse"}'::jsonb,
  '{"nb":"Ber om signatur, sender påminnelse etter 7 dager før 14-dagers frist."}'::jsonb,
  'documents', 'db_event', 'ON_DOCUMENT_PUBLISHED', 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"request_signature","document":"{{event.documentSlug}}","deadlineDays":14},
    {"type":"wait_until","delay":{"amount":7,"unit":"days"}},
    {"type":"send_notification","title":"Påminnelse: les og kvitter","body":"Det er 7 dager igjen til frist.","category":"documents"}
  ]'::jsonb,
  ARRAY['AML § 3-1','IK-f § 5 nr. 1'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['Personalleder'],
  'standard', false, 1, true
),
(
  'documents.revision_overdue_escalation',
  'documents',
  '{"nb":"Revisjon forfalt → eskalering"}'::jsonb,
  '{"nb":"Når en dokumentrevisjon er forfalt opprettes oppgave + eskalering."}'::jsonb,
  'documents', 'db_event', 'ON_DOCUMENT_REVISION_OVERDUE', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Dokumentrevisjon forfalt","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":7,"module":"documents","sourceType":"document"},
    {"type":"escalate","toRole":"daglig_leder","note":"Revisjon ikke gjennomført på tid."}
  ]'::jsonb,
  ARRAY['IK-f § 5 nr. 8'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),
(
  'documents.dpia_triggered',
  'documents',
  '{"nb":"DPIA påkrevd → opprett Datatilsynet-vurdering"}'::jsonb,
  '{"nb":"Dokumenter med GDPR Art. 35 i legal_basis utløser DPIA-oppgave til personvernombud."}'::jsonb,
  'documents', 'db_event', 'ON_DOCUMENT_PUBLISHED', 'insert',
  '{"match":"array_any","path":"legalBasis","where":{"value":"GDPR Art. 35"}}'::jsonb,
  '[{"type":"create_task","title":"DPIA-vurdering","assignee":"Personvernombud","ownerRole":"GDPR","dueInDays":10,"module":"documents","sourceType":"dpia"}]'::jsonb,
  ARRAY['GDPR Art. 35'],
  ARRAY['gdpr'], 'gdpr', 'ad_hoc',
  ARRAY['Personvernombud'],
  'restricted', false, 1, true
),

-- ─── Meetings ───────────────────────────────────────────────────────────────
(
  'meetings.decision_to_tasks',
  'meetings',
  '{"nb":"AMU-vedtak → oppgaver til ansvarlige"}'::jsonb,
  '{"nb":"Hvert vedtak fra AMU/AMU-årsmøte materialiserer seg som oppgave til ansvarlig."}'::jsonb,
  'meetings', 'db_event', 'ON_MEETING_DECISION_LOGGED', 'insert',
  '{"match":"always"}'::jsonb,
  '[{"type":"create_task","title":"Følge opp vedtak","assignee":"{{event.ownerUserId}}","ownerRole":"AMU","dueInDays":30,"module":"meetings","sourceType":"amu_decision"}]'::jsonb,
  ARRAY['AML § 7-2','IK-f § 5 nr. 8'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['AMU-leder'],
  'standard', false, 1, true
),
(
  'meetings.annual_review_certificate',
  'meetings',
  '{"nb":"Årsgjennomgang signert → kompetansebevis"}'::jsonb,
  '{"nb":"AMU-årsmøte signert utløser generering av årsbevis."}'::jsonb,
  'meetings', 'db_event', 'ON_MEETING_SIGNED', 'both',
  '{"match":"field_equals","path":"meetingType","value":"amu-arsmote"}'::jsonb,
  '[{"type":"create_task","title":"Generer årsbevis for HMS","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":5,"module":"meetings","sourceType":"amu_arsmote"}]'::jsonb,
  ARRAY['AML § 7-2','IK-f § 5 nr. 8'],
  ARRAY['aml-amu'], 'aml-amu', 'arlig',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Learning ───────────────────────────────────────────────────────────────
(
  'learning.course_completed_log',
  'learning',
  '{"nb":"Kurs fullført → kompetansebevis logget"}'::jsonb,
  '{"nb":"Loggfører at sertifikatet er utstedt; videre logikk håndteres av learning-modulen."}'::jsonb,
  'learning', 'db_event', 'ON_COURSE_COMPLETED', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"Sertifikat utstedes av modul."}]'::jsonb,
  ARRAY['AML § 3-2','IK-f § 5 nr. 2'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),
(
  'learning.certificate_expiring_60d',
  'learning',
  '{"nb":"Sertifikat utløper om 60 dager → re-tildeling"}'::jsonb,
  '{"nb":"Oppretter oppgave til kursdeltaker når sertifikatet nærmer seg utløp."}'::jsonb,
  'learning', 'db_event', 'ON_CERTIFICATE_ISSUED', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"create_task","title":"Re-tildel kurs","assignee":"{{event.userId}}","ownerRole":"HMS","dueInDays":60,"module":"learning","sourceType":"certificate_expiry"}]'::jsonb,
  ARRAY['AML § 3-2','IK-f § 5 nr. 2'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Registers ──────────────────────────────────────────────────────────────
(
  'registers.new_regulation_owner_task',
  'registers',
  '{"nb":"Nytt regulatorisk krav → oppgave til ansvarlig"}'::jsonb,
  '{"nb":"Ny lovkrav-rad i registeret utløser oppgave til HMS-leder med 14-dagers frist."}'::jsonb,
  'registers', 'db_event', 'ON_REGISTER_RECORD_CREATED', 'insert',
  '{"match":"field_equals","path":"registerType","value":"lovkrav"}'::jsonb,
  '[{"type":"create_task","title":"Avklar tiltak for nytt lovkrav","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":14,"module":"registers","sourceType":"regulation"}]'::jsonb,
  ARRAY['IK-f § 5 nr. 1'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),
(
  'registers.chemical_change_ros',
  'registers',
  '{"nb":"Endring i kjemikalieregister → ROS-revisjon"}'::jsonb,
  '{"nb":"Oppdaterte kjemikaliedata utløser revisjon av risikovurdering for kjemisk eksponering."}'::jsonb,
  'registers', 'db_event', 'ON_REGISTER_RECORD_UPDATED', 'update',
  '{"match":"field_equals","path":"registerType","value":"kjemikalier"}'::jsonb,
  '[{"type":"create_ros_draft","template":"kjemisk eksponering","linkSource":true}]'::jsonb,
  ARRAY['Kjemikalieforskriften','AML § 4-5'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Inspection ─────────────────────────────────────────────────────────────
(
  'inspection.critical_finding_chain',
  'inspection',
  '{"nb":"Kritisk inspeksjonsfunn → avvik + ROS + AMU + § 5-2 vurdering"}'::jsonb,
  '{"nb":"Komplett kritisk-funn-kjede: avvik, ROS-utkast, AMU-sak og vurdering av Arbeidstilsynet-melding (AML § 5-2)."}'::jsonb,
  'inspection', 'db_event', 'finding_critical', 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_deviation","titlePrefix":"Kritisk inspeksjonsfunn","dueInDays":1,"assignFromRound":true},
    {"type":"create_ros_draft","template":"standard 5×5","linkSource":true},
    {"type":"add_amu_agenda_item","agendaItem":"Kritisk inspeksjonsfunn — straks-tiltak","priority":"høy"},
    {"type":"create_task","title":"Vurder Arbeidstilsynet-melding (AML § 5-2)","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":1,"module":"inspection","sourceType":"critical_finding"}
  ]'::jsonb,
  ARRAY['AML § 5-2','AML § 6-2','IK-f § 5 nr. 7'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── ROS ────────────────────────────────────────────────────────────────────
(
  'ros.critical_risk_to_amu',
  'ros',
  '{"nb":"Kritisk risiko → AMU-sak + tiltaksplan"}'::jsonb,
  '{"nb":"En kritisk risiko i ROS legges til AMU-agenda og en tiltaksplan med 7-dagers frist."}'::jsonb,
  'ros', 'db_event', 'ON_ROS_CRITICAL_RISK', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"Kritisk risiko fra ROS — tiltak","priority":"kritisk"},
    {"type":"create_task","title":"Tiltaksplan for kritisk risiko","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":7,"module":"ros","sourceType":"critical_risk"}
  ]'::jsonb,
  ARRAY['AML § 4-1','IK-f § 5 nr. 6','IK-f § 5 nr. 7'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Action plan ────────────────────────────────────────────────────────────
(
  'action_plan.overdue_escalation',
  'action_plan',
  '{"nb":"Tiltak forfalt → eskalering"}'::jsonb,
  '{"nb":"Tiltak som passerer fristen eskaleres til HMS-leder."}'::jsonb,
  'action_plan', 'db_event', 'ON_MEASURE_OVERDUE', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"escalate","toRole":"hms_leder","note":"Tiltak ikke gjennomført på tid."},
    {"type":"send_notification","title":"Tiltak forfalt","body":"Bes fulgt opp omgående.","category":"action_plan"}
  ]'::jsonb,
  ARRAY['IK-f § 5 nr. 7'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Vernerunder ────────────────────────────────────────────────────────────
(
  'vernerunder.critical_finding_to_ros',
  'vernerunder',
  '{"nb":"Vernerunde kritisk funn → ROS + § 5-2 vurdering"}'::jsonb,
  '{"nb":"Kritisk vernerunde-funn fører til ROS-utkast og vurdering av § 5-2 melding."}'::jsonb,
  'vernerunder', 'db_event', 'ON_FINDING_REGISTERED', 'insert',
  '{"match":"field_equals","path":"severity","value":"critical"}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"standard 5×5","linkSource":true},
    {"type":"create_task","title":"Vurder § 5-2 melding — kritisk vernerunde-funn","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":1,"module":"vernerunder","sourceType":"vr_finding_critical"}
  ]'::jsonb,
  ARRAY['AML § 5-2','AML § 6-2','IK-f § 5 nr. 7'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder','verneombud'],
  'standard', false, 1, true
),

-- ─── Internkontroll ─────────────────────────────────────────────────────────
(
  'internkontroll.annual_review_signed_next',
  'internkontroll',
  '{"nb":"Årlig gjennomgang signert → bestill neste rytme"}'::jsonb,
  '{"nb":"Etter signering opprettes oppgave 300 dager fram for å forberede neste års gjennomgang."}'::jsonb,
  'internkontroll', 'db_event', 'ON_ANNUAL_REVIEW_SIGNED', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"create_task","title":"Planlegg neste årlige gjennomgang","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":300,"module":"internkontroll","sourceType":"annual_review"}]'::jsonb,
  ARRAY['IK-f § 5 nr. 8'],
  ARRAY['aml-amu','iso-45001'], 'aml-amu', 'arlig',
  ARRAY['HMS-leder'],
  'standard', false, 1, true
),

-- ─── Gov scope ──────────────────────────────────────────────────────────────
(
  'gov.critical_injury_arbeidstilsynet',
  'gov',
  '{"nb":"Alvorlig skade → Arbeidstilsynet (AML § 5-2) innen 24t"}'::jsonb,
  '{"nb":"Trigget av kritisk inspeksjonsfunn. Krever dobbel godkjenning + workflows.activate_external før aktivering. Frist: 24 timer fra hendelse."}'::jsonb,
  'inspection', 'db_event', 'finding_critical', 'insert',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft melding til Arbeidstilsynet (AML § 5-2).","escalateAfterHours":6,"escalateToRole":"hms_leder"},
    {"type":"rapporter_alvorlig_skade_arbeidstilsynet","melderRolle":"arbeidsgiver","reminderHoursBeforeDeadline":[12,4,1]}
  ]'::jsonb,
  ARRAY['AML § 5-2'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['HMS-leder','daglig_leder'],
  'standard', true, 1, true
),
(
  'gov.gdpr_breach_72h',
  'gov',
  '{"nb":"Personvernbrudd → Datatilsynet (GDPR Art. 33) innen 72t"}'::jsonb,
  '{"nb":"Når et personvernbrudd registreres som kritisk avvik starter 72-timersløpet fra aware_at. Krever dobbel godkjenning."}'::jsonb,
  'compliance_checklist', 'db_event', 'response_finding_critical', 'insert',
  '{"match":"array_any","path":"lawRefs","where":{"value":"GDPR Art. 33"}}'::jsonb,
  '[
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft melding til Datatilsynet (GDPR Art. 33).","escalateAfterHours":12,"escalateToRole":"hms_leder"},
    {"type":"meld_personvernbrudd_datatilsynet","reminderHoursBeforeDeadline":[24,4,1]}
  ]'::jsonb,
  ARRAY['GDPR Art. 33','Personopplysningsloven § 26'],
  ARRAY['gdpr'], 'gdpr', 'ad_hoc',
  ARRAY['Personvernombud','daglig_leder'],
  'restricted', true, 1, true
),
(
  'gov.nav_sick_leave_8w',
  'gov',
  '{"nb":"Sykefravær 8 uker → NAV dialogmøte 2-forberedelse"}'::jsonb,
  '{"nb":"Når sykefraværs-sjekklist for 8 uker er signert utløses NAV-oppfølgingen via Altinn DSOP."}'::jsonb,
  'compliance_checklist', 'db_event', 'execution_signed', 'both',
  '{"match":"field_equals","path":"templateSlug","value":"sykefravar-8uker"}'::jsonb,
  '[{"type":"nav_sykefravar_oppfolging","triggerWeek":8}]'::jsonb,
  ARRAY['Folketrygdloven § 25-2','AML § 4-6'],
  ARRAY['aml-amu'], 'aml-amu', 'ad_hoc',
  ARRAY['Personalleder'],
  'restricted', true, 1, true
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
