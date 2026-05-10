-- Document system-coverage templates — "Systemdokumentasjon"
-- Self: audit consultants flag gaps where a legal requirement has no
-- documented evidence. Klarert's own modules satisfy several of those
-- requirements (risk tasks, survey, chemical register, learning, etc.)
-- but nothing in the document library stated that. This migration adds
-- seven pre-populated templates that explain how the system covers each
-- requirement and link auditors straight to the live module.
--
-- Self-audit (Arbeidstilsynet POV):
--   Addresses pålegg-grunner for: §3-1, §3-2, §4-3, §4-5, §5-1/5-2,
--   §4-6, IK-f §5 nr. 3/4.
--   Each template contains an info-alert placeholder where a future
--   live-data block (Option B) will be inserted — slug-stable so the
--   renderer upgrade is a drop-in with no content migration needed.
--   Restrisiko: templates describe system capability, not org-specific
--   configuration. Orgs must still populate the linked modules with
--   real data for the documents to constitute audit evidence.

-- ── 1. Risikovurdering — systemdokumentasjon ─────────────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000101',
  'tpl-sysdok-risikovurdering',
  'Risikovurdering — systemdokumentasjon',
  'Dokumenterer hvordan Klarerts oppgavemodul dekker kravet til skriftlig risikovurdering etter AML §3-1 og IK-f §5 nr. 3.',
  'procedure',
  array['AML § 3-1', 'IK-f § 5 nr. 3', 'NS-EN ISO 45001'],
  141,
  '{
    "title": "Risikovurdering — systemdokumentasjon",
    "summary": "Dette dokumentet beskriver hvordan organisasjonen oppfyller kravet til skriftlig risikovurdering gjennom Klarerts oppgavemodul.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 3-1", "IK-f § 5 nr. 3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon — den beskriver hvordan Klarert som system dekker lovkravet. Sørg for at risikovurderinger faktisk er registrert i oppgavemodulen for at dokumentet skal utgjøre reelt revisjonsbevis."},
      {"kind":"heading","level":1,"text":"Hvordan oppfylles AML §3-1?"},
      {"kind":"text","body":"<p>Arbeidsmiljøloven §3-1 (2c) og internkontrollforskriften §5 nr. 3 krever at virksomheten kartlegger farer og problemer og på denne bakgrunn vurderer risikoen. Risikovurderingen skal være skriftlig, datert og undertegnet.</p><p>Klarert oppfyller dette kravet gjennom <strong>oppgavemodulen — Risikovurdering-malen</strong>. Hver risikovurdering registreres som en strukturert oppgave med:</p><ul><li>Farekilder (type og detaljert beskrivelse)</li><li>Hvem som kan skades og hvordan</li><li>Sannsynlighet × konsekvens-matrise (S×K-grid)</li><li>Eksisterende barrierer og planlagte tiltak</li><li>Residualrisiko etter tiltak</li><li>Uavhengig gjennomgang med navn og dato</li><li>Neste gjennomgangsdato</li></ul>"},
      {"kind":"heading","level":2,"text":"Ansvarlig og involvering"},
      {"kind":"text","body":"<p>AML §3-1 (2a) krever at arbeidstakerne og deres representanter medvirker i kartleggingen. Klarerts risikovurderingsmal har et eget felt for involverte personer og bruker <em>person</em>-feltet for å knytte verneombud og fagansvarlig til vurderingen.</p><p>Verneombudet skal involveres i alle risikovurderinger etter AML §6-2 nr. 6. Dette sikres ved å legge verneombudet til som involvert part i oppgaven.</p>"},
      {"kind":"heading","level":2,"text":"Frekvens og årsgjennomgang"},
      {"kind":"text","body":"<p>Risikovurderinger skal gjennomgås:</p><ul><li>Minst én gang per år (IK-f §5 nr. 5)</li><li>Etter hendelser, ulykker og nestenulykker</li><li>Ved endringer i prosesser, utstyr eller organisasjon</li><li>På krav fra Arbeidstilsynet</li></ul><p>Neste gjennomgangsdato registreres på hver risikovurderingsoppgave. Oppgavelisten under viser status for alle aktive vurderinger.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall aktive risikovurderinger, siste gjennomgangsdato og andel med restrisiko «Høy» vil vises her direkte fra oppgavemodulen (live-blokk, versjon B). Frem til da: bruk knappen nedenfor."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne risikovurderinger i oppgavemodulen","route":"/tasks/management?template=risiko","variant":"primary"}},
      {"kind":"module","moduleName":"live_risk_feed","params":{"maxItems":5,"showDepartment":true}},
      {"kind":"law_ref","ref":"AML § 3-1","description":"Plikt til å kartlegge og vurdere risiko — skriftlig, datert, undertegnet, med ansatte involvert."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 3","description":"Kartlegge farer og problemer og på denne bakgrunn vurdere risiko — skriftlig prosedyre kreves."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 2. Psykososialt arbeidsmiljø — systemdokumentasjon ───────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000102',
  'tpl-sysdok-psykososialt',
  'Psykososialt arbeidsmiljø — systemdokumentasjon',
  'Dokumenterer hvordan undersøkelsesmodulen dekker kartleggings- og tiltaksplikten for psykososialt arbeidsmiljø etter AML §4-3.',
  'procedure',
  array['AML § 4-3', 'AML § 3-1', 'IK-f § 5 nr. 3'],
  142,
  '{
    "title": "Psykososialt arbeidsmiljø — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts undersøkelsesmodul brukes til å kartlegge og følge opp psykososialt arbeidsmiljø etter AML §4-3.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-3", "AML § 3-1"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. For at dokumentet skal utgjøre revisjonsbevis må organisasjonen faktisk gjennomføre arbeidsmiljøundersøkelser og følge opp resultatene med tiltak i oppgavemodulen."},
      {"kind":"heading","level":1,"text":"Hvordan oppfylles AML §4-3?"},
      {"kind":"text","body":"<p>AML §4-3 stiller krav til det psykososiale arbeidsmiljøet: arbeidet skal legges til rette slik at ansattes integritet og verdighet ivaretas, og arbeidstakerne skal ikke utsettes for trakassering, uønsket seksuell oppmerksomhet eller utilbørlig atferd. Arbeidsbelastning og tidspress skal være forsvarlig.</p><p>IK-f §5 nr. 3 krever at kartlegging av psykososiale risikofaktorer inngår i den systematiske HMS-aktiviteten.</p>"},
      {"kind":"heading","level":2,"text":"Kartlegging via undersøkelsesmodulen"},
      {"kind":"text","body":"<p>Klarerts undersøkelsesmodul dekker kartleggingsplikten gjennom:</p><ul><li><strong>Arbeidsmiljøundersøkelser</strong> — validerte spørreskjemaer (bl.a. QPS Nordic, UWES) som måler arbeidsbelastning, autonomi, sosial støtte og trakassering</li><li><strong>Anonyme innspill</strong> — åpne undersøkelser der ansatte kan melde bekymringer uten å identifisere seg</li><li><strong>Pulsmålinger</strong> — korte hyppige undersøkelser for å følge utvikling over tid</li></ul><p>Arbeidstilsynet forventer at kartlegging gjennomføres regelmessig (anbefalt: minst hvert annet år), at resultater presenteres for ansatte og AMU, og at det iverksettes tiltak der det avdekkes vesentlig risiko.</p>"},
      {"kind":"heading","level":2,"text":"Tiltaksoppfølging"},
      {"kind":"text","body":"<p>Funn fra undersøkelsene skal følges opp med konkrete tiltak. Disse registreres i oppgavemodulen (Tiltak-malen) og kobles til den aktuelle undersøkelsen. AMU skal informeres om resultater og planlagte tiltak etter AML §7-2.</p>"},
      {"kind":"heading","level":2,"text":"Trakassering og varsling"},
      {"kind":"text","body":"<p>Saker som gjelder trakassering eller utilbørlig atferd håndteres via varslingskanalen i Klarert (AML §2A). Se eget dokument: <em>Varslingsrutiner</em>.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall gjennomførte undersøkelser siste 12 måneder, svarprosent og andel med høy risikoindikator vil vises her direkte fra undersøkelsesmodulen (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne undersøkelsesmodulen","route":"/survey","variant":"primary"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Registrer tiltak","route":"/tasks/management?template=tiltak","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 4-3","description":"Krav til psykososialt arbeidsmiljø — verdighet, trakasseringsforbud, forsvarlig arbeidsbelastning."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 3","description":"Kartlegge psykososiale risikofaktorer som del av systematisk HMS."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 3. Kjemisk eksponering og stoffkartotek — systemdokumentasjon ────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000103',
  'tpl-sysdok-kjemisk',
  'Kjemisk eksponering og stoffkartotek — systemdokumentasjon',
  'Dokumenterer hvordan kjemikalieregisteret i Klarert dekker kravene til stoffkartotek og kjemisk risikovurdering etter AML §4-5 og Kjemikalieforskriften.',
  'procedure',
  array['AML § 4-5', 'Kjemikalieforskriften § 3', 'REACH Art. 31'],
  143,
  '{
    "title": "Kjemisk eksponering og stoffkartotek — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts kjemikalieregister dekker plikten til stoffkartotek og kjemisk risikovurdering etter AML §4-5.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-5", "Kjemikalieforskriften § 3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. Revisjonsbeviset er de faktiske oppføringene i kjemikalieregisteret. Registeret må holdes oppdatert — foreldede eller manglende SDS-er er den vanligste påleggsårsaken fra Arbeidstilsynet på §4-5."},
      {"kind":"heading","level":1,"text":"Lovgrunnlag"},
      {"kind":"text","body":"<p>AML §4-5 pålegger arbeidsgiver å sørge for at kjemiske stoffer og biologiske faktorer ikke medfører risiko for ansattes helse og sikkerhet. Kjemikalieforskriften (Forskrift om utførelse av arbeid, kap. 3) konkretiserer kravene:</p><ul><li>Stoffkartotek over alle kjemikalier som brukes eller oppbevares</li><li>Sikkerhetsdatablad (SDS) for hvert stoff, på norsk</li><li>Risikovurdering av eksponering per arbeidsoperasjon</li><li>Substitusjonsplikt — farligere stoffer skal byttes ut om mulig</li><li>Opplæring i sikker håndtering</li></ul>"},
      {"kind":"heading","level":2,"text":"Stoffkartotek i Klarert"},
      {"kind":"text","body":"<p>Kjemikalieregisteret i Klarert fungerer som virksomhetens digitale stoffkartotek. Hver oppføring inneholder:</p><ul><li>Produktnavn, CAS-nummer og leverandør</li><li>Fareklasser og faresymboler (GHS/CLP)</li><li>Bruksområde og ansvarlig avdeling</li><li>Lenke til gjeldende SDS</li><li>Substitusjonsnotat (om alternativ er vurdert)</li><li>Eksponeringsvurdering per stoff</li></ul><p>Registeret er tilgjengelig for alle ansatte og kan presenteres for Arbeidstilsynet ved tilsyn.</p>"},
      {"kind":"heading","level":2,"text":"Risikovurdering av kjemisk eksponering"},
      {"kind":"text","body":"<p>For hvert kjemikalie med identifisert risiko opprettes en risikovurderingsoppgave i oppgavemodulen (Risikovurdering-malen). Vurderingen dokumenterer:</p><ul><li>Eksponeringsnivå (målt eller estimert)</li><li>Sammenligning med administrative normer (AN-verdier)</li><li>Tekniske og organisatoriske vernetiltak</li><li>Krav til personlig verneutstyr (PPE)</li><li>Helseovervåkning hvis nødvendig</li></ul>"},
      {"kind":"heading","level":2,"text":"Opplæring og tilgang"},
      {"kind":"text","body":"<p>Ansatte som håndterer kjemikalier skal ha opplæring i sikker bruk, oppbevaring og avfallshåndtering. Opplæringen dokumenteres i læringsmodulen. SDS-ene skal være lett tilgjengelige på arbeidsstedet — fysisk eller digitalt via Klarert.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall registrerte kjemikalier, andel med gyldig SDS, antall med høy fareindikator og siste oppdateringsdato vil vises her direkte fra kjemikalieregisteret (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne kjemikalieregisteret","route":"/registers/chemicals","variant":"primary"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Opprett kjemisk risikovurdering","route":"/tasks/management?template=risiko","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 4-5","description":"Plikt til å forebygge risiko fra kjemiske stoffer og biologiske faktorer."},
      {"kind":"law_ref","ref":"Kjemikalieforskriften § 3","description":"Krav til stoffkartotek, SDS og risikovurdering av kjemisk eksponering."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 4. Avviksbehandling og personskaderapportering — systemdokumentasjon
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000104',
  'tpl-sysdok-avvik',
  'Avviksbehandling og personskaderapportering — systemdokumentasjon',
  'Dokumenterer hvordan avviksmalen i oppgavemodulen dekker kravene til avviksbehandling (IK-f §5 nr. 4) og meldeplikt for personskader (AML §5-1, §5-2).',
  'procedure',
  array['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 4', 'AML § 3-1'],
  144,
  '{
    "title": "Avviksbehandling og personskaderapportering — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts avviksmal i oppgavemodulen dekker kravene til avviksbehandling og meldeplikt for personskader.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 5-1", "AML § 5-2", "IK-f § 5 nr. 4"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"danger","text":"Alvorlige personskader og farlige forhold skal meldes til Arbeidstilsynet UMIDDELBART (AML §5-2). Bruk knappen under for å opprette avvik — tidsfristen løper fra hendelsestidspunktet."},
      {"kind":"heading","level":1,"text":"Avviksbehandling i Klarert"},
      {"kind":"text","body":"<p>IK-f §5 nr. 4 krever at virksomheten har rutiner for å behandle avvik og forebygge gjentakelse. Klarerts avviksmal i oppgavemodulen gir en strukturert CAPA-prosess (Corrective and Preventive Action) i 9 livssyklustilstander — fra åpen til lukket med effektverifikasjon.</p><p>Avviksmalen dokumenterer:</p><ul><li>Hendelsesdato, sted og hva som skjedde</li><li>Direkte og bakenforliggende årsaker (rotårsaksanalyse)</li><li>Umiddelbare strakstiltak</li><li>Korrigerende og forebyggende tiltak med ansvarlig og frist</li><li>Meldeplikt til Arbeidstilsynet (§5-1/§5-2) — eget sjekkboksfelt</li><li>Effektverifikasjon etter implementering</li><li>Uavhengig godkjenning ved lukking</li></ul>"},
      {"kind":"heading","level":2,"text":"Meldeplikt — AML §5-1 og §5-2"},
      {"kind":"text","body":"<p><strong>§5-1 — Arbeidsulykker og yrkessykdom:</strong> Arbeidsgiver skal registrere alle personskader som oppstår i arbeidet og på arbeidsstedet. Statistikk rapporteres til NAV og SSB.</p><p><strong>§5-2 — Umiddelbar meldeplikt:</strong> Alvorlige personskader og farlige forhold som kan føre til alvorlig skade, skal meldes til Arbeidstilsynet <em>umiddelbart</em> (telefonisk) og bekreftes skriftlig innen 3 virkedager. Arbeidsgiver har dessuten plikt til å varsle politiet ved arbeidsulykker med alvorlig personskade.</p><p>I Klarerts avviksmal markeres hendelsen som meldepliktig i feltet «Meldeplikt Arbeidstilsynet». Oppgaven kan ikke lukkes før feltet er besvart.</p>"},
      {"kind":"heading","level":2,"text":"Nestenulykker og farlige forhold"},
      {"kind":"text","body":"<p>Nestenulykker (hendelser som kunne ført til skade) meldes via nestenulykke-malen i oppgavemodulen. Systematisk registrering av nestenulykker er et krav etter IK-f §5 nr. 4 og gir viktig læringseffekt. En god internkontroll har typisk 5–10× så mange nestenulykker som faktiske skader i registeret.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall åpne avvik, andel innen frist, antall meldepliktige hendelser siste 12 måneder og gjennomsnittlig lukkingstid vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Meld avvik / personskade","route":"/tasks/management?template=avvik","variant":"danger"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Meld nestenulykke","route":"/tasks/management?template=nestenulykke","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 5-1","description":"Plikt til å registrere personskader og yrkessykdom."},
      {"kind":"law_ref","ref":"AML § 5-2","description":"Umiddelbar meldeplikt til Arbeidstilsynet ved alvorlig personskade eller farlig forhold."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 4","description":"Rutiner for å behandle avvik og forebygge gjentakelse."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 5. HMS-opplæring — systemdokumentasjon ───────────────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000105',
  'tpl-sysdok-opplaering',
  'HMS-opplæring — systemdokumentasjon',
  'Dokumenterer hvordan læringsmodulen i Klarert dekker opplæringsplikten etter AML §3-2 og IK-f §5 nr. 1c.',
  'procedure',
  array['AML § 3-2', 'IK-f § 5 nr. 1c', 'Forskrift om organisering § 3-18'],
  145,
  '{
    "title": "HMS-opplæring — systemdokumentasjon",
    "summary": "Beskriver hvordan læringsmodulen i Klarert dokumenterer gjennomføring av HMS-opplæring etter AML §3-2.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 3-2", "IK-f § 5 nr. 1c"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. Revisjonsbeviset er de faktiske gjennomføringsregistreringene i læringsmodulen — ikke planen alene. Arbeidstilsynet vil be om dokumentasjon på at opplæringen faktisk er gjennomført."},
      {"kind":"heading","level":1,"text":"Opplæringsplikt etter AML §3-2"},
      {"kind":"text","body":"<p>AML §3-2 pålegger arbeidsgiver å sørge for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i det systematiske HMS-arbeidet. IK-f §5 nr. 1c krever at dette er dokumentert i internkontrollsystemet.</p><p>Loven stiller særskilte krav til:</p><ul><li><strong>Lederopplæring</strong> — alle med personalansvar skal ha tilstrekkelig HMS-opplæring (Forskrift om organisering §3-18)</li><li><strong>Verneombudsopplæring</strong> — minimum 40 timer (AML §6-5)</li><li><strong>AMU-opplæring</strong> — for AMU-medlemmer (AML §7-3)</li><li><strong>Risikobasert fagopplæring</strong> — tilpasset den enkeltes arbeid og risikoeksponering</li></ul>"},
      {"kind":"heading","level":2,"text":"Dokumentasjon via læringsmodulen"},
      {"kind":"text","body":"<p>Klarerts læringsmodul registrerer for hvert kurs:</p><ul><li>Hvem som har gjennomført (individuell historikk)</li><li>Gjennomføringsdato og bestått/ikke bestått</li><li>Kursinnhold og læringsmål</li><li>Fornyelsesintervall og varsling ved utløp</li></ul><p>Ledere med personalansvar skal ha gjennomført HMS-lederopplæring. Klarert sender automatisk påminnelse når fornyelse nærmer seg.</p>"},
      {"kind":"heading","level":2,"text":"Introduksjonsopplæring (onboarding)"},
      {"kind":"text","body":"<p>Nyansatte skal motta HMS-opplæring før de starter i arbeidet (AML §3-2 første ledd). Introduksjonskurset i læringsmodulen dekker:</p><ul><li>Organisasjonens HMS-policy og mål</li><li>Avviksmelding og varslingskanaler</li><li>Beredskap og evakuering</li><li>Risikoer knyttet til den konkrete stillingen</li></ul>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Fullføringsgrad per kurs, antall ansatte med utløpt opplæring og ledere uten godkjent HMS-lederopplæring vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne læringsmodulen","route":"/learning","variant":"primary"}},
      {"kind":"law_ref","ref":"AML § 3-2","description":"Plikt til å sørge for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i HMS-arbeidet."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 1c","description":"Internkontrollen skal inneholde oversikt over opplæringsaktiviteter og kompetansekrav."},
      {"kind":"law_ref","ref":"Forskrift om organisering § 3-18","description":"Særskilt krav om dokumentert HMS-opplæring for ledere med personalansvar."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 6. Sykefraværsoppfølging — systemdokumentasjon ───────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000106',
  'tpl-sysdok-sykefraværsoppfølging',
  'Sykefraværsoppfølging — systemdokumentasjon',
  'Dokumenterer hvordan sykefravær-malen i oppgavemodulen dekker oppfølgingsplikten etter AML §4-6 og Ftrl §8-7a.',
  'procedure',
  array['AML § 4-6', 'Ftrl § 8-7a', 'Ftrl § 8-6'],
  146,
  '{
    "title": "Sykefraværsoppfølging — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts sykefravær-mal i oppgavemodulen sikrer lovpålagt oppfølging av sykemeldte arbeidstakere.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-6", "Ftrl § 8-7a"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. For hvert sykefravær som overskrider 4 uker skal det opprettes en oppfølgingsoppgave i Klarert. Manglende dokumentasjon kan gi bot fra NAV og Arbeidstilsynet."},
      {"kind":"heading","level":1,"text":"Oppfølgingsplikt etter AML §4-6"},
      {"kind":"text","body":"<p>AML §4-6 pålegger arbeidsgiver en aktiv plikt til å tilrettelegge og følge opp sykemeldte arbeidstakere. Lovens milepæler er:</p><ul><li><strong>4 uker:</strong> Oppfølgingsplan skal være utarbeidet og sendt til sykmelder (lege). Planen skal inneholde vurdering av tilretteleggingsmuligheter og plan for tilbakeføring.</li><li><strong>7 uker:</strong> Dialogmøte 1 — arbeidsgiver innkaller til møte med den sykemeldte. BHT kan involveres.</li><li><strong>26 uker:</strong> Dialogmøte 2 — NAV innkaller, arbeidsgiver og sykmelder deltar. Gradert sykmelding og tiltak vurderes.</li></ul>"},
      {"kind":"heading","level":2,"text":"Dokumentasjon i Klarert"},
      {"kind":"text","body":"<p>Sykefravær-malen i oppgavemodulen registrerer alle lovpålagte milepæler:</p><ul><li>Første sykedag og type sykefravær (100% / gradert / egenmelding)</li><li>4-ukersplan sendt — dato og bekreftelse</li><li>Dialogmøte 1 gjennomført — dato og referat</li><li>Tilretteleggingstype og konkrete tiltak</li><li>BHT-involvering</li><li>Dialogmøte 2 (NAV) — dato</li><li>Forventet tilbakekomstdato</li></ul><p>Oppgaven gir varsling ved milepæler som nærmer seg fristen og sikrer at ingen lovpålagt aktivitet glemmes.</p>"},
      {"kind":"heading","level":2,"text":"Personvern og taushetsplikt"},
      {"kind":"text","body":"<p>Sykefraværsoppfølging innebærer behandling av helseopplysninger (særlige kategorier, GDPR art. 9). Klarert lagrer ikke diagnose med mindre den ansatte frivillig oppgir den. Feltet «Diagnose/diagnosegruppe» er valgfritt og merket med dette.</p><p>Tilgang til sykefraværsoppgaver er begrenset til den ansattes nærmeste leder og HR. Se personvernerklæringen for ansatte for detaljer.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall aktive sykefraværssaker, andel med 4-ukersplan sendt innen fristen og pågående Dialogmøte 2-saker vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Opprett sykefraværsoppfølging","route":"/tasks/management?template=sykefravær-oppfølging","variant":"primary"}},
      {"kind":"law_ref","ref":"AML § 4-6","description":"Plikt til å tilrettelegge og følge opp sykemeldte — 4-ukersplan, Dialogmøte 1 (7 uker) og Dialogmøte 2 (26 uker)."},
      {"kind":"law_ref","ref":"Ftrl § 8-7a","description":"Krav til oppfølgingsplan som forutsetning for sykepenger ut over 8 uker."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── 7. Systematisk internkontroll — systemdokumentasjon ──────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000107',
  'tpl-sysdok-internkontroll',
  'Systematisk internkontroll — Klarert som IK-system',
  'Overordnet systemdokumentasjon som forklarer hvordan Klarert som helhet dekker kravene i internkontrollforskriften §5 — for bruk ved tilsyn.',
  'procedure',
  array['IK-f § 5', 'AML § 3-1', 'AML § 3-2', 'AML § 4-1'],
  140,
  '{
    "title": "Klarert som internkontrollsystem — systemdokumentasjon",
    "summary": "Overordnet dokumentasjon av hvordan Klarert dekker alle kravene i IK-forskriften §5 — egnet som innledende dokument ved Arbeidstilsynet-tilsyn.",
    "status": "published",
    "template": "wide",
    "legalRefs": ["IK-f § 5", "AML § 3-1"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette dokumentet er ment som et oppsummeringsnotat til revisor eller tilsynsmyndighet. Det er ikke et erstatning for de faktiske registreringene i systemet — det er en peker til dem."},
      {"kind":"heading","level":1,"text":"Internkontrollforskriften §5 — systemdekning"},
      {"kind":"text","body":"<p>Internkontrollforskriften (IK-f) §5 stiller krav til hva et internkontrollsystem skal inneholde. Tabellen under viser hvordan hvert krav er dekket i Klarert.</p>"},
      {"kind":"text","body":"<table><thead><tr><th>IK-f §5 krav</th><th>Dekket av</th><th>Dokumentasjon</th></tr></thead><tbody><tr><td>nr. 1a — Mål for HMS</td><td>Dokumentmodul: HMS-policy og mål</td><td>tpl-hms-policy</td></tr><tr><td>nr. 1b — Organisasjon og ansvar</td><td>Dokumentmodul: Organisasjon og ansvarsfordeling</td><td>tpl-org-ansvar</td></tr><tr><td>nr. 1c — Kompetanse og opplæring</td><td>Læringsmodul + Dokumentmodul</td><td>tpl-sysdok-opplaering</td></tr><tr><td>nr. 2 — Oversikt over krav</td><td>Sjekkliste-modul (AML-pakke) + Lov- og regelverksregister</td><td>Sjekkliste-katalog</td></tr><tr><td>nr. 3 — Risikovurdering</td><td>Oppgavemodul (Risikovurdering-mal)</td><td>tpl-sysdok-risikovurdering</td></tr><tr><td>nr. 4 — Avvikshåndtering</td><td>Oppgavemodul (Avvik-mal)</td><td>tpl-sysdok-avvik</td></tr><tr><td>nr. 5 — Årsgjennomgang</td><td>Dokumentmodul: Årsgjennomgang av internkontrollen</td><td>tpl-aarsgjennomgang</td></tr></tbody></table>"},
      {"kind":"heading","level":2,"text":"Psykososialt arbeidsmiljø (AML §4-3)"},
      {"kind":"text","body":"<p>Kartlegging via undersøkelsesmodulen. Se: <em>Psykososialt arbeidsmiljø — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Kjemisk eksponering (AML §4-5)"},
      {"kind":"text","body":"<p>Stoffkartotek via kjemikalieregisteret. Se: <em>Kjemisk eksponering og stoffkartotek — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Sykefraværsoppfølging (AML §4-6)"},
      {"kind":"text","body":"<p>Strukturert oppfølging via sykefravær-malen i oppgavemodulen. Se: <em>Sykefraværsoppfølging — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Varsling (AML §2A)"},
      {"kind":"text","body":"<p>Fullstendige varslingsrutiner dekket i dokumentmodulen. Se: <em>Varslingsrutiner</em>.</p>"},
      {"kind":"module","moduleName":"live_org_chart","params":{"showVerneombud":true,"showAMU":true}},
      {"kind":"module","moduleName":"live_risk_feed","params":{"maxItems":3,"showDepartment":true}},
      {"kind":"law_ref","ref":"IK-f § 5","description":"Internkontrollforskriften §5 — liste over hva internkontrollen skal inneholde."},
      {"kind":"law_ref","ref":"AML § 3-1","description":"Arbeidsgivers plikt til systematisk HMS-arbeid."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  updated_at   = now();

-- ── Auto-enable for all existing orgs ────────────────────────────────
-- provision_documents_baseline_for_org handles new tenants going forward.
-- This block backfills the seven new templates for every existing org.
do $$
declare
  v_org_id uuid;
  v_tpl_id uuid;
  v_tpl_ids uuid[] := array[
    '00000000-d000-4000-a000-000000000101'::uuid,
    '00000000-d000-4000-a000-000000000102'::uuid,
    '00000000-d000-4000-a000-000000000103'::uuid,
    '00000000-d000-4000-a000-000000000104'::uuid,
    '00000000-d000-4000-a000-000000000105'::uuid,
    '00000000-d000-4000-a000-000000000106'::uuid,
    '00000000-d000-4000-a000-000000000107'::uuid
  ];
begin
  for v_org_id in select id from public.organizations loop
    foreach v_tpl_id in array v_tpl_ids loop
      insert into public.document_org_template_settings (organization_id, template_id, enabled)
      values (v_org_id, v_tpl_id, true)
      on conflict (organization_id, template_id) do nothing;
    end loop;
  end loop;
end;
$$;
