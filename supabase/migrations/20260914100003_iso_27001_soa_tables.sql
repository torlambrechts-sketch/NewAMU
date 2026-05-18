-- ISO 27001:2022 — Statement of Applicability tables.
--
-- Gap closed: ISO 27001:2022 §6.1.3(d) requires a documented Statement of
-- Applicability listing all 93 Annex A controls, whether each is applicable,
-- and if excluded — why. Without this, an ISMS cannot achieve certification.
--
-- Self-audit (certification readiness):
--   Addressed: control inventory (all 93 seeded), per-org applicability flag,
--   exclusion justification, implementation status, responsible and target date.
--   Restrisiko deferred: control effectiveness evidence linkage (documents/
--   tasks references per control), automated evidence completeness scoring.
--
-- Two tables:
--   iso_27001_annex_a_controls  — read-only system catalogue of all 93 controls
--                                  from ISO 27001:2022 Annex A, organized into
--                                  4 themes (5/6/7/8).
--   iso_27001_soa               — per-org applicability decisions (one row per
--                                  control per org). Auto-populated when org
--                                  activates ISO 27001 in ISO IMS settings.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. iso_27001_annex_a_controls ────────────────────────────────────────────

create table if not exists public.iso_27001_annex_a_controls (
  id          text primary key,        -- 'A.5.1', 'A.6.3', 'A.8.24'
  theme       text not null,           -- 'organizational'|'people'|'physical'|'technological'
  theme_label text not null,           -- Norwegian display label
  title       text not null,
  description text,
  position    integer not null
);

comment on table public.iso_27001_annex_a_controls is
  'Read-only ISO 27001:2022 Annex A control catalogue. 93 controls in 4 themes.
   Seeded once in this migration; updated only when the standard revises.';

alter table public.iso_27001_annex_a_controls enable row level security;

drop policy if exists annex_a_controls_select on public.iso_27001_annex_a_controls;
create policy annex_a_controls_select on public.iso_27001_annex_a_controls
  for select to authenticated using (true);

-- ── 2. Seed all 93 controls ───────────────────────────────────────────────────

insert into public.iso_27001_annex_a_controls (id, theme, theme_label, title, description, position) values
  -- Theme 5: Organizational controls (37)
  ('A.5.1',  'organizational','Organisatoriske kontroller','Retningslinjer for informasjonssikkerhet','Informasjonssikkerhetspolitikk og emnebaserte retningslinjer skal defineres, godkjennes, publiseres, kommuniseres og anerkjennes av relevant personell, og gjennomgås med planlagte intervaller.',10),
  ('A.5.2',  'organizational','Organisatoriske kontroller','Roller og ansvar for informasjonssikkerhet','Roller og ansvar for informasjonssikkerhet skal defineres og tildeles i samsvar med organisasjonens behov.',20),
  ('A.5.3',  'organizational','Organisatoriske kontroller','Sikkerhetsoppgaver og -ansvar','Motstridende oppgaver og motstridende ansvarsområder skal skilles.',30),
  ('A.5.4',  'organizational','Organisatoriske kontroller','Ledelsesansvar','Ledelsen skal kreve at alt personell anvender informasjonssikkerhet i samsvar med etablert politikk, emnebasert politikk og prosedyrer.',40),
  ('A.5.5',  'organizational','Organisatoriske kontroller','Kontakt med myndigheter','Organisasjonen skal etablere og vedlikeholde kontakt med relevante myndigheter.',50),
  ('A.5.6',  'organizational','Organisatoriske kontroller','Kontakt med spesielle interessegrupper','Organisasjonen skal etablere og vedlikeholde kontakt med spesielle interessegrupper eller andre faglige sikkerhetsforumet og fagforeninger.',60),
  ('A.5.7',  'organizational','Organisatoriske kontroller','Trusseletterretning','Informasjon relatert til informasjonssikkerhetstrusler skal samles inn og analyseres for å produsere trusseletterretning.',70),
  ('A.5.8',  'organizational','Organisatoriske kontroller','Informasjonssikkerhet i prosjektledelse','Informasjonssikkerhet skal integreres i prosjektledelse.',80),
  ('A.5.9',  'organizational','Organisatoriske kontroller','Inventar av informasjon og andre tilknyttede eiendeler','Et inventar av informasjon og andre tilknyttede eiendeler, inkludert eiere, skal utvikles og vedlikeholdes.',90),
  ('A.5.10', 'organizational','Organisatoriske kontroller','Akseptabel bruk av informasjon og andre tilknyttede eiendeler','Regler for akseptabel bruk og prosedyrer for håndtering av informasjon og andre tilknyttede eiendeler skal identifiseres, dokumenteres og implementeres.',100),
  ('A.5.11', 'organizational','Organisatoriske kontroller','Tilbakelevering av eiendeler','Personell og andre interesseparters brukere skal returnere alle organisasjonens eiendeler ved endring eller avslutning av deres ansettelse, kontrakt eller avtale.',110),
  ('A.5.12', 'organizational','Organisatoriske kontroller','Klassifisering av informasjon','Informasjon skal klassifiseres i henhold til organisasjonens informasjonssikkerhetsbehov basert på konfidensialitet, integritet, tilgjengelighet og relevante interessentbehov.',120),
  ('A.5.13', 'organizational','Organisatoriske kontroller','Merking av informasjon','Et passende sett med prosedyrer for informasjonsmerking skal utvikles og implementeres i samsvar med organisasjonens informasjonsklassifiseringsordning.',130),
  ('A.5.14', 'organizational','Organisatoriske kontroller','Informasjonsoverføring','Regler, prosedyrer eller avtaler for informasjonsoverføring skal være på plass for alle typer overføringsutstyr i organisasjonen og med eksterne parter.',140),
  ('A.5.15', 'organizational','Organisatoriske kontroller','Tilgangskontroll','Regler for å kontrollere fysisk og logisk tilgang til informasjon og andre tilknyttede eiendeler skal etableres og implementeres basert på forretnings- og informasjonssikkerhetskrav.',150),
  ('A.5.16', 'organizational','Organisatoriske kontroller','Identitetshåndtering','Den fulle livssyklusen til identiteter skal håndteres.',160),
  ('A.5.17', 'organizational','Organisatoriske kontroller','Autentiseringsinformasjon','Tildeling og administrasjon av autentiseringsinformasjon skal kontrolleres av en styringsprosess.',170),
  ('A.5.18', 'organizational','Organisatoriske kontroller','Tilgangsrettigheter','Tilgangsrettigheter til informasjon og andre tilknyttede eiendeler skal klargjøres, gjennomgås, modifiseres og fjernes.',180),
  ('A.5.19', 'organizational','Organisatoriske kontroller','Informasjonssikkerhet i leverandørforhold','Prosesser og prosedyrer skal defineres og implementeres for å styre informasjonssikkerhetsrisikoen knyttet til bruk av leverandørers produkter eller tjenester.',190),
  ('A.5.20', 'organizational','Organisatoriske kontroller','Håndtering av informasjonssikkerhet i leverandøravtaler','Relevante informasjonssikkerhetskrav skal etableres og avtales med hver leverandør basert på type leverandørforhold.',200),
  ('A.5.21', 'organizational','Organisatoriske kontroller','Håndtering av informasjonssikkerhet i IKT-leverandørkjeden','Prosesser og prosedyrer skal defineres og implementeres for å styre informasjonssikkerhetsrisikoen knyttet til IKT-produkt- og tjenesteleverandørkjeden.',210),
  ('A.5.22', 'organizational','Organisatoriske kontroller','Overvåking, gjennomgang og endringsstyring av leverandørtjenester','Organisasjonen skal regelmessig overvåke, gjennomgå, evaluere og håndtere endringer i leverandørens informasjonssikkerhetspraksis og tjenesteleveranse.',220),
  ('A.5.23', 'organizational','Organisatoriske kontroller','Informasjonssikkerhet for bruk av skytjenester','Prosesser for anskaffelse, bruk, styring og avslutning av skytjenester skal etableres i samsvar med organisasjonens informasjonssikkerhetskrav.',230),
  ('A.5.24', 'organizational','Organisatoriske kontroller','Planlegging og forberedelse av informasjonssikkerhetshendelseshåndtering','Organisasjonen skal planlegge og forberede seg for hendelseshåndtering ved å definere, etablere og kommunisere prosesser, roller og ansvar for informasjonssikkerhetshåndtering.',240),
  ('A.5.25', 'organizational','Organisatoriske kontroller','Vurdering og beslutning om informasjonssikkerhetshendelser','Organisasjonen skal vurdere informasjonssikkerhetshendelser og beslutte om de skal kategoriseres som informasjonssikkerhetshendelser.',250),
  ('A.5.26', 'organizational','Organisatoriske kontroller','Respons på informasjonssikkerhetshendelser','Informasjonssikkerhetshendelser skal håndteres i samsvar med dokumenterte prosedyrer.',260),
  ('A.5.27', 'organizational','Organisatoriske kontroller','Læring fra informasjonssikkerhetshendelser','Kunnskap oppnådd fra informasjonssikkerhetshendelser skal brukes til å styrke og forbedre informasjonssikkerhetskontroller.',270),
  ('A.5.28', 'organizational','Organisatoriske kontroller','Innsamling av bevis','Organisasjonen skal etablere og implementere prosedyrer for identifikasjon, innsamling, anskaffelse og bevaring av bevis relatert til informasjonssikkerhetshendelser.',280),
  ('A.5.29', 'organizational','Organisatoriske kontroller','Informasjonssikkerhet under avbrudd','Organisasjonen skal planlegge hvordan informasjonssikkerhet skal opprettholdes under avbrudd.',290),
  ('A.5.30', 'organizational','Organisatoriske kontroller','IKT-beredskap for virksomhetskontinuitet','IKT-beredskap skal planlegges, implementeres, vedlikeholdes og testes basert på virksomhetskontinuitetsmål og IKT-kontinuitetskrav.',300),
  ('A.5.31', 'organizational','Organisatoriske kontroller','Juridiske, lovpålagte, regulatoriske og kontraktsmessige krav','Juridiske, lovpålagte, regulatoriske og kontraktsmessige krav relevant for informasjonssikkerhet skal identifiseres, dokumenteres og holdes oppdatert.',310),
  ('A.5.32', 'organizational','Organisatoriske kontroller','Immaterielle rettigheter','Organisasjonen skal implementere hensiktsmessige prosedyrer for å beskytte immaterielle rettigheter.',320),
  ('A.5.33', 'organizational','Organisatoriske kontroller','Beskyttelse av registre','Registre skal beskyttes mot tap, ødeleggelse, forfalskning, uautorisert tilgang og uautorisert utgivelse.',330),
  ('A.5.34', 'organizational','Organisatoriske kontroller','Personvern og beskyttelse av personopplysninger','Organisasjonen skal identifisere og oppfylle kravene angående bevaring av personvern og beskyttelse av personopplysninger i henhold til gjeldende lovgivning og regulering.',340),
  ('A.5.35', 'organizational','Organisatoriske kontroller','Uavhengig gjennomgang av informasjonssikkerhet','Organisasjonens tilnærming til å håndtere informasjonssikkerhet og implementeringen skal gjennomgås uavhengig med planlagte intervaller eller når vesentlige endringer inntreffer.',350),
  ('A.5.36', 'organizational','Organisatoriske kontroller','Overholdelse av retningslinjer, regler og standarder for informasjonssikkerhet','Overholdelse av organisasjonens informasjonssikkerhetspolitikk, emnebasert politikk, regler og standarder skal regelmessig gjennomgås.',360),
  ('A.5.37', 'organizational','Organisatoriske kontroller','Dokumenterte driftsrutiner','Driftsrutiner for informasjonsbehandlingsutstyr skal dokumenteres og gjøres tilgjengelig for personell som trenger dem.',370),

  -- Theme 6: People controls (8)
  ('A.6.1',  'people','Personkontroller','Screening','Bakgrunnsverifisering av alle kandidater til å bli ansatte skal utføres i samsvar med gjeldende lovgivning, regulering og etikk, og stå i forhold til forretningskravene, informasjonen som skal aksesseres og oppfattet risiko.',380),
  ('A.6.2',  'people','Personkontroller','Vilkår og betingelser for ansettelse','Ansettelseskontraktene skal angi det ansattes og organisasjonens ansvar for informasjonssikkerhet.',390),
  ('A.6.3',  'people','Personkontroller','Informasjonssikkerhetsbevissthet, utdanning og opplæring','Personell i organisasjonen og relevante interesseparter skal motta egnet bevissthet om informasjonssikkerhet, utdanning og opplæring og regelmessige oppdateringer av organisasjonens informasjonssikkerhetspolitikk, emnebasert politikk og prosedyrer, relevante for deres arbeidsfunksjon.',400),
  ('A.6.4',  'people','Personkontroller','Disiplinærprosess','En disiplinærprosess skal formaliseres og kommuniseres for å handle mot personell og andre relevante interesseparter som har begått et brudd på informasjonssikkerhetspolitikken.',410),
  ('A.6.5',  'people','Personkontroller','Ansvar ved avslutning eller endring av ansettelse','Ansvar og plikter for informasjonssikkerhet som forblir gyldige etter avslutning eller endring av ansettelse skal defineres, håndheves og kommuniseres til relevant personell og andre interesseparter.',420),
  ('A.6.6',  'people','Personkontroller','Konfidensialitets- eller taushetserklæringer','Konfidensialitets- eller taushetserklæringer som gjenspeiler organisasjonens behov for beskyttelse av informasjon skal identifiseres, dokumenteres, gjennomgås regelmessig og signeres av personell og andre relevante interesseparter.',430),
  ('A.6.7',  'people','Personkontroller','Fjernarbeid','Sikkerhetstiltak skal implementeres når personell arbeider eksternt for å beskytte informasjon som aksesseres, behandles eller lagres utenfor organisasjonens lokaler.',440),
  ('A.6.8',  'people','Personkontroller','Rapportering av informasjonssikkerhetshendelser','Organisasjonen skal gi personell en mekanisme for å rapportere observerte eller mistenkte informasjonssikkerhetshendelser gjennom hensiktsmessige kanaler til rett tid.',450),

  -- Theme 7: Physical controls (14)
  ('A.7.1',  'physical','Fysiske kontroller','Fysiske sikringsomkretser','Sikringsomkretser skal defineres og brukes til å beskytte områder som inneholder informasjon og andre tilknyttede eiendeler.',460),
  ('A.7.2',  'physical','Fysiske kontroller','Fysisk inngangsadgang','Sikrede områder skal beskyttes med hensiktsmessige inngangsadgangskontroller og tilgangspunkter.',470),
  ('A.7.3',  'physical','Fysiske kontroller','Sikring av kontorer, rom og fasiliteter','Fysisk sikkerhet for kontorer, rom og fasiliteter skal utformes og implementeres.',480),
  ('A.7.4',  'physical','Fysiske kontroller','Overvåking av fysisk sikkerhet','Lokaler skal overvåkes kontinuerlig for å hindre uautorisert fysisk tilgang.',490),
  ('A.7.5',  'physical','Fysiske kontroller','Beskyttelse mot fysiske og miljømessige trusler','Beskyttelse mot fysiske og miljømessige trusler, som naturkatastrofer og andre forsettlige eller utilsiktede fysiske trusler mot infrastruktur, skal utformes og implementeres.',500),
  ('A.7.6',  'physical','Fysiske kontroller','Arbeid i sikrede områder','Sikkerhetstiltak for arbeid i sikrede områder skal utformes og implementeres.',510),
  ('A.7.7',  'physical','Fysiske kontroller','Ryddig skrivebord og ryddig skjerm','Regler for ryddig skrivebord for papir og flyttbare lagringsmedier og en ryddig skjerm for informasjonsbehandlingsutstyr skal defineres og hensiktsmessig håndheves.',520),
  ('A.7.8',  'physical','Fysiske kontroller','Plassering og beskyttelse av utstyr','Utstyr skal plasseres sikkert og beskyttes.',530),
  ('A.7.9',  'physical','Fysiske kontroller','Sikkerhet for eiendeler utenfor lokaler','Eiendeler utenfor lokaler skal beskyttes.',540),
  ('A.7.10', 'physical','Fysiske kontroller','Lagringsmedier','Lagringsmedier skal håndteres gjennom hele livssyklusen for anskaffelse, bruk, transport og avhending i henhold til organisasjonens klassifiseringsskjema og krav til håndtering.',550),
  ('A.7.11', 'physical','Fysiske kontroller','Støtteverktøy','Informasjonsbehandlingsutstyr skal beskyttes mot strømbrudd og andre forstyrrelser forårsaket av feil i støtteverktøy.',560),
  ('A.7.12', 'physical','Fysiske kontroller','Sikkerhet for kabling','Kabler som bærer strøm eller datatilkoblinger eller som støtter informasjonstjenester skal beskyttes mot avlytting, interferens eller skade.',570),
  ('A.7.13', 'physical','Fysiske kontroller','Vedlikehold av utstyr','Utstyr skal vedlikeholdes riktig for å sikre tilgjengelighet, integritet og konfidensialitet av informasjon.',580),
  ('A.7.14', 'physical','Fysiske kontroller','Sikker avhending eller gjenbruk av utstyr','Elementer av utstyr som inneholder lagringsmedier skal verifiseres for å sikre at sensitive data og lisensiert programvare har blitt fjernet eller sikkert overskrevet før avhending eller gjenbruk.',590),

  -- Theme 8: Technological controls (34)
  ('A.8.1',  'technological','Teknologiske kontroller','Brukerendepunktsenheter','Informasjon lagret på, behandlet av eller tilgjengelig via brukerendepunktsenheter skal beskyttes.',600),
  ('A.8.2',  'technological','Teknologiske kontroller','Privilegerte tilgangsrettigheter','Tildeling og bruk av privilegerte tilgangsrettigheter skal begrenses og styres.',610),
  ('A.8.3',  'technological','Teknologiske kontroller','Tilgangsbegrensning til informasjon','Tilgang til informasjon og andre tilknyttede eiendeler skal begrenses i henhold til den etablerte emnebaserte politikken om tilgangskontroll.',620),
  ('A.8.4',  'technological','Teknologiske kontroller','Tilgang til kildekode','Lese- og skrivetilgang til kildekode, utviklingsverktøy og programvarebiblioteker skal håndteres hensiktsmessig.',630),
  ('A.8.5',  'technological','Teknologiske kontroller','Sikker autentisering','Sikre autentiseringsteknologier og prosedyrer skal implementeres basert på begrensninger for informasjonstilgang og den emnebaserte politikken for tilgangskontroll.',640),
  ('A.8.6',  'technological','Teknologiske kontroller','Kapasitetsstyring','Bruk av ressurser skal overvåkes og justeres i samsvar med gjeldende og forventede kapasitetskrav.',650),
  ('A.8.7',  'technological','Teknologiske kontroller','Beskyttelse mot malware','Beskyttelse mot malware skal implementeres og støttes av hensiktsmessig brukerbevissthet.',660),
  ('A.8.8',  'technological','Teknologiske kontroller','Håndtering av tekniske sårbarheter','Informasjon om tekniske sårbarheter i informasjonssystemer i bruk skal innhentes, organisasjonens eksponering for slike sårbarheter skal evalueres og hensiktsmessige tiltak skal tas.',670),
  ('A.8.9',  'technological','Teknologiske kontroller','Konfigurasjonsstyring','Konfigurasjoner, inkludert sikkerhetskonfigurasjoner, av maskinvare, programvare, tjenester og nettverk skal etableres, dokumenteres, implementeres, overvåkes og gjennomgås.',680),
  ('A.8.10', 'technological','Teknologiske kontroller','Sletting av informasjon','Informasjon lagret i informasjonssystemer, enheter eller andre lagringsmedier skal slettes når det ikke lenger er nødvendig.',690),
  ('A.8.11', 'technological','Teknologiske kontroller','Datamaskering','Datamaskering skal brukes i samsvar med organisasjonens emnebaserte politikk for tilgangskontroll og andre relaterte emnebaserte retningslinjer, og forretningskrav, ta hensyn til gjeldende lovgivning.',700),
  ('A.8.12', 'technological','Teknologiske kontroller','Forebygging av datalekkasje','Tiltak for forebygging av datalekkasje skal brukes på systemer, nettverk og andre enheter som behandler, lagrer eller overfører sensitiv informasjon.',710),
  ('A.8.13', 'technological','Teknologiske kontroller','Sikkerhetskopiering av informasjon','Sikkerhetskopier av informasjon, programvare og systemer skal vedlikeholdes og testes regelmessig i henhold til den avtalte emnebaserte politikken for sikkerhetskopiering.',720),
  ('A.8.14', 'technological','Teknologiske kontroller','Redundans av informasjonsbehandlingsfasiliteter','Informasjonsbehandlingsfasiliteter skal implementeres med tilstrekkelig redundans til å oppfylle tilgjengelighetskrav.',730),
  ('A.8.15', 'technological','Teknologiske kontroller','Logging','Logger som registrerer aktiviteter, unntak, feil og andre relevante hendelser skal produseres, lagres, beskyttes og analyseres.',740),
  ('A.8.16', 'technological','Teknologiske kontroller','Overvåkingsaktiviteter','Nettverk, systemer og applikasjoner skal overvåkes for unormal atferd, og hensiktsmessige tiltak skal iverksettes for å evaluere potensielle informasjonssikkerhetshendelser.',750),
  ('A.8.17', 'technological','Teknologiske kontroller','Klokkesynchronisering','Klokkene til informasjonsbehandlingssystemene som brukes av organisasjonen, skal synkroniseres til godkjente tidskilder.',760),
  ('A.8.18', 'technological','Teknologiske kontroller','Bruk av privilegerte verktøy','Bruk av verktøy som kan overvinne system- og applikasjonskontroller skal begrenses og overvåkes nøye.',770),
  ('A.8.19', 'technological','Teknologiske kontroller','Installasjon av programvare på operative systemer','Prosedyrer og tiltak skal implementeres for å sikre trygg installasjon av programvare på operative systemer.',780),
  ('A.8.20', 'technological','Teknologiske kontroller','Nettverkssikkerhet','Nettverk og nettverksenheter skal sikres, håndteres og kontrolleres for å beskytte informasjon i systemer og applikasjoner.',790),
  ('A.8.21', 'technological','Teknologiske kontroller','Sikkerhet i nettverkstjenester','Sikkerhetsmekanismer, tjenestenivåer og tjenestekrav for alle nettverkstjenester skal identifiseres, implementeres og overvåkes.',800),
  ('A.8.22', 'technological','Teknologiske kontroller','Separasjon av nettverk','Grupper av informasjonstjenester, brukere og informasjonssystemer skal separeres i organisasjonens nettverk.',810),
  ('A.8.23', 'technological','Teknologiske kontroller','Filtrering av nettsted','Tilgang til eksterne nettsteder skal håndteres for å redusere eksponering for skadelig innhold.',820),
  ('A.8.24', 'technological','Teknologiske kontroller','Bruk av kryptografi','Regler for effektiv bruk av kryptografi, inkludert kryptografisk nøkkelbehandling, skal defineres og implementeres.',830),
  ('A.8.25', 'technological','Teknologiske kontroller','Sikker utviklingslivssyklus','Regler for sikker utvikling av programvare og systemer skal etableres og brukes.',840),
  ('A.8.26', 'technological','Teknologiske kontroller','Krav til applikasjonssikkerhet','Informasjonssikkerhetskrav skal identifiseres, spesifiseres og godkjennes ved utvikling eller anskaffelse av applikasjoner.',850),
  ('A.8.27', 'technological','Teknologiske kontroller','Sikker systemarkitektur og ingeniørprinsipper','Prinsipper for engineering av sikre systemer skal etableres, dokumenteres, vedlikeholdes og brukes for enhver informasjonssystemutviklingsaktivitet.',860),
  ('A.8.28', 'technological','Teknologiske kontroller','Sikker koding','Sikre kodingsprinsipper skal brukes i programvareutvikling.',870),
  ('A.8.29', 'technological','Teknologiske kontroller','Sikkerhetstesting i utvikling og aksept','Sikkerhetstestingsprosesser skal defineres og implementeres i utviklingslivssyklusen.',880),
  ('A.8.30', 'technological','Teknologiske kontroller','Outsourcet utvikling','Organisasjonen skal dirigere, overvåke og gjennomgå aktivitetene knyttet til outsourcet systemutvikling.',890),
  ('A.8.31', 'technological','Teknologiske kontroller','Separasjon av utviklings-, test- og produksjonsmiljøer','Utviklings-, test- og produksjonsmiljøer skal separeres og sikres.',900),
  ('A.8.32', 'technological','Teknologiske kontroller','Endringsstyring','Endringer i informasjonsbehandlingsfasiliteter og informasjonssystemer skal underkastes styringsprosedyrer for endring.',910),
  ('A.8.33', 'technological','Teknologiske kontroller','Testinformasjon','Testinformasjon skal hensiktsmessig velges ut, beskyttes og håndteres.',920),
  ('A.8.34', 'technological','Teknologiske kontroller','Beskyttelse av informasjonssystemer under revisjonstesting','Revisjonstester og andre forsikringsaktiviteter som involverer vurdering av operative systemer skal planlegges og avtales mellom tester og relevant ledelse.',930)
on conflict (id) do update set
  title       = excluded.title,
  description = excluded.description,
  position    = excluded.position;

-- ── 3. iso_27001_soa ─────────────────────────────────────────────────────────

create table if not exists public.iso_27001_soa (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  control_id            text not null references public.iso_27001_annex_a_controls (id),
  applicable            boolean not null default true,
  exclusion_reason      text,
  -- 'not_started' | 'planned' | 'partial' | 'implemented' | 'verified'
  implementation_status text not null default 'not_started',
  implementation_notes  text,
  responsible_id        uuid,  -- soft ref to organization_members.id
  target_date           date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, control_id)
);

comment on table public.iso_27001_soa is
  'Per-org Statement of Applicability for ISO 27001:2022 Annex A.
   One row per (org, control). Auto-populated when org activates iso-27001
   in organization_iso_settings via the SoA initialization RPC or trigger.
   IsoSoAPage.tsx reads and updates these rows.';

comment on column public.iso_27001_soa.applicable is
  'true = control applies to this org. false = excluded. When false,
   exclusion_reason must be provided (enforced at application layer).';

comment on column public.iso_27001_soa.implementation_status is
  'not_started: no evidence. planned: target_date set. partial: partially
   implemented. implemented: evidence available. verified: audited.
   Feeds the iso_soa_implementation_rate kpi widget on the IMS dashboard.';

alter table public.iso_27001_soa enable row level security;

drop policy if exists iso_soa_select on public.iso_27001_soa;
create policy iso_soa_select on public.iso_27001_soa
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists iso_soa_write on public.iso_27001_soa;
create policy iso_soa_write on public.iso_27001_soa
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

drop trigger if exists iso_soa_set_updated_at on public.iso_27001_soa;
create trigger iso_soa_set_updated_at
  before update on public.iso_27001_soa
  for each row execute function public.set_updated_at();

create index if not exists iso_soa_org_idx
  on public.iso_27001_soa (organization_id, implementation_status);

-- ── 4. provision_iso_27001_soa_for_org ───────────────────────────────────────
-- Called by IsoSettingsPage when the org activates iso-27001. Idempotently
-- inserts all 93 controls as 'not_started' / applicable=true.

create or replace function public.provision_iso_27001_soa_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.iso_27001_soa (organization_id, control_id, applicable, implementation_status)
  select p_org_id, id, true, 'not_started'
  from public.iso_27001_annex_a_controls
  on conflict (organization_id, control_id) do nothing;
end;
$$;

revoke all on function public.provision_iso_27001_soa_for_org(uuid) from public, anon;
grant execute on function public.provision_iso_27001_soa_for_org(uuid) to authenticated, service_role;
