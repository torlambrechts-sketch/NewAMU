-- AML e-læring — innholds-utvidelser fase 1 + reparasjon av baseline-shape.
--
-- To kombinerte gap lukkes:
--   A. Innholdsgap (compliance-analyse 2026-05-11):
--      - § 19-1 straffeansvar + § 14-12 innleide i 40-timers-kurset
--      - BHT-samspill + praktisk vernerunde i verneombud-kurset
--      - Bransje­varianter for § 3-2 (industri/helse/bygg)
--      - ARP-detalj i likestillings­kurset
--      - Nytt kurs c-aml-endring for § 4-1 (3) endrings­kartlegging
--      - Fyldig modulpakke i c-aml-ledere
--   B. Renderings­gap: eksisterende baseline (20260828120054) lagrer modul-
--      JSONB med flat shape (content som streng, estimatedMinutes,
--      prompt/answer i quiz). LearningPlayer forventer wrapped
--      ModuleContent-discriminated union (content.body, content.questions
--      med question/correctIndex, content.slides, durationMinutes). Denne
--      migrasjonen replacer modulene for de seks eksisterende kursene
--      med korrekt shape som faktisk renderer.
--
-- Self-audit (Arbeidstilsynet POV):
--   * § 3-5 / § 6-5 — pensum fullstendig, pedagogisk variert (text + quiz
--     + flashcard + on_job + checklist + video-transkript-som-tekst).
--   * Restrisiko: video­modulene leveres som tekst-transkript inntil
--     opptak er produsert; bytter til `video`-kind med url+caption når
--     opptak foreligger.
--   * Bransje­varianter olje/gass, transport, landbruk er restanse fase 2.
--   * Dokumentasjon: hver modul progress logges; kursbevis via eksisterende
--     learning_issue_certificate-RPC.
--
-- Spec: specs/learning-aml-course-content.md

set local search_path = public, pg_catalog;

-- ── 1. c-40-timers-hms (REPLACE — fikser baseline + utvider) ─────────────

update public.learning_system_course_locales
set modules = $jsonb$
[
  {"id":"m1","title":"Arbeidsgivers HMS-ansvar","order":1,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 2-1","AML § 3-1","AML § 3-5"],
   "content":{"kind":"text","body":"<p>Daglig leder og styret har det overordnede HMS-ansvaret etter AML § 2-1. Ansvaret kan ikke delegeres bort.</p><p>Som arbeidsgiver må du sikre at det finnes et systematisk HMS-arbeid (Internkontroll­forskriften), at risikoer kartlegges (AML § 3-1), at arbeidstakere har opplæring (§ 3-2), at vernetjenesten er etablert (§ 6 og § 7), og at avvik håndteres (IK-f § 5 nr. 4 og 7).</p><p>Du skal kunne dokumentere ansvars­linjen ved tilsyn: hvem har hvilket ansvar, hva er delegert, hvor er det skriftlig?</p>"}},

  {"id":"m2","title":"Internkontrollforskriften — IK § 5","order":2,"kind":"text","durationMinutes":12,
   "lawRefs":["IK-f § 5","AML § 3-1"],
   "content":{"kind":"text","body":"<p>§ 5 lister åtte minimumspunkter i et HMS-system:</p><ol><li>Mål for HMS-arbeidet</li><li>Organisering og ansvar</li><li>Opplæring og kompetanse</li><li>Arbeidstakermedvirkning</li><li>Kartlegging og risikovurdering</li><li>Tiltak basert på risiko</li><li>Rutiner for å rette opp avvik</li><li>Systematisk overvåking og revisjon</li></ol><p>Du må kunne forklare hvert av disse punktene og dokumentere hvordan det er ivaretatt i din virksomhet.</p>"}},

  {"id":"m3","title":"Risikovurdering i praksis","order":3,"kind":"text","durationMinutes":12,
   "lawRefs":["AML § 3-1 (2c)","AML § 4-3","IK-f § 5 nr. 6"],
   "content":{"kind":"text","body":"<p>Risikovurdering = sannsynlighet × konsekvens, eller ALARP-prinsippet (As Low As Reasonably Practicable).</p><p>Som leder må du sørge for at vurderingen er gjennomført, dokumentert, og at tiltak er prioritert etter risiko. ROS-skjema er minimum.</p><p>Kjemiske eksponeringer krever egen vurdering (Forskrift om utførelse av arbeid). Psyko­sosialt arbeids­miljø — særlig mobbing og trakassering — skal vurderes særskilt etter § 4-3.</p>"}},

  {"id":"m4","title":"Verneorganisasjon og medvirkning","order":4,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 6-1","AML § 6-2","AML § 7-1","AML § 7-2","AML § 14-12"],
   "content":{"kind":"text","body":"<p>Tersklene du må kunne:</p><ul><li>Fra 10 ansatte: verneombud (§ 6-1). Innleide teller med (§ 14-12).</li><li>Fra 30 ansatte: AMU (§ 7-1). Fra 10–29 kan AMU kreves av en part.</li><li>Fra 50 ansatte: hovedverneombud anbefalt; informasjons- og drøftings­plikt (§ 8-1).</li></ul><p>Verneombudet har stansings­rett (§ 6-3). AMU er paritetisk og rådgivende — men har vedtaks­myndighet i fem konkrete tilfeller (§ 7-2 (4)).</p>"}},

  {"id":"m5","title":"Sykefravær, IA og tilrettelegging","order":5,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 4-6","Folketrygdloven kap. 8"],
   "content":{"kind":"text","body":"<p>Tilretteleggings­plikten (§ 4-6) gjelder uavhengig av IA-avtale.</p><p>Frister du må huske:</p><ul><li>Innen 4 uker: skriftlig oppfølgings­plan</li><li>Innen 7 uker: dialogmøte 1 (leder + ansatt + ev. tillitsvalgt)</li><li>Innen 26 uker: dialogmøte 2 (NAV deltar)</li><li>52 uker: maksdato — drøft alternativer</li></ul><p>Tilretteleggingen skal være konkret, dokumentert og evaluert. NAV kan kreve oppfølgings­dokumentasjon ved kontroll.</p>"}},

  {"id":"m6","title":"Personlig straffeansvar og sanksjoner","order":6,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 19-1","AML § 19-2","AML § 19-3","AML § 18-10","Straffeloven § 27"],
   "content":{"kind":"text","body":"<p>AML § 19-1 fastsetter at både arbeidsgiver som virksomhet og enkelt­personer i ledelsen kan straffes med bøter eller fengsel inntil 1 år (3 år ved grov overtredelse, § 19-1 (2)).</p><p>Arbeidstilsynet kan i tillegg ilegge overtredelses­gebyr opptil 15 G (~1,8 mill. kr i 2026) etter § 18-10 uten anmeldelse.</p><p>Ansvaret er personlig og kan ikke forsikres bort. Høyesterett (HR-2019-2205-A) har slått fast at manglende systematisk HMS-arbeid alene gir straffe­ansvar — det er ikke krav om at skade har inntruffet.</p><p>Som leder må du derfor kunne dokumentere risiko­vurdering, opplæring, avvik, verne­organisasjon, og lukking av pålegg.</p>"}},

  {"id":"m7","title":"Innleide og tellings­regel","order":7,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 14-12","AML § 14-12 a","AML § 6-1","AML § 7-1","AML § 3-2"],
   "content":{"kind":"text","body":"<p>§ 14-12 og likebehandlings­prinsippet i § 14-12 a innebærer at innleide har samme arbeidsmiljø­vern som egne ansatte.</p><p>Innleide teller med i grunnlaget for:</p><ul><li>§ 6-1 verneombud­plikt (≥10)</li><li>§ 7-1 AMU-plikt (≥30, eller ≥10 hvis parter krever)</li><li>§ 4-3 psyko­sosial kartlegging</li><li>§ 3-2 opplæring (innleier har sekundær­ansvar)</li></ul><p>Feiltelling fører til pålegg om etablering av VO/AMU innen 30 dager; manglende oppfølging utløser § 18-10 gebyr.</p>"}},

  {"id":"m8","title":"Flashcards — paragrafer på pulsen","order":8,"kind":"flashcard","durationMinutes":10,
   "lawRefs":["AML"],
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"§ 2-1","back":"Arbeidsgivers overordnede ansvar — kan ikke delegeres"},
     {"id":"c2","front":"§ 3-1","back":"Systematisk HMS-arbeid — krav til IK-system"},
     {"id":"c3","front":"§ 3-2","back":"Opplæring og instruksjon for arbeidstakere"},
     {"id":"c4","front":"§ 3-5","back":"HMS-opplæring for arbeidsgiver (40-timers norm)"},
     {"id":"c5","front":"§ 4-3","back":"Psykososialt arbeidsmiljø — vern mot trakassering"},
     {"id":"c6","front":"§ 4-6","back":"Tilretteleggings­plikt — uavhengig av IA"},
     {"id":"c7","front":"§ 6-1 / 6-3 / 6-5","back":"Verneombud — pliktig ≥10, stansingsrett, 40-t opplæring"},
     {"id":"c8","front":"§ 7-1 / 7-2","back":"AMU — pliktig ≥30, paritetisk, oppgaver i § 7-2"},
     {"id":"c9","front":"§ 14-12","back":"Innleide — likebehandling og tellings­regel"},
     {"id":"c10","front":"§ 18-10","back":"Overtredelses­gebyr opptil 15 G"},
     {"id":"c11","front":"§ 19-1","back":"Straffeansvar — bot eller fengsel inntil 1 år (3 år grov)"},
     {"id":"c12","front":"IK-f § 5 nr. 6","back":"Kartlegge farer og vurdere risiko"}
   ]}},

  {"id":"m9","title":"OJT — Din første HMS-årsrapport","order":9,"kind":"on_job","durationMinutes":30,
   "lawRefs":["IK-f § 5 nr. 5-8","AML § 6-2","AML § 7-2 g"],
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Last ned IK-§ 5-sjekkliste fra NewAMU","description":"Bevis: skjermbilde. Signatur: selv."},
     {"id":"t2","title":"List alle risikoer fra siste risikovurdering","description":"Bevis: PDF eller lenke. Signatur: selv."},
     {"id":"t3","title":"Tell antall avvik åpne/lukket siste 12 mnd","description":"Bevis: eksport. Signatur: selv."},
     {"id":"t4","title":"Skriv 1-sides utkast til IK-årsrapport","description":"Bruk NewAMU mal. Bevis: vedlegg. Signatur: verneombud."},
     {"id":"t5","title":"Drøft utkastet med verneombud før AMU-møte","description":"Bevis: møtenotat. Signatur: verneombud."}
   ]}},

  {"id":"m10","title":"Video-transkript — Arbeidsgivers HMS-ansvar (8 min)","order":10,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 2-1","AML § 3-1","AML § 3-5","AML § 4-3","AML § 6-1","AML § 7-1","AML § 14-12","AML § 19-1","IK-f § 5"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript med tidsstempel. Erstattes med video-modul når opptak foreligger.</em></p><p><strong>[00:00–00:20] Åpning.</strong> Du har akkurat fått daglig leder-tittelen, eller du leder en avdeling med personal­ansvar, eller du sitter i et styre. I løpet av de neste åtte minuttene skal vi gå gjennom det viktigste du må forstå om HMS-ansvaret ditt — fordi det er personlig, og det kan ikke delegeres bort.</p><p><strong>[00:20–01:10] § 2-1 og delegerings­grensen.</strong> Arbeidsmiljølovens § 2-1 sier at arbeidsgiver skal sørge for at bestemmelsene i loven blir overholdt. Du kan delegere oppgaver, men ikke ansvaret. Høyesterett, sist HR-2019-2205, har slått fast at manglende systematisk HMS-arbeid alene gir straffe­ansvar.</p><p><strong>[01:10–02:30] Det systematiske HMS-arbeidet.</strong> IK-forskriften § 5 har åtte punkter: Mål, Organisering, Kunnskap, Arbeidstaker­medvirkning, Risikovurdering, Drift, Overvåking, Oppfølging.</p><p><strong>[02:30–04:00] § 3-5 og 40 timer.</strong> Loven setter ikke timetall, men forskrift om organisering, ledelse og medvirkning § 3-18 fastsetter at opplæringen skal være tilpasset risikoen i virksomheten. 40 timer er praksis. E-læring dekker teorien; praktiske oppgaver må gjennomføres i tillegg.</p><p><strong>[04:00–05:20] Terskler og tellere.</strong> Ti ansatte — verneombud. Tretti — AMU. Innleide teller med (§ 14-12) — mange ledere teller bare egne ansatte og havner under terskelen i papirene.</p><p><strong>[05:20–06:30] § 4-3 psykososialt.</strong> Mest undervurderte paragraf. Du må kartlegge psykososialt arbeids­miljø anonymt med terskel på minst fem svar per gruppe.</p><p><strong>[06:30–07:30] Avvik og varsling.</strong> To kanaler — én for HMS-avvik, én for varsling etter kap. 2 A. § 2A-4 forbyr gjengjeldelse. Som leder kan du komme i personlig erstatnings­ansvar.</p><p><strong>[07:30–08:00] Avslutning.</strong> Dokumenter alt. Det er dokumentasjonen som beskytter deg ved tilsyn.</p>"}},

  {"id":"m11","title":"Mid-quiz","order":11,"kind":"quiz","durationMinutes":6,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Hvilken § hjemler arbeidsgivers HMS-opplæring?","options":["§ 2-1","§ 3-2","§ 3-5","§ 6-5"],"correctIndex":2},
     {"id":"q2","question":"Fra hvor mange ansatte må virksomheten ha AMU?","options":["5","10","30","50"],"correctIndex":2},
     {"id":"q3","question":"Innen hvor mange uker skal oppfølgings­plan ved sykefravær være på plass?","options":["1","4","7","12"],"correctIndex":1},
     {"id":"q4","question":"Hvilken § krever risikovurdering og handlingsplan?","options":["§ 3-1 (2c)","§ 4-1","§ 5-1","§ 14-9"],"correctIndex":0}
   ]}},

  {"id":"m12","title":"Sluttquiz","order":12,"kind":"quiz","durationMinutes":10,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"§ 19-1 — øvre strafferamme ved grov overtredelse?","options":["1 år","3 år","5 år","10 år"],"correctIndex":1},
     {"id":"q2","question":"§ 18-10 — øvre grense for overtredelses­gebyr?","options":["5 G","10 G","15 G","30 G"],"correctIndex":2},
     {"id":"q3","question":"Teller innleide med i grunnlaget for AMU-plikt?","options":["Ja","Nei","Bare ved >12 mnd","Bare hvis fast oppmøte"],"correctIndex":0},
     {"id":"q4","question":"Hvilken Høyesterettsdom slo fast at manglende systematisk HMS-arbeid alene gir straffe­ansvar?","options":["Rt. 1998-411","Rt. 2012-770","HR-2019-2205-A","Rt. 2020-1066"],"correctIndex":2},
     {"id":"q5","question":"Fra hvor mange ansatte er verneombud pliktig?","options":["5","10","20","30"],"correctIndex":1},
     {"id":"q6","question":"§ 4-6 tilretteleggings­plikten gjelder …","options":["Bare ved IA-avtale","Uavhengig av IA","Kun for sykmeldte","Kun fysisk skade"],"correctIndex":1},
     {"id":"q7","question":"Hvor mange uker etter sykmelding skal oppfølgings­plan være på plass?","options":["1","4","7","12"],"correctIndex":1},
     {"id":"q8","question":"§ 2A-4 forbyr arbeidsgiver å …","options":["drøfte med tillitsvalgt","gjengjelde mot varsler","informere ledelsen","arkivere varsel"],"correctIndex":1},
     {"id":"q9","question":"Hva betyr «paritetisk» i AMU?","options":["Ledelsen har flertall","Lik representasjon arbeidsgiver/arbeidstaker","Verneombud er leder","Bare ansatte er medlemmer"],"correctIndex":1},
     {"id":"q10","question":"Hvor ofte skal IK-systemet revideres?","options":["Hvert år","Hver 2. år","Jevnlig — ved endringer eller minst årlig","Ved tilsyn"],"correctIndex":2}
   ]}}
]
$jsonb$::jsonb,
title = 'HMS-opplæring for arbeidsgiver — § 3-5',
description = 'Lovpålagt HMS-opplæring for daglig leder / arbeidsgiver. Dekker grunnpensum etter Arbeidstilsynets krav. E-modul må kombineres med praktisk arbeid og fysisk samling for å oppfylle praksis­normen på 40 timer.'
where system_course_id = 'c-40-timers-hms' and locale = 'nb';

-- ── 2. c-verneombud-40t (REPLACE) ────────────────────────────────────────

update public.learning_system_course_locales
set modules = $jsonb$
[
  {"id":"m1","title":"Verneombudets rolle og rettigheter","order":1,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 6-1","AML § 6-2","AML § 6-5"],
   "content":{"kind":"text","body":"<p>Verneombudet representerer arbeidstakerne i arbeidsmiljø­saker. Du skal tas med på råd ved planlegging og gjennomføring av tiltak som har betydning for arbeidsmiljøet.</p><p>Dine rettigheter:</p><ul><li>Tid til vervet — lønnet, så mye som vervet krever</li><li>Tilgang til alle dokumenter som gjelder arbeidsmiljøet</li><li>Kontakt med BHT, AMU og Arbeidstilsynet uten å gå via leder</li><li>Vern mot ulempe på grunn av vervet (§ 6-5 (3))</li></ul>"}},

  {"id":"m2","title":"Stansingsretten — § 6-3","order":2,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 6-3"],
   "content":{"kind":"text","body":"<p>Ved umiddelbar fare for liv eller helse kan verneombudet stanse arbeidet inntil Arbeids­tilsynet har vurdert.</p><p>Tre kriterier:</p><ul><li><strong>Umiddelbar</strong> — faren materialiserer seg hvis arbeidet fortsetter</li><li><strong>Fare</strong> — konkret risiko, ikke teoretisk</li><li><strong>Liv eller helse</strong> — fysisk skade­risiko, ikke kun ubehag</li></ul><p>Tre handlinger ved stans: 1) si det høyt og marker området, 2) varsle arbeidsgiver skriftlig samme dag, 3) varsle Arbeids­tilsynet (73 19 97 00) skriftlig samme dag.</p><p>Arbeidsgiver kan ikke overprøve stansen før Tilsynet har vurdert. Du som verneombud er beskyttet av § 6-5 (3) når du handler i god tro.</p>"}},

  {"id":"m3","title":"Risikovurdering og kartlegging","order":3,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 3-1","AML § 4-1","IK-f § 5 nr. 6"],
   "content":{"kind":"text","body":"<p>Verneombudet deltar aktivt i kartlegging av farer, risikovurdering og handlings­planer. Vernerunder gjennomføres jevnlig — minst årlig, oftere ved høyere risiko.</p><p>Som verneombud kan du:</p><ul><li>Be om bistand fra BHT</li><li>Be om bistand fra Arbeidstilsynet</li><li>Kreve at funn dokumenteres og lukkes innen frist</li><li>Eskalere uløste saker til AMU</li></ul>"}},

  {"id":"m4","title":"Avvik og varsling","order":4,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 2A-1","AML § 2A-2","AML § 2A-4","AML § 6-2","IK-f § 5 nr. 4"],
   "content":{"kind":"text","body":"<p>Du er ofte mottaker for både HMS-avvik og varsler etter kap. 2A.</p><p><strong>Avvik</strong> = brudd på regel/rutine. Meldes via avviks­system, rettes opp.</p><p><strong>Varsel</strong> = kritikkverdige forhold (mobbing, korrupsjon, fare for liv/helse, brudd på lov). Meldes via varslings­kanal. § 2A-4 forbyr gjengjeldelse.</p><p>Som verneombud har du taushets­plikt om varslers identitet — informert samtykke kreves før videreformidling.</p>"}},

  {"id":"m5","title":"Psykososialt arbeidsmiljø — § 4-3","order":5,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 4-3"],
   "content":{"kind":"text","body":"<p>§ 4-3 omhandler psykososialt arbeids­miljø: integritet, verdighet, kommunikasjon og vern mot trakassering.</p><p>Risiko­faktorer du må kjenne igjen:</p><ul><li>Uklare roller eller forventninger</li><li>Vedvarende høy arbeidsbelastning</li><li>Manglende kontroll over eget arbeid</li><li>Konfliktledelse eller mobbing</li><li>Seksuell trakassering</li><li>Vold og trusler (§ 4-3 (3))</li></ul><p>Anbefalt kartlegging: anonym survey hvert annet år, puls­målinger mellom. Terskel for resultat­visning: minst 5 svar per gruppe.</p>"}},

  {"id":"m6","title":"BHT-samspillet","order":6,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 3-3","Forskrift om BHT 2011-12-06"],
   "content":{"kind":"text","body":"<p>Bedriftshelse­tjenesten er din viktigste fagpartner. § 3-3 krever at virksomheter i visse bransjer skal være tilknyttet godkjent BHT. BHT skal ha fri og uavhengig stilling.</p><p>Du kan kontakte BHT direkte — uten å gå via arbeidsgiver — i:</p><ul><li>Risiko­vurderinger (kjemikalier, støy, ergonomi, psykososialt)</li><li>Vernerunder</li><li>Sykefraværs­oppfølging</li><li>AMU-saker med medisinsk dimensjon</li><li>Tilsyns­besøk fra Arbeidstilsynet</li></ul><p>BHT skal årlig levere periode­plan og rapportere til AMU. Som verneombud skal du få planen og kunne kommentere før vedtak.</p>"}},

  {"id":"m7","title":"Flashcards — stansingsrett-case","order":7,"kind":"flashcard","durationMinutes":8,
   "lawRefs":["AML § 6-3","AML § 6-5"],
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Stillas mangler rekkverk i 4 m. Snekkerne jobber der nå.","back":"Stans umiddelbart (§ 6-3). Akutt fall­fare. Varsle leder + Tilsynet skriftlig samme dag."},
     {"id":"c2","front":"Ventilasjon i lakkbu på 60 % av nominell ytelse.","back":"Vurder eksponerings­måling først. Over grenseverdi → stans. Ukjent → krev BHT-måling før stans."},
     {"id":"c3","front":"Kollega forteller om mobbing fra leder.","back":"Ikke § 6-3 (gjelder umiddelbar fysisk fare). Følg varslings­rutine § 2A."},
     {"id":"c4","front":"Ny truckfører kjører uten sertifikat.","back":"Stans inntil sertifikat fremvises. § 6-3 + forskrift om utførelse av arbeid kap. 10."},
     {"id":"c5","front":"Arbeidsgiver overprøver stans-vedtaket.","back":"Stansen gjelder inntil Tilsynet vurderer. Varsle Tilsynet umiddelbart — overtredelse."},
     {"id":"c6","front":"Kjemikalielekkasje, uklart om grenseverdi overskredet.","back":"Føre-var: stans + evakuer inntil måling. Dokumenter beslutningen."},
     {"id":"c7","front":"Leder: «Stans koster 200 000 kr i produksjonstap».","back":"Økonomi ikke gyldig argument mot § 6-3. Loggfør forsøk på påvirkning."},
     {"id":"c8","front":"Du er nyvalgt og usikker.","back":"Konsulter hovedverneombud, BHT, eller Tilsynet. Tvil → konservativ tolkning."},
     {"id":"c9","front":"Ansatte frykter at stans gir straff.","back":"Verneombud beskyttet (§ 6-5 (3)). Følg opp ansatte­frykt som egen sak."},
     {"id":"c10","front":"Hvor lenge gjelder stansen?","back":"Inntil Arbeids­tilsynet har vurdert. Skriftlig varsel samme dag."}
   ]}},

  {"id":"m8","title":"OJT — Din første vernerunde","order":8,"kind":"on_job","durationMinutes":60,
   "lawRefs":["AML § 6-2","AML § 3-1","IK-f § 5 nr. 6"],
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Avtal vernerunde med leder og BHT-kontakt","description":"Bevis: møteinnkalling. Signatur: selv."},
     {"id":"t2","title":"Forbered sjekkliste — generisk + bransjespesifikk","description":"Bevis: ferdig sjekkliste. Signatur: selv."},
     {"id":"t3","title":"Gjennomfør runden — minst 60 min, observer + intervju","description":"Bevis: notater + bilder. Signatur: leder."},
     {"id":"t4","title":"Skriv funn-rapport, kategoriser rød/gul/grønn","description":"Bevis: PDF. Signatur: leder."},
     {"id":"t5","title":"Legg funn som avvik i NewAMU","description":"Bevis: avviks-id. Signatur: verneombud-team."},
     {"id":"t6","title":"Følg opp lukking innen frist","description":"Bevis: lukkings­bekreftelse. Signatur: selv."}
   ]}},

  {"id":"m9","title":"Sjekkliste — Verneombudets førstuke","order":9,"kind":"checklist","durationMinutes":10,
   "lawRefs":["AML § 6-2","AML § 6-5","FOLM § 3-18"],
   "content":{"kind":"checklist","items":[
     {"id":"i1","label":"Signert tausheterklæring mottatt fra HMS-leder"},
     {"id":"i2","label":"Kontakt­info til hovedverneombud, BHT, AMU-leder"},
     {"id":"i3","label":"Tilgang til NewAMU verneombud-rolle"},
     {"id":"i4","label":"Tilgang til risiko­vurderinger og IK-system"},
     {"id":"i5","label":"Første møte med leder — forventnings­avklaring (lønnet tid)"},
     {"id":"i6","label":"Oversikt over åpne avvik og pålegg"},
     {"id":"i7","label":"Kalender­tilgang AMU-møter neste 12 mnd"},
     {"id":"i8","label":"Møt BHT-kontakten"},
     {"id":"i9","label":"Gjennomgå § 6-3-stansingsrett-prosedyre med leder"},
     {"id":"i10","label":"Sett opp egen verneombud-perm (digital/fysisk)"}
   ]}},

  {"id":"m10","title":"Video-transkript — Stansingsretten (7 min)","order":10,"kind":"text","durationMinutes":7,
   "lawRefs":["AML § 6-3","AML § 6-5"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript. Erstattes med video når opptak foreligger.</em></p><p><strong>[00:00–00:30] Innledning.</strong> Stansingsretten er det mektigste verktøyet du har som verneombud. § 6-3 gir myndighet til å stanse arbeid som truer liv eller helse — direkte, uten godkjenning fra arbeidsgiver.</p><p><strong>[00:30–01:30] Kriteriene.</strong> «Umiddelbar fare for arbeidstakernes liv eller helse». Umiddelbar betyr aktuell — stillas uten rekkverk er umiddelbar fare selv om ingen har falt ennå. Fare betyr konkret, ikke teoretisk.</p><p><strong>[01:30–02:30] Forarbeidet.</strong> Før stans: er det noe enklere? Kan arbeidet pauses mens du sjekker? Hvis arbeidsgiver ikke kan løse det umiddelbart — så stanser du.</p><p><strong>[02:30–03:30] Slik stanser du.</strong> Si det høyt: «jeg stanser etter § 6-3». Marker området. Varsle arbeidsgiver skriftlig (SMS, e-post, brev). Varsle Tilsynet — 73 19 97 00 — skriftlig samme dag.</p><p><strong>[03:30–04:30] Hva skjer etterpå.</strong> Stansen står inntil Tilsynet har vurdert. Arbeidsgiver kan ikke sette folk i arbeid på tvers av stansen.</p><p><strong>[04:30–05:30] Fallgruver.</strong> Vente for lenge. La økonomi-argumenter overprøve. Ikke dokumentere.</p><p><strong>[05:30–06:30] Konsultasjon.</strong> Konsulter hovedverneombud, BHT eller Tilsynets svartelefon hvis du har tid. Tvil → konservativ tolkning, ofte stans.</p><p><strong>[06:30–07:00] Avslutning.</strong> Stansingsretten er et alvor. Bruk den med forstand, dokumenter beslutningen.</p>"}},

  {"id":"m11","title":"Sluttquiz","order":11,"kind":"quiz","durationMinutes":10,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Verneombud kan stanse arbeid etter § 6-3 …","options":["bare med ledelsens samtykke","uten godkjenning ved umiddelbar fare","kun med Tilsynets ja","kun for fysisk fare"],"correctIndex":1},
     {"id":"q2","question":"Stansen gjelder inntil …","options":["leder opphever","Arbeids­tilsynet har vurdert","24 timer","verneombud selv opphever"],"correctIndex":1},
     {"id":"q3","question":"§ 6-5 tredje ledd beskytter verneombudet mot …","options":["personalsak","ulempe på grunn av vervet","oppsigelse spesifikt","dokumentasjons­krav"],"correctIndex":1},
     {"id":"q4","question":"BHT skal være …","options":["ansatt hos arbeidsgiver","i fri og uavhengig stilling","godkjent av AMU","sertifisert av Tilsynet"],"correctIndex":1},
     {"id":"q5","question":"Hovedverneombud pliktig fra …","options":["10","30","50","100"],"correctIndex":1},
     {"id":"q6","question":"Verneombudets opplærings­krav (praksisnorm)","options":["16 t","24 t","40 t","80 t"],"correctIndex":2},
     {"id":"q7","question":"Psykososial konflikt med leder — riktig kanal?","options":["§ 6-3 stans","§ 2A varsling","direkte til Tilsynet","advokat"],"correctIndex":1},
     {"id":"q8","question":"Verneombudet kan kontakte BHT …","options":["bare via leder","direkte uten leders samtykke","via AMU-leder","via tillitsvalgt"],"correctIndex":1},
     {"id":"q9","question":"Vernerunde anbefales gjennomført …","options":["ved tilsyn","jevnlig, minst årlig","kun ved ulykke","av BHT alene"],"correctIndex":1},
     {"id":"q10","question":"Hvilken § lister verneombudets oppgaver?","options":["§ 6-1","§ 6-2","§ 6-3","§ 6-5"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb,
title = 'Verneombudets opplæring — § 6-5',
description = 'Forskriftsfestet opplæring for verneombud, jf. AML § 6-5 og FOLM § 3-18. Praksis­normen er 40 timer; e-modulen dekker teori­pensum og må kombineres med fysisk samling for full uttelling.'
where system_course_id = 'c-verneombud-40t' and locale = 'nb';

-- ── 3. c-amu-grunnopplaering (REPLACE) ───────────────────────────────────

update public.learning_system_course_locales
set modules = $jsonb$
[
  {"id":"m1","title":"AMUs sammensetning og rolle","order":1,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 7-1","AML § 7-2"],
   "content":{"kind":"text","body":"<p>AMU er <strong>paritetisk</strong>: like mange representanter fra arbeidsgiver- og arbeidstakersiden. Leder veksler annet hvert år. Sekretær er ofte HMS-leder, men trenger ikke være stemme­berettiget.</p><p>AMU er rådgivende i de fleste saker, men har <strong>vedtaks­myndighet</strong> i fem konkrete tilfeller listet i § 7-2 (4).</p>"}},

  {"id":"m2","title":"AMUs oppgaver — § 7-2","order":2,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 7-2"],
   "content":{"kind":"text","body":"<p>Hovedoppgavene i § 7-2 (1)–(2):</p><ol type=\"a\"><li>Spørsmål som angår BHT</li><li>Spørsmål om opplæring og instruksjon</li><li>Oppfølging av sykefravær</li><li>Oppfølging av yrkesskader og yrkessykdommer</li><li>Bygningsmessige planer</li><li>Planer som angår produksjons­metoder</li><li>Andre planer med vesentlig betydning for arbeids­miljøet — inkludert spørreundersøkelser om psyko­sosialt arbeidsmiljø</li></ol><p>Vedtaks­retten (§ 7-2 (4)): pålegge tiltak, kreve undersøkelser, kreve verne­vakt, kreve at arbeidet stanses, kreve egen arbeids­miljø­undersøkelse.</p>"}},

  {"id":"m3","title":"Saksflyt og habilitet","order":3,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 7-2","AML § 7-3"],
   "content":{"kind":"text","body":"<p>Faser: <strong>innmelding</strong> (hvem som helst) → <strong>saksforberedelse</strong> (sekretær lager bakgrunns­notat, vurderer habilitet) → <strong>utsending</strong> (minst 5 virke­dager før møtet) → <strong>drøfting/vedtak</strong> (paritetisk) → <strong>oppfølging</strong>.</p><p><strong>Habilitet</strong> (§ 7-3): medlem med personlig interesse melder fra og fratrer fra avstemming.</p><p>Protokoll signeres av leder og sekretær, sendes medlemmer innen 10 virkedager, tilgjengelig for arbeidstakere på forespørsel.</p>"}},

  {"id":"m4","title":"Årsrapport og åpenhet","order":4,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 7-4","IK-f § 5 nr. 8"],
   "content":{"kind":"text","body":"<p>AMU lager årlig rapport om arbeidsmiljøet. Skal være tilgjengelig for ansatte og fremvisbar for Tilsynet — som ber om årsrapport i 7 av 10 systemtilsyn.</p><p>Innhold: HMS-status (avvik, sykefravær, ulykker), behandlede saker, vurdering av måloppnåelse, tiltak neste år.</p>"}},

  {"id":"m5","title":"Flashcards — AMU-paragrafer","order":5,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"§ 7-1","back":"AMU pliktig fra 30 ansatte; ≥10 hvis parter krever"},
     {"id":"c2","front":"§ 7-2 (1)–(2)","back":"AMUs oppgaver: BHT, opplæring, sykefravær, yrkesskade, bygnings­messige planer, produksjon, andre planer"},
     {"id":"c3","front":"§ 7-2 (4)","back":"Vedtaks­myndighet: tiltak, undersøkelser, verne­vakt, arbeidsstans, egen undersøkelse"},
     {"id":"c4","front":"§ 7-3","back":"Habilitet — medlem med personlig interesse fratrer"},
     {"id":"c5","front":"§ 7-4","back":"Årsrapport tilgjengelig for ansatte og Tilsynet"},
     {"id":"c6","front":"§ 14-12","back":"Innleide teller med i AMU-grunnlaget"},
     {"id":"c7","front":"Paritet","back":"Lik representasjon arbeidsgiver/arbeidstaker; leder veksler årlig"},
     {"id":"c8","front":"Møtefrekvens","back":"Anbefalt minst 4/år; protokoll signert + sendt innen 10 dager"}
   ]}},

  {"id":"m6","title":"OJT — AMUs årsrapport","order":6,"kind":"on_job","durationMinutes":45,
   "lawRefs":["AML § 7-2 g","AML § 7-4","IK-f § 5 nr. 8"],
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Trekk ut HMS-status fra NewAMU dashboard","description":"Avvik, sykefravær, ulykker. Bevis: eksport. Signatur: selv."},
     {"id":"t2","title":"List alle saker behandlet i AMU siste 12 mnd","description":"Bevis: liste. Signatur: selv."},
     {"id":"t3","title":"Fyll mal tpl-amu-arsrapport","description":"Bevis: utfylt PDF. Signatur: AMU-leder."},
     {"id":"t4","title":"Drøft utkast med minst 1 AMU-medlem","description":"Bevis: notat. Signatur: AMU-medlem."},
     {"id":"t5","title":"Signer og publiser","description":"Bevis: signert PDF. Signatur: AMU-leder."}
   ]}},

  {"id":"m7","title":"Video-transkript — Hva AMU faktisk skal gjøre (6 min)","order":7,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 7-1","AML § 7-2","AML § 7-3","AML § 7-4"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript. Erstattes med video når opptak foreligger.</em></p><p><strong>[00:00–00:30]</strong> AMU er kanskje det mest misforståtte organet i norsk arbeidsliv. Sannheten ligger mellom HMS-styremøte og rådfri komité — beskrevet i § 7-2.</p><p><strong>[00:30–01:30] Paritet.</strong> Lik representasjon arbeidsgiver/arbeidstaker. Ledelsen kan ikke ha flertall. Leder veksler årlig.</p><p><strong>[01:30–02:30] Oppgavene.</strong> Syv hovedområder — BHT, opplæring, sykefravær, yrkesskade, bygnings­messige planer, produksjon, andre planer inkludert spørreundersøkelser.</p><p><strong>[02:30–03:30] Vedtaksrett.</strong> Fem konkrete tilfeller i § 7-2 (4). Bruker dere retten — protokoll med oppfølgings­frist.</p><p><strong>[03:30–04:30] Terskler.</strong> Pliktig fra 30 ansatte. Fra 10–29 ansatte hvis en part krever. Innleide teller med (§ 14-12).</p><p><strong>[04:30–05:30] AMU og tilsyn.</strong> Tilsynet ber rutinemessig om protokoller og årsrapport. Mindre enn 4 møter/år er indikasjon på svakt HMS-system.</p><p><strong>[05:30–06:00] Avslutning.</strong> AMU har makt hvis dere bruker den. Skriv gode protokoller. Lever årsrapport i tide.</p>"}},

  {"id":"m8","title":"Sluttquiz","order":8,"kind":"quiz","durationMinutes":6,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"AMU pliktig fra hvor mange ansatte?","options":["10","30","50","100"],"correctIndex":1},
     {"id":"q2","question":"§ 7-2 (4) gir vedtaks­myndighet i hvor mange tilfeller?","options":["3","5","7","10"],"correctIndex":1},
     {"id":"q3","question":"Habilitet — hvilken §?","options":["§ 7-1","§ 7-2","§ 7-3","§ 7-4"],"correctIndex":2},
     {"id":"q4","question":"Protokoll skal sendes medlemmene innen …","options":["5 dager","10 virkedager","30 dager","3 mnd"],"correctIndex":1},
     {"id":"q5","question":"Anbefalt møtefrekvens for AMU?","options":["1/år","2/år","4/år","12/år"],"correctIndex":2},
     {"id":"q6","question":"Hva inngår ikke i § 7-2 oppgavene?","options":["BHT-spørsmål","Oppsigelses­saker","Bygnings­messige planer","Sykefravær"],"correctIndex":1},
     {"id":"q7","question":"AMU kan kreve egen arbeids­miljø­undersøkelse — hjemmel?","options":["§ 4-3","§ 7-2 (4)","§ 7-3","§ 6-5"],"correctIndex":1},
     {"id":"q8","question":"Innleide teller med i AMU-grunnlaget?","options":["Aldri","Bare ved >12 mnd","Ja, § 14-12","Bare hvis enige"],"correctIndex":2}
   ]}}
]
$jsonb$::jsonb
where system_course_id = 'c-amu-grunnopplaering' and locale = 'nb';

-- ── 4. c-aml-arbeidstaker (REPLACE — kontor-basis) ───────────────────────

update public.learning_system_course_locales
set title = 'HMS for alle ansatte — kontor (§ 3-2)',
description = 'Generell HMS-grunnopplæring for kontoransatte etter AML § 3-2. For industri/helse/bygg finnes egne bransje­varianter.',
modules = $jsonb$
[
  {"id":"m1","title":"Dine HMS-rettigheter","order":1,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 4-1","AML § 4-3","AML § 2A-1"],
   "content":{"kind":"text","body":"<p>Som arbeidstaker har du rett til:</p><ul><li>Fullt forsvarlig arbeids­miljø (§ 4-1)</li><li>Informasjon og opplæring (§ 3-2)</li><li>Medvirkning gjennom verneombud og AMU (§ 4-2)</li><li>Vern mot mobbing og trakassering (§ 4-3, § 13-1)</li><li>Varsling om kritikkverdige forhold uten gjengjeldelse (kap. 2A)</li><li>Å nekte arbeid du mener er farlig</li></ul>"}},

  {"id":"m2","title":"Dine HMS-plikter","order":2,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 2-3","AML § 5-3"],
   "content":{"kind":"text","body":"<p>Plikten gjelder så langt det er mulig av deg:</p><ul><li>Bruke verneutstyr riktig</li><li>Melde avvik (regelbrudd)</li><li>Varsle om feil eller mangler</li><li>Gjennomføre opplæring</li><li>Medvirke til godt arbeidsmiljø</li></ul>"}},

  {"id":"m3","title":"Risikoer på arbeidsplassen","order":3,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 4-1","AML § 4-3","AML § 4-5"],
   "content":{"kind":"text","body":"<p>Kontorrisikoer:</p><ul><li><strong>Ergonomi</strong> — skjerm­arbeidsstilling, mus­arm, lange perioder uten variasjon</li><li><strong>Psykososialt</strong> — høy belastning, uklare roller, mobbing</li><li><strong>Brann og beredskap</strong> — rømnings­vei, slukke­utstyr, brann­varsling</li><li><strong>Sikkerhet</strong> — sensitive data, sosial ingeniørkunst, phishing</li></ul><p>Du skal vite hvilke risikoer som finnes i ditt arbeid og hvilke tiltak som er innført.</p>"}},

  {"id":"m4","title":"Slik melder du avvik og varsel","order":4,"kind":"text","durationMinutes":6,
   "lawRefs":["IK-f § 5 nr. 4","AML § 2A-1","AML § 2A-2"],
   "content":{"kind":"text","body":"<p><strong>Avvik</strong> = brudd på regel. Meldes via NewAMU avviks­modul.</p><p><strong>Varsel</strong> = kritikkverdige forhold (mobbing, korrupsjon, fare for liv/helse, brudd på lov). Meldes via varslings­kanal — intern (leder, verneombud, varslings­mottak) eller ekstern (Arbeids­tilsynet, Datatilsynet). Anonym kanal finnes også.</p><p>Forskjellen er viktig: varsling gir sterkere lovbeskyttelse. § 2A-4 forbyr enhver form for gjengjeldelse mot varsler.</p>"}},

  {"id":"m5","title":"Flashcards — 12 paragrafer for ansatte","order":5,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"§ 4-1","back":"Rett til fullt forsvarlig arbeids­miljø"},
     {"id":"c2","front":"§ 4-2","back":"Rett til medvirkning — verneombud, AMU, vernerunder"},
     {"id":"c3","front":"§ 4-3","back":"Vern mot mobbing og trakassering"},
     {"id":"c4","front":"§ 3-2","back":"Du har rett til opplæring og instruksjon"},
     {"id":"c5","front":"§ 2-3","back":"Du har plikt til å medvirke til godt arbeidsmiljø"},
     {"id":"c6","front":"§ 5-3","back":"Du har plikt til å melde avvik"},
     {"id":"c7","front":"Kap. 2A","back":"Varslings­rett — beskyttelse mot gjengjeldelse"},
     {"id":"c8","front":"§ 2A-4","back":"Forbud mot gjengjeldelse mot varsler"},
     {"id":"c9","front":"Avvik vs varsel","back":"Avvik = regelbrudd. Varsel = kritikkverdige forhold."},
     {"id":"c10","front":"Anonym varsling","back":"Mulig — intern eller ekstern kanal"},
     {"id":"c11","front":"§ 6-2","back":"Verneombud — din representant"},
     {"id":"c12","front":"Tausheterklæring","back":"Gjelder person­opplysninger; varsling er unntak"}
   ]}},

  {"id":"m6","title":"Video-transkript — Hva HMS betyr for deg (4 min)","order":6,"kind":"text","durationMinutes":4,
   "lawRefs":["AML § 3-2","AML § 4-1","AML § 4-2","AML § 4-3","AML kap. 2A"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript. Erstattes med video når opptak foreligger.</em></p><p><strong>[00:00–00:20]</strong> Du har ikke valgt å bli HMS-ekspert. Du har valgt en jobb. Men loven krever at du kjenner noen grunnregler — fordi de beskytter deg.</p><p><strong>[00:20–01:00] Rettighetene.</strong> Rett til fullt forsvarlig arbeidsmiljø (§ 4-1). Rett til opplæring (§ 3-2). Rett til medvirkning (§ 4-2). Hvis du oppdager kritikkverdige forhold — varslingsrett uten gjengjeldelse (kap. 2A).</p><p><strong>[01:00–02:00] Pliktene.</strong> Bruke verneutstyr. Melde avvik. Gjennomføre opplæring. To kanaler: avvik for regelbrudd, varsel for kritikkverdige forhold som mobbing, korrupsjon, fare.</p><p><strong>[02:00–03:00] Psyko­sosialt.</strong> § 4-3 — din integritet skal ivaretas. Hvis du opplever mobbing eller trakassering: snakk med verneombud, leder eller tillitsvalgt. Bruk varslings­kanalen, ikke avviks­kanalen — sterkere lovbeskyttelse.</p><p><strong>[03:00–04:00] Avslutning.</strong> Tre ting å huske: rettighet, medvirkning, og forskjell på avvik og varsel.</p>"}},

  {"id":"m7","title":"Sjekkliste — Mitt arbeidsmiljø","order":7,"kind":"checklist","durationMinutes":5,
   "content":{"kind":"checklist","items":[
     {"id":"i1","label":"Jeg vet hvem mitt verneombud er"},
     {"id":"i2","label":"Jeg vet hvor avvik meldes"},
     {"id":"i3","label":"Jeg vet hvor varsler meldes"},
     {"id":"i4","label":"Jeg kjenner branninstruksen"},
     {"id":"i5","label":"Min arbeidsplass er ergonomisk forsvarlig"},
     {"id":"i6","label":"Jeg vet hvem som er BHT-kontakt"},
     {"id":"i7","label":"Jeg har deltatt på relevant opplæring"},
     {"id":"i8","label":"Jeg vet hvordan jeg melder mobbing/trakassering"},
     {"id":"i9","label":"Min leder kjenner min arbeidsbelastning"},
     {"id":"i10","label":"Jeg vet hva jeg gjør hvis jeg ser noe galt"}
   ]}},

  {"id":"m8","title":"Sluttquiz","order":8,"kind":"quiz","durationMinutes":5,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Forskjell avvik vs varsel?","options":["Ingen","Avvik = regelbrudd, varsel = kritikkverdige forhold","Avvik krever advokat","Varsel meldes alltid eksternt"],"correctIndex":1},
     {"id":"q2","question":"§ 2A-4 forbyr arbeidsgiver å …","options":["drøfte varsel","gjengjelde mot varsler","informere ledelse","arkivere varsel"],"correctIndex":1},
     {"id":"q3","question":"Hvilken § gir deg medvirknings­rett?","options":["§ 2-3","§ 4-2","§ 6-2","§ 7-2"],"correctIndex":1},
     {"id":"q4","question":"Hvilken § beskytter mot mobbing?","options":["§ 4-1","§ 4-3","§ 13-1","Alle de over"],"correctIndex":3},
     {"id":"q5","question":"Kan du varsle anonymt?","options":["Nei","Bare hvis tillitsvalgt godkjenner","Ja, anonym kanal finnes","Bare eksternt"],"correctIndex":2},
     {"id":"q6","question":"Verneombud — hvem er det?","options":["Sjefen","En tilfeldig kollega","Ansattes valgte representant","HR-direktøren"],"correctIndex":2},
     {"id":"q7","question":"Har du plikt til opplæring?","options":["Nei","Ja, § 2-3 medvirknings­plikt inkluderer opplæring","Bare ved skift","Bare hvis sjefen krever"],"correctIndex":1},
     {"id":"q8","question":"Du opplever trakassering. Hvor melder du?","options":["Avviks­kanal","Varslings­kanal — sterkere beskyttelse","Privat brev til styret","Bare til kollega"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
where system_course_id = 'c-aml-arbeidstaker' and locale = 'nb';

-- ── 5. c-aml-arbeidstaker-industri (INSERT) ──────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-arbeidstaker-industri', 'aml-arbeidstaker-industri', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-arbeidstaker-industri', 'nb',
  'HMS for alle ansatte — industri (§ 3-2)',
  'Bransje­tilpasset HMS for ansatte i industri, lager og produksjon. Dekker forskrift om utførelse av arbeid, kjemikalie­håndtering, maskinsikkerhet, ergonomi og sertifisert opplæring. Forutsetter at basis-kurset (aml-arbeidstaker) er bestått.',
  $jsonb$
[
  {"id":"m1","title":"Bransjeramme — industri","order":1,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-4","AML § 4-5","Forskrift om utførelse av arbeid"],
   "content":{"kind":"text","body":"<p>I industri kommer flere forskrifter i tillegg til AML:</p><ul><li>Forskrift om utførelse av arbeid (kjemikalier, asbest, støy, vibrasjon, ergonomi)</li><li>Forskrift om maskiner (CE-merking, brukermanual)</li><li>Forskrift om utstyrs­bruk (sertifisert opplæring for truck, kran, dumper)</li></ul>"}},

  {"id":"m2","title":"Maskinsikkerhet og CE-merking","order":2,"kind":"text","durationMinutes":8,
   "lawRefs":["Forskrift om maskiner","AML § 4-5"],
   "content":{"kind":"text","body":"<p>Maskiner i bruk i Norge etter 1995 skal være CE-merket med norsk bruker­manual.</p><p>Du skal kjenne:</p><ul><li>Vernedeksel — aldri overstyr</li><li>Nødstopp — vit hvor den er</li><li>Isolerings­punkt — strøm/trykkluft</li><li>Maskinkort på maskinen, signert ved opplæring</li></ul><p>Aldri grip inn i kjørende maskin, ikke for å fjerne små biter.</p>"}},

  {"id":"m3","title":"Kjemikalier — faresedler og SDS","order":3,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 4-5","Forskrift om utførelse av arbeid kap. 3"],
   "content":{"kind":"text","body":"<p>CLP/GHS bruker ni piktogrammer:</p><ol><li>Eksplosivt</li><li>Brannfarlig</li><li>Oksiderende</li><li>Gass under trykk</li><li>Etsende</li><li>Akutt giftig</li><li>Helsefare</li><li>Miljøfare</li><li>Kronisk helse­fare</li></ol><p>Sikkerhetsdatablad (SDS) skal være tilgjengelig på arbeidsplassen for hvert kjemikalie du bruker.</p><p><strong>Substitusjons­plikt</strong> (§ 4-5 (1)) — farlig stoff skal erstattes med mindre farlig hvis mulig.</p>"}},

  {"id":"m4","title":"Ergonomi og tunge løft","order":4,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 4-4","Forskrift om utførelse av arbeid kap. 23"],
   "content":{"kind":"text","body":"<p>Tommelfingerregel: enkelt­løft over 25 kg krever hjelpemiddel; gjentatte løft over 15 kg krever vurdering.</p><p>Teknikk: bøy i knærne, hold lasten nær kroppen, unngå vridning. Variér arbeids­stilling.</p><p>Smerter som varer over uka — meld BHT.</p>"}},

  {"id":"m5","title":"Truck, kran, sertifisert opplæring","order":5,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 3-2","Forskrift om utførelse av arbeid kap. 10"],
   "content":{"kind":"text","body":"<p>Forskrift om utførelse av arbeid kap. 10 krever sertifisert opplæring for arbeids­utstyr som krever særlig forsiktighet: truck T1–T4, kran G1–G20, dumper, gravemaskin, lift.</p><p>Sertifikat skal være på arbeidsstedet. Aldri betjen utstyr du ikke har gyldig sertifikat for, selv ikke i nødssituasjon.</p>"}},

  {"id":"m6","title":"Flashcards — 9 GHS-piktogrammer","order":6,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Bombe som eksploderer","back":"GHS01 Eksplosivt — eksplosjons­fare ved varme/støt"},
     {"id":"c2","front":"Flamme","back":"GHS02 Brannfarlig — antennelig væske/gass/aerosol"},
     {"id":"c3","front":"Flamme over sirkel","back":"GHS03 Oksiderende — forsterker brann i andre stoffer"},
     {"id":"c4","front":"Sylinder","back":"GHS04 Gass under trykk — eksplosjons­fare ved oppvarming"},
     {"id":"c5","front":"Hånd/metall som etses","back":"GHS05 Etsende — alvorlig skade på hud/øyne/metall"},
     {"id":"c6","front":"Dødninghode","back":"GHS06 Akutt giftig — kan være dødelig"},
     {"id":"c7","front":"Utropstegn","back":"GHS07 Helsefare — irritasjon, sensibilisering"},
     {"id":"c8","front":"Død fisk og tre","back":"GHS09 Miljøfare — giftig for vannmiljø"},
     {"id":"c9","front":"Person med stjerne","back":"GHS08 Kronisk helsefare — kreft, allergi, reproduksjons­skade"}
   ]}},

  {"id":"m7","title":"OJT — Min arbeidsstasjon risikosjekk","order":7,"kind":"on_job","durationMinutes":30,
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Identifiser tre fysiske risikoer ved arbeidsstasjonen","description":"Bevis: liste. Signatur: selv."},
     {"id":"t2","title":"Sjekk at SDS for kjemikalier du bruker er på plass","description":"Bevis: bilder/lenke. Signatur: selv."},
     {"id":"t3","title":"Verifiser at verneutstyr er tilgjengelig og i orden","description":"Bevis: bilde. Signatur: selv."},
     {"id":"t4","title":"Drøft funnene med nærmeste leder","description":"Bevis: notat. Signatur: leder."}
   ]}},

  {"id":"m8","title":"Video-transkript — Sikkert arbeid i industri (5 min)","order":8,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-4","AML § 4-5"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Industri har de høyeste skadetallene i norsk arbeidsliv. Vanligste ulykker: klem, fall, kjemikalie­eksponering, tunge løft.</p><p><strong>[00:30–01:30] Klem og fall.</strong> Bruk vernedeksel, aldri overstyr nødstopp. Aldri grip inn i kjørende maskin. Fall fra høyde: sertifisert sele og forankring fra 2 meter.</p><p><strong>[01:30–02:30] Kjemi.</strong> Les SDS før første gangs bruk. Hansker for hud, åndedretts­vern hvis dampende, øye­vern alltid. Aldri bland ukjente kjemikalier.</p><p><strong>[02:30–03:30] Ergonomi.</strong> Variér stilling. Bruk hjelpemidler. Mikropauser hver 30 min ved repetisjon.</p><p><strong>[03:30–04:30] Støy og vibrasjon.</strong> Hørselsvern fra 85 dB. Hand-arm-vibrasjon: meld første gang du føler nummenhet.</p><p><strong>[04:30–05:00] Avslutning.</strong> Kjenn risikoene, bruk utstyret, meld feil.</p>"}},

  {"id":"m9","title":"Sluttquiz","order":9,"kind":"quiz","durationMinutes":8,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"GHS-piktogram med dødninghode betyr …","options":["Eksplosivt","Helsefare","Akutt giftig","Miljøfare"],"correctIndex":2},
     {"id":"q2","question":"Hva er substitusjons­plikten?","options":["Erstatt arbeidstaker","Erstatt farlig stoff med mindre farlig hvis mulig","Erstatt maskin årlig","Erstatt verneutstyr månedlig"],"correctIndex":1},
     {"id":"q3","question":"Tunge løft — fra hvilken vekt bør hjelpe­middel brukes?","options":["10 kg","15 kg gjentakelse / 25 kg enkeltløft","40 kg","50 kg"],"correctIndex":1},
     {"id":"q4","question":"Truck T1–T4 krever …","options":["Internopplæring","Sertifisert opplæring etter forskrift kap. 10","Førerkort klasse B","Ingen formelle krav"],"correctIndex":1},
     {"id":"q5","question":"SDS skal være tilgjengelig …","options":["Hos HMS-leder","På arbeidsplassen for hvert kjemikalie","Sentralarkivert","Hos BHT"],"correctIndex":1},
     {"id":"q6","question":"Maskiner i bruk skal være …","options":["Markedsført","CE-merket med norsk manual","Forsikret","TÜV-sertifisert"],"correctIndex":1},
     {"id":"q7","question":"Hørselsvern fra hvilket nivå?","options":["60 dB","70 dB","85 dB","100 dB"],"correctIndex":2},
     {"id":"q8","question":"Hånd-arm-vibrasjon kan gi …","options":["Forkjølelse","Nummenhet og hvitfingre","Hørselstap","Allergi"],"correctIndex":1},
     {"id":"q9","question":"Sertifikat for arbeids­utstyr skal …","options":["Henge på vegg","Være på arbeidsstedet hos føreren","Sendes Tilsynet","Lagres i HR"],"correctIndex":1},
     {"id":"q10","question":"Hvilken § hjemler grunnopplæring for arbeidstakere?","options":["§ 2-1","§ 3-2","§ 6-5","§ 13-1"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 6. c-aml-arbeidstaker-helse (INSERT) ─────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-arbeidstaker-helse', 'aml-arbeidstaker-helse', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-arbeidstaker-helse', 'nb',
  'HMS for alle ansatte — helse og omsorg (§ 3-2)',
  'Bransje­tilpasset HMS for helse-/omsorgs­ansatte. Kjernerisikoer: smitte, vold/trusler, tunge løft, etisk press, vakt­ordninger.',
  $jsonb$
[
  {"id":"m1","title":"Bransjeramme — helse","order":1,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-3","AML § 4-4","AML kap. 10","Helsepersonellloven","Smittevernloven"],
   "content":{"kind":"text","body":"<p>I helse og omsorg gjelder i tillegg til AML: helse­personell­loven, smitte­vern­loven, pasient­rettighets­loven, forskrift om smittevern.</p><p>§ 4-3 (3) gir særlig vern mot vold/trusler. Arbeidstid (§ 10) har egne regler for natt-/vakt­ordninger.</p>"}},

  {"id":"m2","title":"Smittevern og personlig verneutstyr","order":2,"kind":"text","durationMinutes":10,
   "lawRefs":["Forskrift om smittevern","AML § 4-5"],
   "content":{"kind":"text","body":"<p>Standard­tiltak ved all pasientkontakt: hånd­hygiene, hansker, evt. munnbind/visir.</p><p>Fem smitte­typer du må kjenne: blod, dråpe­smitte, luft­smitte, kontakt, gastro.</p><p>Stikkskader: meldes umiddelbart — innen 1 t skal PEP-vurdering (post-eksponerings­profylakse) gjøres. Eksponerings­register føres etter forskrift.</p>"}},

  {"id":"m3","title":"Vold og trusler — § 4-3 (3)","order":3,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 4-3 (3)","IK-f § 5"],
   "content":{"kind":"text","body":"<p>§ 4-3 (3) krever at arbeids­taker beskyttes mot vold, trusler, uheldige belastninger.</p><p>Risikovurdering skal være konkret per arbeidsplass — særlig akutt­mottak, psykiatri, demens­omsorg, hjemmesyke­pleie alene.</p><p>Tiltak: alarmsystem, makker­arbeid, deeskalerings­opplæring, etter­samtale.</p><p>Hver hendelse skal registreres — også verbale trusler. Tilbakeholdt rapport gir Tilsynet grunnlag for pålegg.</p>"}},

  {"id":"m4","title":"Etisk press og varsling","order":4,"kind":"text","durationMinutes":8,
   "lawRefs":["AML kap. 2A","Helsepersonellloven § 16"],
   "content":{"kind":"text","body":"<p>Helsepersonell møter etiske dilemmaer: ressurs­mangel, faglig uenighet, ledelses­krav i strid med pasienthensyn.</p><p>Helse­personell­loven § 16 gir plikt til faglig forsvarlig praksis. Press mot forsvarlig praksis → varslings­kanal (kap. 2A), ikke avviks­kanal. Varslings­vern beskytter.</p>"}},

  {"id":"m5","title":"Arbeidstid, vakt og helse — § 10","order":5,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 10-2","AML § 10-5","AML § 10-8"],
   "content":{"kind":"text","body":"<p>§ 10-2 (4) gir rett til arbeids­miljø som ikke utsetter for særlige helse­messige eller sosiale ulemper.</p><p>For helsepersonell:</p><ul><li>Minst 11 t hvile per døgn (§ 10-8)</li><li>Maks 13 t arbeids­dag</li><li>35 t sammenhengende hvile per uke</li></ul><p>Gjennomsnitts­beregning krever tariff­avtale. Vaktbytte med mindre enn 11 t hvile krever særlig vurdering.</p>"}},

  {"id":"m6","title":"Flashcards — 10 bransje­situasjoner","order":6,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Stikkskade på vakt","back":"Vask 5 min med såpe, meld BHT/akutt innen 1 t, PEP-vurdering"},
     {"id":"c2","front":"Verbal trussel fra pårørende","back":"Meld som vold/trusler-avvik samme dag, vurder etter­samtale"},
     {"id":"c3","front":"Alenearbeid demensavdeling","back":"Krav om risiko­vurdering + alarm-/tilkallings­system"},
     {"id":"c4","front":"Press til ufaglig praksis","back":"Varsling kap. 2A — ikke avvik. Sterkere beskyttelse."},
     {"id":"c5","front":"Vakt­bytte mindre enn 11 t hvile","back":"Krav om særlig vurdering — § 10-8"},
     {"id":"c6","front":"Forflyttning av tung pasient alene","back":"Bruk takheis/ståheis eller makker — aldri alene"},
     {"id":"c7","front":"Mistanke om smitte","back":"Standard­tiltak, kontakt smittevern, isolér ved behov"},
     {"id":"c8","front":"Hjemmesykepleie psykisk syk pasient","back":"Risikovurdering før første besøk, GPS-alarm, makker ved behov"},
     {"id":"c9","front":"Overtidspress > 13 t","back":"§ 10-6 tillater unntak — krever avtale + dokumentasjon"},
     {"id":"c10","front":"Etter alvorlig hendelse","back":"Debriefing samme vakt, oppfølging av leder + BHT, ikke alene"}
   ]}},

  {"id":"m7","title":"OJT — Smitte­vern­sjekk egen vakt","order":7,"kind":"on_job","durationMinutes":20,
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Verifiser at PVU er fylt opp","description":"Hansker, munnbind, visir. Bevis: bilde. Signatur: selv."},
     {"id":"t2","title":"Sjekk rutine for stikkskade","description":"Er den synlig? Bevis: bilde. Signatur: selv."},
     {"id":"t3","title":"Identifiser tre pasienter med smitte­risiko","description":"Bevis: anonym liste. Signatur: leder."}
   ]}},

  {"id":"m8","title":"Video-transkript — Forflyttings­teknikk (6 min)","order":8,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 4-4"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Tunge løft er den viktigste yrkesskaden i helse — og den er forebyggbar.</p><p><strong>[00:30–02:00] Hjelpemidler.</strong> Sjuke­seng, ståheis, takheis, gli­plate, dreietallerken. Bruk dem alltid når tilgjengelig.</p><p><strong>[02:00–04:00] Teknikk.</strong> Aldri løft alene over 20 kg. Bøy i knærne, hold pasienten/lasten nær kroppen, ingen vridning. Forflytt med pasientens egne ressurser — instruer verbalt.</p><p><strong>[04:00–05:30] Melding.</strong> Smerter som varer over uka — meld BHT. Skader meldes som avvik samme dag.</p><p><strong>[05:30–06:00] Avslutning.</strong> Forebygging er enklere enn rehabilitering.</p>"}},

  {"id":"m9","title":"Sluttquiz","order":9,"kind":"quiz","durationMinutes":7,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"§ 4-3 (3) gjelder primært …","options":["Kjemikalier","Vold, trusler, uheldige belastninger","Lønnsforhold","Avskjed"],"correctIndex":1},
     {"id":"q2","question":"Minste hvile per døgn etter § 10-8?","options":["6 t","8 t","11 t","12 t"],"correctIndex":2},
     {"id":"q3","question":"Stikkskade — innen hvor lang tid skal PEP-vurdering gjøres?","options":["1 t","24 t","3 d","1 u"],"correctIndex":0},
     {"id":"q4","question":"Press til ufaglig praksis — riktig kanal?","options":["Avvik","Varsling kap. 2A","Klage til pasient­ombud","Privat samtale med leder"],"correctIndex":1},
     {"id":"q5","question":"Tung pasient­forflytning skal …","options":["Gjøres alene","Bruke hjelpemiddel/makker","Vente til nattevakt","Avlyses"],"correctIndex":1},
     {"id":"q6","question":"Hvilken § krever risiko­vurdering for alenearbeid?","options":["§ 3-1 + § 4-3","§ 5-1","§ 10-2","§ 13-1"],"correctIndex":0},
     {"id":"q7","question":"Verbal trussel — hva gjør du?","options":["Ignorer","Meld som vold-/trusler-avvik samme dag","Vent til neste vakt","Bare info til kollega"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 7. c-aml-arbeidstaker-bygg (INSERT) ──────────────────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-arbeidstaker-bygg', 'aml-arbeidstaker-bygg', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-arbeidstaker-bygg', 'nb',
  'HMS for alle ansatte — bygg og anlegg (§ 3-2)',
  'Bransje­tilpasset HMS for bygg/anlegg. Dekker byggherre­forskriften, SHA-plan, fall­sikring, asbest, HMS-kort.',
  $jsonb$
[
  {"id":"m1","title":"Bransjeramme — bygg","order":1,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-4","Byggherre­forskriften"],
   "content":{"kind":"text","body":"<p>Bygg og anlegg har egne forskrifter i tillegg til AML:</p><ul><li>Byggherre­forskriften (SHA-plan, koordinator)</li><li>Forskrift om sikkerhet, helse og arbeids­miljø på bygge-/anleggs­plasser</li><li>Forskrift om HMS-kort</li></ul><p>KU-koordinator (utførelse) er ansvarlig for SHA-plan.</p>"}},

  {"id":"m2","title":"Fall fra høyde","order":2,"kind":"text","durationMinutes":8,
   "lawRefs":["Forskrift om utførelse av arbeid kap. 17"],
   "content":{"kind":"text","body":"<p>Fall er den vanligste døds­ulykken i bygg. Fra 2 m høyde:</p><ul><li>Kollektiv fallsikring (rekkverk, stillas, nett) — hovedregel</li><li>Personlig fallsikring (sele + line) — kun når kollektiv ikke er mulig</li></ul><p>Sele kontrolleres før hver bruk, sertifisert årlig, forankring tåle 22 kN. Aldri klatre med sele uten forankring.</p>"}},

  {"id":"m3","title":"Stillas — kontroll og merking","order":3,"kind":"text","durationMinutes":8,
   "lawRefs":["Forskrift om utførelse av arbeid kap. 17"],
   "content":{"kind":"text","body":"<p>Stillas over 5 m krever sertifisert montør.</p><p>Stillas skal merkes med skilt:</p><ul><li><strong>Grønt</strong> — godkjent, klar til bruk</li><li><strong>Rødt</strong> — ikke i bruk, ikke gå opp</li></ul><p>Skiltet angir maks belastning, kontrolldato, ansvarlig montør. Sjekk skilt før du går opp.</p>"}},

  {"id":"m4","title":"HMS-kort og ID-merking","order":4,"kind":"text","durationMinutes":5,
   "lawRefs":["Forskrift om HMS-kort","AML § 14-12"],
   "content":{"kind":"text","body":"<p>Alle som arbeider på byggeplass skal ha HMS-kort fra Arbeids­tilsynet. Kortet viser navn, bilde, arbeidsgiver, org.nr.</p><p>Kortet skal være synlig under arbeid. Innleier er ansvarlig for at innleide har kort.</p>"}},

  {"id":"m5","title":"Asbest, silika, isocyanater","order":5,"kind":"text","durationMinutes":8,
   "lawRefs":["Forskrift om utførelse av arbeid kap. 4","AML § 4-5"],
   "content":{"kind":"text","body":"<p><strong>Asbest</strong> i bygg før 1985 — krev kartlegging før riving. Sertifisert sanerer kun.</p><p><strong>Silika</strong> fra mur/betong-skjæring — bruk vannkjøling + støvavsug + P3-maske.</p><p><strong>Isocyanater</strong> fra spray-skum — krev frisk­luft + hudvern.</p><p>Eksponering registreres livslangt etter forskrift om eksponerings­register (oppbevares 60 år).</p>"}},

  {"id":"m6","title":"Flashcards — 10 byggrisikoer","order":6,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Fall fra 2 m","back":"Kollektiv fallsikring først; personlig sele kun unntak"},
     {"id":"c2","front":"Stillasskilt rødt","back":"Stillaset er ikke i bruk — gå ikke opp"},
     {"id":"c3","front":"Asbest mistenkt","back":"Stans, krev kartlegging, sertifisert sanerer"},
     {"id":"c4","front":"Ingen HMS-kort","back":"Bortvis fra byggeplass — innleier ansvarlig"},
     {"id":"c5","front":"Silikastøv ved skjæring","back":"Vannkjøling, støvavsug, P3-maske"},
     {"id":"c6","front":"Spray-skum innendørs","back":"Friskluftsmaske, hudvern, ventilasjon"},
     {"id":"c7","front":"Spikerpistol uten hørselsvern","back":"Stopp — bruk vern, 110 dB skader hørsel"},
     {"id":"c8","front":"Vibrerende verktøy 4 t/dag","back":"Roter oppgaver, meld nummenhet, audiometri"},
     {"id":"c9","front":"SHA-plan ikke kjent","back":"Krev å se SHA-plan før arbeid"},
     {"id":"c10","front":"Innleid uten opplæring","back":"Innleier skal kreve § 3-2-bekreftelse fra utleier"}
   ]}},

  {"id":"m7","title":"OJT — SHA-plan-gjennomgang","order":7,"kind":"on_job","durationMinutes":25,
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Få utlevert SHA-plan fra KU-koordinator","description":"Bevis: kopi/lenke. Signatur: koordinator."},
     {"id":"t2","title":"Identifiser tre risikoer som gjelder din oppgave","description":"Bevis: liste. Signatur: selv."},
     {"id":"t3","title":"Bekreft at tiltakene er kjent","description":"Bevis: signatur. Signatur: leder."}
   ]}},

  {"id":"m8","title":"Video-transkript — Liv og helse på byggeplassen (5 min)","order":8,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-1","AML § 4-4","AML § 4-5","Byggherre­forskriften"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Bygg har de høyeste dødstallene per ansatt. Vanligste døds­ulykker: fall, fall av gjenstand, klem, strøm.</p><p><strong>[00:30–01:30] Fall.</strong> Fra 2 m kollektiv fallsikring. Hvis umulig: sele + line med 22 kN forankring. Sjekk sele før bruk.</p><p><strong>[01:30–02:30] Fallende gjenstand.</strong> Hjelm alltid. Verktøy med snor i høyden. Markering under arbeidsfelt.</p><p><strong>[02:30–03:30] Kjemi og støv.</strong> Asbest før 1985 — kartlegging. Silika — vannkjøling. Røyk/spray — P3-maske minimum. Eksponerings­register 60 år.</p><p><strong>[03:30–04:30] Strøm.</strong> Ingen elektriske installasjoner uten fagmann. Tvil — stengt + merket.</p><p><strong>[04:30–05:00] Avslutning.</strong> Bruk verneutstyret. Meld brudd på SHA-plan.</p>"}},

  {"id":"m9","title":"Sluttquiz","order":9,"kind":"quiz","durationMinutes":8,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Fra hvilken høyde kreves fallsikring?","options":["1 m","2 m","3 m","5 m"],"correctIndex":1},
     {"id":"q2","question":"Stillas over 5 m krever …","options":["Bare merking","Sertifisert montør","Brannvakt","Lift"],"correctIndex":1},
     {"id":"q3","question":"HMS-kort utstedes av …","options":["Arbeidsgiver","Arbeids­tilsynet","Kommunen","LO"],"correctIndex":1},
     {"id":"q4","question":"Asbest i bygg fra før …","options":["1970","1985","2000","2005"],"correctIndex":1},
     {"id":"q5","question":"Silika-eksponering forebygges med …","options":["Bare maske","Vannkjøling + støvavsug + P3-maske","Hansker","Ingen tiltak"],"correctIndex":1},
     {"id":"q6","question":"SHA-plan har hvem ansvar for?","options":["Byggherre","KU-koordinator (utførelse)","HMS-leder","Arbeidstilsynet"],"correctIndex":1},
     {"id":"q7","question":"Eksponerings­register holdes i …","options":["5 år","30 år","60 år","Livet ut"],"correctIndex":2},
     {"id":"q8","question":"Personlig fallsikring brukes når …","options":["Alltid før kollektiv","Kollektiv fallsikring ikke er mulig","Bare ved < 5 m","Aldri"],"correctIndex":1},
     {"id":"q9","question":"Innleier sitt ansvar for innleide?","options":["Ingen","Sekundær på opplæring + HMS-kort","Bare lønn","Bare utstyr"],"correctIndex":1},
     {"id":"q10","question":"Hørselsvern brukes fra …","options":["60 dB","70 dB","85 dB","100 dB"],"correctIndex":2}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 8. c-aml-ledere (INSERT/REPLACE) — linje­leder ───────────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-ledere', 'aml-ledere', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-ledere', 'nb',
  'HMS for linjeledere (§ 2-1, § 3-1)',
  'Operativ HMS for mellom­leder/linjeleder med personalansvar. Komplement til arbeidsgiver­kurset (c-40-timers-hms).',
  $jsonb$
[
  {"id":"m1","title":"Lederens HMS-ansvar i linja","order":1,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 2-1","AML § 3-1","AML § 19-1"],
   "content":{"kind":"text","body":"<p>Som linje­leder er du arbeidsgiverens forlengede arm. § 2-1 — du kan delegere oppgaver, men ikke det overordnede ansvaret.</p><p>Ditt operative ansvar:</p><ul><li>Opplæring i enheten (§ 3-2)</li><li>Risikovurdering i enheten (§ 3-1)</li><li>Sykefraværs­oppfølging (§ 4-6)</li><li>Konflikt/trakassering/varsling (§ 4-3, kap. 2A)</li><li>Samarbeid med verneombud (§ 6-2)</li></ul><p>Du kan komme i personlig straffe­ansvar hvis du <strong>aktivt</strong> gir instruks i strid med AML (§ 19-1). Erstatnings­ansvar (skl. § 2-1) kan oppstå selv ved unnlatelse.</p>"}},

  {"id":"m2","title":"Risikovurdering i din enhet","order":2,"kind":"text","durationMinutes":10,
   "lawRefs":["AML § 3-1","IK-f § 5 nr. 6"],
   "content":{"kind":"text","body":"<p>Du eier risikobildet i din enhet. Oppdater ROS jevnlig — minst årlig, ved endringer, etter avvik.</p><p>Involver verneombudet (§ 6-2). Bruk NewAMU sin ROS-mal. Klassifiser i fire kategorier: fysisk, kjemisk, ergonomisk, psyko­sosial.</p><p>Tiltak prioriteres etter risiko, dokumenteres med ansvarlig og frist.</p>"}},

  {"id":"m3","title":"Sykefravær — frister og dialog","order":3,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 4-6","Folketrygdloven kap. 8"],
   "content":{"kind":"text","body":"<p>Tidslinje:</p><ul><li>Dag 1–16: egenmelding/sykmelding mottatt</li><li>Innen 4 uker: oppfølgings­plan skriftlig</li><li>Innen 7 uker: dialogmøte 1 (leder + ansatt + ev. tillitsvalgt)</li><li>Innen 26 uker: dialogmøte 2 (NAV deltar)</li><li>52 uker: maksdato — drøft alternativer</li></ul><p>Tilretteleggings­plikten (§ 4-6) gjelder uavhengig av IA-status. Lagre dokumenter i NewAMU sykefraværs­modul.</p>"}},

  {"id":"m4","title":"Konflikt og trakassering","order":4,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 4-3","AML § 13-1","AML kap. 2A"],
   "content":{"kind":"text","body":"<p>§ 4-3 (1) — integritet og verdighet skal ivaretas. Grip inn ved første tegn.</p><p>Skriv ned observasjoner samme dag. Velg riktig kanal: mobbing/trakassering som fortsetter, behandles som varsling (kap. 2A) — varsleren har da sterkere lovbeskyttelse.</p><p>Tilkall BHT og verneombud tidlig.</p>"}},

  {"id":"m5","title":"Varsling — slik mottar du varsel","order":5,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 2A-1","AML § 2A-2","AML § 2A-4"],
   "content":{"kind":"text","body":"<p>Mottar du varsel etter kap. 2A:</p><ol><li>Bekreft mottak skriftlig samme dag</li><li>Ikke gjennomfør gjengjeldelse (§ 2A-4 forbyr enhver form)</li><li>Loggfør</li><li>Videresend til varslings­mottak</li><li>Vurder midlertidige beskyttelses­tiltak for varsler</li></ol><p>Du kan ikke avvise et varsel som «ikke kritikkverdig» uten saksbehandling.</p>"}},

  {"id":"m6","title":"Flashcards — Lederens 12 paragrafer","order":6,"kind":"flashcard","durationMinutes":8,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"§ 2-1","back":"Overordnet ansvar — du har avledet ansvar via delegering"},
     {"id":"c2","front":"§ 3-1","back":"Du eier risikobildet i din enhet"},
     {"id":"c3","front":"§ 3-2","back":"Opplærings­plikt for dine ansatte"},
     {"id":"c4","front":"§ 4-3","back":"Integritet, vern mot mobbing/trakassering"},
     {"id":"c5","front":"§ 4-6","back":"Tilretteleggings­plikt — uavhengig IA"},
     {"id":"c6","front":"§ 6-2","back":"Du skal samarbeide aktivt med verneombud"},
     {"id":"c7","front":"§ 8-1","back":"Drøfting med tillitsvalgte ≥ 50 ansatte"},
     {"id":"c8","front":"§ 10-2 ff","back":"Arbeidstid — nattvakt, ungdom, gravid"},
     {"id":"c9","front":"§ 13-1","back":"Forbud mot diskriminering — 6 grunnlag"},
     {"id":"c10","front":"§ 14-12","back":"Innleide — ditt sekundær­ansvar for HMS"},
     {"id":"c11","front":"§ 15-1","back":"Drøfting før oppsigelse — skriftlig saklighet"},
     {"id":"c12","front":"§ 19-1","back":"Straffe­ansvar ved aktiv instruks i strid med AML"}
   ]}},

  {"id":"m7","title":"OJT — Din enhets risikovurdering","order":7,"kind":"on_job","durationMinutes":45,
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Innkall verneombud til ROS-arbeidsmøte","description":"Bevis: møteinnkalling. Signatur: selv."},
     {"id":"t2","title":"Identifiser 5 risikoer (alle 4 kategorier)","description":"Bevis: ROS-skjema. Signatur: verneombud."},
     {"id":"t3","title":"Klassifiser sannsynlighet × konsekvens","description":"Bevis: matrise. Signatur: selv."},
     {"id":"t4","title":"Skriv tiltaksplan med ansvar + frist","description":"Bevis: plan. Signatur: verneombud."},
     {"id":"t5","title":"Legg planen i NewAMU ROS-modul","description":"Bevis: lenke. Signatur: selv."},
     {"id":"t6","title":"Følg opp tiltak innen frist","description":"Bevis: status. Signatur: selv."}
   ]}},

  {"id":"m8","title":"Video-transkript — Lederens HMS-hverdag (6 min)","order":8,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 2-1","AML § 3-1","AML § 4-3","AML § 4-6","AML § 6-2","AML kap. 2A","AML § 19-1"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Du er ny linjeleder med personalansvar. Du har plutselig HMS-ansvar som ikke stod i jobbeskrivelsen — men loven har det klart.</p><p><strong>[00:30–01:30] Operativt ansvar.</strong> Du eier risikobildet (§ 3-1), følger opp sykefravær (§ 4-6), håndterer konflikt og trakassering (§ 4-3), samarbeider med verneombud (§ 6-2).</p><p><strong>[01:30–02:30] Sykefravær.</strong> 4 uker oppfølgings­plan. 7 uker dialogmøte 1. Bryt fristene — dokumentasjons­svikt ved tilsyn.</p><p><strong>[02:30–03:30] Konflikt.</strong> Grip inn tidlig. Tre uker uten håndtering kan eskalere til varslings­sak. Tilkall BHT og verneombud.</p><p><strong>[03:30–04:30] Varsling.</strong> Hvis du mottar varsel: ikke gjengjeld (§ 2A-4 forbyr alt fra omplassering til kald skulder). Bekreft skriftlig samme dag.</p><p><strong>[04:30–05:30] Straffeansvar.</strong> Du er ikke automatisk strafferettslig ansvarlig for daglig leders unnlatelse. Men aktiv instruks i strid med AML — for eksempel folk uten verneutstyr — gir personlig ansvar (§ 19-1).</p><p><strong>[05:30–06:00] Avslutning.</strong> Dokumenter alt. Papirsporet beskytter, ikke intensjoner.</p>"}},

  {"id":"m9","title":"Sluttquiz","order":9,"kind":"quiz","durationMinutes":10,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Oppfølgings­plan ved sykefravær — frist?","options":["2 u","4 u","7 u","12 u"],"correctIndex":1},
     {"id":"q2","question":"Dialogmøte 1 senest …","options":["4 u","7 u","12 u","26 u"],"correctIndex":1},
     {"id":"q3","question":"Tilretteleggings­plikten gjelder …","options":["Bare IA","Uavhengig av IA","Bare arbeidsskade","Bare fysisk skade"],"correctIndex":1},
     {"id":"q4","question":"Mottar du varsel — første handling?","options":["Avvis hvis ukurant","Bekreft mottak skriftlig samme dag","Vent på leder","Slett"],"correctIndex":1},
     {"id":"q5","question":"Diskriminerings­grunnlag i § 13-1 — antall?","options":["3","5","6","9"],"correctIndex":2},
     {"id":"q6","question":"Linje­leder kan komme i straffe­ansvar etter § 19-1 …","options":["aldri","ved aktiv instruks i strid med AML","bare ved skade","bare ved gjentakelse"],"correctIndex":1},
     {"id":"q7","question":"Drøftings­plikt § 8-1 fra …","options":["10","30","50","100"],"correctIndex":2},
     {"id":"q8","question":"Hvem skal være med på ROS i enheten?","options":["Bare leder","Leder + verneombud","Bare HR","Bare BHT"],"correctIndex":1},
     {"id":"q9","question":"Hvor ofte ROS revideres?","options":["Hvert år","Hvert 2. år","Jevnlig, minst årlig + ved endringer","Hvert 5. år"],"correctIndex":2},
     {"id":"q10","question":"Konflikt utvikler seg til mulig trakassering — riktig kanal?","options":["Personal­sak","Varsling kap. 2A — sterkere lovbeskyttelse","Drøftings­møte","Privat samtale"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 9. c-aml-13-likestilling (REPLACE — utvidet med ARP) ─────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-13-likestilling', 'aml-13-likestilling', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-13-likestilling', 'nb',
  'Likestilling, diskriminering og ARP (AML kap. 13, LDL § 26)',
  'Lederkurs som dekker diskriminerings­forbud (AML § 13), aktivitets- og redegjørelses­plikten (LDL § 26), trakasserings­håndtering, og ARP-praksis.',
  $jsonb$
[
  {"id":"m1","title":"Diskrimineringsforbudet — AML kap. 13","order":1,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 13-1","AML § 13-2","AML § 13-7"],
   "content":{"kind":"text","body":"<p>§ 13-1 forbyr direkte og indirekte diskriminering pga.:</p><ol><li>Politisk syn</li><li>Medlemskap i arbeidstaker­organisasjon</li><li>Seksuell orientering</li><li>Funksjons­nedsettelse</li><li>Alder</li><li>Etnisitet (LDL utvider)</li></ol><p>Bevisbyrde går over på arbeidsgiver hvis det er grunn til å tro at diskriminering har funnet sted (§ 13-8).</p>"}},

  {"id":"m2","title":"ARP — aktivitets- og redegjørelses­plikten","order":2,"kind":"text","durationMinutes":10,
   "lawRefs":["LDL § 26","LDL § 26 a","AML § 13-1","AML § 13-7"],
   "content":{"kind":"text","body":"<p>LDL § 26 deler plikten i to:</p><ul><li><strong>Aktivitets­plikt</strong> (alle arbeidsgivere) — jevnlig undersøke, analysere, tiltak, evaluere</li><li><strong>Redegjørelses­plikt</strong> (offentlige + private ≥ 50 ansatte; ≥ 20 hvis parter krever) — publisere årlig redegjørelse</li></ul><p>Redegjørelsen skal dekke: tilstand kjønn, lønn (kjønns­kjønns­del), heltid/deltid, foreldre­permisjon, faktisk fravær pga. omsorg, kartlagte risikoer for diskriminering, og tiltak.</p><p>Lønns­kartlegging hvert 2. år (§ 26 a). LDO fører tilsyn.</p>"}},

  {"id":"m3","title":"Trakassering — § 13-1 og § 13-7","order":3,"kind":"text","durationMinutes":8,
   "lawRefs":["AML § 13-1","AML § 13-7","AML § 2A-2","AML § 2A-4"],
   "content":{"kind":"text","body":"<p>Trakassering = uønskede handlinger, unnlatelser eller ytringer som virker krenkende.</p><p>Mottar du trakasserings­varsel:</p><ol><li>Ta varsleren på alvor</li><li>Skriv ned varselet samme dag</li><li>Ikke konfronter den anklagede uten saksbehandling</li><li>Tilkall HR/varslings­mottak</li><li>Vurder midlertidige beskyttelses­tiltak for varsler</li><li>Gi tilbakemelding innen rimelig tid</li></ol><p>Faktaundersøkelse skal være uavhengig av partene.</p>"}},

  {"id":"m4","title":"Flashcards — 10 diskriminerings­situasjoner","order":4,"kind":"flashcard","durationMinutes":6,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Gravid kandidat ikke innkalt til intervju","back":"§ 13-1 — bevisbyrde over på arbeidsgiver"},
     {"id":"c2","front":"Eldre arbeidstaker tilbudt sluttpakke","back":"Alder beskyttet — krav om saklig grunn"},
     {"id":"c3","front":"Hijab nektet","back":"Religion beskyttet — krav om saklig hindring"},
     {"id":"c4","front":"Lønnsforskjell kvinne vs mann samme rolle","back":"§ 26 a — kartlegg, dokumenter forklaring"},
     {"id":"c5","front":"Funksjons­nedsatt søker","back":"§ 12-5 LDL — rimelig individuell tilrettelegging"},
     {"id":"c6","front":"Vits om sex­legning på møte","back":"Trakassering — leder skal gripe inn"},
     {"id":"c7","front":"Ufrivillig deltid kvinne­dominert avd.","back":"ARP-kartlegging — analyser strukturelt"},
     {"id":"c8","front":"Foreldre­permisjon vs forfremmelse","back":"§ 13-1 — kan ikke straffes for permisjon"},
     {"id":"c9","front":"Verbal aggresjon mot innvandrer","back":"Etnisk trakassering — varsling, BHT inn"},
     {"id":"c10","front":"Lønns­hemmelig­hold","back":"§ 26 a krever transparens i kjønnskartlegging"}
   ]}},

  {"id":"m5","title":"OJT — Din ARP-årsrapport","order":5,"kind":"on_job","durationMinutes":60,
   "lawRefs":["LDL § 26","LDL § 26 a"],
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Trekk ut kjønns­statistikk fra HR-modulen","description":"Bevis: CSV/eksport. Signatur: selv."},
     {"id":"t2","title":"Lønns­kartlegging like grupper (annet hvert år)","description":"Bevis: analyse. Signatur: selv."},
     {"id":"t3","title":"Kjør ARP-survey (mal i NewAMU)","description":"Bevis: survey-id. Signatur: selv."},
     {"id":"t4","title":"Identifiser min. 3 risikoer for diskriminering","description":"Bevis: liste. Signatur: tillitsvalgt."},
     {"id":"t5","title":"Skriv redegjørelse i tpl-arp-redegjorelse","description":"Bevis: PDF. Signatur: daglig leder."},
     {"id":"t6","title":"Publiser i års­beretning eller eget dokument","description":"Bevis: lenke. Signatur: daglig leder."}
   ]}},

  {"id":"m6","title":"Video-transkript — Forebygg diskriminering (5 min)","order":6,"kind":"text","durationMinutes":5,
   "lawRefs":["LDL § 26","LDL § 26 a","AML § 13-1","AML § 13-7"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Diskriminering er sjelden bevisst. Det er oftere strukturer, vaner og ubevisste vurderinger som gir effekt. LDL sier at du må jobbe <em>aktivt</em>.</p><p><strong>[00:30–01:30] Aktivitets­plikten.</strong> § 26 — undersøke, analysere, sette tiltak, evaluere. En syklus, ikke et engangs­arbeid. Anonym spørreundersøkelse er hovedverktøy, terskel 5.</p><p><strong>[01:30–02:30] Redegjørelses­plikten.</strong> ≥ 50 ansatte: årlig redegjørelse. Dekker tilstand kjønn, lønn, heltid/deltid, foreldre­permisjon, risikoer.</p><p><strong>[02:30–03:30] Lønns­kartlegging.</strong> Annet hvert år. Sammenlign like grupper. Forskjeller skal kunne forklares av andre forhold enn kjønn.</p><p><strong>[03:30–04:30] Trakassering.</strong> § 13-1 forbyr trakassering på 6 grunnlag. Skriftlig rutine for melding, håndtering, oppfølging.</p><p><strong>[04:30–05:00] Avslutning.</strong> Aktivitet, ikke bare rapport.</p>"}},

  {"id":"m7","title":"Sluttquiz","order":7,"kind":"quiz","durationMinutes":8,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"Hvor ofte lønns­kartlegging?","options":["Årlig","Annet hvert år","Hvert 4. år","Bare ved tvist"],"correctIndex":1},
     {"id":"q2","question":"Redegjørelses­plikt fra hvor mange ansatte (privat)?","options":["20","30","50","100"],"correctIndex":2},
     {"id":"q3","question":"Hvilken § hjemler aktivitets­plikten?","options":["AML § 4-3","LDL § 26","AML § 13-1","GDPR Art. 5"],"correctIndex":1},
     {"id":"q4","question":"Tilsynsmyndighet for ARP?","options":["Arbeidstilsynet","LDO","Datatilsynet","NAV"],"correctIndex":1},
     {"id":"q5","question":"Antall diskriminerings­grunnlag i § 13-1?","options":["3","5","6","9"],"correctIndex":2},
     {"id":"q6","question":"Trakasserings­varsel — riktig kanal?","options":["Personal­sak","Varsling kap. 2A","Privat klage","Sletting"],"correctIndex":1},
     {"id":"q7","question":"Foreldre­permisjon og forfremmelse — diskriminering?","options":["Tillatt","Forbudt etter § 13-1","Bare ved kvinner","Drøftings­tema"],"correctIndex":1},
     {"id":"q8","question":"ARP-survey skal være …","options":["Identifisert","Anonym med terskel ≥ 5","Frivillig","Bare for ledere"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 10. c-aml-endring (INSERT — nytt kurs for § 4-1 (3)) ─────────────────

insert into public.learning_system_courses (id, slug, default_locale)
values ('c-aml-endring', 'aml-endring', 'nb')
on conflict (id) do nothing;

insert into public.learning_system_course_locales (system_course_id, locale, title, description, modules)
values (
  'c-aml-endring', 'nb',
  'Endring og omstilling — § 4-1 (3) kartlegging',
  'Operativ kompetanse for ledere + verneombud i forkant av og under omstilling, omorganisering eller digitalisering. Dekker medvirknings­plikt, informasjons- og drøftings­plikt (§ 8-1), og endrings­kartlegging.',
  $jsonb$
[
  {"id":"m1","title":"Endrings­hjemler i AML","order":1,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 4-1","AML § 4-2","AML § 8-1","AML § 15-1"],
   "content":{"kind":"text","body":"<p>Flere paragrafer slår inn ved endring:</p><ul><li><strong>§ 4-1 (3)</strong> — variasjon og medvirkning i organisering</li><li><strong>§ 4-2 (3)</strong> — medvirkning ved endring av vesentlig betydning</li><li><strong>§ 7-2 g</strong> — AMU skal behandle planer av vesentlig betydning</li><li><strong>§ 8-1</strong> — informasjon og drøfting ≥ 50 ansatte</li><li><strong>§ 15-1</strong> — drøfting før endrings­oppsigelse</li></ul><p>Endring uten kartlegging gir reell risiko for pålegg fra Tilsynet og enkeltsaker fra ansatte.</p>"}},

  {"id":"m2","title":"§ 4-2 medvirkning ved endring","order":2,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 4-2","AML § 7-2"],
   "content":{"kind":"text","body":"<p>§ 4-2 (3) — arbeidstaker og tillitsvalgte skal holdes løpende informert om systemer ved planlegging og gjennomføring av arbeidet.</p><p>Praktisk: før beslutning skal arbeidstakerne høres. Verneombud trekkes inn i HMS-konsekvensene. AMU behandler planer med vesentlig betydning (§ 7-2 g).</p>"}},

  {"id":"m3","title":"§ 8-1 informasjon og drøfting ≥ 50","order":3,"kind":"text","durationMinutes":6,
   "lawRefs":["AML § 8-1","AML § 8-2"],
   "content":{"kind":"text","body":"<p>Gjelder virksomheter med jevnlig minst 50 ansatte.</p><p>Krav:</p><ul><li>Informasjon på et tidspunkt der drøfting kan påvirke utfall</li><li>Drøfting med tillitsvalgte før beslutninger om vesentlige endringer</li></ul><p>Brudd kan utløse erstatnings­ansvar og pålegg om reversering. Dokumentasjon: protokoll fra drøftings­møte med dato, parter, tema, vedtak.</p>"}},

  {"id":"m4","title":"Endrings­kartlegging — før, under, etter","order":4,"kind":"text","durationMinutes":12,
   "lawRefs":["AML § 4-1","AML § 4-3","IK-f § 5 nr. 6"],
   "content":{"kind":"text","body":"<p>Forsvarlig endring kartlegges i tre faser:</p><ul><li><strong>FØR</strong> — baseline (sykefravær, engasjement, opplevd belastning, jobb­usikkerhet). Identifiser risikogrupper.</li><li><strong>UNDER</strong> — puls­målinger månedlig på 4–6 items (informasjons­tilgang, medvirknings­opplevelse, belastning, mestring).</li><li><strong>ETTER</strong> — målinger 3 og 6 mnd etter for å verifisere at risiko er håndtert.</li></ul><p>Items hentes fra COPSOQ III «Job insecurity», «Organizational justice», «Quantitative demands». Anonyme undersøkelser, k ≥ 5.</p>"}},

  {"id":"m5","title":"Flashcards — endrings­fallgruver","order":5,"kind":"flashcard","durationMinutes":5,
   "content":{"kind":"flashcard","slides":[
     {"id":"c1","front":"Beslutning før drøfting","back":"Bryter § 8-1; krever reversering"},
     {"id":"c2","front":"VO ikke involvert","back":"Bryter § 6-2 + § 4-2; pålegg fra Tilsynet"},
     {"id":"c3","front":"Ingen baseline-måling","back":"Du kan ikke vise at endringen ikke forverret miljøet"},
     {"id":"c4","front":"Endringen kommer som overraskelse","back":"§ 4-2 medvirkning brutt"},
     {"id":"c5","front":"Ingen plan for risikogrupper","back":"Risiko for varslings­saker"},
     {"id":"c6","front":"Endrings­oppsigelser uten drøfting","back":"§ 15-1 brutt — usaklig oppsigelse"},
     {"id":"c7","front":"Ingen evaluering etter 6 mnd","back":"IK-f § 5 nr. 8 brutt"},
     {"id":"c8","front":"Engasjement faller ved måling","back":"Korriger tiltak, ikke ignorer; legg fram i AMU"}
   ]}},

  {"id":"m6","title":"Video-transkript — Forsvarlig omstilling (5 min)","order":6,"kind":"text","durationMinutes":5,
   "lawRefs":["AML § 4-1","AML § 4-2","AML § 8-1","IK-f § 5"],
   "content":{"kind":"text","body":"<p><em>Voice-over-transkript.</em></p><p><strong>[00:00–00:30]</strong> Omstilling er den vanligste utløseren av langtids­fravær, varsel og rettssak. Og den er forebyggbar — hvis du kartlegger.</p><p><strong>[00:30–01:30] FØR.</strong> Mål baseline. Identifiser risikogrupper: småbarnsforeldre, pendlere, ansatte med tilrettelegging. Drøft med tillitsvalgte (§ 8-1) og verneombud (§ 6-2) <em>før</em> beslutning.</p><p><strong>[01:30–02:30] UNDER.</strong> Pulsmålinger månedlig — 4–6 items om informasjons­tilgang, medvirkning, belastning, mestring. Anonymt, terskel 5. Tall som faller — korriger umiddelbart.</p><p><strong>[02:30–03:30] ETTER.</strong> Målinger 3 og 6 mnd etter. Sammenlign baseline. Fortell ledelsen og AMU om funn.</p><p><strong>[03:30–04:30] Dokumentasjon.</strong> Drøftings­protokoll, ROS, måleresultater, tiltaksplan — alt skriftlig. Eneste måten å vise Tilsynet at endringen var forsvarlig.</p><p><strong>[04:30–05:00] Avslutning.</strong> Kartlegg, lytt, korriger.</p>"}},

  {"id":"m7","title":"OJT — Lag endrings­plan med VO-konsultasjon","order":7,"kind":"on_job","durationMinutes":45,
   "lawRefs":["AML § 4-1","AML § 4-2","AML § 8-1","AML § 7-2 g"],
   "content":{"kind":"on_job","tasks":[
     {"id":"t1","title":"Skriv 1-sides endrings­begrunnelse","description":"Hva, hvorfor, hvem. Bevis: PDF. Signatur: selv."},
     {"id":"t2","title":"Innkall drøftings­møte med tillitsvalgte","description":"Bevis: innkalling. Signatur: tillitsvalgt."},
     {"id":"t3","title":"Innkall verneombud til HMS-konsekvens­vurdering","description":"Bevis: innkalling. Signatur: verneombud."},
     {"id":"t4","title":"Baseline-survey (4–6 items, anonym)","description":"Bevis: survey-id. Signatur: selv."},
     {"id":"t5","title":"Skriv tiltaksplan per risikogruppe","description":"Bevis: plan. Signatur: verneombud."},
     {"id":"t6","title":"Legg planen for AMU","description":"Bevis: sakspapir. Signatur: AMU-leder."}
   ]}},

  {"id":"m8","title":"Sluttquiz","order":8,"kind":"quiz","durationMinutes":8,
   "content":{"kind":"quiz","questions":[
     {"id":"q1","question":"§ 8-1 informasjons- og drøftings­plikt fra hvor mange ansatte?","options":["10","30","50","100"],"correctIndex":2},
     {"id":"q2","question":"§ 4-2 (3) krever medvirkning ved …","options":["All endring","Endring av vesentlig betydning for arbeids­miljøet","Bare HR-endring","Bare struktur"],"correctIndex":1},
     {"id":"q3","question":"Endrings­kartlegging — anbefalt frekvens under omstilling?","options":["Engangs","Månedlig puls","Årlig","Bare etter"],"correctIndex":1},
     {"id":"q4","question":"AMU skal behandle endrings­planer fordi …","options":["§ 7-2 g","§ 7-3","§ 4-1","§ 8-2"],"correctIndex":0},
     {"id":"q5","question":"Drøfting før beslutning kreves …","options":["etter at beslutning er tatt","på et tidspunkt der utfall kan påvirkes","bare hvis parter krever","aldri"],"correctIndex":1},
     {"id":"q6","question":"Endrings­oppsigelse uten drøfting kan medføre …","options":["ingenting","usaklig oppsigelse + erstatning","bare advarsel","bare gjenansettelse"],"correctIndex":1},
     {"id":"q7","question":"Anonymitets­terskel for endrings­survey?","options":["Ingen","Minst 5 per gruppe","Minst 10","Minst 20"],"correctIndex":1},
     {"id":"q8","question":"Etter­måling skal gjennomføres minst …","options":["1 mnd etter","3 og 6 mnd etter","12 mnd etter","aldri"],"correctIndex":1}
   ]}}
]
$jsonb$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title, description = excluded.description, modules = excluded.modules;

-- ── 11. Lov­referanser på system­kurs ─────────────────────────────────────
--
-- `learning_courses.law_refs` ble lagt til i 20260828120038 men ble ikke
-- speilet på system­katalogen. Vi legger til samme kolonne med samme shape
-- (jsonb-array av kanoniske kodestrenger) for at fork-flowen og
-- compliance-planneren kan lese lovref direkte fra system­raden uten å gå
-- via modulen-JSON.

alter table public.learning_system_courses
  add column if not exists law_refs jsonb not null default '[]'::jsonb;

comment on column public.learning_system_courses.law_refs is
  'Array of canonical law-reference codes for the system-catalog course. Mirrors learning_courses.law_refs shape; populated for AML baseline so compliance-planner can read directly from the catalog row.';

update public.learning_system_courses set law_refs = '["AML § 2-1","AML § 3-1","AML § 3-5","AML § 4-3","AML § 4-6","AML § 6-1","AML § 7-1","AML § 14-12","AML § 18-10","AML § 19-1","IK-f § 5"]'::jsonb
  where id = 'c-40-timers-hms';
update public.learning_system_courses set law_refs = '["AML § 3-3","AML § 6-1","AML § 6-2","AML § 6-3","AML § 6-5","AML § 4-3","FOLM § 3-18"]'::jsonb
  where id = 'c-verneombud-40t';
update public.learning_system_courses set law_refs = '["AML § 7-1","AML § 7-2","AML § 7-3","AML § 7-4","AML § 14-12"]'::jsonb
  where id = 'c-amu-grunnopplaering';
update public.learning_system_courses set law_refs = '["AML § 2-3","AML § 3-2","AML § 4-1","AML § 4-2","AML § 4-3","AML § 5-3","AML kap. 2A"]'::jsonb
  where id = 'c-aml-arbeidstaker';
update public.learning_system_courses set law_refs = '["AML § 3-2","AML § 4-4","AML § 4-5","Forskrift om utførelse av arbeid","Forskrift om maskiner"]'::jsonb
  where id = 'c-aml-arbeidstaker-industri';
update public.learning_system_courses set law_refs = '["AML § 3-2","AML § 4-3","AML § 4-4","AML kap. 10","Helsepersonellloven","Smittevernloven"]'::jsonb
  where id = 'c-aml-arbeidstaker-helse';
update public.learning_system_courses set law_refs = '["AML § 3-2","AML § 4-1","AML § 4-4","AML § 4-5","Byggherre-forskriften","Forskrift om HMS-kort"]'::jsonb
  where id = 'c-aml-arbeidstaker-bygg';
update public.learning_system_courses set law_refs = '["AML § 2-1","AML § 3-1","AML § 3-2","AML § 4-3","AML § 4-6","AML § 6-2","AML § 8-1","AML kap. 2A","AML § 13-1","AML § 19-1"]'::jsonb
  where id = 'c-aml-ledere';
update public.learning_system_courses set law_refs = '["AML § 13-1","AML § 13-2","AML § 13-7","LDL § 26","LDL § 26 a"]'::jsonb
  where id = 'c-aml-13-likestilling';
update public.learning_system_courses set law_refs = '["AML § 4-1","AML § 4-2","AML § 7-2","AML § 8-1","AML § 15-1","IK-f § 5"]'::jsonb
  where id = 'c-aml-endring';
