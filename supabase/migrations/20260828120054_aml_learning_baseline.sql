-- AML — Læringsbaseline.
--
-- Coverage gap closed:
--   AML krever opplæring på en rekke områder. Eksisterende katalog
--   (c-aml-ledere, c-aml-13-likestilling) dekker bare to. Denne
--   migrasjonen legger til de fire som er mest etterspurt i tilsyn:
--
--   1. c-40-timers-hms — § 3-5 daglig leders 40-timers HMS-opplæring.
--   2. c-verneombud-40t — § 6-5 verneombudets 40-timers opplæring
--      (forskriftsfestet).
--   3. c-amu-grunnopplaering — § 7-4 AMU-medlemmenes grunnopplæring.
--   4. c-aml-arbeidstaker — § 3-2 (1) bokstav b «sufficient training»
--      for arbeidstakere — basis-HMS for alle.
--
-- Hver kurs er strukturert som:
--   - 4–6 tekstmoduler à 5–10 min
--   - 1 sluttquiz med passing 75 %
--   - law_refs nederst i hver modul
--
-- Self-audit (Arbeidstilsynet POV):
--   § 3-5 og § 6-5-opplæringen er dokumentkrav ved tilsyn — virksomhet
--   må kunne dokumentere bestått opplæring per leder/verneombud.
--   Læringssystemet utsteder kursbevis (eksisterende
--   learning_issue_certificate-RPC), så bevis-trail er etablert.
--   Restrisiko: forskriftens 40-timers krav forutsetter VARIASJON i
--   undervisningsformer (ikke bare e-læring) — kommentarboks i hvert
--   kurs anbefaler kombinasjon med klasseromsmodul / praktisk øvelse.
--   Læringsmodulen i appen tagger «kreves fysisk supplement» som
--   praktiseres av pedagogisk leverandør, ikke av plattformen.

set local search_path = public, pg_catalog;

-- Helper: insert system course + locale in en idempotent måte.
-- Hver kursinnsetting følger samme mønster: course-id, slug, locale 'nb',
-- title, description, modules-jsonb. Quiz-modul har 'kind' = 'quiz' med
-- spørsmål-array; tekst-modul har 'kind' = 'text' med 'content'.

-- ── 1. c-40-timers-hms ────────────────────────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-40-timers-hms', '40-timers-hms', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-40-timers-hms',
  'nb',
  'HMS-opplæring for arbeidsgiver — § 3-5 (40 timer)',
  'Lovpålagt HMS-opplæring for daglig leder / arbeidsgiver. Dekker grunnpensum etter Arbeidstilsynets krav. E-modul må kombineres med praktisk arbeid og oppgaver for å oppfylle 40-timers-kravet.',
  jsonb_build_array(
    jsonb_build_object('id','m1','title','Arbeidsgivers HMS-ansvar','kind','text','estimatedMinutes',10,
      'content','Daglig leder / styre har det overordnede HMS-ansvaret etter AML § 2-1. Ansvaret kan ikke delegeres bort. Som arbeidsgiver må du sikre at det finnes et systematisk HMS-arbeid (IK-forskriften), at risikoer kartlegges (AML § 3-1), at arbeidstakere har opplæring (§ 3-2), at vernetjenesten er etablert (§ 6 og § 7), og at avvik håndteres (IK-f § 5 nr. 4 og 7).',
      'lawRefs', jsonb_build_array('AML § 2-1','AML § 3-1','AML § 3-5')),
    jsonb_build_object('id','m2','title','Internkontrollforskriften — IK § 5','kind','text','estimatedMinutes',12,
      'content','§ 5 lister de åtte minimumspunktene i et HMS-system: mål (1a), organisering og ansvar (1b), opplæring (1c), arbeidstakermedvirkning (1d), kartlegging og risikovurdering (2 og 3), rutiner for å rette opp avvik (4), systematisk overvåking (5–8). Som leder skal du kunne forklare hvert av disse punktene og dokumentere hvordan de er ivaretatt i din virksomhet.',
      'lawRefs', jsonb_build_array('IK-f § 5','AML § 3-1')),
    jsonb_build_object('id','m3','title','Risikovurdering i praksis','kind','text','estimatedMinutes',12,
      'content','Risikovurdering = sannsynlighet × konsekvens, eller ALARP-prinsippet (As Low As Reasonably Practicable). Som leder må du sørge for at vurderingen er gjennomført, at den er dokumentert, at tiltak er prioritert etter risiko og at resultatet er kommunisert. ROS-skjema er minimum; for kjemiske eksponeringer trengs egen vurdering (forskrift om utførelse av arbeid). Spesielt for psykososialt arbeidsmiljø: mobbing/trakassering er en lovpålagt vurdering.',
      'lawRefs', jsonb_build_array('AML § 3-1 (2c)','AML § 4-3','IK-f § 5 nr. 6')),
    jsonb_build_object('id','m4','title','Verneorganisasjon og medvirkning','kind','text','estimatedMinutes',8,
      'content','Virksomheter med ≥10 ansatte skal ha verneombud (§ 6-1). Virksomheter med ≥30 ansatte skal ha AMU (§ 7-1). Verneombudet representerer arbeidstakerne og har rett til å stanse farlig arbeid. AMU skal involveres i HMS-relevante beslutninger og motta årsrapport. Som leder må du legge til rette for verneombudets arbeid og bruke AMU aktivt.',
      'lawRefs', jsonb_build_array('AML § 6-1','AML § 6-2','AML § 7-1','AML § 7-2')),
    jsonb_build_object('id','m5','title','Sykefravær, IA og tilrettelegging','kind','text','estimatedMinutes',10,
      'content','Tilretteleggingsplikten (§ 4-6) gjelder uavhengig av IA-avtale. Du skal lage oppfølgingsplan innen 4 uker for sykmeldte med restarbeidsevne; dialogmøte 1 innen 7 uker. Tilrettelegging skal være konkret, dokumentert og evaluert. NAV kan kreve oppfølgingsdokumentasjon.',
      'lawRefs', jsonb_build_array('AML § 4-6','Folketrygdloven kap. 8')),
    jsonb_build_object('id','m6','title','Quiz — sjekk forståelsen','kind','quiz','estimatedMinutes',8,
      'questions', jsonb_build_array(
        jsonb_build_object('id','q1','prompt','Hvilken § hjemler arbeidsgivers 40-timers HMS-opplæring?','type','single',
          'options', jsonb_build_array('§ 2-1','§ 3-2','§ 3-5','§ 6-5'),'answer',2),
        jsonb_build_object('id','q2','prompt','Fra hvor mange ansatte må virksomheten ha AMU?','type','single',
          'options', jsonb_build_array('5','10','30','50'),'answer',2),
        jsonb_build_object('id','q3','prompt','Hvor mange dager etter sykmelding skal oppfølgingsplan være på plass?','type','single',
          'options', jsonb_build_array('1 uke','4 uker','7 uker','3 mnd.'),'answer',1),
        jsonb_build_object('id','q4','prompt','Hvilken § krever at arbeidsgiver gjør risikovurdering og handlingsplan?','type','single',
          'options', jsonb_build_array('§ 3-1 (2c)','§ 4-1','§ 5-1','§ 14-9'),'answer',0)
      ),
      'passingScore', 75)
  )
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 2. c-verneombud-40t ───────────────────────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-verneombud-40t', 'verneombud-40t', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-verneombud-40t',
  'nb',
  'Verneombudets opplæring (§ 6-5 — 40 timer)',
  'Forskriftsfestet 40-timers opplæring for verneombud, jf. AML § 6-5 og forskrift om organisering, ledelse og medvirkning § 3-18. E-modul som basis — krever supplerende klasseroms-/praktisk modul for full uttelling.',
  jsonb_build_array(
    jsonb_build_object('id','m1','title','Verneombudets rolle og rettigheter','kind','text','estimatedMinutes',10,
      'content','Verneombudet representerer arbeidstakerne i arbeidsmiljøsaker. Skal tas med på råd ved planlegging og gjennomføring av tiltak som har betydning for arbeidsmiljøet. Har rett til den tid som trengs til vervet, lønnet, og tilgang til alle dokumenter som gjelder arbeidsmiljøet.',
      'lawRefs', jsonb_build_array('AML § 6-1','AML § 6-2','AML § 6-5')),
    jsonb_build_object('id','m2','title','Stansingsretten — § 6-3','kind','text','estimatedMinutes',8,
      'content','Hvis verneombudet mener at det foreligger umiddelbar fare for arbeidstakernes liv eller helse, kan arbeidet stanses inntil Arbeidstilsynet har tatt stilling. Stansingen skal være forholdsmessig. Plikt til å varsle arbeidsgiver og dokumentere skriftlig.',
      'lawRefs', jsonb_build_array('AML § 6-3')),
    jsonb_build_object('id','m3','title','Risikovurdering og kartlegging','kind','text','estimatedMinutes',10,
      'content','Verneombudet deltar aktivt i kartlegging av farer, risikovurdering og handlingsplaner. Vernerunder gjennomføres jevnlig. Verneombudet kan be om bistand fra BHT og fra Arbeidstilsynet.',
      'lawRefs', jsonb_build_array('AML § 3-1','AML § 4-1','IK-f § 5 nr. 6')),
    jsonb_build_object('id','m4','title','Avvik og varsling','kind','text','estimatedMinutes',8,
      'content','Verneombudet er ofte mottaker for både HMS-avvik og varsler etter kapittel 2A. Du skal kjenne forskjell på avvik (rette opp regelbrudd) og varsel (kritikkverdige forhold), og vite hvordan saker eskaleres.',
      'lawRefs', jsonb_build_array('AML § 2A-1','AML § 6-2','IK-f § 5 nr. 4')),
    jsonb_build_object('id','m5','title','Psykososialt arbeidsmiljø','kind','text','estimatedMinutes',10,
      'content','§ 4-3 omhandler psykososialt arbeidsmiljø: integritet, verdighet, kommunikasjon og vern mot trakassering. Verneombudet skal kunne kjenne igjen risikofaktorer (uklare roller, høy arbeidsbelastning, dårlig ledelse, mobbing) og medvirke til tiltak.',
      'lawRefs', jsonb_build_array('AML § 4-3')),
    jsonb_build_object('id','m6','title','Quiz','kind','quiz','estimatedMinutes',6,
      'questions', jsonb_build_array(
        jsonb_build_object('id','q1','prompt','Hvilken § gir verneombudet stansingsrett?','type','single',
          'options', jsonb_build_array('§ 6-1','§ 6-2','§ 6-3','§ 6-5'),'answer',2),
        jsonb_build_object('id','q2','prompt','Hvor mange timers opplæring skal verneombudet minst ha?','type','single',
          'options', jsonb_build_array('20','40','60','80'),'answer',1),
        jsonb_build_object('id','q3','prompt','Skal verneombudet motta varsler etter kap. 2A?','type','single',
          'options', jsonb_build_array('Aldri','Bare HMS-relaterte','Ja, det er en av kanalene','Bare hvis tillitsvalgt er fraværende'),'answer',2)
      ), 'passingScore', 75)
  )
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 3. c-amu-grunnopplaering ──────────────────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-amu-grunnopplaering', 'amu-grunnopplaering', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-amu-grunnopplaering',
  'nb',
  'AMU — grunnopplæring for medlemmer (§ 7-4)',
  'Obligatorisk grunnopplæring for AMU-medlemmer. Dekker AMUs mandat, saksflyt og ansvarsområder.',
  jsonb_build_array(
    jsonb_build_object('id','m1','title','AMUs sammensetning og rolle','kind','text','estimatedMinutes',8,
      'content','AMU er paritetisk: like mange representanter fra arbeidsgiver- og arbeidstakersiden. Leder veksler annet hvert år. Sekretariat ofte HMS-leder. AMU er rådgivende i de fleste saker, men har vedtaksmyndighet i konkrete forhold listet i § 7-2.',
      'lawRefs', jsonb_build_array('AML § 7-1','AML § 7-2')),
    jsonb_build_object('id','m2','title','AMUs oppgaver','kind','text','estimatedMinutes',10,
      'content','§ 7-2 (a)–(g): behandle spørsmål som angår BHT, behandle spørsmål om opplæring, oppfølging av sykefravær, oppfølging av yrkesskader, bygningsmessige planer, planer som angår produksjonsmetoder, andre planer og helsefarlige forhold.',
      'lawRefs', jsonb_build_array('AML § 7-2')),
    jsonb_build_object('id','m3','title','AMU-sak — saksflyt','kind','text','estimatedMinutes',8,
      'content','Sak: foredragelses → drøfting → vedtak/anbefaling → oppfølging. Protokoll signeres. Saksforberedelse: HMS-leder eller annen ansvarlig sender saksdokumenter minst 5 virkedager før møtet. Habilitet: medlemmer som har personlig interesse melder ifra.',
      'lawRefs', jsonb_build_array('AML § 7-2','AML § 7-3')),
    jsonb_build_object('id','m4','title','Årsrapport og åpenhet','kind','text','estimatedMinutes',6,
      'content','AMU lager årlig rapport om arbeidsmiljøet. Rapporten skal være tilgjengelig for ansatte og kunne vises Arbeidstilsynet ved tilsyn. Anbefales offentliggjort på intranett eller HMS-portal.',
      'lawRefs', jsonb_build_array('AML § 7-4')),
    jsonb_build_object('id','m5','title','Quiz','kind','quiz','estimatedMinutes',5,
      'questions', jsonb_build_array(
        jsonb_build_object('id','q1','prompt','Hvor mange ansatte må virksomheten ha for at AMU er pliktig?','type','single',
          'options', jsonb_build_array('10','30','50','100'),'answer',1),
        jsonb_build_object('id','q2','prompt','Hva betyr «paritetisk» i AMU?','type','single',
          'options', jsonb_build_array('Ledelsen har flertall','Lik representasjon arbeidsgiver/arbeidstaker','Verneombudet er leder','Bare ansatte er medlemmer'),'answer',1),
        jsonb_build_object('id','q3','prompt','Hvilken § lister AMUs oppgaver?','type','single',
          'options', jsonb_build_array('§ 6-2','§ 7-1','§ 7-2','§ 7-4'),'answer',2)
      ), 'passingScore', 75)
  )
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 4. c-aml-arbeidstaker ─────────────────────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-arbeidstaker', 'aml-arbeidstaker', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-arbeidstaker',
  'nb',
  'HMS for alle ansatte — basis (§ 3-2)',
  'Generell HMS-grunnopplæring for arbeidstakere etter AML § 3-2 (1) bokstav a–c. Tilpasses bransje med praktisk modul.',
  jsonb_build_array(
    jsonb_build_object('id','m1','title','Dine HMS-rettigheter','kind','text','estimatedMinutes',8,
      'content','Som arbeidstaker har du rett til et fullt forsvarlig arbeidsmiljø (§ 4-1). Du har rett til informasjon, opplæring og medvirkning. Du har rett til å varsle om kritikkverdige forhold (kap. 2A) uten å bli utsatt for gjengjeldelse. Du har rett til å nekte å utføre arbeid du mener er farlig.',
      'lawRefs', jsonb_build_array('AML § 4-1','AML § 4-3','AML § 2A-1')),
    jsonb_build_object('id','m2','title','Dine HMS-plikter','kind','text','estimatedMinutes',6,
      'content','Du har plikt til å medvirke til et godt arbeidsmiljø: bruke verneutstyr, melde avvik, varsle om feil eller mangler, og gjennomføre opplæring. Plikten gjelder så langt det er mulig av deg.',
      'lawRefs', jsonb_build_array('AML § 2-3','AML § 5-3')),
    jsonb_build_object('id','m3','title','Risikoer på arbeidsplassen','kind','text','estimatedMinutes',8,
      'content','Fysiske risikoer (fallfare, ergonomi, støy, kjemikalier), psykososiale risikoer (mobbing, høy belastning, uklare roller), brann/beredskap. Du skal vite hvilke risikoer som finnes i ditt arbeid og hvilke tiltak som er innført.',
      'lawRefs', jsonb_build_array('AML § 4-1','AML § 4-3','AML § 4-5')),
    jsonb_build_object('id','m4','title','Slik melder du avvik og varsel','kind','text','estimatedMinutes',6,
      'content','Avvik = brudd på krav. Varsel = kritikkverdige forhold. Avvik meldes via [HMS-system]. Varsel kan meldes intern (leder, verneombud, varslingsmottak) eller eksternt (Arbeidstilsynet, Datatilsynet osv.). Anonym kanal finnes også.',
      'lawRefs', jsonb_build_array('IK-f § 5 nr. 4','AML § 2A-2')),
    jsonb_build_object('id','m5','title','Quiz','kind','quiz','estimatedMinutes',5,
      'questions', jsonb_build_array(
        jsonb_build_object('id','q1','prompt','Hva er gjengjeldelse mot varsler?','type','single',
          'options', jsonb_build_array('Lovlig oppfølging','Forbudt etter § 2A-4','Krever drøftelse','Bare relevant ved avskjed'),'answer',1),
        jsonb_build_object('id','q2','prompt','Hvilken § gir deg rett til medvirkning?','type','single',
          'options', jsonb_build_array('§ 2-3','§ 4-2','§ 6-2','§ 7-2'),'answer',1),
        jsonb_build_object('id','q3','prompt','Forskjell på avvik og varsel?','type','single',
          'options', jsonb_build_array('Ingen','Avvik = regelbrudd, varsel = kritikkverdige forhold','Avvik krever advokat','Varsel meldes alltid eksternt'),'answer',1)
      ), 'passingScore', 75)
  )
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;
