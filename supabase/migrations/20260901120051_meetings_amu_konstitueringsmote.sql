-- Meetings — AMU konstitueringsmøte template (stretch / closeout).
--
-- Why
--   After every AMU election cycle (verneombud + AMU-medlemmer) the
--   newly-constituted utvalg needs a first meeting to:
--    * Bekrefte valgresultat fra siste valg
--    * Velge leder, nestleder, sekretær
--    * Avtale møtekalender for funksjonsperioden
--    * Plan for opplæring (40-timerskurs for nye medlemmer)
--    * Avklare arbeidsfordeling + saker fra forrige periode
--
--   Today the survey-as-election placeholder (`amu-valg-system`) hints
--   at a follow-up `amu-konstitueringsmote`. This migration seeds the
--   template so the chain is complete: valg avsluttes → resultat
--   sertifiseres → konstitueringsmøte planlegges.
--
-- Compliance posture
--   AML § 7-1 — sammensetning og funksjonsperiode (vanligvis 2 år).
--   AML § 7-4 + § 6-5 — opplæring 40 timer for verneombud og AMU-
--     medlemmer.
--   Forskrift om org. ledelse § 3-13 (verneombud funksjonstid 2 år).
--
-- Idempotent: ON CONFLICT (id) DO UPDATE.

set local search_path = public, pg_catalog;

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order,
   default_confidentiality_level, minimum_employee_count,
   definition, metadata_schema)
values
('amu-konstitueringsmote', 'amu-konstitueringsmote',
 'AMU konstitueringsmøte (etter valg)',
 'Første møte i AMU etter valg av nye medlemmer. Konstituerer utvalget for kommende funksjonsperiode: velger leder/nestleder, fastsetter møtekalender, planlegger opplæring (40-timerskurs) og avklarer overlevering fra forrige periode.',
 'AML',
 array['AML'],
 array[
   'AML § 7-1',
   'AML § 7-2',
   'AML § 7-4',
   'AML § 6-5',
   'Forskrift om org. ledelse § 3-13'
 ],
 'ad_hoc', 90, 'aml-amu', 145,
 'standard', 30,
 $def$
 {
   "preparationChecklist": [
     {"key":"election_result","label":"Valgresultat fra valg/survey er sertifisert og vedlagt","isMandatory":true,"lawRef":"AML § 7-1"},
     {"key":"prior_minutes","label":"Protokoll fra siste møte i forrige funksjonsperiode vedlagt","isMandatory":false},
     {"key":"draft_calendar","label":"Utkast til møtekalender for kommende periode","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling","isMandatory":true,"defaultPosition":10},
     {"key":"composition_verify","title":"Bekreftelse av AMU-sammensetning","description":"Verifiser at utvalget har likt antall arbeidsgiver- og arbeidstakerrepresentanter, samt at terskelen på 30 ansatte er møtt iht. AML § 7-1.","isMandatory":true,"lawRef":"AML § 7-1","defaultPosition":20,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}},
     {"key":"chair_election","title":"Valg av leder og nestleder","description":"AMU velger selv leder og nestleder blant medlemmene. Vervet veksler typisk mellom arbeidsgiver- og arbeidstakerside hver toårsperiode.","isMandatory":true,"voteRequired":true,"lawRef":"AML § 7-1","defaultPosition":30},
     {"key":"secretary_role","title":"Sekretærfunksjon — utpeking","description":"AMU avtaler hvem som fører protokoll for kommende periode (kan være fast sekretær eller rullerende blant medlemmer).","isMandatory":true,"defaultPosition":40},
     {"key":"function_period","title":"Funksjonsperiode og tidsplan","description":"Bekreft funksjonsperiodens varighet (vanligvis 2 år, jf. Forskrift om org. ledelse § 3-13) og når neste valg skal avholdes.","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-13","defaultPosition":50},
     {"key":"training_plan","title":"Opplæring — 40-timerskurs for nye medlemmer","description":"AML § 6-5 og § 7-4 krever at verneombud og AMU-medlemmer får nødvendig opplæring (vanligvis 40 timer). Avtal når kurs gjennomføres for nye medlemmer.","isMandatory":true,"lawRef":"AML § 7-4","defaultPosition":60,"dataBinding":{"source":"training_completion","window":"last_year","presentation":"table"}},
     {"key":"meeting_calendar","title":"Møtekalender — kommende periode","description":"Vedta møtekalender med minst 4 kvartalsmøter pr. år, jf. Forskrift om org. ledelse § 3-16.","isMandatory":true,"voteRequired":true,"defaultPosition":70},
     {"key":"handover","title":"Overlevering fra forrige periode","description":"Gå gjennom åpne saker, vedtak og oppgaver fra forrige AMU-periode. Bekreft hvem som følger opp hva.","isMandatory":true,"defaultPosition":80,"dataBinding":{"source":"open_decisions","window":"all_open","presentation":"summary"}},
     {"key":"contact_routines","title":"Kontaktrutiner — verneombud, BHT, ledelse","description":"Avklar kommunikasjonsrutiner og hvem som tar imot saker mellom møtene.","isMandatory":false,"defaultPosition":90},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":100}
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
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true},
   {"key":"function_period_start","kind":"date","label":"Funksjonsperiode start","required":true},
   {"key":"function_period_end","kind":"date","label":"Funksjonsperiode slutt"}
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

-- Verification:
-- select id, label, is_active, sort_order, minimum_employee_count
-- from public.meeting_system_templates
-- where id = 'amu-konstitueringsmote';
