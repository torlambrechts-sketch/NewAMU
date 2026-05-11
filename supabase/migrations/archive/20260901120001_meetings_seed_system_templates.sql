-- Meetings — seed system templates.
--
-- 18 system templates spanning the legally mandated meeting types in Norway
-- plus ISO and GDPR management reviews. Every template encodes:
--   * `frameworks[]` and `law_refs[]` for dashboard drill-down + compliance
--     gap-and-audit planner.
--   * `cadence_hint` for the Årshjul integration.
--   * `definition.agendaItems[]` with `isMandatory: true` where the law forces
--     a specific topic — the UI surfaces these as a "Manglende obligatoriske
--     saker" check.
--   * `definition.requiredAttendees[]` for quorum + composition validation.
--   * `definition.invitationLeadDays` where law specifies notice (7 days for
--     AMU per Forskrift om org. ledelse § 3-2).
--
-- Self-audit (Arbeidstilsynet POV):
--   * AML § 7-2 (2) — 4 AMU templates cover quarterly + annual cycle.
--   * AML § 7-2 (6) — Q4 årsmøte template forces annual report sign-off as
--     mandatory agenda item.
--   * AML § 6-2 / § 6-5 — verneombud-mote with quarterly cadence.
--   * AML § 8-2 / § 15-1 — drøftingsmøte med begrunnelse / alternativer /
--     konsekvenser / ansattes synspunkter som obligatoriske saker.
--   * Likestillingsloven § 26 / § 26a — drofting-likestilling med
--     lønnskartlegging og kjønnsbalanse som obligatoriske saker.
--   * Hovedavtalen § 9-3 — bedriftsutvalg for orgs med tariffavtale.
--   * AML § 2A-7 (5) — varslingsutvalg som eget templat med COI-prompt.
--   * ISO 9001/27001/45001/14001 § 9.3 — ledelsens gjennomgang etter
--     klausul-spesifikke obligatoriske input/output-saker.
--   * GDPR art. 30 / art. 35 — ROPA og DPIA-gjennomgangsmaler.
--   * Restrisiko: secret-ballot elections forblir i modules/amu (egen modul);
--     legally binding eSignature deferred — protokollsignaturer ligger på
--     "Bekreftelse (forhåndsregistrering — ikke juridisk signatur)" inntil
--     BankID-integrasjon er på plass.
--
-- Idempotent. Re-applying upserts only the columns we own; admin-side
-- override fields on `meeting_org_template_settings` are untouched.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — AMU-syklus                                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order, definition, metadata_schema)
values
('amu-kvartalsmote-q1', 'amu-kvartalsmote-q1',
 'AMU kvartalsmøte Q1',
 'Første kvartalsmøte i AMU. Standard agenda: vernerunde-status, sykefraværsutvikling, opplæringsplan HMS.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 7-2 (2)', 'IK-f § 5 nr. 7'],
 'quarterly', 120, 'aml-amu', 110,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true},
     {"key":"open_actions","label":"Status på åpne tiltak fra forrige møte","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"vernerunder","title":"Vernerunder — status og funn","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav b","defaultPosition":20},
     {"key":"sykefravar","title":"Sykefraværsutvikling","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":30},
     {"key":"opplaering","title":"Opplæringsplan HMS","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav e","defaultPosition":40},
     {"key":"avvik","title":"Avvik og hendelser","isMandatory":true,"lawRef":"IK-f § 5 nr. 7","defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
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
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon","required":false},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-kvartalsmote-q2', 'amu-kvartalsmote-q2',
 'AMU kvartalsmøte Q2',
 'Andre kvartalsmøte. Fokus på arbeidsmiljøundersøkelse, ROS-status og fysisk arbeidsmiljø.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 4-1', 'AML § 4-4'],
 'quarterly', 120, 'aml-amu', 120,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"arbeidsmiljoundersokelse","title":"Arbeidsmiljøundersøkelse — gjennomgang og oppfølging","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav d","defaultPosition":20},
     {"key":"ros","title":"ROS-status","isMandatory":true,"lawRef":"AML § 3-1","defaultPosition":30},
     {"key":"fysisk_miljo","title":"Fysisk arbeidsmiljø (ergonomi, støy, klima)","isMandatory":true,"lawRef":"AML § 4-4","defaultPosition":40},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-kvartalsmote-q3', 'amu-kvartalsmote-q3',
 'AMU kvartalsmøte Q3',
 'Tredje kvartalsmøte. Fokus på psykososialt arbeidsmiljø, varslingssaker og mobbing/trakassering.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 4-3', 'AML § 2A-7 (5)'],
 'quarterly', 120, 'aml-amu', 130,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"psykososial","title":"Psykososialt arbeidsmiljø","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":20},
     {"key":"varsling","title":"Varslingssaker — anonymisert oversikt","isMandatory":true,"lawRef":"AML § 2A-7 (5)","defaultPosition":30,"conflictCheck":true},
     {"key":"mobbing","title":"Mobbing og trakassering — rutiner og saker","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":40},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-arsrapport-q4', 'amu-arsrapport-q4',
 'AMU årsmøte og årsrapport (Q4)',
 'Årsmøte med behandling av AMU-årsrapport per AML § 7-2 (6) og neste års arbeidsmiljøplan.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2 (6)', 'Forskrift om org. ledelse § 3-4'],
 'annual', 180, 'aml-amu', 140,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"draft_report","label":"Utkast til AMU-årsrapport distribuert til medlemmene","isMandatory":true,"lawRef":"AML § 7-2 (6)"},
     {"key":"plan_draft","label":"Utkast til arbeidsmiljøplan for kommende år","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"arsrapport","title":"AMU-årsrapport — gjennomgang og vedtak","isMandatory":true,"lawRef":"AML § 7-2 (6)","voteRequired":true,"defaultPosition":20},
     {"key":"composition","title":"AMU-sammensetning og verv neste år","isMandatory":true,"lawRef":"AML § 7-1","defaultPosition":30},
     {"key":"arbeidsmiljoplan","title":"Arbeidsmiljøplan for neste år","isMandatory":true,"voteRequired":true,"defaultPosition":40},
     {"key":"sykefravar_arsstats","title":"Sykefraværsstatistikk — årsoversikt","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":50},
     {"key":"hendelser","title":"Yrkesskader og hendelser — årsoversikt","isMandatory":true,"lawRef":"AML § 5-1","defaultPosition":60},
     {"key":"opplaering","title":"Opplæring — gjennomført vs. planlagt","isMandatory":true,"defaultPosition":70},
     {"key":"evaluation","title":"Evaluering av AMUs arbeid","isMandatory":true,"defaultPosition":80},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
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
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — verneombud, bedriftsutvalg, varsling                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('verneombud-mote', 'verneombud-mote',
 'Verneombudsmøte',
 'Møte for alle verneombud + hovedverneombud. Gjennomgang av vernerunder, avvik og opplæringsbehov.',
 'AML',
 array['AML','IK-f'],
 array['AML § 6-2', 'AML § 6-5'],
 'quarterly', 90, 'aml-amu', 210,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling sendt til verneområdene","isMandatory":true},
     {"key":"vernerunde_rapporter","label":"Siste vernerunde-rapporter samlet inn","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"vernerunder","title":"Vernerunder per verneområde","isMandatory":true,"lawRef":"AML § 6-2","defaultPosition":20},
     {"key":"avvik","title":"Avvik fra verneombudene","isMandatory":true,"lawRef":"IK-f § 5 nr. 7","defaultPosition":30},
     {"key":"opplaering","title":"Opplæring og 40-timerskurs","isMandatory":true,"lawRef":"AML § 6-5","defaultPosition":40},
     {"key":"saker_amu","title":"Saker til neste AMU","isMandatory":false,"defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"verneombud"}
   ],
   "invitationLeadDays": 5,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"Verneombud som deltar","required":true}
 ]}
 $ms$::jsonb),

('bedriftsutvalg', 'bedriftsutvalg',
 'Bedriftsutvalgsmøte',
 'Bedriftsutvalg for virksomheter med tariffavtale (Hovedavtalen § 9-3). Drøfting av drift, økonomi og organisasjonsspørsmål.',
 'AML',
 array['AML','Hovedavtalen'],
 array['Hovedavtalen § 9-3', 'AML § 4-2'],
 'quarterly', 120, 'aml-drofting', 220,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling sendt minst 1 uke før møtet","isMandatory":true},
     {"key":"drift_rapport","label":"Driftsrapport vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"drift","title":"Driftsstatus","isMandatory":true,"defaultPosition":20},
     {"key":"okonomi","title":"Økonomisk status og budsjettoppfølging","isMandatory":true,"lawRef":"Hovedavtalen § 9-3","defaultPosition":30},
     {"key":"organisasjon","title":"Organisasjonsendringer og ansettelser","isMandatory":false,"defaultPosition":40},
     {"key":"medvirkning","title":"Medvirkning og medbestemmelse","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"Utvalgsmedlemmer","required":true}
 ]}
 $ms$::jsonb),

('varslingsutvalg', 'varslingsutvalg',
 'Varslingsutvalgsmøte',
 'Behandling av varslingssaker. Konfidensielt møte med taushetsplikt og COI-prompt.',
 'AML',
 array['AML'],
 array['AML § 2A-7', 'AML § 2A-7 (5)'],
 'ad_hoc', 90, 'aml-amu', 230,
 $def$
 {
   "preparationChecklist": [
     {"key":"confidentiality","label":"Taushetsplikt bekreftet av alle deltakere","isMandatory":true,"lawRef":"AML § 2A-7 (5)"},
     {"key":"coi_check","label":"Interessekonflikt-sjekk gjennomført","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og taushetserklæring","isMandatory":true,"defaultPosition":10},
     {"key":"sak","title":"Saksgjennomgang (anonymisert ved behov)","isMandatory":true,"conflictCheck":true,"defaultPosition":20},
     {"key":"tiltak","title":"Tiltak og oppfølging","isMandatory":true,"voteRequired":true,"defaultPosition":30},
     {"key":"oversikt","title":"Oversikt over åpne saker","isMandatory":true,"defaultPosition":40}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1}
   ],
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Utvalgsmedlemmer","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — drøfting og medvirkning                                            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('drofting-omstilling', 'drofting-omstilling',
 'Drøftingsmøte — omstilling / nedbemanning',
 'Drøftingsplikten ved omstilling, oppsigelser eller masseoppsigelser. Obligatoriske saker per AML § 8-2 og § 15-1.',
 'AML',
 array['AML'],
 array['AML § 8-2', 'AML § 15-1', 'AML § 15-2'],
 'ad_hoc', 120, 'aml-drofting', 310,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling med begrunnelse sendt i god tid før møtet","isMandatory":true,"lawRef":"AML § 8-2"},
     {"key":"alternativer","label":"Alternativer utredet","isMandatory":true},
     {"key":"konsekvenser","label":"Konsekvensanalyse vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"begrunnelse","title":"Begrunnelse for tiltaket","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":10},
     {"key":"alternativer","title":"Alternative løsninger som er vurdert","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":20},
     {"key":"konsekvenser","title":"Konsekvenser for arbeidstakerne","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":30},
     {"key":"synspunkter","title":"Ansattes synspunkter","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":40},
     {"key":"oppfolging","title":"Avtale om videre prosess","isMandatory":true,"defaultPosition":50}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"department","kind":"department","label":"Avdeling berørt","required":true},
   {"key":"participants","kind":"participants","label":"Deltakere","required":true}
 ]}
 $ms$::jsonb),

('drofting-likestilling', 'drofting-likestilling',
 'Drøftingsmøte — aktivitetsplikt likestilling',
 'Årlig drøfting av lønnskartlegging og likestillingsarbeid per Likestillings- og diskrimineringsloven § 26 og § 26a.',
 'AML',
 array['Likestillingsloven'],
 array['Likestillings- og diskrimineringsloven § 26', 'Likestillings- og diskrimineringsloven § 26a'],
 'annual', 120, 'aml-drofting', 320,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling med utkast til redegjørelse vedlagt","isMandatory":true},
     {"key":"lonnskartlegging","label":"Lønnskartlegging gjennomført","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26a"}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling","isMandatory":true,"defaultPosition":10},
     {"key":"lonnskartlegging","title":"Lønnskartlegging — kjønnsforskjeller","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26a","defaultPosition":20},
     {"key":"kjonnsbalanse","title":"Kjønnsbalanse på alle nivåer","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26","defaultPosition":30},
     {"key":"tilrettelegging","title":"Tilretteleggingsbehov og fravær","isMandatory":true,"defaultPosition":40},
     {"key":"diskriminering","title":"Risiko for diskriminering — kartlegging og tiltak","isMandatory":true,"defaultPosition":50},
     {"key":"redegjorelse","title":"Vedtak — redegjørelse til årsberetningen","isMandatory":true,"voteRequired":true,"defaultPosition":60}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Deltakere","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

('allmote', 'allmote',
 'Allmøte',
 'Halvårlig allmøte. Informasjon, høring og medvirkning per AML § 4-2.',
 'AML',
 array['AML'],
 array['AML § 4-2'],
 'semiannual', 60, 'aml-drofting', 330,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Agenda kommunisert minst 3 dager før","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"strategi","title":"Strategisk status","isMandatory":false,"defaultPosition":10},
     {"key":"drift","title":"Driftsstatus","isMandatory":false,"defaultPosition":20},
     {"key":"hms","title":"HMS-tema","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":30},
     {"key":"sporsmal","title":"Spørsmål fra ansatte","isMandatory":true,"defaultPosition":40}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1}
   ],
   "protocolRoles": ["chair"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"}
 ]}
 $ms$::jsonb),

('personalmote', 'personalmote',
 'Personalmøte',
 'Månedlig personalmøte i enheten. Informasjon, høring og HMS-tema.',
 'AML',
 array['AML'],
 array['AML § 4-2'],
 'monthly', 45, 'aml-drofting', 340,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Saksliste sendt til enheten","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"info","title":"Informasjon","isMandatory":false,"defaultPosition":10},
     {"key":"hms","title":"HMS-tema","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":20},
     {"key":"sporsmal","title":"Spørsmål og innspill fra ansatte","isMandatory":false,"defaultPosition":30}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1}
   ],
   "protocolRoles": ["chair"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"department","kind":"department","label":"Avdeling","required":true},
   {"key":"team","kind":"team","label":"Team"}
 ]}
 $ms$::jsonb),

('mus', 'mus',
 'Medarbeidersamtale (MUS)',
 'Årlig medarbeidersamtale mellom leder og ansatt. Mål, utvikling, trivsel og HMS.',
 'AML',
 array['AML'],
 array['AML § 4-2', 'AML § 4-3'],
 'annual', 60, 'personal', 410,
 $def$
 {
   "preparationChecklist": [
     {"key":"prep_form","label":"Forberedelsesskjema delt med ansatt","isMandatory":true},
     {"key":"prev_mus","label":"Forrige MUS-notater tilgjengelig","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"trivsel","title":"Trivsel og arbeidsmiljø","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":10},
     {"key":"mal","title":"Mål og oppgaver","isMandatory":true,"defaultPosition":20},
     {"key":"utvikling","title":"Utvikling og kompetanse","isMandatory":true,"defaultPosition":30},
     {"key":"hms","title":"HMS — fysisk og psykososialt","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":40},
     {"key":"varsling","title":"Kjennskap til varslingsrutiner","isMandatory":true,"lawRef":"AML § 2A-7","defaultPosition":50}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"member","count":1}
   ],
   "protocolRoles": ["chair","member"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Leder og ansatt","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ ISO — ledelsens gjennomgang (klausul 9.3)                                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('iso-9001-ledelsens-gjennomgang', 'iso-9001-ledelsens-gjennomgang',
 'ISO 9001 — Ledelsens gjennomgang',
 'Årlig ledelsens gjennomgang av kvalitetsstyringssystemet per ISO 9001:2015 § 9.3.',
 'ISO_9001',
 array['ISO 9001:2015'],
 array['ISO 9001:2015 § 9.3', 'ISO 9001:2015 § 9.3.2', 'ISO 9001:2015 § 9.3.3'],
 'annual', 180, 'iso-styring', 510,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"Input til ledelsens gjennomgang samlet (§ 9.3.2)","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2"},
     {"key":"agenda_sent","label":"Innkalling og agenda sendt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige ledelsens gjennomgang","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 a","defaultPosition":10},
     {"key":"context","title":"Endringer i eksterne og interne forhold","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 b","defaultPosition":20},
     {"key":"performance","title":"Informasjon om ytelsen til kvalitetsstyringssystemet","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c","defaultPosition":30},
     {"key":"customer","title":"Tilbakemelding fra kunder","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.1","defaultPosition":40},
     {"key":"quality_objectives","title":"Status for kvalitetsmål","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.2","defaultPosition":50},
     {"key":"audit_results","title":"Revisjonsresultater","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.5","defaultPosition":60},
     {"key":"resources","title":"Tilstrekkelighet av ressurser","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 e","defaultPosition":70},
     {"key":"opportunities","title":"Muligheter for forbedring","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 g","defaultPosition":80},
     {"key":"decisions","title":"Beslutninger om forbedring og ressursbehov","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"location","kind":"location","label":"Lokasjon"}
 ]}
 $ms$::jsonb),

('iso-27001-isms-gjennomgang', 'iso-27001-isms-gjennomgang',
 'ISO 27001 — ISMS-gjennomgang',
 'Årlig ledelsens gjennomgang av informasjonssikkerhetsstyringssystemet per ISO/IEC 27001:2022 § 9.3.',
 'ISO_27001',
 array['ISO 27001:2022'],
 array['ISO/IEC 27001:2022 § 9.3', 'ISO/IEC 27001:2022 § 9.3.2', 'ISO/IEC 27001:2022 § 9.3.3'],
 'annual', 180, 'iso-styring', 520,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"ISMS-input samlet (incidents, audits, KRIs)","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2"},
     {"key":"risk_register","label":"Oppdatert risikoregister tilgjengelig","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 a","defaultPosition":10},
     {"key":"context","title":"Endringer i interessenter og krav","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 b","defaultPosition":20},
     {"key":"info_security","title":"Informasjonssikkerhetsytelse","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 c","defaultPosition":30},
     {"key":"incidents","title":"Sikkerhetshendelser og responsstatus","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 c.4","defaultPosition":40},
     {"key":"risk_assessment","title":"Risikovurdering og restrisiko","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 8.2","defaultPosition":50},
     {"key":"controls","title":"Effektivitet av kontrollene (Annex A)","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 Annex A","defaultPosition":60},
     {"key":"resources","title":"Ressurser og kompetanse","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 e","defaultPosition":70},
     {"key":"decisions","title":"Beslutninger om forbedring og kontrolljustering","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"isms_scope","kind":"text","label":"ISMS-omfang"}
 ]}
 $ms$::jsonb),

('iso-45001-ledelsens-gjennomgang', 'iso-45001-ledelsens-gjennomgang',
 'ISO 45001 — Ledelsens gjennomgang',
 'Årlig ledelsens gjennomgang av HMS-styringssystemet per ISO 45001:2018 § 9.3.',
 'ISO_45001',
 array['ISO 45001:2018'],
 array['ISO 45001:2018 § 9.3'],
 'annual', 180, 'iso-styring', 530,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"HMS-input samlet (hendelser, ROS, audit, opplæring)","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 a","defaultPosition":10},
     {"key":"context","title":"Endringer i eksterne og interne forhold","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 b","defaultPosition":20},
     {"key":"policy","title":"HMS-policy og HMS-mål","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c","defaultPosition":30},
     {"key":"performance","title":"HMS-ytelse","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.1","defaultPosition":40},
     {"key":"consultation","title":"Høring og medvirkning fra ansatte","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.5","defaultPosition":50},
     {"key":"risks","title":"Risiko og muligheter","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.6","defaultPosition":60},
     {"key":"resources","title":"Ressurser og kompetanse","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 e","defaultPosition":70},
     {"key":"decisions","title":"Beslutninger om forbedring og ressursbehov","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"},{"role":"verneombud"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

('iso-14001-miljogjennomgang', 'iso-14001-miljogjennomgang',
 'ISO 14001 — Miljøgjennomgang',
 'Årlig ledelsens gjennomgang av miljøstyringssystemet per ISO 14001:2015 § 9.3.',
 'ISO_14001',
 array['ISO 14001:2015'],
 array['ISO 14001:2015 § 9.3'],
 'annual', 150, 'iso-styring', 540,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"Miljøytelse-input samlet","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"defaultPosition":10},
     {"key":"context","title":"Endringer i interessenter og lovkrav","isMandatory":true,"lawRef":"ISO 14001:2015 § 4","defaultPosition":20},
     {"key":"performance","title":"Miljøytelse mot miljømål","isMandatory":true,"defaultPosition":30},
     {"key":"compliance","title":"Etterlevelse av lovkrav","isMandatory":true,"lawRef":"ISO 14001:2015 § 9.1.2","defaultPosition":40},
     {"key":"incidents","title":"Avvik og hendelser","isMandatory":true,"defaultPosition":50},
     {"key":"resources","title":"Ressursbehov","isMandatory":true,"defaultPosition":60},
     {"key":"decisions","title":"Beslutninger","isMandatory":true,"voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ GDPR — DPIA + ROPA                                                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('gdpr-dpia-gjennomgang', 'gdpr-dpia-gjennomgang',
 'GDPR — DPIA-gjennomgang',
 'Behandling og godkjenning av personvernkonsekvensvurdering (DPIA) per GDPR art. 35.',
 'GDPR',
 array['GDPR'],
 array['GDPR Art. 35', 'GDPR Art. 36'],
 'ad_hoc', 90, 'personvern', 610,
 $def$
 {
   "preparationChecklist": [
     {"key":"dpia_draft","label":"DPIA-utkast vedlagt","isMandatory":true,"lawRef":"GDPR Art. 35"},
     {"key":"dpo_review","label":"Personvernombud (DPO) har gjennomgått utkastet","isMandatory":true,"lawRef":"GDPR Art. 35 (2)"}
   ],
   "agendaItems": [
     {"key":"purpose","title":"Behandlingsformål og kontekst","isMandatory":true,"lawRef":"GDPR Art. 35 (7) a","defaultPosition":10},
     {"key":"necessity","title":"Nødvendighet og proporsjonalitet","isMandatory":true,"lawRef":"GDPR Art. 35 (7) b","defaultPosition":20},
     {"key":"risks","title":"Risiko for de registrerte","isMandatory":true,"lawRef":"GDPR Art. 35 (7) c","defaultPosition":30},
     {"key":"measures","title":"Risikoreduserende tiltak","isMandatory":true,"lawRef":"GDPR Art. 35 (7) d","defaultPosition":40},
     {"key":"residual","title":"Restrisiko og krav om forhåndsdrøfting (Art. 36)","isMandatory":true,"lawRef":"GDPR Art. 36","defaultPosition":50},
     {"key":"decision","title":"Beslutning: godkjent / avvist / krever forhåndsdrøfting","isMandatory":true,"voteRequired":true,"defaultPosition":60}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"processing_activity","kind":"text","label":"Behandlingsaktivitet","required":true},
   {"key":"data_categories","kind":"text","label":"Datakategorier"}
 ]}
 $ms$::jsonb),

('gdpr-ropa-arsgjennomgang', 'gdpr-ropa-arsgjennomgang',
 'GDPR — ROPA årlig gjennomgang',
 'Årlig gjennomgang av protokoll over behandlingsaktiviteter per GDPR art. 30.',
 'GDPR',
 array['GDPR'],
 array['GDPR Art. 30'],
 'annual', 120, 'personvern', 620,
 $def$
 {
   "preparationChecklist": [
     {"key":"ropa_export","label":"ROPA-eksport vedlagt","isMandatory":true,"lawRef":"GDPR Art. 30"}
   ],
   "agendaItems": [
     {"key":"new_activities","title":"Nye behandlingsaktiviteter siden sist","isMandatory":true,"lawRef":"GDPR Art. 30 (1)","defaultPosition":10},
     {"key":"updated_activities","title":"Endringer i eksisterende aktiviteter","isMandatory":true,"defaultPosition":20},
     {"key":"retention","title":"Slettefrister — overholdelse","isMandatory":true,"lawRef":"GDPR Art. 5 (1) e","defaultPosition":30},
     {"key":"processors","title":"Databehandleravtaler — status","isMandatory":true,"lawRef":"GDPR Art. 28","defaultPosition":40},
     {"key":"transfers","title":"Tredjelandsoverføringer","isMandatory":true,"lawRef":"GDPR Art. 44-49","defaultPosition":50},
     {"key":"decisions","title":"Beslutninger og oppfølging","isMandatory":true,"voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
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
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  is_active = true,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Re-provision settings for every org now that templates exist            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_meetings_baseline_for_org(v_org.id);
  end loop;
end $$;
