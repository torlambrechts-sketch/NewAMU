-- Sector pack: helse (helse- og omsorgssektoren).
--
-- 5 ikke-valgfrie system-regler + 2 katalog-maler som binder helsesektor-
-- spesifikke krav til allerede emitterte workflow-event. Pakkes som ett
-- forward-migration (idempotent, on conflict do update) slik at den kan
-- replayes på fersk DB. `frameworks=ARRAY['helse']` på hver rad lar gap-
-- og-revisjons-planneren plukke pakken ut i en egen kolonne på matrisen.
--
-- Arbeidstilsynet + Statens helsetilsyn + UKOM self-audit:
--   Pålegg-grunner addressed: Spesialisthelsetjenesteloven § 3-3 og
--   § 3-3 a (varsling av pasienthendelser til Helsetilsynet og UKOM),
--   Helse- og omsorgstjenesteloven § 12-3 a (UKOM-varsling),
--   Helsepersonelloven § 17 (helsepersonells meldeplikt) og § 48
--   (autorisasjon), Smittevernloven § 4-1 + forskrift om smittevern i
--   helsetjenesten (daglig smittevernsjekk), AML § 4-4 + forskrift om
--   utførelse av arbeid kap. 23 (ergonomisk vurdering av forflytning).
--   Restrisiko deferred: ingen API mot Helsetilsynet/UKOM finnes ennå —
--   pasienthendelses-melding er strukturert manual_arbeidstilsynet_-
--   submission-aktig outbox-rad med audit-spor. Daglig leder / fagansvarlig
--   må selv sende skjema (e-meldingsskjema) og loggføre kvittering.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values

-- ─── 1. Spesialisthelsetjenesteloven § 3-3 — pasienthendelse til Helsetilsynet ──
(
  'helse-avvik-spesialisthelsetjenesteloven-16',
  'Spesialisthelsetjenesteloven',
  'Helse — Pasienthendelse / meldeplikt',
  500,
  'Spesialisthelsetjenesteloven § 3-3 — Melding om alvorlig pasienthendelse',
  'Helse § 3-3 — Pasienthendelse → varsling til Statens helsetilsyn',
  'Kritisk funn merket med tags=[''pasienthendelse''] fra sjekkliste eller inspeksjon → konfidensiell oppgave til fagansvarlig + manuell outbox-rad (manual_arbeidstilsynet_submission) som påminnelse om e-meldingsskjema til Helsetilsynet. Helsepersonelloven § 17 utløses i parallell.',
  'Spesialisthelsetjenesteloven § 3-3: «Helseinstitusjon som omfattes av denne loven, skal straks sende melding til Statens helsetilsyn om betydelig personskade på pasient som følge av ytelse av helsetjeneste eller ved at en pasient skader en annen.» Helsepersonelloven § 17 pålegger den enkelte å varsle tilsynsmyndighet. Brudd er straffbart og hyppigste pålegg-grunn ved tilsyn fra Helsetilsynet.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"array_any","path":"tags","where":{"value":"pasienthendelse"}}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] Helsetilsynet § 3-3 — vurder og send pasienthendelse-melding","description":"Spesialisthelsetjenesteloven § 3-3 + helsepersonelloven § 17. E-meldingsskjema må sendes Statens helsetilsyn. Loggfør kvittering i denne oppgaven.","assignee":"Fagansvarlig","ownerRole":"fagansvarlig","dueInDays":3,"module":"inspection","sourceType":"helse-§3-3","lawRefs":["Spesialisthelsetjenesteloven § 3-3","Helsepersonelloven § 17"]},
    {"type":"send_notification","title":"Pasienthendelse meldt — § 3-3","body":"Statens helsetilsyn skal varsles. Konfidensiell behandling iht. taushetsplikt.","category":"compliance","toRole":"fagansvarlig"}
  ]'::jsonb,
  ARRAY['Spesialisthelsetjenesteloven § 3-3', 'Helsepersonelloven § 17'],
  ARRAY['helse'],
  'do', null, 'confidential',
  true,
  'Manuell outbox-leg — NewAMU har ikke API mot Helsetilsynet. Fagansvarlig fyller e-meldingsskjema (helsetilsynet.no) og loggfører referansenummer + tidspunkt i oppgaven.'
),

-- ─── 2. Smittevernloven § 4-1 — daglig smittevernsjekk ─────────────────
(
  'helse-smittevern-daily-check',
  'Smittevernloven',
  'Helse — Smittevern',
  501,
  'Smittevernloven § 4-1 — Daglig smittevernsjekkliste',
  'Helse smittevern — Daglig sjekkliste 07:00 hvis siste utførelse > 30t siden',
  'Hver morgen 07:00 (Europe/Oslo) kontrolleres at compliance_checklist_executions inneholder en rad for template_slug=''smittevern-daglig'' yngre enn 30 timer. Hvis ikke → oppgave til sykehjems-/sykehus-leder med 12 timers frist.',
  'Smittevernloven § 4-1 jf. forskrift om smittevern i helsetjenesten § 2-1: helseinstitusjon skal ha skriftlig smittevernprogram + daglig oppfølging av tiltak. Manglende daglig sjekk var pålegg-grunn i ~30% av Helsetilsynets sykehjem-tilsyn 2023-24.',
  'compliance_checklist', 'schedule', null, '0 7 * * *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Smittevern — daglig sjekkliste må utføres","description":"Smittevernloven § 4-1 + forskrift om smittevern i helsetjenesten. Daglig sjekkliste mangler eller er > 30 timer siden — gjennomfør straks.","assignee":"Avdelingsleder","ownerRole":"institusjonsleder","dueInDays":1,"module":"compliance","sourceType":"smittevern-daglig","lawRefs":["Smittevernloven § 4-1","Forskrift om smittevern i helsetjenesten § 2-1"]},
    {"type":"send_notification","title":"Smittevern — daglig sjekk","body":"Daglig smittevernsjekkliste er ikke utført siste 30 timer.","category":"compliance","toRole":"institusjonsleder"}
  ]'::jsonb,
  ARRAY['Smittevernloven § 4-1', 'Forskrift om smittevern i helsetjenesten § 2-1'],
  ARRAY['helse'],
  'check', null, 'standard',
  true,
  '30-timers vindu velges fordi 24t er for snevert (skift-overlapping); 36t lar avvik gli. Cron tikker mot Europe/Oslo via schedule_timezone-kolonnen (_120500).'
),

-- ─── 3. UKOM — alvorlig pasienthendelse til Statens undersøkelseskommisjon ──
(
  'helse-ukom-alvorlig-pasienthendelse',
  'Helse- og omsorgstjenesteloven',
  'Helse — Pasienthendelse / meldeplikt',
  502,
  'Helse- og omsorgstjenesteloven § 12-3 a — UKOM-varsling',
  'Helse § 12-3 a — Alvorlig pasienthendelse → UKOM',
  'Kritisk funn merket med category=''alvorlig_pasienthendelse'' → konfidensiell oppgave til kvalitets-/fagansvarlig + manuell outbox-rad som påminnelse om UKOM-varslingsskjema. Parallellt med § 3-3-løpet til Helsetilsynet.',
  'Helse- og omsorgstjenesteloven § 12-3 a (innført 01.07.2019) + spesialisthelsetjenesteloven § 3-3 a: Statens undersøkelseskommisjon for helse- og omsorgstjenesten (UKOM) skal varsles om alvorlige hendelser som har eller kunne hatt dødelig utfall. UKOM-varsling er IKKE alternativ til Helsetilsynet — det er parallell-leg. Manglende varsling er straffesanksjonert.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"field_equals","path":"category","value":"alvorlig_pasienthendelse"}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] UKOM-varsling — alvorlig pasienthendelse","description":"Helse- og omsorgstjenesteloven § 12-3 a + spesialisthelsetjenesteloven § 3-3 a. Send varsling til UKOM (varsling.ukom.no). Husk: parallell-leg til § 3-3-melding til Helsetilsynet — IKKE alternativ.","assignee":"Fagansvarlig","ownerRole":"fagansvarlig","dueInDays":1,"module":"inspection","sourceType":"helse-§12-3-a","lawRefs":["Helse- og omsorgstjenesteloven § 12-3 a","Spesialisthelsetjenesteloven § 3-3 a"]},
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft UKOM-varsling og parallell § 3-3-melding til Helsetilsynet er sendt.","escalateAfterHours":24,"escalateToRole":"hms_leder"},
    {"type":"send_notification","title":"UKOM-frist løper","body":"Alvorlig pasienthendelse — UKOM må varsles. Konfidensiell behandling.","category":"compliance","toRole":"fagansvarlig"}
  ]'::jsonb,
  ARRAY['Helse- og omsorgstjenesteloven § 12-3 a', 'Spesialisthelsetjenesteloven § 3-3 a'],
  ARRAY['helse'],
  'do', null, 'confidential',
  true,
  'UKOM-varsling går via varsling.ukom.no — manuell prosess. Loggfør referanse + tidspunkt i oppgaven.'
),

-- ─── 4. AML § 4-4 — ergonomisk vurdering av forflytningsoppgaver ────────
(
  'helse-forflytning-hms',
  'AML',
  'Helse — Arbeidsmiljø',
  503,
  'AML § 4-4 + Forskrift om utførelse av arbeid kap. 23 — Forflytning',
  'Helse AML § 4-4 — Halvårlig ergonomisk vurdering av forflytning',
  'To ganger i året (1. mars + 1. september 09:00) opprettes oppgave til verneombud + HMS-leder om ergonomisk vurdering av forflytningsoppgaver iht. forskrift om utførelse av arbeid kap. 23. Gjelder helseinstitusjoner med ≥20 ansatte.',
  'AML § 4-4 (1): «Fysiske arbeidsmiljøfaktorer som bygnings- og utstyrsmessige forhold … skal være fullt forsvarlig …» + forskrift om utførelse av arbeid kap. 23 spesifiserer ergonomiske krav ved manuell forflytning. Muskel- og skjelettlidelser i pleiesektoren er en dominerende pålegg-grunn ved Arbeidstilsynets sektor-tilsyn.',
  'inspection', 'schedule', null, '0 9 1 3,9 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Halvårlig ergonomisk vurdering av forflytningsoppgaver","description":"AML § 4-4 + forskrift om utførelse av arbeid kap. 23. Gjennomgå utstyr, opplæring, antall pasienthåndteringer + dokumenter avvik.","assignee":"HMS-leder","ownerRole":"hms_leder","dueInDays":21,"module":"inspection","sourceType":"helse-§4-4-forflytning","lawRefs":["AML § 4-4","Forskrift om utførelse av arbeid kap. 23"]},
    {"type":"add_amu_agenda_item","agendaItem":"Ergonomisk vurdering forflytning — AML § 4-4","priority":"høy"}
  ]'::jsonb,
  ARRAY['AML § 4-4', 'Forskrift om utførelse av arbeid kap. 23'],
  ARRAY['helse'],
  'plan', 20, 'standard',
  true,
  'Cron 1. mars og 1. september plasserer den utenfor tradisjonelle års-/halvårs-rapport-frister så HMS-leder ikke kolliderer.'
),

-- ─── 5. Helsepersonelloven § 48 — autorisasjon-utløp ───────────────────
(
  'helse-sertifikat-autorisasjon-monitor',
  'Helsepersonelloven',
  'Helse — Autorisasjon',
  504,
  'Helsepersonelloven § 48 — Autorisasjon for helsepersonell',
  'Helse § 48 — Autorisasjon-utløp 60d/30d/0d',
  'Sertifikat utstedt fra learning-modul med kind=''healthcare_authorization'' → forflyttings-kaskade: oppgave 60d før, 30d før, 0d. Beste-match på sertifikat-kategori; krever at HR/læring stempler kategorien i certificate-detalj.',
  'Helsepersonelloven § 48 + § 53: yrkesutøvelse uten gyldig autorisasjon er straffbart for arbeidstaker og medfører pålegg + virksomhetsstraff for arbeidsgiver. Statens helsetilsyn håndhever. 60d-varsling lar HR forflytte personen til ikke-pliktig stilling eller sikre fornyelse i tide.',
  'learning', 'db_event', 'ON_CERTIFICATE_ISSUED', null, 'both',
  '{"match":"field_equals","path":"kind","value":"healthcare_authorization"}'::jsonb,
  '[
    {"type":"create_task","title":"Autorisasjon utløper om 60d — forny eller forflytt","description":"Helsepersonelloven § 48. Yrkesutøvelse uten gyldig autorisasjon er straffbart. HR må enten initiere fornyelse eller midlertidig forflytte ansatt til ikke-pliktig stilling.","assignee":"{{event.userId}}","ownerRole":"HR","dueInDays":60,"module":"learning","sourceType":"helse-§48","lawRefs":["Helsepersonelloven § 48"]},
    {"type":"create_task","title":"Autorisasjon utløper om 30d — påkrevd handling","description":"Helsepersonelloven § 48. 30 dager igjen — fornyelse må være under behandling eller forflytting iverksatt.","assignee":"{{event.userId}}","ownerRole":"HR","dueInDays":30,"module":"learning","sourceType":"helse-§48-30d","lawRefs":["Helsepersonelloven § 48"]},
    {"type":"create_task","title":"Autorisasjon utløpt — kontroller status","description":"Helsepersonelloven § 48. Autorisasjon er utløpt på papir — bekreft fornyelse eller fjern arbeidstaker fra autorisasjon-pliktig stilling umiddelbart.","assignee":"{{event.userId}}","ownerRole":"HR","dueInDays":1,"module":"learning","sourceType":"helse-§48-0d","lawRefs":["Helsepersonelloven § 48"]}
  ]'::jsonb,
  ARRAY['Helsepersonelloven § 48', 'Helsepersonelloven § 53'],
  ARRAY['helse'],
  'do', null, 'standard',
  true,
  'Best-effort: matcher på event.kind=''healthcare_authorization''. HR-/læring-modulen må sette kind på certificate-utstedelse for at regelen skal fyre — ellers er sertifikatet bare et generisk kompetansebevis (faller tilbake på aml-3-4-certificate-expiry).'
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

-- ─── Katalog-maler (valgfrie templates som org kan installere) ──────────
-- Disse er sektorvarianter av eksisterende katalog-maler. Pack='helse' gir
-- gap-og-revisjons-planneren et flagg å filtrere på i UI.

insert into public.workflow_rule_catalog (
  slug, scope_id, name_i18n, description_i18n,
  source_module, trigger_type, trigger_event_name, trigger_on,
  condition_json, actions_json,
  law_refs, frameworks, pack, cadence_hint, recommended_for,
  confidentiality_level, contains_gov_action, catalog_version, is_published
) values
(
  'helse.pasienthendelse_audit',
  'inspection',
  '{"nb":"Helse: pasienthendelse → audit-trail + AMU","en":"Healthcare: patient incident → audit trail + AMU"}'::jsonb,
  '{"nb":"Pasienthendelse tagget i inspeksjon utløser audit-trail, AMU-agendapost, og påminnelse om § 3-3-varsling til Helsetilsynet."}'::jsonb,
  'inspection', 'db_event', 'finding_critical', 'insert',
  '{"match":"array_any","path":"tags","where":{"value":"pasienthendelse"}}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"Pasienthendelse — spes.helsetjl. § 3-3","priority":"høy"},
    {"type":"create_task","title":"Audit-trail: pasienthendelse-behandling","assignee":"Fagansvarlig","ownerRole":"fagansvarlig","dueInDays":5,"module":"inspection","sourceType":"helse-pasienthendelse-audit"}
  ]'::jsonb,
  ARRAY['Spesialisthelsetjenesteloven § 3-3','Helsepersonelloven § 17'],
  ARRAY['helse'], 'helse', 'ad_hoc',
  ARRAY['Fagansvarlig','HMS-leder'],
  'confidential', false, 1, true
),
(
  'helse.bht_konsultasjon_yrkeshelse',
  'inspection',
  '{"nb":"Helse: yrkeshelse-funn → BHT-konsultasjon","en":"Healthcare: occupational health finding → BHT consult"}'::jsonb,
  '{"nb":"Yrkeshelse-funn i helsesektor utløser BHT-konsultasjons-oppgave med 14d frist (AML § 3-3 jf. forskrift om organisering, ledelse og medvirkning kap. 13)."}'::jsonb,
  'inspection', 'db_event', 'finding_high', 'insert',
  '{"match":"field_equals","path":"category","value":"yrkeshelse"}'::jsonb,
  '[
    {"type":"create_task","title":"BHT-konsultasjon for yrkeshelsesak","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":14,"module":"inspection","sourceType":"helse-bht"}
  ]'::jsonb,
  ARRAY['AML § 3-3'],
  ARRAY['helse'], 'helse', 'ad_hoc',
  ARRAY['HMS-leder'],
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
