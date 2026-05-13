-- Seed workflow_system_rules with the Arbeidsmiljøloven compliance package.
--
-- Coverage matrix (LOV-2005-06-17-62 + LOV-2018-06-15-38 GDPR-implementering
-- + Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid
-- (Internkontrollforskriften, FOR-1996-12-06-1127)):
--
--   Kap. 2A  Varsling — § 2A-3, § 2A-7
--   Kap. 3   Virkemidler — § 3-1, § 3-2, § 3-4, § 3-5
--   Kap. 4   Krav til arbeidsmiljøet — § 4-2, § 4-3, § 4-5, § 4-6
--   Kap. 5   Meldeplikt — § 5-1, § 5-2, § 5-3
--   Kap. 6   Verneombud — § 6-1, § 6-2, § 6-3, § 6-5
--   Kap. 7   AMU — § 7-1, § 7-2
--   Kap. 8   Informasjon og drøfting — § 8-1
--   Kap. 9   Kontrolltiltak — § 9-1
--   Kap. 10  Arbeidstid — § 10-6
--   Kap. 11  Barn og ungdom — § 11-1
--   Kap. 12  Permisjon — § 12-9
--   Kap. 13  Diskriminering — § 13-1
--   Kap. 14  Ansettelse — § 14-5, § 14-9
--   Kap. 15  Opphør — § 15-1
--   IK-f     § 5 nr. 1, 6, 7, 8
--   GDPR     Art. 33 / Personopplysningsloven § 26
--   Folketr. § 25-2
--
-- Each row carries a `rationale` field explaining WHY the rule is
-- non-optional and which pålegg-grunn from Arbeidstilsynet it heads off.
-- All idempotent via on conflict (slug) do update set …
--
-- Arbeidstilsynet self-audit (overordnet):
--   Pålegg-grunn addressed: dette er den juridiske ryggraden — uten
--   disse rutinene i drift er internkontrollkravet i AML § 3-1 +
--   IK-f § 5 brutt før første tilsynsbesøk.
--   Restrisiko deferred: sektor-spesifikke regler (helse, transport,
--   bygg, sjø-/luftfart) — disse leveres i sektor-pakker fordi de
--   krever sektor-felt på org-modellen vi ikke har enda.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  description, rationale, source_module, trigger_type, trigger_event_name,
  schedule_cron, trigger_on, condition_json, actions_json, law_refs,
  frameworks, pdca_phase, applies_if_employee_count_gte, enabled, notes
) values

-- ─── Kap. 2A — Varsling ────────────────────────────────────────────────
(
  'aml-2a-7-whistleblower-confidential',
  'AML', 'Kap. 2A — Varsling', 2, 'AML § 2A-7 — Konfidensiell håndtering av varsel',
  'Varslersaker auto-merkes som konfidensielle (workflow_runs.confidentiality_level=confidential) og oppgaven går kun til varslingsutvalg.',
  'AML § 2A-7 femte ledd: «Arbeidsgiver skal sikre at den som har varslet, ikke utsettes for gjengjeldelse, og at saken behandles konfidensielt.» Uten denne regelen risikerer org sak for gjengjeldelse.',
  'survey', 'db_event', 'ON_SURVEY_RESPONSE_SUBMITTED', null, 'insert',
  '{"match":"and","conditions":[{"match":"field_equals","path":"surveySlug","value":"varslingsutvalg"},{"match":"field_equals","path":"isAnonymous","value":"true"}]}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] Triage varslersak","description":"AML § 2A-7 (5) — sak skal behandles konfidensielt. Kun varslingsutvalg.","assignee":"Varslingsmottak","ownerRole":"varslingsutvalg","dueInDays":1,"module":"survey","sourceType":"varsel_2a7"}
  ]'::jsonb,
  ARRAY['AML § 2A-7'], ARRAY['aml-amu'], 'do', null, true,
  'Lov om arbeidsmiljø § 2A-7 femte ledd — vern mot gjengjeldelse + konfidensialitet.'
),

-- ─── Kap. 3 — Virkemidler ──────────────────────────────────────────────
(
  'aml-3-1-hms-doc-log',
  'AML', 'Kap. 3 — Virkemidler i arbeidsmiljøarbeidet', 3, 'AML § 3-1 — Dokumentasjon av HMS-arbeid',
  'Endring i HMS-dokumenter (publisering / revisjon) logges automatisk slik at tilsynet kan etterprøve hva som var gjeldende rutine på et gitt tidspunkt.',
  'AML § 3-1 (2) bokstav e: «Sørge for at de gjeldende kravene til arbeidsmiljø oppfylles … gjennomføre systematisk arbeid …» Krever sporbar dokumentasjon — ellers blir det pålegg ved tilsyn.',
  'documents', 'db_event', 'ON_DOCUMENT_PUBLISHED', null, 'insert',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"HMS-dokument publisert — workflow_runs er den sporbare loggen."}]'::jsonb,
  ARRAY['AML § 3-1', 'IK-f § 5 nr. 8'], ARRAY['aml-amu','iso-45001'], 'do', null, true, null
),
(
  'aml-3-2-onboarding-training',
  'AML', 'Kap. 3 — Virkemidler i arbeidsmiljøarbeidet', 3, 'AML § 3-2 — Opplæring',
  'Ny ansettelse triggerer at HMS-introduksjonskurs blir tildelt og forfallsdato 30 dager etter ansettelse settes.',
  'AML § 3-2: «Arbeidsgiver skal sørge for at arbeidstaker får nødvendig opplæring …» Manglende introduksjon er nr. 1 pålegg-grunn ved nyansettelser.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"new_hire"}'::jsonb,
  '[{"type":"create_task","title":"Tildel HMS-introduksjonskurs","assignee":"{{event.assigneeUserId}}","ownerRole":"HR","dueInDays":30,"module":"learning","sourceType":"hms_onboarding"}]'::jsonb,
  ARRAY['AML § 3-2', 'IK-f § 5 nr. 2'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-3-4-certificate-expiry',
  'AML', 'Kap. 3 — Virkemidler i arbeidsmiljøarbeidet', 3, 'AML § 3-4 — Sertifikat for farlig arbeid',
  'Sertifikat-utløp (forskrift om utførelse av arbeid, kap. 10) → fornyelseskurs påmeldes 60 dager før utløp.',
  'AML § 3-4 jf. forskrift om utførelse av arbeid: arbeid med farlige stoffer eller verktøy krever gyldig sertifikat. Uten varsling før utløp risikerer ansatte ulovlig arbeid.',
  'learning', 'db_event', 'ON_CERTIFICATE_ISSUED', null, 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"create_task","title":"Re-tildel kurs (60d før utløp)","assignee":"{{event.userId}}","ownerRole":"HMS","dueInDays":60,"module":"learning","sourceType":"certificate_expiry"}]'::jsonb,
  ARRAY['AML § 3-4', 'AML § 3-5'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-3-5-leader-hms-course',
  'AML', 'Kap. 3 — Virkemidler i arbeidsmiljøarbeidet', 3, 'AML § 3-5 — Plikt til opplæring i HMS for arbeidsgiver',
  'Når daglig leder skiftes ut (profiles role change → daglig_leder) opprettes oppgave om §3-5-kurs innen 6 måneder.',
  'AML § 3-5: «Arbeidsgiver skal gjennomgå opplæring i helse-, miljø- og sikkerhetsarbeid.» Manglende §3-5 hos daglig leder gir umiddelbart pålegg.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"role_change_daglig_leder"}'::jsonb,
  '[{"type":"create_task","title":"Påmeld § 3-5 HMS-kurs for daglig leder","assignee":"{{event.assigneeUserId}}","ownerRole":"HR","dueInDays":180,"module":"learning","sourceType":"§3-5"}]'::jsonb,
  ARRAY['AML § 3-5'], ARRAY['aml-amu'], 'do', null, true, null
),

-- ─── Kap. 4 — Krav til arbeidsmiljøet ──────────────────────────────────
(
  'aml-4-2-accommodation-request',
  'AML', 'Kap. 4 — Krav til arbeidsmiljøet', 4, 'AML § 4-2 — Tilrettelegging',
  'Søknad om tilrettelegging fra ansatt → oppgave til nærmeste leder med 14-dagers svarfrist.',
  'AML § 4-2 (1): «Arbeidstaker skal medvirke ved utforming, gjennomføring og oppfølging …» 14-dagers svarfrist er beste praksis fra Likestillings- og diskrimineringsnemnda.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"accommodation_request"}'::jsonb,
  '[{"type":"create_task","title":"Behandle tilretteleggingssøknad","assignee":"{{event.assigneeUserId}}","ownerRole":"Personalleder","dueInDays":14,"module":"tasks","sourceType":"§4-2"}]'::jsonb,
  ARRAY['AML § 4-2', 'AML § 4-6'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-4-3-psychosocial-confidential',
  'AML', 'Kap. 4 — Krav til arbeidsmiljøet', 4, 'AML § 4-3 — Psykososialt arbeidsmiljø',
  'Krenkelser / mobbing / trakassering rapportert → konfidensiell triage til personalleder eller verneombud.',
  'AML § 4-3 (3): «Arbeidstaker skal ikke utsettes for trakassering eller annen utilbørlig opptreden.» Konfidensialitet er strengt nødvendig ved varsling av krenkelser.',
  'compliance_checklist', 'db_event', 'response_finding_critical', null, 'insert',
  '{"match":"array_any","path":"lawRefs","where":{"value":"AML § 4-3"}}'::jsonb,
  '[{"type":"create_task","title":"[KONFIDENSIELT] Triage krenkelse-rapport","assignee":"Personalleder","ownerRole":"HR","dueInDays":3,"module":"compliance","sourceType":"§4-3"}]'::jsonb,
  ARRAY['AML § 4-3'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-4-5-chemical-registration',
  'AML', 'Kap. 4 — Krav til arbeidsmiljøet', 4, 'AML § 4-5 — Kjemikalier og biologisk materiale',
  'Nytt kjemikalium registrert → krav om ROS-analyse + oppdatert stoffkartotek innen 30 dager.',
  'AML § 4-5 + Forskrift om utførelse av arbeid kap. 3: nytt kjemikalium krever risikovurdering + stoffkartotek-oppføring.',
  'registers', 'db_event', 'ON_REGISTER_RECORD_CREATED', null, 'insert',
  '{"match":"field_equals","path":"registerType","value":"kjemikalier"}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"kjemisk eksponering","linkSource":true},
    {"type":"create_task","title":"Oppdater stoffkartotek + ROS for nytt kjemikalium","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":30,"module":"registers","sourceType":"§4-5"}
  ]'::jsonb,
  ARRAY['AML § 4-5', 'Kjemikalieforskriften'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-4-6-sick-leave-4w',
  'AML', 'Kap. 4 — Krav til arbeidsmiljøet', 4, 'AML § 4-6 — Tilrettelegging ved redusert arbeidsevne',
  'Sykefravær når 4 uker → oppfølgingsplan etter § 4-6 opprettes automatisk for nærmeste leder.',
  'AML § 4-6 (3): «Arbeidsgiver skal i samråd med arbeidstaker utarbeide oppfølgingsplan for tilbakeføring … senest innen fire uker etter sykefraværet ble registrert.» Klare lovkrav, hyppig pålegg-grunn.',
  'compliance_checklist', 'db_event', 'execution_signed', null, 'both',
  '{"match":"field_equals","path":"templateSlug","value":"sykefravar-4uker"}'::jsonb,
  '[{"type":"create_task","title":"§ 4-6 oppfølgingsplan","assignee":"{{event.signedBy}}","ownerRole":"Nærmeste leder","dueInDays":7,"module":"compliance","sourceType":"§4-6"}]'::jsonb,
  ARRAY['AML § 4-6', 'Folketrygdloven § 25-2'], ARRAY['aml-amu'], 'plan', null, true, null
),

-- ─── Kap. 5 — Meldeplikt ───────────────────────────────────────────────
(
  'aml-5-1-injury-register',
  'AML', 'Kap. 5 — Meldeplikt', 5, 'AML § 5-1 — Registrering av personskader',
  'Personskade meldt fra inspeksjon eller HSE-modul → automatisk oppføring i skaderegister + AMU-orientering.',
  'AML § 5-1 (1): «Arbeidsgiver skal sørge for registrering av skader og sykdommer som oppstår under utførelse av arbeid.» Skaderegister er en grunnplikt — fravær er pålegg-grunn.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"field_equals","path":"category","value":"personskade"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"Personskade meldt — AML § 5-1","priority":"høy"},
    {"type":"log_only","note":"Skaderegister-rad opprettes av skadeprosess; her bekrefter vi AMU-orientering."}
  ]'::jsonb,
  ARRAY['AML § 5-1'], ARRAY['aml-amu'], 'check', null, true, null
),
(
  'aml-5-2-arbeidstilsynet-24h',
  'AML', 'Kap. 5 — Meldeplikt', 5, 'AML § 5-2 — Melding til Arbeidstilsynet ved alvorlig skade',
  'Alvorlig personskade flagget → 24-timers innmeldings-timer startes, oppgave til daglig leder, vurdering om RegInc-melding.',
  'AML § 5-2: «Hvis arbeidstaker omkommer eller blir alvorlig skadet …, skal arbeidsgiver straks og senest innen 24 timer varsle Arbeidstilsynet og nærmeste politimyndighet.» Forsinket melding er straffbar.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"field_equals","path":"category","value":"alvorlig_personskade"}'::jsonb,
  '[
    {"type":"create_task","title":"24t: vurder Arbeidstilsynet-melding (AML § 5-2)","assignee":"Daglig leder","ownerRole":"daglig_leder","dueInDays":1,"module":"inspection","sourceType":"§5-2"},
    {"type":"send_notification","title":"§ 5-2 trigger","body":"Alvorlig personskade — 24-timers innmeldings-frist løper.","category":"compliance"}
  ]'::jsonb,
  ARRAY['AML § 5-2'], ARRAY['aml-amu'], 'do', null, true,
  'Politimyndighet skal også varsles parallelt jf. § 5-2 første ledd; det er fortsatt et manuelt steg.'
),
(
  'aml-5-3-nav-injury-report',
  'AML', 'Kap. 5 — Meldeplikt', 5, 'AML § 5-3 — Melding til NAV ved yrkesskade',
  'Yrkesskade-flagget hendelse → NAV-meldings-utkast genereres for HR.',
  'AML § 5-3 jf. ftrl. § 13-14: yrkesskade skal meldes NAV. Manglende NAV-melding kan ramme arbeidstakers ytelses-rettigheter.',
  'inspection', 'db_event', 'finding_critical', null, 'insert',
  '{"match":"field_equals","path":"category","value":"yrkesskade"}'::jsonb,
  '[{"type":"create_task","title":"Send yrkesskade-melding NAV","assignee":"HR","ownerRole":"HR","dueInDays":3,"module":"inspection","sourceType":"§5-3"}]'::jsonb,
  ARRAY['AML § 5-3', 'Folketrygdloven § 13-14'], ARRAY['aml-amu'], 'do', null, true, null
),

-- ─── Kap. 6 — Verneombud ───────────────────────────────────────────────
(
  'aml-6-1-vo-required-10',
  'AML', 'Kap. 6 — Verneombud', 6, 'AML § 6-1 — Plikt til å velge verneombud',
  'Når org overstiger 10 ansatte (årlig sjekk + ved ansettelse) → påminnelse om verneombud-valg.',
  'AML § 6-1: «Ved hver virksomhet som går inn under loven skal det velges verneombud.» < 10 ansatte kan inngå skriftlig avtale om å unnvære.',
  'tasks', 'schedule', null, '0 8 1 * *', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"Månedlig sjekk om org ≥10 ansatte uten verneombud — flagges av analysis-job."}]'::jsonb,
  ARRAY['AML § 6-1'], ARRAY['aml-amu'], 'check', 10, true, null
),
(
  'aml-6-3-stop-work-amu',
  'AML', 'Kap. 6 — Verneombud', 6, 'AML § 6-3 — Stansing av farlig arbeid',
  'Verneombud stanser arbeid → automatisk AMU-sak + dokumentert i protokoll.',
  'AML § 6-3 (1): «Dersom verneombudet mener at det foreligger umiddelbar fare for arbeidstakernes liv eller helse … kan arbeidet stanses inntil Arbeidstilsynet har tatt stilling.» Stansing skal dokumenteres.',
  'vernerunder', 'db_event', 'ON_FINDING_REGISTERED', null, 'insert',
  '{"match":"field_equals","path":"finding_kind","value":"stansing"}'::jsonb,
  '[
    {"type":"add_amu_agenda_item","agendaItem":"Verneombud-stansing — § 6-3","priority":"kritisk"},
    {"type":"create_task","title":"Dokumenter stansing iht. § 6-3","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":1,"module":"vernerunder","sourceType":"§6-3"}
  ]'::jsonb,
  ARRAY['AML § 6-3'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-6-5-vo-training',
  'AML', 'Kap. 6 — Verneombud', 6, 'AML § 6-5 — Opplæring av verneombud',
  'Nytt verneombud valgt → § 6-5 grunnopplæring tildeles innen 6 måneder.',
  'AML § 6-5 + forskrift om organisering, ledelse og medvirkning § 3-18: «Arbeidsgiver skal sørge for at verneombud får den opplæring som er nødvendig …» 40-timers grunnkurs er standard.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"new_verneombud"}'::jsonb,
  '[{"type":"create_task","title":"Påmeld 40-timers verneombud-kurs","assignee":"{{event.assigneeUserId}}","ownerRole":"HR","dueInDays":180,"module":"learning","sourceType":"§6-5"}]'::jsonb,
  ARRAY['AML § 6-5'], ARRAY['aml-amu'], 'do', null, true, null
),

-- ─── Kap. 7 — AMU ──────────────────────────────────────────────────────
(
  'aml-7-1-amu-required-30',
  'AML', 'Kap. 7 — Arbeidsmiljøutvalg', 7, 'AML § 7-1 — Plikt til AMU',
  'Org når 30 ansatte → AMU-opprettelse pålagt (månedlig sjekk).',
  'AML § 7-1: «I virksomheter hvor det jevnlig sysselsettes minst 30 arbeidstakere, skal det være arbeidsmiljøutvalg.» 30-grensen er objektiv.',
  'tasks', 'schedule', null, '0 8 1 * *', 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"Månedlig sjekk om org ≥30 ansatte uten AMU."}]'::jsonb,
  ARRAY['AML § 7-1'], ARRAY['aml-amu'], 'check', 30, true, null
),
(
  'aml-7-2-amu-decisions-to-tasks',
  'AML', 'Kap. 7 — Arbeidsmiljøutvalg', 7, 'AML § 7-2 — AMUs oppgaver — vedtak materialiseres som tiltak',
  'Vedtak registrert i møte → oppgave til ansvarlig med 30-dagers frist.',
  'AML § 7-2 (4): «Utvalget kan beslutte at arbeidsgiver skal gjennomføre konkrete tiltak …» Uten oppfølgingsplikt blir vedtak symbolske.',
  'meetings', 'db_event', 'ON_MEETING_DECISION_LOGGED', null, 'insert',
  '{"match":"field_equals","path":"meetingType","value":"amu"}'::jsonb,
  '[{"type":"create_task","title":"Iverksett AMU-vedtak","assignee":"{{event.ownerUserId}}","ownerRole":"AMU","dueInDays":30,"module":"meetings","sourceType":"§7-2"}]'::jsonb,
  ARRAY['AML § 7-2'], ARRAY['aml-amu'], 'do', 30, true, null
),

-- ─── Kap. 8 — Informasjon og drøfting ──────────────────────────────────
(
  'aml-8-1-drofting-required-50',
  'AML', 'Kap. 8 — Informasjon og drøfting', 8, 'AML § 8-1 — Drøftingsplikt ≥50 ansatte',
  'Endring i bemanning / omorganisering registrert (org ≥50) → drøftingsmøte må logges før vedtak.',
  'AML § 8-1: «I virksomheter som jevnlig sysselsetter minst 50 arbeidstakere skal arbeidsgiver informere om og drøfte spørsmål av betydning …» Drøftingsplikt før beslutning.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"reorg_decision"}'::jsonb,
  '[{"type":"create_task","title":"Logg drøftingsmøte før vedtak (§ 8-1)","assignee":"Daglig leder","ownerRole":"daglig_leder","dueInDays":14,"module":"meetings","sourceType":"§8-1"}]'::jsonb,
  ARRAY['AML § 8-1', 'AML § 8-2'], ARRAY['aml-amu','hovedavtalen'], 'plan', 50, true, null
),

-- ─── Kap. 9 — Kontrolltiltak ───────────────────────────────────────────
(
  'aml-9-1-control-measure-ros',
  'AML', 'Kap. 9 — Kontrolltiltak', 9, 'AML § 9-1 — Kontrolltiltak krever ROS og drøfting',
  'Nytt kontrolltiltak foreslått → ROS-utkast + drøftingsmøte opprettes som forutsetninger.',
  'AML § 9-1 + § 9-2 (1): «Arbeidsgiver kan bare iverksette kontrolltiltak overfor arbeidstaker når tiltaket har saklig grunn … og kontrolltiltaket ikke innebærer en uforholdsmessig belastning.» Drøftingsplikt og ROS er minstekrav.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"control_measure_proposal"}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"kontrolltiltak","linkSource":true},
    {"type":"create_task","title":"Drøftingsmøte før kontrolltiltak (§ 9-2)","assignee":"Verneombud","ownerRole":"verneombud","dueInDays":14,"module":"meetings","sourceType":"§9-2"}
  ]'::jsonb,
  ARRAY['AML § 9-1', 'AML § 9-2'], ARRAY['aml-amu'], 'plan', null, true, null
),

-- ─── Kap. 10 — Arbeidstid ──────────────────────────────────────────────
(
  'aml-10-6-overtime-validation',
  'AML', 'Kap. 10 — Arbeidstid', 10, 'AML § 10-6 — Overtid skal være varslet og dokumentert',
  'Overtid registrert utover § 10-6 grenser → varsel til verneombud + dokumentasjonskrav.',
  'AML § 10-6 femte ledd: «Samlet arbeidstid må ikke overstige 13 timer i løpet av 24 timer og 48 timer i løpet av 7 dager.» Brudd er straffbart.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"overtime_breach"}'::jsonb,
  '[
    {"type":"send_notification","title":"§ 10-6 brudd","body":"Daglig/ukentlig arbeidstid overskredet — dokumentasjon kreves.","category":"compliance"},
    {"type":"create_task","title":"Dokumenter § 10-6 unntak","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":3,"module":"tasks","sourceType":"§10-6"}
  ]'::jsonb,
  ARRAY['AML § 10-6'], ARRAY['aml-amu'], 'check', null, true, null
),

-- ─── Kap. 11 — Barn og ungdom ──────────────────────────────────────────
(
  'aml-11-1-young-worker-limits',
  'AML', 'Kap. 11 — Barn og ungdom', 11, 'AML § 11-1 — Aldersgrenser og arbeidstidssperre',
  'Ungdom (under 18) ansatt → arbeidstidssperre + ROS av arbeidsoppgaver.',
  'AML § 11-1 + § 11-2: barn under 15 år skal ikke arbeide; ungdom 15–18 har strenge arbeidstidsbegrensninger. Brudd kan medføre stansing.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"young_worker_hired"}'::jsonb,
  '[
    {"type":"create_ros_draft","template":"ungdomsarbeid","linkSource":true},
    {"type":"create_task","title":"Verifiser § 11-2 arbeidstidsbegrensninger","assignee":"HR","ownerRole":"HR","dueInDays":7,"module":"tasks","sourceType":"§11"}
  ]'::jsonb,
  ARRAY['AML § 11-1', 'AML § 11-2'], ARRAY['aml-amu'], 'plan', null, true, null
),

-- ─── Kap. 12 — Permisjon ───────────────────────────────────────────────
(
  'aml-12-9-child-sickness',
  'AML', 'Kap. 12 — Rett til permisjon', 12, 'AML § 12-9 — Permisjon ved barns sykdom',
  'Søknad om permisjon for barns sykdom → automatisk godkjenningsoppgave (jf. folketrygd).',
  'AML § 12-9: «Arbeidstaker som har omsorg for barn under 12 år har rett til permisjon …» Lovfestet permisjonsrett, ikke arbeidsgivers skjønn.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"sick_child_leave_request"}'::jsonb,
  '[{"type":"create_task","title":"Bekreft § 12-9 permisjon","assignee":"HR","ownerRole":"HR","dueInDays":1,"module":"tasks","sourceType":"§12-9"}]'::jsonb,
  ARRAY['AML § 12-9'], ARRAY['aml-amu'], 'do', null, true, null
),

-- ─── Kap. 13 — Diskriminering ──────────────────────────────────────────
(
  'aml-13-1-discrimination-confidential',
  'AML', 'Kap. 13 — Vern mot diskriminering', 13, 'AML § 13-1 — Forbud mot diskriminering',
  'Diskrimineringsklage rapportert → konfidensiell triage + LDO-export-pakke genereres.',
  'AML § 13-1 + likestillings- og diskrimineringsloven §§ 6-11: diskriminering forbudt. LDO håndhever; saksdokumentasjon må bevares konfidensielt.',
  'survey', 'db_event', 'ON_SURVEY_RESPONSE_SUBMITTED', null, 'insert',
  '{"match":"and","conditions":[{"match":"field_equals","path":"surveySlug","value":"diskriminering"},{"match":"field_equals","path":"isAnonymous","value":"true"}]}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] Triage diskrimineringssak","assignee":"Personalleder","ownerRole":"HR","dueInDays":3,"module":"survey","sourceType":"§13-1"},
    {"type":"varsel_ldo_export","category":"diskriminering"}
  ]'::jsonb,
  ARRAY['AML § 13-1', 'Likestillings- og diskrimineringsloven § 26'], ARRAY['aml-amu'], 'do', null, true, null
),

-- ─── Kap. 14 — Ansettelse ──────────────────────────────────────────────
(
  'aml-14-5-written-contract',
  'AML', 'Kap. 14 — Ansettelse mv.', 14, 'AML § 14-5 — Skriftlig arbeidsavtale',
  'Ny ansettelse registrert → arbeidsavtale-utkast må være signert innen 1 måned.',
  'AML § 14-5: «Det skal inngås skriftlig arbeidsavtale i alle arbeidsforhold.» Manglende avtale er pålegg-grunn ved tilsyn.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"new_hire"}'::jsonb,
  '[{"type":"request_signature","document":"arbeidsavtale-{{event.assigneeUserId}}","deadlineDays":30}]'::jsonb,
  ARRAY['AML § 14-5', 'AML § 14-6'], ARRAY['aml-amu'], 'do', null, true, null
),
(
  'aml-14-9-temporary-4yr-limit',
  'AML', 'Kap. 14 — Ansettelse mv.', 14, 'AML § 14-9 — Midlertidig ansettelse 4-årsgrense',
  'Midlertidig kontrakt forlenges → kontroll mot 4-årsgrensen.',
  'AML § 14-9 sjuende ledd: «Arbeidstaker som har vært sammenhengende midlertidig ansatt i mer enn fire år … skal anses som fast ansatt.» Brudd gir krav om fast ansettelse.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"temp_contract_extension"}'::jsonb,
  '[{"type":"create_task","title":"Kontroll: 4-årsgrense § 14-9","assignee":"HR","ownerRole":"HR","dueInDays":1,"module":"tasks","sourceType":"§14-9"}]'::jsonb,
  ARRAY['AML § 14-9'], ARRAY['aml-amu'], 'check', null, true, null
),

-- ─── Kap. 15 — Opphør ──────────────────────────────────────────────────
(
  'aml-15-1-pre-dismissal-meeting',
  'AML', 'Kap. 15 — Opphør av arbeidsforhold', 15, 'AML § 15-1 — Drøfting før oppsigelse',
  'Oppsigelse foreslått → drøftingsmøte iht. § 15-1 må være logget før formell oppsigelse kan utstedes.',
  'AML § 15-1: «Før arbeidsgiver fatter beslutning om oppsigelse, skal spørsmålet så langt det er praktisk mulig drøftes med arbeidstaker og med arbeidstakers tillitsvalgte …» Manglende drøfting er ugyldighetsgrunn.',
  'tasks', 'db_event', 'ON_TASK_CREATED', null, 'insert',
  '{"match":"field_equals","path":"sourceType","value":"dismissal_proposal"}'::jsonb,
  '[
    {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft § 15-1 drøftingsmøte er gjennomført og protokollført før oppsigelse utstedes.","escalateAfterHours":48,"escalateToRole":"hms_leder"},
    {"type":"create_task","title":"Logg § 15-1 drøftingsmøte med tillitsvalgt","assignee":"HR","ownerRole":"HR","dueInDays":14,"module":"meetings","sourceType":"§15-1"}
  ]'::jsonb,
  ARRAY['AML § 15-1'], ARRAY['aml-amu','hovedavtalen'], 'plan', null, true, null
),

-- ─── IK-forskriften ────────────────────────────────────────────────────
(
  'ikf-5-7-action-monitoring',
  'IK-f', 'IK-forskriften § 5 — Plikter i internkontrollen', 100, 'IK-f § 5 nr. 7 — Overvåking av tiltak',
  'Alle tiltak (handlingsplan) som passerer fristen → automatisk eskalering + log til årlig gjennomgang.',
  'IK-f § 5 nr. 7: «foreta systematisk overvåkning og gjennomgang av internkontrollen for å sikre at den fungerer som forutsatt …» Uten overvåking er internkontroll en pro forma-øvelse.',
  'action_plan', 'db_event', 'ON_MEASURE_OVERDUE', null, 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"escalate","toRole":"hms_leder","note":"Tiltak forfalt — IK-f § 5 nr. 7 krever overvåking + handling."}]'::jsonb,
  ARRAY['IK-f § 5 nr. 7'], ARRAY['aml-amu','iso-45001'], 'check', null, true, null
),
(
  'ikf-5-8-annual-review-followup',
  'IK-f', 'IK-forskriften § 5 — Plikter i internkontrollen', 100, 'IK-f § 5 nr. 8 — Årlig gjennomgang',
  'Årlig gjennomgang signert → oppgave 300 dager fram for å planlegge neste års gjennomgang.',
  'IK-f § 5 nr. 8: «foreta systematisk overvåkning og gjennomgang av internkontrollen for å sikre at den fungerer som forutsatt.» Årlig kadens er minimum.',
  'internkontroll', 'db_event', 'ON_ANNUAL_REVIEW_SIGNED', null, 'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"create_task","title":"Planlegg neste års gjennomgang","assignee":"HMS-leder","ownerRole":"HMS","dueInDays":300,"module":"internkontroll","sourceType":"§5-8"}]'::jsonb,
  ARRAY['IK-f § 5 nr. 8'], ARRAY['aml-amu','iso-45001'], 'plan', null, true, null
),

-- ─── GDPR ──────────────────────────────────────────────────────────────
(
  'gdpr-33-breach-72h',
  'GDPR', 'GDPR / Personopplysningsloven — Behandlingsansvar', 200, 'GDPR Art. 33 — Personvernbrudd 72 timer',
  'Personvernbrudd-flagget kritisk hendelse → 72-timers timer starter ved aware_at + Datatilsynet-meldings-utkast.',
  'GDPR Art. 33 nr. 1 jf. personopplysningsloven § 26: «… senest 72 timer etter at vedkommende fikk kjennskap til bruddet … gi melding til tilsynsmyndigheten.» Forsinket melding er bøteleggbar.',
  'compliance_checklist', 'db_event', 'response_finding_critical', null, 'insert',
  '{"match":"array_any","path":"lawRefs","where":{"value":"GDPR Art. 33"}}'::jsonb,
  '[{"type":"create_task","title":"72-timers Datatilsynet-melding — vurder + send","assignee":"Personvernombud","ownerRole":"GDPR","dueInDays":3,"module":"compliance","sourceType":"GDPR § 33"}]'::jsonb,
  ARRAY['GDPR Art. 33', 'Personopplysningsloven § 26'], ARRAY['gdpr'], 'do', null, true, null
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
  enabled = excluded.enabled,
  notes = excluded.notes,
  updated_at = now();
