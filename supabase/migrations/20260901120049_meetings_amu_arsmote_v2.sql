-- Meetings — optimised AMU årsmøte template (H10).
--
-- Why
--   The H0 verification log + supervisor review identified the existing
--   `amu-arsrapport-q4` template as the highest-stakes, most often
--   audited meeting type. H1-H9 layered fixes onto it but the template
--   still carries the old slug ("q4") and was structured for citation-
--   correctness rather than for the new schema fields
--   (default_confidentiality_level, minimum_employee_count, dataBinding,
--   attendee role enum including tillitsvalgt + hovedverneombud).
--
--   This migration inserts a NEW template `amu-arsmote-arsrapport`
--   built from the ground up against the H0-verified law refs,
--   schema additions, and binding-aware agenda. The legacy
--   `amu-arsrapport-q4` is marked is_active = false so it disappears
--   from new-meeting gallery while preserving historical meeting
--   references (existing meetings.system_template_id stays valid).
--
-- Compliance posture
--   * AML § 7-1 — 30 ansatte threshold surfaced via
--     minimum_employee_count.
--   * AML § 7-2 (2) bokstavene a-f — all six surfaced as discrete
--     mandatory agenda items with correct sub-letter citations
--     (verified live on lovdata).
--   * AML § 7-2 (6) — årsrapport vedtak + distribution-step
--     ("til styrende organer og arbeidstakernes organisasjoner")
--     as two separate items.
--   * Forskrift om org. ledelse § 3-16 — minority-dissent (mindretall)
--     registration surfaced as a checklist note.
--   * Attendee roles include the newly added `tillitsvalgt` +
--     `hovedverneombud` from H4.
--   * dataBinding declarations on every input-driven item so the
--     Møteforberedelse-pakke (H9) can pre-fill the protocol.

set local search_path = public, pg_catalog;

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order,
   default_confidentiality_level, minimum_employee_count,
   definition, metadata_schema)
values
('amu-arsmote-arsrapport', 'amu-arsmote-arsrapport',
 'AMU årsmøte og årsrapport (v2)',
 'Årlig sammenfattende AMU-møte med behandling og vedtak av AMU-årsrapport (AML § 7-2 (6)), neste års arbeidsmiljøplan og evaluering. Møtet er strukturert rundt § 7-2 (2) bokstavene a-f for full audit-dekning.',
 'AML',
 array['AML', 'IK-f'],
 array[
   'AML § 7-1',
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
   'AML § 18-9',
   'IK-f § 5 nr. 7',
   'Forskrift om org. ledelse § 3-16'
 ],
 'annual', 180, 'aml-amu', 150,
 'standard', 30,
 $def$
 {
   "preparationChecklist": [
     {"key":"invitation_sent","label":"Innkalling og saksliste distribuert til alle AMU-medlemmer (anbefalt 7 dager før)","isMandatory":true},
     {"key":"annual_report_draft","label":"Utkast til AMU-årsrapport distribuert til medlemmene","isMandatory":true,"lawRef":"AML § 7-2 (6)"},
     {"key":"workplan_draft","label":"Utkast til arbeidsmiljøplan for kommende år vedlagt","isMandatory":true},
     {"key":"bht_input","label":"Bedriftshelsetjenestens årsrapport mottatt og distribuert","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav a"},
     {"key":"ia_data","label":"Sykefraværsdata og IA-status ferdigstilt","isMandatory":false},
     {"key":"minority_dissent_aware","label":"Sekretær har klargjort registrering av flertall/mindretall ved avstemning","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-16"}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll fra forrige møte","isMandatory":true,"defaultPosition":10},
     {"key":"amu_composition","title":"AMU-sammensetning, verv og terskelvurdering (≥ 30 ansatte)","description":"Bekreft at AMU er sammensatt med likt antall arbeidsgiver- og arbeidstakerrepresentanter, og at organisasjonen overskrider terskelen på 30 ansatte iht. AML § 7-1.","isMandatory":true,"lawRef":"AML § 7-1","defaultPosition":20,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}},
     {"key":"bht_status","title":"Bedriftshelsetjeneste — årsoversikt og bidrag","description":"Behandle BHT-årsrapport og bidrag til arbeidsmiljøet, jf. § 7-2 (2) bokstav a.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav a","defaultPosition":30,"dataBinding":{"source":"bht_annual_report","window":"last_year","presentation":"summary"}},
     {"key":"training_plan","title":"Opplæring HMS — gjennomført vs. planlagt + neste års plan","description":"Bokstav b — opplæring, instruksjon og opplysningsvirksomhet med betydning for arbeidsmiljøet.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav b","defaultPosition":40,"dataBinding":{"source":"training_completion","window":"last_year","presentation":"table"}},
     {"key":"major_plans_samtykke","title":"Planer som krever Arbeidstilsynets samtykke (§ 18-9)","description":"Bokstav c — § 18-9-saker. Ikke-mandatory dersom ingen slike planer foreligger året.","isMandatory":false,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":50},
     {"key":"other_plans","title":"Andre planer med vesentlig betydning for arbeidsmiljøet","description":"Bokstav d — bygg, ny teknologi, rasjonalisering, arbeidsprosesser, forebyggende vernetiltak.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav d","defaultPosition":60},
     {"key":"hms_system","title":"Etablering og vedlikehold av HMS-systemet (IK)","description":"Bokstav e — virksomhetens systematiske HMS-arbeid.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav e","defaultPosition":70,"dataBinding":{"source":"ik_annual_review_status","window":"current","presentation":"summary"}},
     {"key":"working_hours","title":"Helse- og velferdsspørsmål knyttet til arbeidstidsordninger","description":"Bokstav f — arbeidstidsordningens påvirkning på arbeidstakernes helse og velferd.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav f","defaultPosition":80},
     {"key":"sick_leave_year","title":"Sykefraværsutvikling — året","description":"Korttid / langtid / IA-status, fordelt på enhet. Sammenligning med fjoråret.","isMandatory":true,"lawRef":"AML § 7-2 første ledd","defaultPosition":90,"dataBinding":{"source":"sick_leave_stats","window":"last_year","presentation":"trend"}},
     {"key":"incidents_year","title":"Hendelser og yrkesskader — årsoversikt","description":"Hendelses- og skadeoversikt med fordeling per kategori og status.","isMandatory":true,"lawRef":"AML § 5-1","defaultPosition":100,"dataBinding":{"source":"incidents","window":"last_year","presentation":"table"}},
     {"key":"ros_year","title":"ROS-status og åpne høyrisiko-vurderinger","description":"Åpne ROS-risikoer med risikoskår ≥ 12 prioriteres for behandling.","isMandatory":true,"lawRef":"AML § 3-1","defaultPosition":110,"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}},
     {"key":"vernerunder_year","title":"Vernerunder — årsoversikt og signaturstatus","isMandatory":true,"lawRef":"AML § 6-2","defaultPosition":120,"dataBinding":{"source":"vernerunde_findings","window":"last_year","presentation":"summary"}},
     {"key":"whistleblowing_overview","title":"Varslingssaker — anonymisert årsoversikt","description":"Anonymisering er obligatorisk per AML § 2A-7 (5), ikke valgfri.","isMandatory":true,"lawRef":"AML § 2A-7 (5)","conflictCheck":true,"defaultPosition":130,"dataBinding":{"source":"whistleblowing_anonymized","window":"last_year","presentation":"summary"}},
     {"key":"annual_report_vote","title":"Vedtak — AMU-årsrapport","description":"Vedta endelig AMU-årsrapport. Anbefalt innhold: AMU-sammensetning, antall møter, oversikt over saker, vurdering av arbeidsmiljøsituasjonen, forslag og tiltak. (Direktoratet har per nå ikke fastsatt forskriftskrav til innhold; dette er beste praksis.)","isMandatory":true,"lawRef":"AML § 7-2 (6)","voteRequired":true,"defaultPosition":200},
     {"key":"annual_report_distribution","title":"Distribusjon — styrende organer og ansattes organisasjoner","description":"Bekreft at rapporten distribueres til både styrende organer og arbeidstakernes organisasjoner. § 7-2 (6) krever begge.","isMandatory":true,"lawRef":"AML § 7-2 (6)","defaultPosition":210},
     {"key":"next_year_plan_vote","title":"Vedtak — arbeidsmiljøplan for kommende år","isMandatory":true,"voteRequired":true,"defaultPosition":220},
     {"key":"evaluation","title":"Evaluering av AMUs arbeid","isMandatory":true,"defaultPosition":230},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":300}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"secretary","count":1},
     {"role":"employer_rep"},
     {"role":"employee_rep"},
     {"role":"tillitsvalgt"},
     {"role":"verneombud"},
     {"role":"hovedverneombud","count":1}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"employeeCount","kind":"number","label":"Antall ansatte ved rapporttidspunkt","required":true}
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
-- │ Deprecate legacy `amu-arsrapport-q4`                                     │
-- │   - hide from new-meeting gallery (is_active = false)                    │
-- │   - existing meetings using its system_template_id stay valid           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set is_active = false,
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and is_active = true;

-- Verification:
-- expected: amu-arsmote-arsrapport active, amu-arsrapport-q4 inactive
-- select id, is_active, sort_order, default_confidentiality_level, minimum_employee_count
-- from public.meeting_system_templates
-- where id like 'amu-ars%';
