-- AML Fullgjennomgang — den komplette arbeidsmiljølov-veiviseren.
--
-- Coverage gap closed:
--   AML-pakken hadde 30+ enkelt-tema-maler men ingen sammenhengende
--   start-til-slutt veiviser som lar HMS-ansvarlig sitte ned én gang,
--   svare på hele arbeidsmiljøloven seksjon for seksjon, se total
--   framdrift, og generere oppfølgingsoppgaver per § som mangler.
--
--   Denne malen er en META-WALKTHROUGH: hvert spørsmål peker tilbake
--   til eksisterende kapittelmaler / dokumenter / register i pakken
--   via `resolutions[]`. Innholdsdublering unngås for kapittel 2A, 3,
--   5, 8, 9, 13, 16, 18 (fullt dekket fra før — PR #175).
--
-- Sections (22):
--   0  Roller og organisering          — metadata-skjema, ingen items
--   1  Kap. 1  Innledende bestemmelser
--   2  Kap. 2  Arbeidsgivers/-takers plikter
--   3  Kap. 2A Varsling                — cross-link 'varsling-arsgjennomgang'
--   4  Kap. 3  Virkemidler/BHT/opplæring
--   5  Kap. 4  Krav til arbeidsmiljøet — cross-link vernerunde, ergonomi, stoff
--   6  Kap. 5  Registrerings-/meldeplikt
--   7  Kap. 6  Verneombud              — cross-link 'verneombud-arsrapport'
--   8  Kap. 7  AMU
--   9  Kap. 8  Informasjon og drøfting
--   10 Kap. 9  Kontrolltiltak
--   11 Kap. 10 Arbeidstid
--   12 Kap. 11 Barne- og ungdomsarbeid  (helt nytt — ingen tidligere dekning)
--   13 Kap. 12 Permisjon
--   14 Kap. 13 Diskrimineringsvern     — cross-link ARP-dokument
--   15 Kap. 14 Ansettelse
--   16 Kap. 14A Innleie/selvstendige
--   17 Kap. 15 Opphør av arbeidsforhold
--   18 Kap. 16 Virksomhetsoverdragelse
--   19 Kap. 17 Tvister                  (nytt)
--   20 Kap. 18 Tilsyn og tvangsmidler   — cross-link 'Tilsyns- og påleggsregister'-register
--   21 Kap. 19 Straffeansvar            (info-items)
--
-- Self-audit (Arbeidstilsynet POV):
--   * Dekker AML kap. 1–19. Kap. 20 (avsluttende bestemmelser) er
--     formelle ikrafttredelses- og overgangsregler — ikke handlings-
--     pliktige for arbeidsgiver i daglig drift, dermed bevisst utelatt.
--   * Pålegg-grunner adressert: § 3-1 (systematisk HMS-arbeid), § 4-1
--     (forsvarlig arbeidsmiljø), § 5-1/5-2 (meldeplikt), § 6-1/§7-1
--     (verneombud/AMU-etablering), § 9-1 (kontrolltiltak),
--     § 10-* (arbeidstid), § 13-1 (diskriminering), § 14-* (ansettelse).
--   * Restrisiko bevisst utelatt: detaljerte AMU-vedtekter,
--     forhandlingsprotokoller, og rettslig prøving av oppsigelser —
--     disse hører hjemme i sak-spesifikke prosedyrer, ikke i en
--     årlig HMS-gjennomgang.
--   * Terskelgating via metadata.antall_ansatte håndteres i UI-laget
--     (greyer ut § 2A-7 under 5 ansatte, § 7-1 under 50 ansatte, osv).
--   * `items[]` er en denormalisert flat kopi av alle items på tvers
--     av sections[] — sikrer at jsonb_typeof(definition->'items')='array'
--     check-constraint fortsatt holder.

set local search_path = public, pg_catalog;

do $$
declare
  v_org_id uuid;
  v_def    jsonb;
  v_meta   jsonb;
  v_law_refs text[];
begin

-- ── Metadata schema for Section 0 — Roller og organisering ────────────────
v_meta := jsonb_build_object('fields', jsonb_build_array(
  jsonb_build_object('key','hms_ansvarlig','kind','participants','required',true,
                     'label','HMS-ansvarlig',
                     'help','Linjeleder med øverste HMS-ansvar etter AML § 3-1. Forhåndsfylles fra OrgEmployee-mandat hvis registrert.'),
  jsonb_build_object('key','verneombud','kind','participants','required',true,
                     'label','Verneombud(er)',
                     'help','Påkrevd fra 5 ansatte (AML § 6-1). Under terskel + tariffenighet kan unntak gjelde.'),
  jsonb_build_object('key','hoved_verneombud','kind','participants','required',false,
                     'label','Hovedverneombud (≥50 ansatte / flere VO)'),
  jsonb_build_object('key','amu_medlemmer','kind','participants','required',false,
                     'label','AMU-medlemmer (arbeidsgiver + arbeidstaker)'),
  jsonb_build_object('key','amu_leder','kind','participants','required',false,
                     'label','AMU-leder for inneværende år'),
  jsonb_build_object('key','tillitsvalgte','kind','participants','required',false,
                     'label','Tillitsvalgte'),
  jsonb_build_object('key','bht_navn','kind','text','required',false,
                     'label','Bedriftshelsetjeneste — leverandør'),
  jsonb_build_object('key','antall_ansatte','kind','number','required',true,
                     'label','Antall ansatte (inkl. innleide og midlertidige)',
                     'help','Driver terskelgating for § 2A-7 (≥5), § 6-1 (≥5 / unntak), § 7-1 AMU (≥50), § 6-1 (4) HVO (≥50).'),
  jsonb_build_object('key','storrelse_terskel','kind','select','required',true,
                     'label','Størrelseskategori',
                     'options', jsonb_build_array(
                       jsonb_build_object('id','u5','label','Under 5 ansatte'),
                       jsonb_build_object('id','5_9','label','5–9 ansatte'),
                       jsonb_build_object('id','10_29','label','10–29 ansatte'),
                       jsonb_build_object('id','30_49','label','30–49 ansatte'),
                       jsonb_build_object('id','50p','label','50 eller flere'))),
  jsonb_build_object('key','tariffavtale','kind','select','required',true,
                     'label','Tariffavtale?',
                     'options', jsonb_build_array(
                       jsonb_build_object('id','ja','label','Ja — tariffbundet'),
                       jsonb_build_object('id','nei','label','Nei'))),
  jsonb_build_object('key','ia_avtale','kind','select','required',false,
                     'label','IA-avtale med NAV?',
                     'options', jsonb_build_array(
                       jsonb_build_object('id','ja','label','Ja'),
                       jsonb_build_object('id','nei','label','Nei'))),
  jsonb_build_object('key','risiko_niva','kind','select','required',true,
                     'label','Vurdert risikonivå for virksomheten',
                     'options', jsonb_build_array(
                       jsonb_build_object('id','lav','label','Lav'),
                       jsonb_build_object('id','mid','label','Middels'),
                       jsonb_build_object('id','hoey','label','Høy'))),
  jsonb_build_object('key','antall_innleide','kind','number','required',false,
                     'label','Antall innleide arbeidstakere (gjennomsnitt)',
                     'help','Brukes til terskelgating på kap. 14A.')
));

-- ── Aggregat: alle law_refs som dekkes (drives dashboard-tile) ────────────
v_law_refs := array[
  -- Kap 1
  'AML § 1-2','AML § 1-7','AML § 1-8','AML § 1-9',
  -- Kap 2
  'AML § 2-1','AML § 2-2','AML § 2-3','AML § 2-4','AML § 2-5',
  -- Kap 2A
  'AML § 2A-1','AML § 2A-2','AML § 2A-3','AML § 2A-4','AML § 2A-5','AML § 2A-7',
  -- Kap 3
  'AML § 3-1','AML § 3-2','AML § 3-3','AML § 3-4','AML § 3-5',
  -- Kap 4
  'AML § 4-1','AML § 4-2','AML § 4-3','AML § 4-4','AML § 4-5','AML § 4-6',
  -- Kap 5
  'AML § 5-1','AML § 5-2','AML § 5-3',
  -- Kap 6
  'AML § 6-1','AML § 6-2','AML § 6-3','AML § 6-5',
  -- Kap 7
  'AML § 7-1','AML § 7-2','AML § 7-3','AML § 7-4',
  -- Kap 8
  'AML § 8-1','AML § 8-2','AML § 8-3',
  -- Kap 9
  'AML § 9-1','AML § 9-2','AML § 9-3',
  -- Kap 10
  'AML § 10-1','AML § 10-2','AML § 10-3','AML § 10-4','AML § 10-5','AML § 10-6',
  'AML § 10-7','AML § 10-8','AML § 10-9','AML § 10-10','AML § 10-11','AML § 10-12','AML § 10-13',
  -- Kap 11
  'AML § 11-1','AML § 11-2','AML § 11-3','AML § 11-4','AML § 11-5',
  -- Kap 12
  'AML § 12-1','AML § 12-2','AML § 12-3','AML § 12-4','AML § 12-5','AML § 12-6',
  'AML § 12-7','AML § 12-8','AML § 12-9','AML § 12-10','AML § 12-11','AML § 12-12',
  'AML § 12-13','AML § 12-14','AML § 12-15','AML § 12-16',
  -- Kap 13
  'AML § 13-1','AML § 13-2','AML § 13-7',
  -- Kap 14
  'AML § 14-1','AML § 14-2','AML § 14-5','AML § 14-6','AML § 14-9',
  'AML § 14-12','AML § 14-12a','AML § 14-12c',
  -- Kap 14A
  'AML § 14A-1','AML § 14A-2','AML § 14A-3',
  -- Kap 15
  'AML § 15-1','AML § 15-3','AML § 15-4','AML § 15-6','AML § 15-7','AML § 15-15',
  -- Kap 16
  'AML § 16-1','AML § 16-2','AML § 16-3','AML § 16-4','AML § 16-5',
  -- Kap 17
  'AML § 17-1','AML § 17-3','AML § 17-4',
  -- Kap 18
  'AML § 18-1','AML § 18-6','AML § 18-7','AML § 18-8','AML § 18-10',
  -- Kap 19
  'AML § 19-1','AML § 19-2'
]::text[];

-- ── Definition jsonb — sections[] (rich) + items[] (flat denormalised) ────
v_def := jsonb_build_object(
  'sections', jsonb_build_array(

    -- ─── Section 1: Kap. 1 — Innledende bestemmelser ────────────────────
    jsonb_build_object(
      'key','kap1','title','1. Innledende bestemmelser','chapter','AML kap. 1',
      'intro','Bekreft at virksomheten faller innenfor AMLs virkeområde og at avvik fra loven kun gjøres med riktig hjemmel.',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k1_2_virkeomraade','prompt','Faller virksomheten innenfor AMLs virkeområde (§ 1-2)?','type','yes_no_na','required',true,'law_ref','AML § 1-2','severity_default','high','help','Loven gjelder virksomhet som sysselsetter arbeidstakere. Sjøfart, fangst og fiske er unntatt.'),
        jsonb_build_object('key','k1_7_utsendte','prompt','Er evt. utsendte arbeidstakere håndtert etter § 1-7?','type','yes_no_na','required',false,'law_ref','AML § 1-7','severity_default','medium','help','Gjelder bare ved utsending av arbeidstakere over landegrenser.'),
        jsonb_build_object('key','k1_8_definisjoner','prompt','Er definisjonene av arbeidsgiver og arbeidstaker korrekt avklart for virksomheten?','type','yes_no_na','required',true,'law_ref','AML § 1-8','severity_default','medium','help','Spesielt viktig ved bemanningsforetak, franchise og konsernforhold.'),
        jsonb_build_object('key','k1_9_ufravikelig','prompt','Er det avtaler eller praksis som strider mot AMLs ufravikelige bestemmelser?','type','yes_no_na','required',true,'law_ref','AML § 1-9','severity_default','critical','help','AML kan ikke fravikes til ugunst for arbeidstaker. Reduksjon av rettigheter via avtale er ugyldig.')
      )),

    -- ─── Section 2: Kap. 2 — Arbeidsgivers og arbeidstakers plikter ─────
    jsonb_build_object(
      'key','kap2','title','2. Arbeidsgivers og arbeidstakers plikter','chapter','AML kap. 2',
      'estimatedMinutes',8,
      'items', jsonb_build_array(
        jsonb_build_object('key','k2_1_plikt','prompt','Sikrer arbeidsgiver at AMLs bestemmelser blir fulgt?','type','yes_no_na','required',true,'law_ref','AML § 2-1','severity_default','critical','help','Arbeidsgivers grunnleggende plikt etter § 2-1. Sjekkes mot dokumentert internkontroll.','task_template', jsonb_build_object('title','Etabler dokumentert HMS-internkontroll','priority','high')),
        jsonb_build_object('key','k2_2_innleide','prompt','Sørger arbeidsgiver for at innleide/selvstendige har et fullt forsvarlig arbeidsmiljø hos virksomheten?','type','yes_no_na','required',false,'law_ref','AML § 2-2','severity_default','high','help','Påkrevd uansett kontraktsforhold når personen jobber på virksomhetens område.'),
        jsonb_build_object('key','k2_3_medvirkning','prompt','Er arbeidstakernes medvirkningsplikt formidlet (delta i HMS-arbeid, melde avvik)?','type','yes_no_na','required',true,'law_ref','AML § 2-3','severity_default','medium','help','Skal være del av onboarding og årlig HMS-gjennomgang.'),
        jsonb_build_object('key','k2_4_varsel_om_avvik','prompt','Er det rutiner for arbeidstaker å varsle om kritikkverdige forhold?','type','yes_no_na','required',true,'law_ref','AML § 2-4','severity_default','high','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','varsling-arsgjennomgang','label','Varslingsrutiner – årsgjennomgang'))),
        jsonb_build_object('key','k2_5_gjengjeldelse','prompt','Beskytter virksomheten arbeidstakere mot gjengjeldelse etter melding/varsling?','type','yes_no_na','required',true,'law_ref','AML § 2-5','severity_default','critical','help','Gjengjeldelse er forbudt. Vurder objektivt om varslere har opplevd ugunstig behandling.')
      )),

    -- ─── Section 3: Kap. 2A — Varsling ───────────────────────────────────
    jsonb_build_object(
      'key','kap2a','title','3. Varsling','chapter','AML kap. 2A',
      'intro','Helt dekket av eksisterende mal og dokument. Bekreft at de er operative.',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k2a_7_rutiner','prompt','Har virksomheten skriftlige varslingsrutiner (≥5 ansatte: påkrevd)?','type','yes_no_na','required',true,'law_ref','AML § 2A-7','severity_default','critical','resolutions', jsonb_build_array(jsonb_build_object('kind','document','ref','tpl-varslingsrutiner','label','Varslingsrutiner (dokumentmal)'), jsonb_build_object('kind','checklist_template','ref','varsling-arsgjennomgang','label','Varsling – årsgjennomgang'))),
        jsonb_build_object('key','k2a_1_rett','prompt','Er retten til å varsle om kritikkverdige forhold kjent for alle ansatte?','type','yes_no_na','required',true,'law_ref','AML § 2A-1','severity_default','high'),
        jsonb_build_object('key','k2a_2_framgangsmaate','prompt','Er forsvarlig framgangsmåte ved varsling beskrevet (intern, ekstern, anonym)?','type','yes_no_na','required',true,'law_ref','AML § 2A-2','severity_default','high'),
        jsonb_build_object('key','k2a_3_aktivitetsplikt','prompt','Følges aktivitetsplikten ved mottak (bekreftelse <5 dager, undersøkelse, tiltak)?','type','yes_no_na','required',true,'law_ref','AML § 2A-3','severity_default','critical'),
        jsonb_build_object('key','k2a_4_gjengjeldelse','prompt','Er det iverksatt tiltak mot gjengjeldelse mot varslere?','type','yes_no_na','required',true,'law_ref','AML § 2A-4','severity_default','critical'),
        jsonb_build_object('key','k2a_5_erstatning','prompt','Er det kjent at varslere har rett til erstatning og oppreisning uten skyld?','type','yes_no_na','required',false,'law_ref','AML § 2A-5','severity_default','medium')
      )),

    -- ─── Section 4: Kap. 3 — Virkemidler, BHT, opplæring ────────────────
    jsonb_build_object(
      'key','kap3','title','4. Virkemidler — HMS-arbeid, BHT, opplæring','chapter','AML kap. 3',
      'estimatedMinutes',12,
      'items', jsonb_build_array(
        jsonb_build_object('key','k3_1_systematisk','prompt','Driver virksomheten systematisk HMS-arbeid etter § 3-1 + IK-forskriften?','type','yes_no_na','required',true,'law_ref','AML § 3-1','severity_default','critical','help','Krever skriftlig HMS-håndbok, kartlegging av risiko, planlagte tiltak, og dokumentasjon.','task_template', jsonb_build_object('title','Verifiser at IK-systemet dekker AML § 3-1 + IK-f § 5','priority','high')),
        jsonb_build_object('key','k3_2_opplaering','prompt','Får arbeidstakere nødvendig opplæring i HMS før de starter risikofylt arbeid?','type','yes_no_na','required',true,'law_ref','AML § 3-2','severity_default','high','help','Spesielt strenge krav ved maskiner, kjemikalier, høyderisiko, og verneombudsfunksjon.'),
        jsonb_build_object('key','k3_3_bht','prompt','Er bedriftshelsetjeneste (BHT) tilknyttet, hvis bransjen krever det?','type','yes_no_na','required',true,'law_ref','AML § 3-3','severity_default','high','help','BHT-plikt avhenger av næringskode. Liste fra Arbeidstilsynet.'),
        jsonb_build_object('key','k3_4_pensjonsordning','prompt','Er obligatorisk pensjonsordning (OTP) etablert?','type','yes_no_na','required',true,'law_ref','AML § 3-4','severity_default','high','help','Lov om OTP — minst 2% av lønn til ansatte under 13 G.'),
        jsonb_build_object('key','k3_5_leder_hms','prompt','Har øverste leder gjennomført lovpålagt HMS-opplæring (40-timers eller likeverdig)?','type','yes_no_na','required',true,'law_ref','AML § 3-5','severity_default','critical','help','En av de hyppigste pålegg-grunnene fra Arbeidstilsynet. Dokumenteres med kursbevis.','task_template', jsonb_build_object('title','HMS-opplæring for øverste leder (40 t)','priority','critical'))
      )),

    -- ─── Section 5: Kap. 4 — Krav til arbeidsmiljøet ────────────────────
    jsonb_build_object(
      'key','kap4','title','5. Krav til arbeidsmiljøet','chapter','AML kap. 4',
      'intro','Fysisk, kjemisk, biologisk, ergonomisk og psykososialt miljø. Cross-link til eksisterende vernerunder.',
      'estimatedMinutes',15,
      'items', jsonb_build_array(
        jsonb_build_object('key','k4_1_forsvarlig','prompt','Er arbeidsmiljøet fullt forsvarlig (§ 4-1) — fysisk, psykisk, velferdsmessig?','type','yes_no_na','required',true,'law_ref','AML § 4-1','severity_default','critical','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','vernerunde-standard','label','Vernerunde – standard'))),
        jsonb_build_object('key','k4_2_omstilling','prompt','Får arbeidstakere medvirke ved omstillinger og organisasjonsendringer?','type','yes_no_na','required',true,'law_ref','AML § 4-2','severity_default','high','help','Omfatter også informasjon om planlagte endringer i god tid.'),
        jsonb_build_object('key','k4_3_psyko','prompt','Er det psykososiale arbeidsmiljøet ivaretatt (integritet, verdighet, ikke trakassering)?','type','yes_no_na','required',true,'law_ref','AML § 4-3','severity_default','critical','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','psykososial-pulsmaling','label','Psykososial pulsmåling'))),
        jsonb_build_object('key','k4_4_fysisk','prompt','Er det fysiske arbeidsmiljøet i orden (klima, lys, støy, stråling, ergonomi)?','type','yes_no_na','required',true,'law_ref','AML § 4-4','severity_default','high','help','Krever målinger ved støy >85 dB, indekljus <300 lux på arbeidsflater, m.fl. Se § 4-4 (4).','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','ergonomi-runde','label','Ergonomi-runde'))),
        jsonb_build_object('key','k4_5_kjemisk','prompt','Er kjemisk og biologisk eksponering kartlagt og minimert?','type','yes_no_na','required',false,'law_ref','AML § 4-5','severity_default','high','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','stoffkartotek-runde','label','Stoffkartotek-runde'))),
        jsonb_build_object('key','k4_6_tilrettelegging','prompt','Foretas individuell tilrettelegging for ansatte med redusert arbeidsevne?','type','yes_no_na','required',true,'law_ref','AML § 4-6','severity_default','high','help','Tilretteleggings­plikten gjelder uavhengig av om sykefraværet er yrkesrelatert.')
      )),

    -- ─── Section 6: Kap. 5 — Registrerings- og meldeplikt ───────────────
    jsonb_build_object(
      'key','kap5','title','6. Registrerings- og meldeplikt','chapter','AML kap. 5',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k5_1_melding','prompt','Er det rutine for å registrere skader/sykdom og melde til NAV / Arbeidstilsynet?','type','yes_no_na','required',true,'law_ref','AML § 5-1','severity_default','critical','help','Yrkesskader meldes på NAV-blankett 13-07.05; alvorlige skader meldes umiddelbart til Arbeidstilsynet.','task_template', jsonb_build_object('title','Etabler skade- og sykdomsregister','priority','critical')),
        jsonb_build_object('key','k5_2_alvorlig','prompt','Er det rutiner for umiddelbar melding av alvorlige skader/dødsulykker?','type','yes_no_na','required',true,'law_ref','AML § 5-2','severity_default','critical','help','Telefonisk varsel til Arbeidstilsynet + politi straks etter ulykken.'),
        jsonb_build_object('key','k5_3_helseundersokelse','prompt','Tilbys lovpålagt helseundersøkelse for utsatte grupper (nattarbeidere, kjemikalier mm.)?','type','yes_no_na','required',true,'law_ref','AML § 5-3','severity_default','high')
      )),

    -- ─── Section 7: Kap. 6 — Verneombud ─────────────────────────────────
    jsonb_build_object(
      'key','kap6','title','7. Verneombud','chapter','AML kap. 6',
      'intro','Terskel: påkrevd fra 5 ansatte. Under 5 + tariffenighet = unntak.',
      'estimatedMinutes',8,
      'items', jsonb_build_array(
        jsonb_build_object('key','k6_1_valgt','prompt','Er verneombud valgt og registrert (eller dokumentert unntak ved <5 ansatte)?','type','yes_no_na','required',true,'law_ref','AML § 6-1','severity_default','critical','help','Skriftlig avtale om unntak må foreligge. Valg dokumenteres med protokoll.','task_template', jsonb_build_object('title','Gjennomfør verneombudsvalg','priority','high')),
        jsonb_build_object('key','k6_2_oppgaver','prompt','Ivaretas verneombudets oppgaver (delta i HMS, stoppe farlig arbeid)?','type','yes_no_na','required',true,'law_ref','AML § 6-2','severity_default','high','resolutions', jsonb_build_array(jsonb_build_object('kind','checklist_template','ref','verneombud-arsrapport','label','Verneombud – årsrapport'))),
        jsonb_build_object('key','k6_3_rett_til_a_stoppe','prompt','Er det kjent at verneombudet kan stoppe arbeid ved umiddelbar fare?','type','yes_no_na','required',true,'law_ref','AML § 6-3','severity_default','high'),
        jsonb_build_object('key','k6_5_oppl','prompt','Har verneombud fullført lovpålagt 40-timers HMS-opplæring?','type','yes_no_na','required',true,'law_ref','AML § 6-5','severity_default','critical','help','Hyppig pålegg-grunn. Dokumenteres med kursbevis.','task_template', jsonb_build_object('title','40-timers HMS-kurs for verneombud','priority','high')),
        jsonb_build_object('key','k6_1_4_hvo','prompt','Er hovedverneombud valgt (krevet når ≥50 ansatte)?','type','yes_no_na','required',false,'law_ref','AML § 6-1','severity_default','high','status_hint','Kun ved ≥50 ansatte')
      )),

    -- ─── Section 8: Kap. 7 — AMU ─────────────────────────────────────────
    jsonb_build_object(
      'key','kap7','title','8. Arbeidsmiljøutvalg (AMU)','chapter','AML kap. 7',
      'intro','Terskel: påkrevd fra 50 ansatte; 10–49 ansatte ved partsenighet.',
      'estimatedMinutes',6,
      'items', jsonb_build_array(
        jsonb_build_object('key','k7_1_etablert','prompt','Er AMU opprettet med rett sammensetning og leder?','type','yes_no_na','required',true,'law_ref','AML § 7-1','severity_default','critical','help','Likt antall arbeidsgiver- og arbeidstakerrepresentanter; leder veksler mellom partene årlig.','task_template', jsonb_build_object('title','Konstituer AMU','priority','high')),
        jsonb_build_object('key','k7_2_oppgaver','prompt','Behandler AMU saker etter § 7-2 (planer, kartlegginger, ulykker, oppfølging)?','type','yes_no_na','required',true,'law_ref','AML § 7-2','severity_default','high','resolutions', jsonb_build_array(jsonb_build_object('kind','meeting','ref','amu-mote','label','AMU – årsmøte'))),
        jsonb_build_object('key','k7_3_lokalt','prompt','Er lokale arbeidsmiljøutvalg vurdert ved flere virksomhetssteder?','type','yes_no_na','required',false,'law_ref','AML § 7-3','severity_default','medium'),
        jsonb_build_object('key','k7_4_arsrapport','prompt','Lager AMU årsrapport om sin virksomhet?','type','yes_no_na','required',true,'law_ref','AML § 7-4','severity_default','medium')
      )),

    -- ─── Section 9: Kap. 8 — Informasjon og drøfting ────────────────────
    jsonb_build_object(
      'key','kap8','title','9. Informasjon og drøfting','chapter','AML kap. 8',
      'intro','Påkrevd fra 50 ansatte.',
      'estimatedMinutes',4,
      'items', jsonb_build_array(
        jsonb_build_object('key','k8_1_info','prompt','Informeres tillitsvalgte jevnlig om virksomhetens utvikling og økonomi?','type','yes_no_na','required',true,'law_ref','AML § 8-1','severity_default','high','status_hint','Kun ved ≥50 ansatte'),
        jsonb_build_object('key','k8_2_drofting','prompt','Drøftes vesentlige beslutninger om sysselsetting og arbeidsorganisering?','type','yes_no_na','required',true,'law_ref','AML § 8-2','severity_default','high'),
        jsonb_build_object('key','k8_3_fortrolighet','prompt','Er fortrolighetsplikten for tillitsvalgte håndtert ifb sensitiv info?','type','yes_no_na','required',false,'law_ref','AML § 8-3','severity_default','medium')
      )),

    -- ─── Section 10: Kap. 9 — Kontrolltiltak ─────────────────────────────
    jsonb_build_object(
      'key','kap9','title','10. Kontrolltiltak','chapter','AML kap. 9',
      'estimatedMinutes',6,
      'items', jsonb_build_array(
        jsonb_build_object('key','k9_1_vilkaar','prompt','Er kontrolltiltak saklig begrunnet og uten uforholdsmessig belastning?','type','yes_no_na','required',true,'law_ref','AML § 9-1','severity_default','high','help','Kameraovervåking, alkoholtest, e-postinnsyn — alle krever saklighet + drøfting.'),
        jsonb_build_object('key','k9_2_drofting','prompt','Er drøfting + informasjon gjennomført før kontrolltiltak innføres?','type','yes_no_na','required',true,'law_ref','AML § 9-2','severity_default','critical','help','Manglende drøfting er ugyldighetsgrunn for tiltaket.','task_template', jsonb_build_object('title','Drøftingsprotokoll for kontrolltiltak','priority','high')),
        jsonb_build_object('key','k9_3_helseopplys','prompt','Begrenses innhenting av helseopplysninger til det nødvendige?','type','yes_no_na','required',true,'law_ref','AML § 9-3','severity_default','high','help','GDPR Art. 9 stiller strenge tilleggskrav.')
      )),

    -- ─── Section 11: Kap. 10 — Arbeidstid ────────────────────────────────
    jsonb_build_object(
      'key','kap10','title','11. Arbeidstid','chapter','AML kap. 10',
      'intro','Definisjoner, grenser, gjennomsnittsberegning, nattarbeid, søn-/helligdager.',
      'estimatedMinutes',12,
      'items', jsonb_build_array(
        jsonb_build_object('key','k10_1_def','prompt','Er definisjonene av arbeidstid og hviletid forstått og dokumentert?','type','yes_no_na','required',true,'law_ref','AML § 10-1','severity_default','medium','help','Arbeidstid = den tiden arbeidstaker står til arbeidsgivers disposisjon. Reisetid kan også være arbeidstid.'),
        jsonb_build_object('key','k10_2_fritak','prompt','Er ansatte i ledende/særlig uavhengig stilling korrekt unntatt fra arbeidstidskapitlet?','type','yes_no_na','required',false,'law_ref','AML § 10-2','severity_default','high','help','Tett tilsynsfokus — feilklassifisering gir lønnskrav bakover.'),
        jsonb_build_object('key','k10_3_plan','prompt','Foreligger skriftlig arbeidstidsplan ved varierende arbeidstid?','type','yes_no_na','required',true,'law_ref','AML § 10-3','severity_default','high'),
        jsonb_build_object('key','k10_4_alminnelig','prompt','Overskrider alminnelig arbeidstid 9 t/dag eller 40 t/uke uten avtalebakgrunn?','type','yes_no_na','required',true,'law_ref','AML § 10-4','severity_default','critical','help','Standardgrense; tariffavtale eller skiftarbeid kan endre rammene.'),
        jsonb_build_object('key','k10_5_gjennomsnitt','prompt','Er ev. gjennomsnittsberegning av arbeidstid avtalefestet?','type','yes_no_na','required',false,'law_ref','AML § 10-5','severity_default','high'),
        jsonb_build_object('key','k10_6_overtid','prompt','Overskrides overtidsrammene (10 t/uke, 25 t/4 uker, 200 t/år uten avtale)?','type','yes_no_na','required',true,'law_ref','AML § 10-6','severity_default','critical','help','Vanlig pålegg-grunn. Tariffavtale gir høyere rammer.'),
        jsonb_build_object('key','k10_7_arbeidstidsoversikt','prompt','Føres arbeidstidsoversikt for hver arbeidstaker (inkl. overtid)?','type','yes_no_na','required',true,'law_ref','AML § 10-7','severity_default','high'),
        jsonb_build_object('key','k10_8_daglig','prompt','Sikres daglig hvile ≥11 t og ukentlig hvile ≥35 t?','type','yes_no_na','required',true,'law_ref','AML § 10-8','severity_default','high'),
        jsonb_build_object('key','k10_9_pause','prompt','Får alle ansatte minst 30 min pause ved arbeidstid >5,5 t?','type','yes_no_na','required',true,'law_ref','AML § 10-9','severity_default','medium'),
        jsonb_build_object('key','k10_10_natt','prompt','Er nattarbeid (mellom 21 og 06) saklig begrunnet og dokumentert?','type','yes_no_na','required',false,'law_ref','AML § 10-10','severity_default','high'),
        jsonb_build_object('key','k10_11_natt_helse','prompt','Tilbys nattarbeidere helsekontroll før oppstart + jevnlig?','type','yes_no_na','required',false,'law_ref','AML § 10-11','severity_default','high'),
        jsonb_build_object('key','k10_12_sondag','prompt','Er søn-/helligdagsarbeid saklig begrunnet, eller dispensert?','type','yes_no_na','required',false,'law_ref','AML § 10-12','severity_default','high'),
        jsonb_build_object('key','k10_13_fritak','prompt','Er individuelle fritak fra arbeidstidskap. (gravide, helse, omsorg) ivaretatt?','type','yes_no_na','required',true,'law_ref','AML § 10-13','severity_default','high')
      )),

    -- ─── Section 12: Kap. 11 — Arbeid av barn og ungdom ──────────────────
    jsonb_build_object(
      'key','kap11','title','12. Arbeid av barn og ungdom','chapter','AML kap. 11',
      'intro','Strenge regler ved ansettelse av personer under 18.',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k11_1_minstealder','prompt','Følges minstealdergrenser (13 år lett arbeid, 15 år vanlig, særlige fag fra 18)?','type','yes_no_na','required',false,'law_ref','AML § 11-1','severity_default','critical','help','Anbefaler bare forelda spørsmål dersom virksomheten faktisk har eller vurderer å ansette under-18.','status_hint','Kun ved ansettelse av personer under 18'),
        jsonb_build_object('key','k11_2_arbeidstid','prompt','Følges spesielle arbeidstidsregler for unge under 18?','type','yes_no_na','required',false,'law_ref','AML § 11-2','severity_default','high'),
        jsonb_build_object('key','k11_3_helse','prompt','Er helsekontroll for unge under 18 tilbudt før oppstart?','type','yes_no_na','required',false,'law_ref','AML § 11-3','severity_default','high'),
        jsonb_build_object('key','k11_4_forbud','prompt','Holdes unge unna forbudt arbeid (farlige stoffer, høyderisiko mv.)?','type','yes_no_na','required',false,'law_ref','AML § 11-4','severity_default','critical'),
        jsonb_build_object('key','k11_5_foreldre','prompt','Er foresatte informert ved ansettelse av mindreårige?','type','yes_no_na','required',false,'law_ref','AML § 11-5','severity_default','medium')
      )),

    -- ─── Section 13: Kap. 12 — Permisjon ─────────────────────────────────
    jsonb_build_object(
      'key','kap12','title','13. Permisjon','chapter','AML kap. 12',
      'estimatedMinutes',10,
      'items', jsonb_build_array(
        jsonb_build_object('key','k12_1_2_svangerskap','prompt','Følges § 12-1/-2 (svangerskapskontroll, svangerskapspermisjon)?','type','yes_no_na','required',true,'law_ref','AML § 12-1','severity_default','high'),
        jsonb_build_object('key','k12_3_4_omsorg_foedsels','prompt','Følges omsorgs- (§ 12-3) og fødselspermisjon (§ 12-4)?','type','yes_no_na','required',true,'law_ref','AML § 12-3','severity_default','high'),
        jsonb_build_object('key','k12_5_6_foreldre','prompt','Følges foreldre- (§ 12-5) og delvis permisjon (§ 12-6)?','type','yes_no_na','required',true,'law_ref','AML § 12-5','severity_default','high'),
        jsonb_build_object('key','k12_7_varsel','prompt','Får ansatte gi forsvarlig varsel om permisjon?','type','yes_no_na','required',true,'law_ref','AML § 12-7','severity_default','medium'),
        jsonb_build_object('key','k12_8_amming','prompt','Er rett til ammefri (med lønn opp til bestemt tid) ivaretatt?','type','yes_no_na','required',false,'law_ref','AML § 12-8','severity_default','medium'),
        jsonb_build_object('key','k12_9_sykt_barn','prompt','Følges retten til permisjon ved sykt barn (omfang etter antall barn)?','type','yes_no_na','required',true,'law_ref','AML § 12-9','severity_default','medium'),
        jsonb_build_object('key','k12_10_paroerende','prompt','Følges retten til permisjon for pleie av nære pårørende?','type','yes_no_na','required',true,'law_ref','AML § 12-10','severity_default','medium'),
        jsonb_build_object('key','k12_11_utdanning','prompt','Følges retten til utdanningspermisjon (§ 12-11)?','type','yes_no_na','required',false,'law_ref','AML § 12-11','severity_default','medium'),
        jsonb_build_object('key','k12_12_militaer','prompt','Følges retten til permisjon ved militærtjeneste / sivilforsvar?','type','yes_no_na','required',false,'law_ref','AML § 12-12','severity_default','low'),
        jsonb_build_object('key','k12_13_off_verv','prompt','Følges retten til permisjon ved offentlige verv?','type','yes_no_na','required',false,'law_ref','AML § 12-13','severity_default','low'),
        jsonb_build_object('key','k12_14_religion','prompt','Følges retten til religiøs høytid (inntil 2 dager u/lønn)?','type','yes_no_na','required',false,'law_ref','AML § 12-14','severity_default','low'),
        jsonb_build_object('key','k12_15_16_oversikt','prompt','Er det oversikt over alle innvilgede permisjoner siste 12 mnd?','type','yes_no_na','required',true,'law_ref','AML § 12-15','severity_default','medium')
      )),

    -- ─── Section 14: Kap. 13 — Diskrimineringsvern ────────────────────────
    jsonb_build_object(
      'key','kap13','title','14. Diskrimineringsvern','chapter','AML kap. 13',
      'intro','Cross-link til Likestillings- og diskrimineringsloven (ARP).',
      'estimatedMinutes',6,
      'items', jsonb_build_array(
        jsonb_build_object('key','k13_1_forbud','prompt','Er forbud mot direkte og indirekte diskriminering kommunisert + dokumentert?','type','yes_no_na','required',true,'law_ref','AML § 13-1','severity_default','critical','resolutions', jsonb_build_array(jsonb_build_object('kind','document','ref','tpl-likestilling-mangfold','label','ARP-redegjørelse'))),
        jsonb_build_object('key','k13_2_omfang','prompt','Er forbudet anvendt på ansettelse, lønn, oppsigelse, opprykk + opplæring?','type','yes_no_na','required',true,'law_ref','AML § 13-2','severity_default','critical'),
        jsonb_build_object('key','k13_7_aktivitet','prompt','Drives aktivt arbeid for likestilling iht. ARP-redegjørelsen?','type','yes_no_na','required',true,'law_ref','AML § 13-7','severity_default','high','help','ARP = Aktivitets- og redegjørelsesplikt etter Likestillings- og diskrimineringsloven § 26. Årlig.')
      )),

    -- ─── Section 15: Kap. 14 — Ansettelse ────────────────────────────────
    jsonb_build_object(
      'key','kap14','title','15. Ansettelse','chapter','AML kap. 14',
      'estimatedMinutes',12,
      'items', jsonb_build_array(
        jsonb_build_object('key','k14_1_informasjon','prompt','Annonseres ledige stillinger internt før eksternt utlysning?','type','yes_no_na','required',true,'law_ref','AML § 14-1','severity_default','medium','help','Plikt til internkunngjøring.'),
        jsonb_build_object('key','k14_2_drofting','prompt','Drøftes bemanningsbehov og kvalifikasjoner med tillitsvalgte?','type','yes_no_na','required',false,'law_ref','AML § 14-2','severity_default','medium'),
        jsonb_build_object('key','k14_5_arbeidsavtale','prompt','Har alle ansatte skriftlig arbeidsavtale med lovpålagt innhold?','type','yes_no_na','required',true,'law_ref','AML § 14-5','severity_default','critical','help','§ 14-6 lister 14 minimumspunkter; manglende avtale = vanlig pålegg.','task_template', jsonb_build_object('title','Audit av skriftlige arbeidsavtaler','priority','critical')),
        jsonb_build_object('key','k14_6_minimum','prompt','Inneholder arbeidsavtalene alle minimumspunktene i § 14-6?','type','yes_no_na','required',true,'law_ref','AML § 14-6','severity_default','critical','help','Identifikasjon, arbeidssted, arbeidstaker/-giver, oppstart, varighet, ferie, lønn, arbeidstid, oppsigelsesfrist mv.'),
        jsonb_build_object('key','k14_9_midlertidig','prompt','Er midlertidige ansettelser saklig begrunnet (kun lovlige grunner)?','type','yes_no_na','required',true,'law_ref','AML § 14-9','severity_default','critical','help','Permanent behov må ha fast stilling. Etter 3 år midlertidig = fast.'),
        jsonb_build_object('key','k14_12_innleie','prompt','Er innleie fra bemanningsforetak begrenset til lovlige situasjoner (§ 14-12)?','type','yes_no_na','required',false,'law_ref','AML § 14-12','severity_default','critical','help','Forbudet mot innleie er styrket — kun lovlig ved vikariater eller særskilt godkjenning.','status_hint','Kun ved bruk av innleie'),
        jsonb_build_object('key','k14_12a_likebehandling','prompt','Får innleide arbeidstakere samme lønns- og arbeidsvilkår som direkte ansatte?','type','yes_no_na','required',false,'law_ref','AML § 14-12a','severity_default','high'),
        jsonb_build_object('key','k14_12c_solidaransvar','prompt','Er solidaransvar for innleier dokumentert (lønnsutbetaling, feriepenger)?','type','yes_no_na','required',false,'law_ref','AML § 14-12c','severity_default','high')
      )),

    -- ─── Section 16: Kap. 14A — Innleie og selvstendige ──────────────────
    jsonb_build_object(
      'key','kap14a','title','16. Innleie og selvstendige','chapter','AML kap. 14A',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k14a_1_drofting','prompt','Er innleie drøftet med tillitsvalgte før igangsetting?','type','yes_no_na','required',false,'law_ref','AML § 14A-1','severity_default','high','status_hint','Kun ved bruk av innleie'),
        jsonb_build_object('key','k14a_2_avtale','prompt','Foreligger skriftlig avtale med bemanningsforetak?','type','yes_no_na','required',false,'law_ref','AML § 14A-2','severity_default','high'),
        jsonb_build_object('key','k14a_3_godkjenning','prompt','Er bemanningsforetaket godkjent av Arbeidstilsynet?','type','yes_no_na','required',false,'law_ref','AML § 14A-3','severity_default','critical')
      )),

    -- ─── Section 17: Kap. 15 — Opphør av arbeidsforhold ──────────────────
    jsonb_build_object(
      'key','kap15','title','17. Opphør av arbeidsforhold','chapter','AML kap. 15',
      'estimatedMinutes',10,
      'items', jsonb_build_array(
        jsonb_build_object('key','k15_1_drofting','prompt','Drøftes oppsigelser med ansatte (eller tillitsvalgte) før beslutning?','type','yes_no_na','required',true,'law_ref','AML § 15-1','severity_default','critical','help','Manglende drøfting = sterk usaklighetsindikasjon. Hyppig opphevet i lagmannsretten.','task_template', jsonb_build_object('title','Drøftingsprotokoll-rutine for oppsigelser','priority','high')),
        jsonb_build_object('key','k15_3_oppsigelsesfrist','prompt','Følges minst lovpålagte oppsigelsesfrister (1–6 mnd avh. av tjenestetid/alder)?','type','yes_no_na','required',true,'law_ref','AML § 15-3','severity_default','high'),
        jsonb_build_object('key','k15_4_form','prompt','Er oppsigelser skriftlige og inneholder de lovpålagt info om søksmålsfrist?','type','yes_no_na','required',true,'law_ref','AML § 15-4','severity_default','critical','help','Uten korrekt informasjon = forlenget søksmålsfrist, og evt. ugyldighet.'),
        jsonb_build_object('key','k15_6_proevetid','prompt','Følges spesielle regler ved oppsigelse i prøvetid (kort frist, saklighet)?','type','yes_no_na','required',false,'law_ref','AML § 15-6','severity_default','high'),
        jsonb_build_object('key','k15_7_saklighet','prompt','Bygger oppsigelser på saklig grunn i virksomhet/arbeidstaker?','type','yes_no_na','required',true,'law_ref','AML § 15-7','severity_default','critical'),
        jsonb_build_object('key','k15_15_dokumentasjon','prompt','Er attest gitt ved opphør (lovpålagt innhold)?','type','yes_no_na','required',true,'law_ref','AML § 15-15','severity_default','medium')
      )),

    -- ─── Section 18: Kap. 16 — Virksomhetsoverdragelse ───────────────────
    jsonb_build_object(
      'key','kap16','title','18. Virksomhetsoverdragelse','chapter','AML kap. 16',
      'estimatedMinutes',6,
      'items', jsonb_build_array(
        jsonb_build_object('key','k16_1_omfang','prompt','Er det avklart om en endring utløser virksomhetsoverdragelses-reglene?','type','yes_no_na','required',false,'law_ref','AML § 16-1','severity_default','high','help','Fusjon, oppkjøp, outsourcing av tjenesteområde kan utløse kap. 16.','status_hint','Kun ved planlagt endring'),
        jsonb_build_object('key','k16_2_overforing','prompt','Overføres rettigheter/plikter automatisk til ny arbeidsgiver?','type','yes_no_na','required',false,'law_ref','AML § 16-2','severity_default','critical'),
        jsonb_build_object('key','k16_3_reservasjon','prompt','Er ansattes reservasjonsrett opplyst?','type','yes_no_na','required',false,'law_ref','AML § 16-3','severity_default','high'),
        jsonb_build_object('key','k16_4_vern','prompt','Er ansatte vernet mot oppsigelse pga selve overdragelsen?','type','yes_no_na','required',false,'law_ref','AML § 16-4','severity_default','critical'),
        jsonb_build_object('key','k16_5_drofting','prompt','Er informasjon og drøfting med tillitsvalgte gjennomført?','type','yes_no_na','required',false,'law_ref','AML § 16-5','severity_default','high')
      )),

    -- ─── Section 19: Kap. 17 — Tvister ───────────────────────────────────
    jsonb_build_object(
      'key','kap17','title','19. Tvister om arbeidsforhold','chapter','AML kap. 17',
      'estimatedMinutes',4,
      'items', jsonb_build_array(
        jsonb_build_object('key','k17_1_forhandlinger','prompt','Er det rutiner for forhandlingsmøter ved tvist (frist 2 uker)?','type','yes_no_na','required',true,'law_ref','AML § 17-1','severity_default','high','help','Krav om forhandling må fremsettes innen 2 uker etter avskjed/oppsigelse.'),
        jsonb_build_object('key','k17_3_soeksmaalsfrist','prompt','Holder virksomheten oversikt over søksmålsfrister (8 uker/6 mnd)?','type','yes_no_na','required',false,'law_ref','AML § 17-3','severity_default','high'),
        jsonb_build_object('key','k17_4_st_i_stilling','prompt','Er praksis kjent rundt arbeidstakers rett til å stå i stilling under tvist?','type','yes_no_na','required',false,'law_ref','AML § 17-4','severity_default','high')
      )),

    -- ─── Section 20: Kap. 18 — Tilsyn og tvangsmidler ────────────────────
    jsonb_build_object(
      'key','kap18','title','20. Tilsyn og tvangsmidler','chapter','AML kap. 18',
      'estimatedMinutes',5,
      'items', jsonb_build_array(
        jsonb_build_object('key','k18_1_arbeidstilsyn','prompt','Er det forberedt mottak av tilsyn fra Arbeidstilsynet (samlemappe, kontaktperson)?','type','yes_no_na','required',true,'law_ref','AML § 18-1','severity_default','high','resolutions', jsonb_build_array(jsonb_build_object('kind','register','ref','Tilsyns- og påleggsregister','label','Register over tilsynssaker'))),
        jsonb_build_object('key','k18_6_palegg','prompt','Er eventuelle pålegg fra Arbeidstilsynet etterlevd innen frist?','type','yes_no_na','required',true,'law_ref','AML § 18-6','severity_default','critical','help','Manglende etterlevelse → tvangsmulkt / stansing.','task_template', jsonb_build_object('title','Audit av åpne tilsynspålegg','priority','critical')),
        jsonb_build_object('key','k18_7_tvangsmulkt','prompt','Er det dokumentert behandling av tvangsmulkt-vedtak?','type','yes_no_na','required',false,'law_ref','AML § 18-7','severity_default','high'),
        jsonb_build_object('key','k18_8_stansing','prompt','Er det rutiner for å håndtere stansing av arbeid ved fare?','type','yes_no_na','required',false,'law_ref','AML § 18-8','severity_default','critical'),
        jsonb_build_object('key','k18_10_klage','prompt','Er klagebehandling på vedtak fra Arbeidstilsynet kjent og dokumentert?','type','yes_no_na','required',false,'law_ref','AML § 18-10','severity_default','medium')
      )),

    -- ─── Section 21: Kap. 19 — Straffeansvar ─────────────────────────────
    jsonb_build_object(
      'key','kap19','title','21. Straffeansvar','chapter','AML kap. 19',
      'intro','Informasjons-seksjon: er ledelsen kjent med straffeansvaret etter AML?',
      'estimatedMinutes',2,
      'items', jsonb_build_array(
        jsonb_build_object('key','k19_1_ansvar','prompt','Er ledelsen kjent med at brudd på AML kan medføre bot eller fengsel inntil 3 år (§ 19-1)?','type','yes_no_na','required',true,'law_ref','AML § 19-1','severity_default','medium','help','Informasjons­spørsmål — handlingsplikten ligger i kap. 1–18.'),
        jsonb_build_object('key','k19_2_grov_skyld','prompt','Er ledelsen kjent med ansvaret ved grov uaktsomhet eller forsett (§ 19-2)?','type','yes_no_na','required',true,'law_ref','AML § 19-2','severity_default','medium')
      ))
  ),
  -- Denormalisert flat items[] (tilfredsstiller jsonb_typeof check + brukes
  -- som fallback i eldre rendrere). Bygges ved jsonb_path_query_array.
  'items', '[]'::jsonb
);

-- Fyll items[] med flate kopier av alle items på tvers av sections[].
v_def := jsonb_set(
  v_def,
  '{items}',
  (select jsonb_agg(item)
   from jsonb_path_query(v_def, '$.sections[*].items[*]') as item)
);

-- ── Per-org loop: idempotent insert / update via slug-konflikt ────────────
for v_org_id in select id from public.organizations loop
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    law_refs, is_active, nav_pinned, is_system, review_status,
    cadence_hint, metadata_schema
  ) values (
    v_org_id,
    'aml-amu',
    'aml-fullgjennomgang',
    'AML — fullgjennomgang av arbeidsmiljøloven',
    'Komplett seksjonsbasert veiviser som dekker AML kap. 1–19. Forhåndsfyller roller og terskler fra organisasjonsdata, kryssrefererer eksisterende kapittelmaler, og lar deg opprette og tildele oppgaver per krav som mangler. Sesjonstilstand lagres for å fortsette senere; framdrift vises per kapittel.',
    v_def,
    v_law_refs,
    true,    -- is_active
    true,    -- nav_pinned (synlig i sidemenyen "Sjekklister")
    true,    -- is_system
    'reviewed',
    'arlig',
    v_meta
  )
  on conflict (organization_id, slug) do update set
    name             = excluded.name,
    description      = excluded.description,
    definition       = excluded.definition,
    law_refs         = excluded.law_refs,
    nav_pinned       = excluded.nav_pinned,
    is_system        = excluded.is_system,
    review_status    = excluded.review_status,
    cadence_hint     = excluded.cadence_hint,
    metadata_schema  = excluded.metadata_schema,
    updated_at       = now();
end loop;

end $$;

-- ── Validering: bekreft at hver organisasjon har malen, og at items[] er
--    et array (ellers feiler check constraint på tabellen). ────────────────
do $$
declare v_count int;
begin
  select count(*) into v_count
  from public.compliance_checklist_templates
  where slug = 'aml-fullgjennomgang'
    and pack = 'aml-amu'
    and jsonb_typeof(definition->'items') = 'array'
    and jsonb_typeof(definition->'sections') = 'array';
  raise notice 'aml-fullgjennomgang seedet for % organisasjoner', v_count;
end $$;
