-- Meetings — consolidate AMU templates and try template-declared dashboard.
--
-- Why
--   Today the catalog ships four AML/AMU meeting templates (Q1, Q2, Q3
--   quarterly + annual årsmøte). The four templates duplicate ~80 % of
--   the agenda and force the chair to pick one per quarter even though
--   the law (AML § 7-2) doesn't require quarter-specific structure —
--   only quarterly cadence + an annual sammenfatting (§ 7-2 (6)).
--
--   This migration replaces the four with a single `amu-mote` template:
--     * cadence_hint = 'quarterly' (the lawful default)
--     * mandatory base items every AMU meeting needs (godkjenning,
--       sykefravær, avvik, vernerunder, åpne vedtak, eventuelt)
--     * recommended items for the annual sammenfatting (årsrapport,
--       neste års plan, § 7-2 (2) bokstav a-f) marked
--       `cadenceOverride: 'annual'` so the agenda builder knows to flag
--       them once a year (typically Q4)
--     * a `dashboard` block — first user of the new
--       `meeting_briefing` dashboard scope. Renders KPI tiles + donuts
--       + tables in a new "Dashboard" tab on the meeting detail view,
--       scoped to `meeting.reporting_period_*`.
--
--   The four legacy templates are flipped to `is_active = false` so
--   they vanish from the new-meeting gallery; existing meetings'
--   `system_template_id` references stay valid (definition_snapshot
--   makes the row immutable from the meeting's POV anyway).
--
-- Compliance posture (Arbeidstilsynet POV)
--   * AML § 7-2 (2) bokstavene a-f — surfaced as recommended annual
--     items so the chair adds them at the årsmøte; mandatory_topics
--     check still fires when an annual meeting omits them.
--   * AML § 7-2 (6) — årsrapport vedtak + distribusjon kept as
--     recommended-annual items.
--   * AML § 7-2 cadence — quarterly enforced via `cadence_hint`.
--   * AML § 7-1 — minimum_employee_count = 30 carried over.
--   * Restrisiko: chairs must remember to include the annual items
--     at Q4. Mitigation: agenda builder honors `cadenceOverride`
--     + `recommended` to surface them as "Foreslåtte saker" on
--     the agenda tab.
--
-- Idempotence
--   Single INSERT with `on conflict (id) do update set …` for the new
--   template. Legacy rows updated with simple `set is_active = false`.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Insert the new consolidated template                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order,
   default_confidentiality_level, minimum_employee_count,
   definition, metadata_schema)
values
('amu-mote', 'amu-mote',
 'AMU-møte',
 'Arbeidsmiljøutvalgets møte. Holdes minst kvartalsvis (AML § 7-2). Malen samler både ordinære kvartalsmøter og det årlige årsmøtet (§ 7-2 (6)) — agenda-bygger flagger anbefalte årssaker som dukker opp én gang per år.',
 'AML',
 array['AML','IK-f'],
 array[
   'AML § 7-1',
   'AML § 7-2',
   'AML § 7-2 første ledd',
   'AML § 7-2 (2)',
   'AML § 7-2 (2) bokstav a',
   'AML § 7-2 (2) bokstav b',
   'AML § 7-2 (2) bokstav c',
   'AML § 7-2 (2) bokstav d',
   'AML § 7-2 (2) bokstav e',
   'AML § 7-2 (2) bokstav f',
   'AML § 7-2 (6)',
   'AML § 3-1',
   'AML § 5-1',
   'AML § 6-2',
   'AML § 18-9',
   'IK-f § 5 nr. 7'
 ],
 'quarterly', 120, 'aml-amu', 100,
 'standard', 30,
 $def$
 {
   "preparationChecklist": [
     {"key":"invitation_sent","label":"Innkalling og saksliste distribuert minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true},
     {"key":"open_decisions_listed","label":"Liste over åpne vedtak fra tidligere møter klargjort","isMandatory":true,"lawRef":"AML § 7-2"}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10,"defaultDurationMinutes":5},
     {"key":"open_decisions_review","title":"Åpne vedtak fra tidligere møter — oppfølging","description":"Gå gjennom uavsluttede vedtak og status på tildelte oppgaver.","isMandatory":true,"lawRef":"AML § 7-2","defaultPosition":20,"defaultDurationMinutes":10,"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}},
     {"key":"sykefravar","title":"Sykefraværsutvikling","description":"Oversikt over sykefraværsutviklingen i perioden, fordelt på enhet.","isMandatory":true,"lawRef":"AML § 7-2 første ledd","defaultPosition":30,"defaultDurationMinutes":15,"dataBinding":{"source":"sick_leave_stats","window":"last_quarter","presentation":"trend"}},
     {"key":"avvik","title":"Avvik og hendelser — gjennomgang","description":"Behandling av avvik, hendelser og yrkesskader registrert i perioden.","isMandatory":true,"lawRef":"AML § 5-1","defaultPosition":40,"defaultDurationMinutes":15,"dataBinding":{"source":"incidents","window":"last_quarter","presentation":"table"}},
     {"key":"vernerunder","title":"Vernerunder — status og funn","description":"Gjennomgang av gjennomførte vernerunder og åpne funn.","isMandatory":true,"lawRef":"AML § 6-2","defaultPosition":50,"defaultDurationMinutes":15,"dataBinding":{"source":"vernerunde_findings","window":"last_quarter","presentation":"summary"}},
     {"key":"ros_high","title":"ROS — åpne høyrisiko-saker","description":"Behandling av åpne ROS-risikoer med risikoskår ≥ 12.","isMandatory":true,"lawRef":"AML § 3-1","defaultPosition":60,"defaultDurationMinutes":15,"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}},
     {"key":"varsling","title":"Varslingssaker — anonymisert oversikt","description":"Anonymisert rollup av varslingssaker per AML § 2A-7 (5).","isMandatory":false,"lawRef":"AML § 2A-7 (5)","conflictCheck":true,"defaultPosition":70,"defaultDurationMinutes":10,"dataBinding":{"source":"whistleblowing_anonymized","window":"last_quarter","presentation":"summary"}},
     {"key":"opplaering","title":"Opplæring — gjennomført vs. planlagt","isMandatory":false,"defaultPosition":80,"defaultDurationMinutes":10,"dataBinding":{"source":"training_completion","window":"last_quarter","presentation":"summary"}},

     {"key":"annual_bht_status","title":"Bedriftshelsetjeneste — årsoversikt","description":"§ 7-2 (2) bokstav a — BHT-årsrapport og bidrag til arbeidsmiljøet.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav a","defaultPosition":210,"defaultDurationMinutes":15,"dataBinding":{"source":"bht_annual_report","window":"last_year","presentation":"summary"}},
     {"key":"annual_training_plan","title":"Opplæringsplan HMS — neste år","description":"§ 7-2 (2) bokstav b — opplæring, instruksjon og opplysningsvirksomhet.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav b","defaultPosition":220,"defaultDurationMinutes":15,"dataBinding":{"source":"training_completion","window":"last_year","presentation":"table"}},
     {"key":"annual_major_plans_at","title":"Planer som krever Arbeidstilsynets samtykke (§ 18-9)","description":"§ 7-2 (2) bokstav c — § 18-9-saker. Hopp over hvis ingen slike planer foreligger året.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":230,"defaultDurationMinutes":10},
     {"key":"annual_other_plans","title":"Andre planer med vesentlig betydning for arbeidsmiljøet","description":"§ 7-2 (2) bokstav d — bygg, ny teknologi, rasjonalisering, arbeidsprosesser.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav d","defaultPosition":240,"defaultDurationMinutes":15},
     {"key":"annual_hms_system","title":"Etablering og vedlikehold av HMS-systemet (IK)","description":"§ 7-2 (2) bokstav e — virksomhetens systematiske HMS-arbeid.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav e","defaultPosition":250,"defaultDurationMinutes":15,"dataBinding":{"source":"ik_annual_review_status","window":"current","presentation":"summary"}},
     {"key":"annual_working_hours","title":"Helse- og velferd ved arbeidstidsordninger","description":"§ 7-2 (2) bokstav f — arbeidstidsordningens påvirkning på helse og velferd.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (2) bokstav f","defaultPosition":260,"defaultDurationMinutes":10},
     {"key":"annual_amu_composition","title":"AMU-sammensetning og verv","description":"Bekreft balansert sammensetning og terskelvurdering iht. AML § 7-1.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-1","defaultPosition":270,"defaultDurationMinutes":10,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}},
     {"key":"annual_report_vote","title":"Vedtak — AMU-årsrapport","description":"§ 7-2 (6) — årsrapport for foregående år vedtas.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (6)","voteRequired":true,"defaultPosition":280,"defaultDurationMinutes":15},
     {"key":"annual_report_distribution","title":"Distribusjon av årsrapport — styrende organer og ansattes organisasjoner","description":"§ 7-2 (6) krever distribusjon til BÅDE styrende organer OG ansattes organisasjoner.","isMandatory":false,"recommended":true,"cadenceOverride":"annual","lawRef":"AML § 7-2 (6)","defaultPosition":285,"defaultDurationMinutes":5},
     {"key":"annual_next_year_plan","title":"Vedtak — arbeidsmiljøplan for kommende år","isMandatory":false,"recommended":true,"cadenceOverride":"annual","voteRequired":true,"defaultPosition":290,"defaultDurationMinutes":15},
     {"key":"annual_evaluation","title":"Evaluering av AMUs arbeid","isMandatory":false,"recommended":true,"cadenceOverride":"annual","defaultPosition":295,"defaultDurationMinutes":10},

     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":900,"defaultDurationMinutes":5}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"secretary","count":1},
     {"role":"employer_rep"},
     {"role":"employee_rep"},
     {"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"],
   "dashboard": {
     "scopeId": "meeting_briefing",
     "defaultPeriod": "meeting_period",
     "layout": [
       {"id":"amu-kpi-incidents-total","kind":"kpi","datasetKey":"briefing_kpi_summary","title":"Avvik i perioden","valuePath":"incidentsTotal","subtitle":"Hendelser registrert","colSpan":"sm"},
       {"id":"amu-kpi-incidents-critical","kind":"kpi","datasetKey":"briefing_kpi_summary","title":"Kritiske avvik","valuePath":"incidentsCritical","subtitle":"Klassifisert som kritisk","colSpan":"sm"},
       {"id":"amu-kpi-sick-leave","kind":"kpi","datasetKey":"briefing_kpi_summary","title":"Sykefraværssaker","valuePath":"sickLeaveCases","subtitle":"Påbegynt i perioden","colSpan":"sm"},
       {"id":"amu-kpi-open-ros","kind":"kpi","datasetKey":"briefing_kpi_summary","title":"Åpne høyrisiko-ROS","valuePath":"openHighRos","subtitle":"Risikoskår ≥ 12","colSpan":"sm"},
       {"id":"amu-donut-incidents","kind":"donut","datasetKey":"briefing_incidents_by_status","title":"Avvik per status","segmentsPath":"segments","colSpan":"md"},
       {"id":"amu-donut-vernerunder","kind":"donut","datasetKey":"briefing_vernerunder_by_status","title":"Vernerunder per status","segmentsPath":"segments","colSpan":"md"},
       {"id":"amu-donut-sick-leave","kind":"donut","datasetKey":"briefing_sick_leave_by_dept","title":"Sykefravær per avdeling","segmentsPath":"segments","colSpan":"md"},
       {"id":"amu-table-open-decisions","kind":"table","datasetKey":"briefing_open_decisions","title":"Åpne vedtak fra tidligere møter","rowKeys":["decisionText","decisionAt"],"colSpan":"full"}
     ]
   }
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår (kun ved årsmøte)"}
 ]}
 $ms$::jsonb)

on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  sort_order = excluded.sort_order,
  default_confidentiality_level = excluded.default_confidentiality_level,
  minimum_employee_count = excluded.minimum_employee_count,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  is_active = true,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Deprecate the four legacy AMU templates                              │
-- │    Existing meetings keep working via definition_snapshot.              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set is_active = false,
    updated_at = now()
where id in (
  'amu-kvartalsmote-q1',
  'amu-kvartalsmote-q2',
  'amu-kvartalsmote-q3',
  'amu-arsmote-arsrapport'
)
  and is_active = true;

-- Verification (manual):
-- expected: amu-mote active, four legacy AMU templates inactive
-- select id, is_active, cadence_hint, sort_order
-- from public.meeting_system_templates
-- where id like 'amu-%' or id = 'amu-mote'
-- order by id;
--
-- expected: amu-mote.definition.dashboard.layout has 8 widgets
-- select jsonb_array_length(definition->'dashboard'->'layout')
-- from public.meeting_system_templates where id = 'amu-mote';
