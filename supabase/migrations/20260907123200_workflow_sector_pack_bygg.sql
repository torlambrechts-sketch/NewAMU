-- Sector pack: bygg (bygg- og anleggsbransjen).
--
-- 5 ikke-valgfrie system-regler + 2 katalog-maler som binder bygg/anlegg-
-- sektor-spesifikke krav til allerede emitterte workflow-event. Ett forward-
-- migration (idempotent). `frameworks=ARRAY['bygg']` lar gap-og-revisjons-
-- planneren plukke pakken ut i en egen kolonne på matrisen.
--
-- Arbeidstilsynet + DSB self-audit:
--   Pålegg-grunner addressed: Byggherreforskriften § 5 (byggherrens plikter
--   gjennom hele prosjektet), § 8 (SHA-plan), § 9 (oppdatering ved endring),
--   § 11 (SJA-/instruksjons-plikt), Forskrift om utførelse av arbeid kap. 17
--   (arbeid i høyden) + § 26-1 (sikker-jobb-analyse ved risikofylt arbeid),
--   Eksplosjonsvernforskriften § 3 + Brann- og eksplosjonsvernloven (DSB-
--   melding ved sprengning), IK-forskriften § 5 nr. 8 (årlig revisjon).
--   Restrisiko deferred: ingen API mot Arbeidstilsynet/DSB for byggherre-
--   meldinger — manuell prosess med outbox-rad. RUH-meldinger gjennom
--   bedrifts-eget RUH-system er sektor-praksis men varierer; ikke modellert
--   her som ett felles event-navn.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  name, description, rationale,
  source_module, trigger_type, trigger_event_name, schedule_cron,
  trigger_on, condition_json, actions_json,
  law_refs, frameworks, pdca_phase,
  applies_if_employee_count_gte, confidentiality_level,
  enabled, notes
) values

-- ─── 1. Byggherreforskriften § 8 — SHA-plan ved prosjekt-oppstart ──────
(
  'bygg-sha-plan-onboarding',
  'Byggherreforskriften',
  'Bygg — Prosjekt-oppstart',
  700,
  'Byggherreforskriften § 8 + § 9 — SHA-plan',
  'Bygg byggherreforskr. § 8 — SHA-plan ved nytt byggeprosjekt',
  'Ny register-rad med kind=''byggeplass'' opprettet → oppgave til byggherre/koordinator om utarbeide SHA-plan (sikkerhet, helse og arbeidsmiljø) før arbeid igangsettes.',
  'Byggherreforskriften § 8: «Byggherren skal sørgje for at det utarbeides en plan for sikkerhet, helse og arbeidsmiljø …» § 9 krever oppdatering ved endring. Manglende SHA-plan før oppstart er hyppigste pålegg-grunn ved Arbeidstilsynets bygg-tilsyn — kan medføre stansing av arbeid.',
  'registers', 'db_event', 'ON_REGISTER_RECORD_CREATED', null, 'insert',
  '{"match":"field_equals","path":"registerType","value":"byggeplass"}'::jsonb,
  '[
    {"type":"create_task","title":"Utarbeid SHA-plan før oppstart (byggherreforskr. § 8)","description":"Byggherreforskriften § 8 + § 9. SHA-plan må være på plass FØR arbeid starter. Skal omfatte risikoforhold, organisering, ansvar og tiltak.","assignee":"Byggherrekoordinator","ownerRole":"byggherrekoordinator","dueInDays":14,"module":"documents","sourceType":"bygg-§8-sha","lawRefs":["Byggherreforskriften § 8","Byggherreforskriften § 9"]},
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft SHA-plan er utarbeidet og signert før byggearbeid igangsettes.","escalateAfterHours":336,"escalateToRole":"hms_leder"},
    {"type":"add_amu_agenda_item","agendaItem":"Nytt byggeprosjekt — SHA-plan-status","priority":"høy"}
  ]'::jsonb,
  ARRAY['Byggherreforskriften § 8', 'Byggherreforskriften § 9'],
  ARRAY['bygg'],
  'plan', null, 'standard',
  true,
  'Krever at registers-modul aksepterer register_kind=''byggeplass''. Hvis ikke seedet i register_types, faller regelen tilbake til ikke-fyrende — fanges av weekly review.'
),

-- ─── 2. Forskrift om utførelse av arbeid § 26-1 — SJA før risikofylt arbeid ──
(
  'bygg-sja-pre-shift',
  'Byggherreforskriften',
  'Bygg — Daglig drift',
  701,
  'Forskrift om utførelse av arbeid § 26-1 + Byggherreforskr. § 11 — SJA',
  'Bygg SJA — Daglig 06:30 mandag-fredag',
  'Hver virkedag 06:30 (Europe/Oslo) opprettes påminnelses-oppgave til baspas + koordinator om SJA (sikker-jobb-analyse) før risikofylt arbeid startes.',
  'Forskrift om utførelse av arbeid § 26-1: SJA skal gjennomføres før arbeid som kan medføre særlig fare. Byggherreforskriften § 11: byggherren skal sørge for nødvendige instruksjoner. Manglende SJA er pålegg-grunn — og direkte årsak til ~40% av personskader på bygg per Arbeidstilsynets statistikk.',
  'tasks', 'schedule', null, '30 6 * * 1-5', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"SJA — utfør før risikofylt arbeid startes","description":"Forskrift om utførelse av arbeid § 26-1 + byggherreforskr. § 11. Identifiser farer, vurder konsekvens, definer tiltak. Skal være signert av baspas + arbeidstaker.","assignee":"Baspas","ownerRole":"baspas","dueInDays":1,"module":"inspection","sourceType":"bygg-sja","lawRefs":["Forskrift om utførelse av arbeid § 26-1","Byggherreforskriften § 11"]},
    {"type":"send_notification","title":"SJA-påminnelse","body":"Husk SJA før arbeid startes — gjelder alle risikofylte oppgaver.","category":"safety","toRole":"baspas"}
  ]'::jsonb,
  ARRAY['Forskrift om utførelse av arbeid § 26-1', 'Byggherreforskriften § 11'],
  ARRAY['bygg'],
  'do', null, 'standard',
  true,
  'Cron 06:30 treffer typisk byggeplass-arbeidstid 07:00. Mandag-fredag er bygg-bransjens standard; helg krever egen regel hvis helgearbeid forekommer.'
),

-- ─── 3. Forskrift om utførelse av arbeid kap. 17 — fallrisiko ──────────
(
  'bygg-fallrisiko-vernerunde',
  'AML',
  'Bygg — Fallrisiko',
  702,
  'Forskrift om utførelse av arbeid kap. 17 + AML § 4-1 — Fallrisiko',
  'Bygg fallrisiko — Tagget funn → ROS + AMU + eskalering',
  'Finding tagget med tags=[''fallrisiko''] → ROS-utkast (fallsikring-mal) + AMU-agendapost. Hvis location=''høyde > 2m'' → eskalering til HMS-leder og stansing-vurdering.',
  'Forskrift om utførelse av arbeid kap. 17 (arbeid i høyden): arbeid over 2m krever fallsikring. AML § 4-1 generell forsvarlighet. Fall fra høyde er årlig topp-3-årsak til dødsulykker på bygg — Arbeidstilsynet kan stanse arbeid på stedet ved brudd.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"array_any","path":"tags","where":{"value":"fallrisiko"}}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"fallsikring","linkSource":true},
    {"type":"add_amu_agenda_item","agendaItem":"Fallrisiko-funn — kap. 17","priority":"kritisk"},
    {"type":"create_task","title":"Behandle fallrisiko-funn — vurder stansing","description":"Forskrift om utførelse av arbeid kap. 17. Arbeid over 2m uten fallsikring SKAL stanses. Verneombud kan stanse arbeidet jf. AML § 6-3.","assignee":"HMS-leder","ownerRole":"hms_leder","dueInDays":1,"module":"inspection","sourceType":"bygg-fallrisiko","lawRefs":["Forskrift om utførelse av arbeid kap. 17","AML § 4-1","AML § 6-3"]},
    {"type":"escalate","toRole":"daglig_leder","note":"Fallrisiko-funn — vurder umiddelbar stansing av arbeid."}
  ]'::jsonb,
  ARRAY['Forskrift om utførelse av arbeid kap. 17', 'AML § 4-1'],
  ARRAY['bygg'],
  'do', null, 'standard',
  true,
  'Location-betingelse (høyde > 2m) håndteres som en tag — emitteren må sette tags=[''fallrisiko'',''hoyde_2m''] når arbeidet skjer over 2m. Eskaleringen kommer i alle tilfeller siden alle fallrisiko-funn er kritiske.'
),

-- ─── 4. Eksplosjonsvernforskriften § 3 — sprengning DSB-melding ────────
(
  'bygg-sprengning-dsb-melding',
  'Brann- og eksplosjonsvernloven',
  'Bygg — Sprengning',
  703,
  'Eksplosjonsvernforskriften § 3 + Brann- og eksplosjonsvernloven — DSB-melding',
  'Bygg sprengning — DSB-melding (manuell outbox)',
  'Ny register-rad med kind=''sprengningsplan'' opprettet → manuell outbox-rad (manual_dsb_submission-aktig) + oppgave til sprengningssjef om å sende DSB-melding før sprengningen startes.',
  'Eksplosjonsvernforskriften § 3 + brann- og eksplosjonsvernloven §§ 19-20: håndtering av eksplosiv vare krever forhåndsmelding til DSB (Direktoratet for samfunnssikkerhet og beredskap). Sprengnings-/skytebas må ha sertifikat. Manglende melding er straffbart.',
  'registers', 'db_event', 'ON_REGISTER_RECORD_CREATED', null, 'insert',
  '{"match":"field_equals","path":"registerType","value":"sprengningsplan"}'::jsonb,
  '[
    {"type":"create_task","title":"Send DSB-melding før sprengning","description":"Eksplosjonsvernforskriften § 3 + brann- og eksplosjonsvernloven §§ 19-20. Forhåndsmelding til DSB må sendes via altinn. Verifiser at sprengningssjef har gyldig sertifikat (skytebas-sertifikat).","assignee":"Sprengningssjef","ownerRole":"sprengningssjef","dueInDays":3,"module":"registers","sourceType":"bygg-§3-dsb","lawRefs":["Eksplosjonsvernforskriften § 3","Brann- og eksplosjonsvernloven § 19","Brann- og eksplosjonsvernloven § 20"]},
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft at DSB-melding er sendt og kvittering loggført før sprengning igangsettes.","escalateAfterHours":48,"escalateToRole":"hms_leder"},
    {"type":"send_notification","title":"Sprengning planlagt — DSB-frist løper","body":"Sprengningsplan registrert. DSB-melding må være sendt før igangsetting.","category":"compliance","toRole":"sprengningssjef"}
  ]'::jsonb,
  ARRAY['Eksplosjonsvernforskriften § 3', 'Brann- og eksplosjonsvernloven § 19', 'Brann- og eksplosjonsvernloven § 20'],
  ARRAY['bygg'],
  'do', null, 'restricted',
  true,
  'Manuell outbox — NewAMU har ingen DSB-API. Sprengningssjef må fylle Altinn-skjema og loggføre referansenummer + tidspunkt. TODO: kan promoteres til gov_dsb_log_only-action i fremtidig sektorpakke.'
),

-- ─── 5. Byggherreforskriften § 5 — årsrevisjon ─────────────────────────
(
  'bygg-arsrevisjon-byggherre',
  'Byggherreforskriften',
  'Bygg — Årsrevisjon',
  704,
  'Byggherreforskriften § 5 + IK-f § 5 nr. 8 — Årlig byggherre-revisjon',
  'Bygg byggherreforskr. § 5 — Årsrevisjon (15. januar)',
  'Hvert år 15. januar 09:00 opprettes oppgave til byggherre om årlig revisjon av byggherreplikter for hvert aktivt prosjekt — vurdering av SHA-plan, koordinerings-funksjon, og prosjekt-erfaringer.',
  'Byggherreforskriften § 5: «Byggherren skal sørgje for at føresegnene i denne forskrifta blir gjennomførte gjennom hele prosjektet …» IK-forskriften § 5 nr. 8 krever systematisk gjennomgang. Manglende dokumentert årsrevisjon er pålegg-grunn — Arbeidstilsynet ber spesifikt om denne ved bygg-revisjon.',
  'meetings', 'schedule', null, '0 9 15 1 *', 'both',
  '{"match":"always"}'::jsonb,
  '[
    {"type":"create_task","title":"Byggherreforskriften § 5 — årlig revisjon av aktive prosjekter","description":"Byggherreforskriften § 5 + IK-f § 5 nr. 8. Gjennomgå SHA-plan, koordinerings-funksjon, prosjekt-erfaringer, RUH-statistikk for fjoråret. Skal dokumenteres skriftlig.","assignee":"Byggherre","ownerRole":"byggherre","dueInDays":45,"module":"meetings","sourceType":"bygg-§5-arsrevisjon","lawRefs":["Byggherreforskriften § 5","IK-f § 5 nr. 8"]},
    {"type":"add_amu_agenda_item","agendaItem":"Byggherre-årsrevisjon — gjennomgang","priority":"høy"}
  ]'::jsonb,
  ARRAY['Byggherreforskriften § 5', 'IK-f § 5 nr. 8'],
  ARRAY['bygg'],
  'check', null, 'standard',
  true,
  '15. januar gir 6 uker til Arbeidstilsynets typiske vår-tilsyns-vindu (mars/april) — slik at revisjonen er tilgjengelig som dokumentasjon.'
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
  'bygg.ruh_kritisk_ros_kjede',
  'inspection',
  '{"nb":"Bygg: RUH kritisk → ROS + § 5-2 vurdering","en":"Construction: critical incident → ROS + § 5-2 review"}'::jsonb,
  '{"nb":"RUH-melding med severity=critical i bygg-prosjekt utløser ROS-utkast, AMU-sak og § 5-2 Arbeidstilsynet-meldings-vurdering."}'::jsonb,
  'inspection', 'db_event', 'finding_critical', 'insert',
  '{"match":"and","conditions":[{"match":"field_equals","path":"category","value":"ruh"},{"match":"field_equals","path":"severity","value":"critical"}]}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"bygg-anlegg standard","linkSource":true},
    {"type":"add_amu_agenda_item","agendaItem":"Bygg RUH-kritisk — § 5-2 vurdering","priority":"kritisk"},
    {"type":"create_task","title":"Vurder Arbeidstilsynet-melding (AML § 5-2)","assignee":"HMS-leder","ownerRole":"hms_leder","dueInDays":1,"module":"inspection","sourceType":"bygg-ruh-kritisk","lawRefs":["AML § 5-2","Byggherreforskriften § 11"]}
  ]'::jsonb,
  ARRAY['AML § 5-2','Byggherreforskriften § 11'],
  ARRAY['bygg'], 'bygg', 'ad_hoc',
  ARRAY['HMS-leder','baspas'],
  'standard', false, 1, true
),
(
  'bygg.kran_loft_sertifikat',
  'registers',
  '{"nb":"Bygg: kran-/løfte-sertifikat → 60d-varsel","en":"Construction: crane/lift cert → 60d alert"}'::jsonb,
  '{"nb":"Kran-/løfteoperatør-sertifikat utstedt → fornyings-varsling 60 dager før utløp (G4/G8/G11). Forskrift om utførelse av arbeid kap. 10."}'::jsonb,
  'learning', 'db_event', 'ON_CERTIFICATE_ISSUED', 'both',
  '{"match":"field_equals","path":"kind","value":"crane_lift_operator"}'::jsonb,
  '[
    {"type":"create_task","title":"Kran-/løfte-sertifikat utløper om 60d — påmeld fornyelse","assignee":"{{event.userId}}","ownerRole":"HR","dueInDays":60,"module":"learning","sourceType":"bygg-kran-sertifikat","lawRefs":["Forskrift om utførelse av arbeid kap. 10","AML § 3-4"]}
  ]'::jsonb,
  ARRAY['Forskrift om utførelse av arbeid kap. 10','AML § 3-4'],
  ARRAY['bygg'], 'bygg', 'ad_hoc',
  ARRAY['HR','HMS-leder'],
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
