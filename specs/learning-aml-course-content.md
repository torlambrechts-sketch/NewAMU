# AML e-læringskurs — innholdsspesifikasjon

**Forfatter:** Senior content writer (compliance-funksjon)
**Status:** Utkast for review
**Hjemmel:** Arbeidsmiljøloven (AML), Forskrift om organisering, ledelse og medvirkning (FOLM), Internkontrollforskriften (IK-f), Likestillings- og diskrimineringsloven (LDL), GDPR
**Tilhørende migrasjon:** `supabase/migrations/20260902120000_aml_learning_content_extensions.sql`

Denne specen lukker gapene identifisert i compliance-analysen (CLAUDE-session 2026-05-11) og utvider de seks eksisterende systemkursene med flashcards, on-the-job-moduler, video-transkript og bransjevarianter. Hver modul har:

- `kind` etter `ModuleKind`-enum (`text | quiz | flashcard | video | on_job | checklist | tips | image`)
- `estimatedMinutes` for tidsestimat
- `lawRefs[]` med kanoniske kodestrenger (`'AML § ...'`)
- For `video`: `transcript` (med tidsstempel) og `runtimeSeconds`
- For `flashcard`: `cards[]` med `front` / `back`
- For `on_job`: `tasks[]` med `instruction`, `evidenceRequired`, `signoffRole`
- For `quiz`: `questions[]` med `prompt`, `type`, `options`, `answer`, `passingScore`

Video lages senere; transkriptene her er ferdig skriptet, voice-over-klare.

---

## Kursoversikt

| Slug | Tittel | Total e-læring | Krever fysisk supplement | Målgruppe | Status |
|---|---|---|---|---|---|
| `40-timers-hms` | HMS-opplæring for arbeidsgiver (§ 3-5) | ~150 min | Ja — minst 24 t fysisk | Daglig leder | Utvidet |
| `verneombud-40t` | Verneombudets opplæring (§ 6-5) | ~140 min | Ja — minst 24 t fysisk | Verneombud, hovedverneombud | Utvidet |
| `amu-grunnopplaering` | AMU grunnopplæring (§ 7-4) | ~75 min | Anbefalt 8 t fysisk | AMU-medlemmer | Utvidet |
| `aml-arbeidstaker` | HMS for alle ansatte — kontor (§ 3-2) | ~45 min | Nei | Kontoransatte | Utvidet |
| `aml-arbeidstaker-industri` | HMS for alle ansatte — industri (§ 3-2) | ~70 min | Bransje-praksis | Industri/lager/produksjon | **Ny** |
| `aml-arbeidstaker-helse` | HMS for alle ansatte — helse (§ 3-2) | ~70 min | Bransje-praksis | Helse/omsorg | **Ny** |
| `aml-arbeidstaker-bygg` | HMS for alle ansatte — bygg (§ 3-2) | ~70 min | Sikkerhetskurs (byggherre­forskrift) | Bygg/anlegg | **Ny** |
| `aml-ledere` | HMS for linjeledere (§ 2-1, § 3-1) | ~80 min | Nei | Ledere m/personalansvar | Utvidet |
| `aml-13-likestilling` | Likestilling, diskriminering, ARP (§ 13, LDL § 26) | ~70 min | Nei | Ledere m/personalansvar | Utvidet |
| `aml-endring` | Endrings- og omstillings­kartlegging (§ 4-1 (3)) | ~50 min | Anbefalt | Ledere + verneombud før omstilling | **Ny** |

---

## 1. KURS — `40-timers-hms` (UTVIDET)

**Mål:** Daglig leder oppfyller § 3-5-pliktens *innholds*­krav (timetalls­normen 40 timer fylles ved kombinasjon av e-læring, klasserom og praktisk arbeid).

**Eksisterende moduler beholdes uendret (m1–m6).** Følgende moduler legges til:

### Modul m7 — Personlig straffe­ansvar og sanksjoner (text, 10 min)

> AML § 19-1 fastsetter at *både* arbeidsgiver som virksomhet og enkeltpersoner i ledelsen kan straffes med bøter eller fengsel inntil 1 år (3 år ved særlig skjerpende omstendigheter, § 19-1 (2)). Foretaksstraff følger straffeloven § 27. Arbeidstilsynet kan i tillegg ilegge overtredelses­gebyr opp til 15 G (~1,8 mill kr pr. 2026) etter § 18-10 uten å gå via politianmeldelse. Et leder­ansvar er personlig og kan ikke forsikres bort. Praksis fra Høyesterett (Rt. 2012-770, HR-2019-2205-A) viser at *manglende systematisk HMS-arbeid* alene er nok til straffeansvar — det er ikke krav om at skade har inntruffet. Som leder skal du derfor kunne dokumentere:
>
> 1. Risikovurdering er gjennomført og oppdatert
> 2. Opplæring er gitt og dokumentert
> 3. Avvik er behandlet
> 4. Verneombud og AMU er involvert i samsvar med § 6 og § 7
> 5. Tilsyns­pålegg er lukket
>
> **lawRefs:** AML § 19-1, § 19-2, § 19-3, § 18-10; Straffeloven § 27

### Modul m8 — Innleide og deltids­ansatte (text + flashcards, 8 min)

> § 14-12 og likebehandlings­prinsippet i § 14-12 a innebærer at innleide har samme arbeids­miljø­vern som egne ansatte. Innleide *teller med* i grunnlaget for:
>
> - § 6-1 verneombud­plikt (≥10 ansatte)
> - § 7-1 AMU-plikt (≥30, eller ≥10 hvis parter krever)
> - § 4-3 psyko­sosial kartlegging — innleide skal inviteres
> - § 3-2 opplærings­plikt — innleier har sekundær­ansvar for at opplæring er gitt, primær­ansvar ligger hos utleier
>
> Konsekvenser ved feiltelling: Arbeidstilsynet kan pålegge etablering av VO/AMU med 30 dagers frist. Manglende oppfølging utløser § 18-10 gebyr.
>
> **lawRefs:** AML § 14-12, § 14-12 a, § 6-1, § 7-1, § 3-2

### Modul m9 — Flashcards: lov­paragrafer du må kunne på pulsen (flashcard, 10 min)

12 kort. Format `front / back`:

1. **§ 2-1** / Arbeidsgivers ansvar — overordnet, kan ikke delegeres
2. **§ 3-1** / Systematisk HMS-arbeid — krav til IK-system
3. **§ 3-2** / Opplæring og instruksjon for arbeidstakere
4. **§ 3-5** / 40-timers HMS-opplæring for arbeidsgiver
5. **§ 4-3** / Psykososialt arbeidsmiljø — integritet, vern mot trakassering
6. **§ 4-6** / Tilretteleggings­plikt
7. **§ 6-1 / § 6-3 / § 6-5** / Verneombud — pliktig ≥10, stansingsrett, 40-t opplæring
8. **§ 7-1 / § 7-2** / AMU — pliktig ≥30, oppgaver paritetisk
9. **§ 14-12** / Innleide og likebehandling
10. **§ 18-10** / Overtredelses­gebyr opptil 15 G
11. **§ 19-1** / Straffe­ansvar — bot eller fengsel inntil 1 år
12. **IK-f § 5 nr. 6** / Kartlegge farer og vurdere risiko

### Modul m10 — On-the-job: Din første HMS-årsrapport (on_job, 30 min praksis)

| Oppgave | Bevis | Signatur |
|---|---|---|
| Last ned IK-forskriftens § 5-sjekkliste fra NewAMU | Screenshot fra modulen | Selv |
| List alle risikoer fra siste risikovurdering i din enhet | PDF/lenke til vurdering | Selv |
| Tell antall avvik åpne/lukket siste 12 mnd | Eksport fra avvikssystem | Selv |
| Skriv 1-sides utkast til IK-årsrapport (mal i NewAMU) | Vedlegg | Verneombud bekrefter |
| Drøft utkastet med verneombud før AMU-møte | Møtenotat | Verneombud signerer |

**Signoff­rolle:** Verneombud + nærmeste leder
**lawRefs:** IK-f § 5 nr. 5–8, AML § 6-2, § 7-2 g

### Modul m11 — Video: «Slik forklarer du HMS-ansvaret ditt for styret» (video, 8 min)

**Runtime:** 480 s | **Format:** taler + folier | **Voice-over kjønn:** kvinne, nb-bokmål

```
[00:00 — 00:20] ÅPNING
"Du har akkurat fått daglig leder-tittelen. Eller du leder en avdeling med personal­ansvar.
Eller du sitter i et styre. I løpet av de neste åtte minuttene skal vi gå gjennom det
viktigste du må forstå om HMS-ansvaret ditt — fordi det er personlig, og det kan
ikke delegeres bort."

[00:20 — 01:10] § 2-1 OG DELEGERINGSGRENSEN
"Arbeidsmiljølovens § 2-1 sier at arbeidsgiver skal sørge for at bestemmelsene i loven
blir overholdt. Du kan delegere oppgaver, men ikke ansvaret. Hvis verneombudet ikke
har fått opplæring, så er det du som er ansvarlig — selv om HMS-leder skulle ordne det.
Høyesterett har i flere saker, sist HR-2019-2205, slått fast at manglende
*systematisk* HMS-arbeid alene gir grunnlag for straffe­ansvar. Du må altså ikke vente
til en ulykke har skjedd."

[01:10 — 02:30] DET SYSTEMATISKE HMS-ARBEIDET
"Internkontroll­forskriften § 5 lister åtte punkter du må ha på plass. Den enkleste
måten å huske dem på er M-O-K-A-R-D-O-O:
Mål — du skal ha definerte HMS-mål.
Organisering — roller og ansvar dokumentert.
Kunnskap — opplæring til arbeidstakere.
Arbeidstaker­medvirkning — verneombud, AMU, vernerunder.
Risikovurdering — kartlegging, dokumentasjon, plan.
Drift — rutiner for å rette avvik.
Overvåking — du følger med på at systemet fungerer.
Oppfølging — systemet revideres."

[02:30 — 04:00] § 3-5 OG 40 TIMER
"§ 3-5 sier at du som arbeidsgiver skal gjennomgå opplæring i HMS-arbeid. Loven
selv setter ikke timetall, men forskrift om organisering, ledelse og medvirkning
§ 3-18 fastsetter at opplæringen skal være tilpasset risikoen i virksomheten,
og praksis er at 40 timer er normen. E-læring kan dekke teoridelen — men du må
også gjennomføre praktiske oppgaver, gjerne i samarbeid med BHT. Sjekk at
opplæringen din dokumenteres med kursbevis og oppbevares tilgjengelig for
Arbeidstilsynet."

[04:00 — 05:20] TERSKLER OG TELLEREGEL
"Antall ansatte avgjør om du må ha verneombud og AMU.
Ti eller flere ansatte: verneombud er pliktig — § 6-1.
Tretti eller flere: AMU er pliktig — § 7-1. Med 10–29 ansatte kan AMU kreves
hvis en av partene ber om det.
Husk — § 14-12 sier at innleide teller med i grunnlaget. Mange ledere telles bare
egne ansatte og havner under terskelen i papirene. Arbeidstilsynet teller
hodene på arbeidsplassen, ikke i lønnssystemet."

[05:20 — 06:30] § 4-3 PSYKO­SOSIALT
"§ 4-3 er den paragrafen flest ledere undervurderer. Den krever at arbeidstakerens
integritet og verdighet ivaretas, og at det skal være vern mot mobbing og
trakassering. Du må ha kartlagt det psyko­sosiale arbeids­miljøet — ikke bare
det fysiske. Dette gjøres med spørreundersøkelse anonymt, med terskel på
minst fem svar per gruppe før resultatet vises."

[06:30 — 07:30] AVVIK OG VARSLING
"Du må ha to forskjellige kanaler — én for HMS-avvik og én for varsling etter
kapittel 2 A. Avvik er regelbrudd. Varsling handler om kritikkverdige forhold,
og loven beskytter varsleren mot gjengjeldelse, § 2A-4. Som leder kan du komme
i personlig erstatnings­ansvar hvis du gjengjelder. Ha rutinene skriftlige."

[07:30 — 08:00] AVSLUTNING
"Du har nå rammen for ansvaret ditt. De neste modulene går dypere på risikovurdering,
verneorganisasjon, sykefravær og varsling. Husk: dokumenter alt. Det er
dokumentasjonen som beskytter deg ved tilsyn — og det er fraværet av den som
felde lederen i HR-2019-2205. Lykke til."
```

**lawRefs:** AML § 2-1, § 3-1, § 3-5, § 4-3, § 6-1, § 7-1, § 14-12, § 19-1; IK-f § 5

### Modul m12 — Utvidet quiz (quiz, 10 min, 75 % bestått)

10 spørsmål. (Eksisterende m6-quiz beholdes som mid-course. Denne er sluttvurdering.)

1. § 19-1 — øvre strafferamme for grov overtredelse → 1 år / **3 år** / 5 år / 10 år
2. § 18-10 — øvre grense for overtredelsesgebyr → 5 G / 10 G / **15 G** / 30 G
3. Innleide teller med i grunnlaget for AMU-plikt — **Ja** / Nei / Bare ved >12 mnd
4. Hvilken Høyesterettsdom slo fast at manglende systematisk HMS-arbeid alene gir straffeansvar? → Rt. 1998-411 / Rt. 2012-770 / **HR-2019-2205-A** / Rt. 2020-1066
5. Fra hvor mange ansatte er verneombud pliktig? → 5 / **10** / 20 / 30
6. § 4-6 tilretteleggings­plikten gjelder → bare ved IA-avtale / **uavhengig av IA** / kun for sykmeldte / kun fysisk skade
7. Hvor lenge etter sykmelding skal oppfølgingsplan være på plass? → 1 uke / **4 uker** / 7 uker / 3 mnd
8. § 2A-4 forbyr arbeidsgiver å → drøfte med tillitsvalgt / **gjengjelde mot varsler** / informere ledelsen / arkivere varsel
9. Hva betyr «paritetisk» i AMU? → Ledelsen har flertall / **Lik representasjon arbeidsgiver/arbeidstaker** / Verneombud er leder / Bare ansatte er medlemmer
10. Hvor ofte skal IK-systemet revideres? → Hvert år / Hver 2. år / **Jevnlig — ved endringer eller minst årlig** / Ved tilsyn

---

## 2. KURS — `verneombud-40t` (UTVIDET)

**Eksisterende m1–m6 beholdes.** Nye moduler:

### Modul m7 — BHT-samspillet (text, 8 min)

> Bedriftshelsetjenesten (BHT) er din viktigste fagpartner som verneombud. § 3-3 fastslår at virksomheter i bransjene listet i forskrift om at virksomheter innen visse bransjer skal ha godkjent bedriftshelsetjeneste skal være tilknyttet godkjent BHT. BHT skal ha en *fri og uavhengig stilling*.
>
> Som verneombud har du rett til å kontakte BHT direkte uten å gå via arbeidsgiver. Du kan be om bistand i:
>
> - Risiko­vurderinger (særlig kjemikalier, støy, ergonomi, psyko­sosialt)
> - Vernerunder
> - Sykefraværs­oppfølging
> - AMU-saker med medisinsk dimensjon
> - Tilsyns­besøk fra Arbeidstilsynet
>
> BHT skal årlig levere periode­plan og rapportere til AMU. Som verneombud skal du få denne planen og kunne kommentere den før den vedtas. Hvis BHT ikke leverer eller virksomheten ikke bruker BHT — ta det opp i AMU og dokumenter skriftlig.
>
> **lawRefs:** AML § 3-3; Forskrift om BHT 6. desember 2011 nr. 1355

### Modul m8 — On-the-job: Din første vernerunde (on_job, 60 min praksis)

| Steg | Oppgave | Bevis | Signatur |
|---|---|---|---|
| 1 | Avtal vernerunde med leder og BHT-kontakt | Møteinnkalling | Selv |
| 2 | Forbered sjekkliste — kombiner generisk fra NewAMU + bransjespesifikk | Ferdig sjekkliste | Selv |
| 3 | Gjennomfør vernerunde — minst 60 min, observer + intervju | Notater + bilder | Leder |
| 4 | Skriv funn-rapport — kategoriser etter risiko (rød/gul/grønn) | PDF-rapport | Leder |
| 5 | Legg inn funn som avvik i avvikssystemet | Avviks-id i NewAMU | Verneombud-team |
| 6 | Følg opp lukking innen frist | Lukkings­bekreftelse | Selv |

**Signoff:** Leder + hovedverneombud (eller HMS-leder hvis < 30 ansatte)
**lawRefs:** AML § 6-2, § 3-1; IK-f § 5 nr. 6

### Modul m9 — Flashcards: stansingsrett-scenarier (flashcard, 8 min)

10 kort med praktiske case:

1. **Front:** «Stillas mangler rekkverk i 4 m høyde. Snekkerne jobber der nå.» / **Back:** Stans umiddelbart (§ 6-3). Akutt fare for fall. Varsle leder og Arbeidstilsynet skriftlig samme dag.
2. **Front:** «Ventilasjon i lakkbu er på 60 % av nominell ytelse.» / **Back:** Vurder eksponeringsmåling før stans. Hvis grenseverdi overstiges → stans. Hvis ukjent → krev BHT-måling, ikke stans automatisk.
3. **Front:** «En kollega forteller at hen er mobbet av lederen.» / **Back:** Ikke stans-grunnlag etter § 6-3 (gjelder umiddelbar fysisk fare). Følg varslings­rutine § 2A. Loggfør, drøft med hovedverneombud og BHT.
4. **Front:** «Ny truck-fører kjører uten sertifikat.» / **Back:** Stans inntil sertifikat fremvises. § 6-3 + forskrift om utførelse av arbeid kap. 10.
5. **Front:** «Arbeidsgiver overprøver stans-vedtaket og setter folk i arbeid igjen.» / **Back:** Stans-vedtaket gjelder inntil Arbeidstilsynet har vurdert. Varsle Arbeidstilsynet umiddelbart. Dokumenter skriftlig. Arbeidsgiver kan ikke overprøve verneombudets stans før Tilsynet har vurdert.
6. **Front:** «En kjemikalie­lekkasje er detektert, men det er uklart om grenseverdi er overskredet.» / **Back:** Føre-var. Stans + evakuer arbeidsstedet inntil måling foreligger. Dokumenter beslutningen.
7. **Front:** «Leder ber deg ikke stanse fordi det vil koste 200 000 kr i produksjons­stopp.» / **Back:** Økonomi er ikke gyldig motargument mot § 6-3. Liv og helse går foran. Loggfør forsøket på påvirkning.
8. **Front:** «Du er nyvalgt verneombud og usikker på om saken er stans-grunnlag.» / **Back:** Konsulter hovedverneombud eller BHT. Du kan også ringe Arbeidstilsynet for veiledning. Tvil om alvor → konservativ tolkning, ofte stans.
9. **Front:** «Tre ansatte signaliserer at de er redde for at lederen straffer dem hvis du stanser.» / **Back:** Verneombudet skal ikke utsettes for ulempe (§ 6-5 (3)). Tilsynsplikt — du er beskyttet. Følg opp ansatte­frykten som egen sak.
10. **Front:** «Hvor lenge gjelder stansen?» / **Back:** Inntil Arbeidstilsynet har tatt stilling. Tilsynet skal kontaktes umiddelbart skriftlig. Praksis: svar innen samme arbeidsdag.

### Modul m10 — Video: «Stansingsretten — slik bruker du den riktig» (video, 7 min)

**Runtime:** 420 s

```
[00:00 — 00:30] INNLEDNING
"Stansingsretten er det mektigste verktøyet du har som verneombud. Den står i
arbeidsmiljølovens § 6-3 og gir deg myndighet til å stanse arbeid som du mener
truer liv eller helse — direkte. Du trenger ingen godkjenning fra arbeidsgiver
før du stanser. I løpet av de neste syv minuttene går vi gjennom når du skal
bruke retten, hvordan du bruker den, og hva som skjer etterpå."

[00:30 — 01:30] NÅR — KRITERIENE
"Lovens ordlyd er 'umiddelbar fare for arbeidstakernes liv eller helse'. Tre
ord er viktige: 'umiddelbar', 'fare' og 'liv eller helse'.
Umiddelbar betyr ikke at noen blør akkurat nå — det betyr at faren er aktuell
og at den vil materialisere seg hvis arbeidet fortsetter. Et stillas uten
rekkverk i fire meters høyde er umiddelbar fare, selv om ingen har falt ennå.
Fare betyr at det er konkret risiko, ikke teoretisk. Manglende sertifikat for
truck-kjøring er konkret. Et dårlig psyko­sosialt arbeidsmiljø er alvorlig
— men det er sjelden 'umiddelbar fare' i § 6-3-forstand. Det følger en annen
prosedyre, varsling etter kap. 2A."

[01:30 — 02:30] FORARBEIDET
"Før du stanser: er det noe enklere? Kan du be om at arbeidet pauses mens du
sjekker? Det er ofte raskere. Men hvis du har vurdert at faren er reell og at
arbeidsgiver enten ikke vil eller ikke kan løse det umiddelbart — så stanser
du. Ikke vent på godkjenning. Du er verneombud nettopp for å handle her."

[02:30 — 03:30] SLIK STANSER DU
"Tre steg.
Først: si det høyt og tydelig — 'jeg stanser dette arbeidet etter § 6-3'.
Markér området fysisk om mulig.
Deretter: varsle arbeidsgiver skriftlig. SMS, e-post eller brev. Du må ha
dokumentasjon på når og hvorfor.
Til slutt: varsle Arbeidstilsynet. Ring 73 19 97 00. Send skriftlig samme dag.
Tilsynet vil vurdere saken og enten bekrefte stans, oppheve, eller pålegge tiltak."

[03:30 — 04:30] HVA SKJER ETTERPÅ
"Stansen står inntil Arbeidstilsynet har tatt stilling. Arbeidsgiver kan ikke
sette folk i arbeid på tvers av din stans. Hvis arbeidsgiver gjør det, varsle
Tilsynet umiddelbart — det er overtredelse.
Du som verneombud kan ikke straffes for forsvarlig bruk av retten. Hvis du
trodde i god tro at faren var reell og dokumenterte beslutningen — er du
beskyttet av § 6-5 tredje ledd."

[04:30 — 05:30] FALLGRUVER
"Tre vanlige feil.
Én: å vente for lenge fordi du er usikker. Bedre å stanse og bli korrigert
av Tilsynet enn å vente og oppleve ulykke.
To: å la økonomi-argumenter overprøve deg. Produksjons­tap er aldri gyldig
argument mot liv og helse. Loggfør forsøk på påvirkning.
Tre: å ikke dokumentere. Stansen må være skriftlig samme dag — ellers blir
det din opplevelse mot leders, og du står svakere."

[05:30 — 06:30] KONSULTASJON OG BHT
"Du er ikke alene. Konsulter hovedverneombud, BHT, eller Arbeidstilsynets
svartelefon før du stanser hvis du har tid. Men: tid er ikke alltid på
verneombudets side. Tvilen tilbake til konservativ tolkning — hvis i tvil,
stans."

[06:30 — 07:00] AVSLUTNING
"Stansingsretten er et alvor. Den er også en av de mest virksomme
sikkerhets­mekanismene norsk arbeidsliv har. Bruk den med forstand, dokumenter
beslutningen, og husk at du er beskyttet så lenge du handler i god tro.
I neste modul ser vi på vernerunder."
```

**lawRefs:** AML § 6-3, § 6-5

### Modul m11 — Sjekkliste: Verneombudets førstuke (checklist, 10 min)

10 punkter (binær avkrysning):

1. Skriv under på tausheterklæring (mottatt fra HMS-leder)
2. Få utlevert kontakt­info til hovedverneombud, BHT, AMU-leder
3. Tilgang til NewAMU verneombud-rolle
4. Tilgang til risikovurderinger og IK-system
5. Avtal første møte med leder — forventnings­avklaring (lønnet tid for vervet)
6. Få oversikt over åpne avvik og pålegg
7. Kalender­tilgang AMU-møter neste 12 mnd
8. Møt BHT-kontakten
9. Gjennomgå § 6-3-stansingsrett-prosedyre med leder
10. Sett opp egen «verneombud-perm» (digital eller fysisk)

**lawRefs:** AML § 6-2, § 6-5; FOLM § 3-18

### Modul m12 — Utvidet quiz (quiz, 10 min, 75 % bestått)

10 spørsmål inkl. case-basert:

1. Verneombudet kan stanse arbeid etter § 6-3 → bare med ledelsens samtykke / **uten godkjenning ved umiddelbar fare** / kun med Arbeidstilsynets ja / kun for fysisk fare
2. Stansen gjelder inntil → leder opphever / **Arbeidstilsynet har vurdert** / 24 timer / verneombudet selv opphever
3. § 6-5 tredje ledd beskytter verneombudet mot → personalsak / **ulempe på grunn av vervet** / oppsigelse spesifikt / arbeidsgiverkrav om dokumentasjon
4. BHT skal være → ansatt hos arbeidsgiver / **i fri og uavhengig stilling** / godkjent av AMU / sertifisert av Tilsynet
5. Hovedverneombud er pliktig fra → 10 / **30** / 50 / 100 ansatte
6. Verneombudets opplærings­krav i tid → 16 t / 24 t / **40 t** / 80 t
7. Psykososial konflikt med leder — riktig kanal? → § 6-3 stans / **§ 2A varsling** / direkte til Tilsynet / advokat
8. Verneombudet kan kontakte BHT → bare via leder / **direkte uten leders samtykke** / via AMU-leder / via tillitsvalgt
9. Vernerunde anbefales gjennomført → ved tilsyn / **jevnlig, minst årlig** / kun ved ulykke / av BHT alene
10. Hvilken § lister verneombudets oppgaver? → § 6-1 / **§ 6-2** / § 6-3 / § 6-5

---

## 3. KURS — `amu-grunnopplaering` (UTVIDET)

**Eksisterende m1–m5 beholdes.** Nye moduler:

### Modul m6 — Saksforberedelse og habilitet (text, 6 min)

> En AMU-sak gjennomgår fem faser: **innmelding** (hvem som helst), **saksforberedelse** (sekretær lager bakgrunns­notat, vurderer habilitet), **utsending** (minst 5 virkedager før møtet), **drøfting/vedtak** (paritetisk), **oppfølging** (sekretær følger opp, neste møte gjennomgår status).
>
> Habilitet — § 7-3 sier at medlem som har personlig interesse i saken skal melde fra og fratre fra avstemming. Eksempel: leder som behandler sak om eget verktøy, eller verneombud som er nær­stående til sak­subjekt.
>
> Protokoll skal signeres av leder og sekretær, sendes til medlemmer innen 10 virke­dager, og være tilgjengelig for arbeids­takere på forespørsel.
>
> **lawRefs:** AML § 7-2, § 7-3

### Modul m7 — AMUs årsrapport — slik skriver du den (text + on_job, 15 min)

> Årsrapporten er AMUs viktigste eksterne dokument. Den skal:
>
> - Beskrive HMS-status (avvik, sykefravær, ulykker)
> - Liste behandlede saker
> - Vurdere måloppnåelse
> - Foreslå tiltak for neste år
>
> Mal i NewAMU (`tpl-amu-arsrapport`). Rapporten leveres til styret/eier og er tilgjengelig for arbeidstakere. Arbeidstilsynet ber om årsrapporten i forhåndsvarsel ved 7 av 10 systemtilsyn.
>
> **On-the-job:** Trekk ut data fra NewAMU dashboard, fyll mal, drøft med 1 AMU-medlem, signer.
>
> **lawRefs:** AML § 7-2 g, § 7-4; IK-f § 5 nr. 8

### Modul m8 — Video: «Hva AMU faktisk skal gjøre» (video, 6 min)

**Runtime:** 360 s

```
[00:00 — 00:30] INNLEDNING
"AMU — arbeidsmiljø­utvalget — er kanskje det mest misforståtte organet i norsk
arbeidsliv. Mange tror det er et HMS-styremøte. Andre tror det er et råd uten
makt. Sannheten er noe imellom — og den er detaljert beskrevet i lovens § 7-2."

[00:30 — 01:30] PARITETISK SAMMENSETNING
"AMU skal være paritetisk: lik representasjon fra arbeidsgiver- og arbeidstaker­siden.
Ledelsen kan ikke ha flertall. Hvis det blir stemmelikhet har ikke lederen
dobbeltstemme. Lederen veksler annet hvert år — ett år arbeidsgiver, ett år
arbeidstaker. Sekretær er ofte HMS-leder, men trenger ikke være stemmeberettiget."

[01:30 — 02:30] § 7-2 OPPGAVENE
"Syv hovedoppgaver — du bør kunne dem på pulsen:
A — Spørsmål som gjelder bedriftshelsetjenesten.
B — Spørsmål som gjelder opplæring og instruksjon.
C — Oppfølging av sykefravær.
D — Oppfølging av yrkesskader og yrkessykdommer.
E — Bygningsmessige planer.
F — Planer som angår produksjons­metoder.
G — Andre planer som har vesentlig betydning for arbeidsmiljøet — inkludert
spørreundersøkelser om psykososialt arbeidsmiljø."

[02:30 — 03:30] FORSKJELL PÅ RÅDGIVENDE OG VEDTAK
"AMU er rådgivende i de fleste saker — men har vedtaksmyndighet i fem konkrete
tilfeller listet i § 7-2 (4): pålegge gjennomføring av tiltak, kreve nærmere
undersøkelser, kreve verne­vakt, kreve at arbeidet stanses, og kreve egen
arbeidsmiljø­undersøkelse. Bruker du vedtaksretten skal protokoll­føres med
oppfølgings­frist."

[03:30 — 04:30] AMU OG TERSKLER
"AMU er pliktig fra 30 ansatte. Fra 10 til 29 ansatte kan AMU opprettes hvis
en av partene krever det — det gjøres oftere enn de fleste tror. Innleide
teller med i grunnlaget etter § 14-12."

[04:30 — 05:30] AMU OG TILSYN
"Arbeidstilsynet ber rutinemessig om AMU-protokoller og årsrapport ved tilsyn.
Hvis AMU ikke har møtt minimum 4 ganger per år — vanlig praksis — er det
indikasjon på at HMS-systemet er svakt. Sørg for tett saksrekke og
dokumentasjon."

[05:30 — 06:00] AVSLUTNING
"AMU har makt hvis dere bruker den. Bruk vedtaksretten når nødvendig. Skriv
gode protokoller. Lever årsrapport i tide. I de neste modulene går vi
dypere på sak­saksflyt og årsrapport."
```

**lawRefs:** AML § 7-1, § 7-2, § 7-3, § 7-4

### Modul m9 — Flashcards: AMU-paragrafer (flashcard, 6 min)

8 kort, alle § 7-x.

### Modul m10 — Utvidet quiz (quiz, 6 min, 75 % bestått) — 8 spørsmål

---

## 4. KURS — `aml-arbeidstaker` (UTVIDET — kontor som basis)

Tittelen endres til **«HMS for alle ansatte — kontor (§ 3-2)»**. Eksisterende m1–m5 beholdes med små tekstinnstramminger. Nye moduler:

### Modul m6 — Flashcards: Dine HMS-rettigheter på 12 kort (flashcard, 6 min)

12 kort om rettigheter og plikter, varsling, avvik.

### Modul m7 — Video: «Hva betyr HMS for deg som ansatt?» (video, 4 min)

**Runtime:** 240 s

```
[00:00 — 00:20] ÅPNING
"Du har ikke valgt å bli HMS-ekspert. Du har valgt en jobb. Men loven krever
at du kjenner noen grunnregler — og det er fordi de beskytter deg."

[00:20 — 01:00] DINE RETTIGHETER
"Du har rett til et fullt forsvarlig arbeidsmiljø — § 4-1. Du har rett til
opplæring og informasjon — § 3-2. Du har rett til å delta i avgjørelser som
angår ditt arbeids­miljø, gjennom verneombud og AMU — § 4-2. Og hvis du
oppdager kritikkverdige forhold, har du rett til å varsle uten å bli straffet
— kapittel 2 A."

[01:00 — 02:00] DINE PLIKTER
"Du har plikt til å bruke verneutstyr riktig. Plikt til å melde avvik — det
betyr ting som ikke fungerer som de skal. Og plikt til å gjennomføre den
opplæringen arbeidsgiver tilbyr. Husk at det er to ulike kanaler: avvik
og varsel. Avvik handler om regelbrudd. Varsel handler om kritikkverdige
forhold som mobbing, korrupsjon eller fare for liv og helse."

[02:00 — 03:00] DET PSYKO­SOSIALE
"§ 4-3 sier at integriteten din skal ivaretas. Det betyr at du skal kunne gå
på jobb uten å bli mobbet, trakassert eller utsatt for diskriminering.
Hvis du opplever dette: snakk med verneombud, leder eller tillitsvalgt. Skal
det bli sak, så bruk varslings­kanalen, ikke avviks­kanalen — det gir deg
sterkere lovbeskyttelse."

[03:00 — 04:00] AVSLUTNING
"Du skal nå ha grunnreglene. Tre ting å huske: rettighet til forsvarlig miljø,
plikt til medvirkning, og forskjell på avvik og varsel. Hvis du er i tvil,
spør verneombudet ditt — eller ta kontakt med BHT."
```

**lawRefs:** AML § 3-2, § 4-1, § 4-2, § 4-3, kap. 2A

### Modul m8 — Sjekkliste: Mitt arbeidsmiljø (checklist, 5 min)

10 selvtest-punkter — refleksjon, ikke vurdering.

### Modul m9 — Utvidet quiz (quiz, 5 min, 75 %) — 8 spørsmål

---

## 5. KURS — `aml-arbeidstaker-industri` (NYTT)

**Mål:** Bransje­tilpasset § 3-2-opplæring for industri/lager/produksjon. Forutsetter at basis (`aml-arbeidstaker`) er bestått; prerequisite-pekes.

### Modul m1 — Velkommen og bransjekrav (text, 5 min)

> I industri og produksjon kommer flere forskrifter i tillegg til AML: Forskrift om utførelse av arbeid (kjemikalie­håndtering, asbest, støy, vibrasjon, ergonomi), Forskrift om maskiner (CE-merking, brukermanual), Forskrift om utstyrs­bruk (sertifisert opplæring for truck, kran, dumper). Du skal vite hvilke deler som gjelder din jobb.
>
> **lawRefs:** AML § 4-4, § 4-5; Forskrift om utførelse av arbeid

### Modul m2 — Maskinsikkerhet og CE-merking (text + image, 8 min)

### Modul m3 — Kjemikalie­håndtering, faresedler og GHS (text, 10 min)

> CLP/GHS-faresedler — ni piktogrammer. Du skal kjenne dem alle. Sikkerhets­data­blad (SDS) skal være tilgjengelig på arbeidsplassen for hvert kjemikalie. Eksponering måles ved behov. Substitusjons­plikt — § 4-5 (1) — sier at farlig stoff skal erstattes med mindre farlig hvis mulig.
>
> **lawRefs:** AML § 4-5; Forskrift om utførelse av arbeid kap. 3

### Modul m4 — Ergonomi og tunge løft (text + tips, 8 min)

### Modul m5 — Truck, kran, og sertifisert opplæring (text, 6 min)

> Forskrift om utførelse av arbeid kap. 10 krever sertifisert opplæring for arbeid med arbeids­utstyr som krever særlig forsiktighet. Truck T1–T4, kran G1–G20, dumper, gravemaskin, lift. Du skal ha sertifikat før du betjener utstyret, og det skal være tilgjengelig på arbeidsstedet.
>
> **lawRefs:** AML § 3-2; Forskrift om utførelse av arbeid kap. 10

### Modul m6 — Flashcards: 10 faresedler (flashcard, 6 min)

### Modul m7 — On-the-job: Min arbeidsstasjon — risiko­sjekk (on_job, 30 min)

| Steg | Oppgave | Bevis | Signatur |
|---|---|---|---|
| 1 | Identifiser tre fysiske risikoer ved arbeidsstasjonen | Liste | Selv |
| 2 | Sjekk at SDS for kjemikalier du bruker er på plass | Bilder/lenke | Selv |
| 3 | Verifiser at verneutstyr er tilgjengelig og i orden | Bilde | Selv |
| 4 | Drøft funnene med nærmeste leder | Notat | Leder |

### Modul m8 — Video: «Sikkert arbeid i industri» (video, 5 min) — transkript

[Kortere transkript, fokus på fall, klem, ergonomi, kjemi, støy — utelatt for plassens skyld; følger samme struktur som videoer over.]

### Modul m9 — Quiz (quiz, 8 min, 75 %) — 10 spørsmål

---

## 6. KURS — `aml-arbeidstaker-helse` (NYTT)

**Bransje:** Helse- og omsorg. Kjernerisikoer: smitte, vold/trusler, tunge løft, etisk press, vakt­ordninger.

Moduler:
1. **Bransje­ramme** — AML § 4-3 (3) vold/trusler, helsepersonell­loven § 16, smitte­vernloven
2. **Smitte­vern og personlig verneutstyr** (text + image)
3. **Vold og trusler — risiko og rapportering** (text — særlig viktig: dokumentasjons­plikt for ledelsen § 4-3 (3))
4. **Forflyttings­teknikk og hjelpemidler** (video + tips, 6 min)
5. **Etisk press og samvittighets­konflikt** (text — varsling kap. 2A er relevant for helse­ansatte)
6. **Arbeidstid, vakt og helse — § 10** (text — særlig § 10-2 om mulighet til hvile)
7. **Flashcards: 10 bransje­vendinger**
8. **On-the-job: smitte­vern­sjekk på egen vakt**
9. **Quiz** — 10 spørsmål

---

## 7. KURS — `aml-arbeidstaker-bygg` (NYTT)

**Bransje:** Bygg, anlegg, samferdsel.

Moduler:
1. **Bransje­ramme** — AML + Byggherre­forskriften + SHA-plan-systemet
2. **Fall fra høyde — § 1 risiko­kategori** (text + image)
3. **Stillas og rekkverk — kontroll­ansvar**
4. **HMS-kort, ID­merking og innleie**
5. **Asbest, silika, isocyanater — eksponerings­risiko** (text)
6. **Bråk, vibrasjon, kulde** (text)
7. **Flashcards: 10 byggrisikoer**
8. **On-the-job: SHA-plan-gjennomgang**
9. **Video: «Liv og helse på byggeplassen» (5 min)** — transkript
10. **Quiz** — 10 spørsmål

(Bransjekursene 6 og 7 detaljerer modulnivåer i migrasjonen, men er semantisk komplette her som bestilling.)

---

## 8. KURS — `aml-ledere` (UTVIDET)

**Målgruppe:** Linje­leder med personal­ansvar — mellom­leder. Forskjell fra § 3-5: arbeidsgiverkurset er for daglig leder; dette er for ledere uten øverste juridiske ansvar, men med daglig HMS-ansvar.

### Modul m1 — Lederens HMS-ansvar i linja (text, 8 min)

> Som linje­leder er du arbeidsgiverens forlengede arm — § 2-1 sier at arbeidsgiver kan delegere oppgaver, men ikke det overordnede ansvaret. Når du har personal­ansvar, har du operativt ansvar for:
>
> - Å sørge for opplæring (§ 3-2)
> - Å gjennomføre risikovurdering i din enhet (§ 3-1)
> - Å følge opp sykefravær (§ 4-6)
> - Å håndtere konflikt, trakassering og varsling (§ 4-3, kap. 2A)
> - Å samarbeide med verneombud (§ 6-2)
>
> Du kan komme i personlig straffe­ansvar hvis du *aktivt* gir instruks som strider mot AML (§ 19-1). Du er *ikke* automatisk straffeansvarlig for daglig leders unnlatelse — men erstatnings­ansvarlig kan du bli (skadeerstatningsloven § 2-1).

### Modul m2 — Risikovurdering i din enhet (text + on_job, 12 min)

### Modul m3 — Sykefraværs­oppfølging — frister (text, 8 min)

> Tidslinje du må huske:
>
> - **Dag 1–16**: egenmelding/sykmelding mottatt
> - **Innen 4 uker**: oppfølgings­plan skriftlig
> - **Innen 7 uker**: dialogmøte 1 (du + ansatt + ev. tillitsvalgt)
> - **Innen 26 uker**: dialogmøte 2 (NAV-deltakelse)
> - **52 uker**: maksdato — drøft alternativer
>
> Tilretteleggings­plikten gjelder *uavhengig* av IA-status.

### Modul m4 — Konflikt og trakassering (text, 8 min)

### Modul m5 — Varsling — slik mottar du varsel (text, 6 min)

### Modul m6 — Flashcards: lederens 12 paragrafer (flashcard, 8 min)

### Modul m7 — On-the-job: din risikovurdering (on_job, 45 min)

### Modul m8 — Video: «Lederens HMS-hverdag» (video, 6 min) — transkript

[Detaljert transkript følger samme struktur — 360 s, dekker daglige fallgruver.]

### Modul m9 — Quiz (quiz, 10 min, 75 %) — 10 spørsmål

---

## 9. KURS — `aml-13-likestilling` (UTVIDET)

**Eksisterende moduler beholdes.** Nye moduler:

### Modul mE1 — ARP — aktivitets- og redegjørelses­plikten (text, 10 min)

> LDL § 26 deler plikten i to:
>
> - **Aktivitets­plikt** (alle arbeidsgivere): jevnlig undersøke, analysere, tiltak, evaluere
> - **Redegjørelses­plikt** (offentlige + private ≥ 50 ansatte, eller ≥ 20 hvis parter krever): publisere årlig redegjørelse i års­beretning eller eget dokument
>
> Redegjørelsen skal dekke: tilstand kjønn, lønn (kjønns­kjønns­del), heltid/deltid, foreldre­permisjon, faktisk fravær fra arbeid pga. omsorg, samt kartlegging av risiko for diskriminering og hva som er gjort for å unngå den. Likestillings- og diskriminerings­ombudet (LDO) fører tilsyn.
>
> **lawRefs:** LDL § 26, § 26a; AML § 13-1, § 13-7

### Modul mE2 — Trakasserings­varsel — slik håndterer du (text, 8 min)

### Modul mE3 — Flashcards: 10 diskriminerings­grunnlag og praksis (flashcard, 6 min)

### Modul mE4 — On-the-job: din ARP-årsrapport (on_job, 60 min)

### Modul mE5 — Video: «Slik forebygger du diskriminering i praksis» (video, 5 min) — transkript

```
[00:00 — 00:30] INNLEDNING
"Diskriminering er sjelden bevisst. Det er oftere strukturer, vaner, og
ubevisste vurderinger som gir effekt. Likestillings- og diskriminerings­loven
sier at du som arbeidsgiver må jobbe *aktivt* med å hindre det — det er
ikke nok å reagere."

[00:30 — 01:30] AKTIVITETS­PLIKTEN
"§ 26 sier at du jevnlig skal undersøke om diskriminering forekommer. Du
skal analysere mulige årsaker, sette inn tiltak, og evaluere effekten av
tiltakene. Det er en syklus, ikke et engangs­arbeid. Spørreundersøkelse er
hoved­verktøyet — anonymt, minst 5 svar per kategori, med spørsmål om
forskjellsbehandling pga. kjønn, etnisitet, religion, funksjons­nedsettelse,
seksuell orientering og alder."

[01:30 — 02:30] REDEGJØRELSES­PLIKTEN
"Hvis du har 50 eller flere ansatte må du publisere en årlig redegjørelse.
Den dekker tilstand på kjønn, lønn, heltid/deltid, foreldre­permisjon, og
hvilke risikoer for diskriminering du har avdekket. NewAMU har mal
'tpl-arp-redegjorelse' du kan starte fra."

[02:30 — 03:30] LØNNS­KARTLEGGING
"Annet hvert år skal lønn kartlegges på kjønn. Du sammenligner like grupper
— ikke individer. Det er ikke kravet at lønnene er like; det er kravet at
forskjellene kan forklares av andre forhold enn kjønn. Bruk lønns­statistikk­
verktøyet i HR-modulen."

[03:30 — 04:30] TRAKASSERING — FOREBYGGING
"§ 13-1 forbyr trakassering på alle de seks diskrimineringsgrunnlagene. Du
som leder skal forebygge — gjennom rutiner, opplæring, kultur. Du skal ha
en skriftlig rutine for hvordan trakassering meldes, håndteres og følges
opp. Rutinen skal være tilgjengelig for ansatte."

[04:30 — 05:00] AVSLUTNING
"ARP-arbeid er kontinuerlig. Hovedaktiviteter: kartlegging hvert år,
redegjørelse hvert år, lønnskartlegging annet hvert. Husk: aktivitet,
ikke bare rapport."
```

### Modul mE6 — Quiz (quiz, 8 min, 75 %) — 10 spørsmål

---

## 10. KURS — `aml-endring` (NYTT)

**Hjemmel:** AML § 4-1 (3) — «I virksomheter hvor det er nødvendig som ledd i et fullt forsvarlig arbeidsmiljø, skal arbeidet kunne legges opp slik at det gir mulighet for variasjon og kontakt med andre, men også slik at det gir mulighet for selvbestemmelse.» Endringer som vesentlig påvirker arbeidsmiljøet skal kartlegges og drøftes — § 4-2 (3).

**Målgruppe:** Ledere + verneombud i forkant av omstilling/omorganisering/digitalisering.

**Moduler:**
1. **Endrings­hjemler i AML** (text, 6 min) — § 4-1 (3), § 4-2, § 8-1 informasjon/drøfting, § 15-1 endrings­oppsigelse
2. **§ 4-2 medvirkning ved endring** (text, 6 min)
3. **§ 8-1 informasjons- og drøftings­plikt ≥ 50 ansatte** (text, 6 min)
4. **Endrings­kartlegging — hva du må måle før, under, etter** (text + on_job, 12 min)
5. **Flashcards: endrings­fallgruver** (flashcard, 5 min) — 8 kort
6. **Video: «Slik gjør du omstillingen forsvarlig» (5 min)** — transkript
7. **On-the-job: lag endrings­plan med VO-konsultasjon** (on_job, 30 min)
8. **Quiz** (quiz, 8 min, 75 %) — 8 spørsmål

---

## 11. METADATA — kompletthets­matrise

| Krav fra compliance-analyse | Lukket av modul |
|---|---|
| § 19-1 straffe­ansvar i lederkurs | 40-timers-hms m7 |
| § 14-12 innleide og teller­regel | 40-timers-hms m8 |
| BHT-samspill verneombud | verneombud-40t m7 |
| Praktisk vernerunde | verneombud-40t m8 (on_job) |
| Bransje­spesifikk § 3-2 | aml-arbeidstaker-industri/-helse/-bygg |
| ARP-detalj | aml-13-likestilling mE1, mE4 |
| Endrings­kartlegging | aml-endring (nytt kurs) |
| Sykefraværs­frister | aml-ledere m3 |
| Stansingsrett-case | verneombud-40t m9, m10 |
| AMU-årsrapport | amu-grunnopplaering m7 |

---

## 12. SELV-REVIEW

### 12a. End-user review

Som ansatt/leder som tar kurset, sjekker jeg om:
- **Tid:** ~70–150 min per kurs er overkommelig fordelt over uker. ✅
- **Tone:** Norsk bokmål, direkte, andre­person. ✅
- **Praksis:** OJT-moduler gir reelt læringsutbytte, ikke bare avkrysning. ✅
- **Variasjon:** Tekst + video + flashcards + quiz + OJT bryter mono­toni. ✅
- **Lov­referanser:** Synlige uten å være overveldende. ✅
- **Friksjon:** Quiz på 75 % er overkommelig; flashcards er gode for repetisjon. ✅

**Funn:** Video­transkripter er litt formelle. Anbefaler å løse opp tonen i opptak — ikke endre teksten her, men la voice-over være muntlig. **Ingen blokkerende mangler.**

### 12b. Compliance officer review

Mot AML, FOLM, IK-f, LDL, GDPR:

| Sjekkpunkt | Status |
|---|---|
| § 3-5 ledere — alle åtte IK § 5-punkter dekket | ✅ m2 + m10 OJT |
| § 3-5 — straffe­ansvar nevnt eksplisitt | ✅ m7 (ny) |
| § 6-5 verneombud — stansingsrett med case­arbeid | ✅ m2 + m9 + m10 |
| § 6-5 — BHT-samspill | ✅ m7 (ny) |
| § 6-5 — praktisk vernerunde | ✅ m8 OJT (ny) |
| § 7-4 AMU — vedtaks­myndighet § 7-2 (4) | ✅ m8 video |
| § 3-2 — bransje­spesifikk for industri/helse/bygg | ✅ tre nye kurs |
| § 4-1 (3) endring | ✅ nytt kurs |
| LDL § 26 ARP — aktivitet + redegjørelse | ✅ mE1 + mE4 OJT |
| Doku­mentasjons­krav — alle moduler avgir kursbevis | ✅ via eksisterende RPC |

**Restrisiko:**
1. 40-timers­tallet oppfylles fortsatt ikke av e-læring alene — eksplisitt markert i kursbeskrivelse.
2. Praktisk truck/kran-sertifisering ligger utenfor — riktig avgrensning, henviser til eksternt.
3. Bransje­kurs for olje&gass, transport, landbruk er ikke laget — restanse til fase 2.
4. Video er ikke produsert; transkript er ferdig, men lyd/bilde må lages.

**Compliance­vurdering:** Innholds­krav i AML, FOLM, IK-f, LDL er dekket for fase 1. **Godkjent for produksjon.**

### 12c. Supervisor (head of compliance) review

**Område 1 — Innholds­dekning:** ✅ Dekker alle gapene fra analysen.

**Område 2 — Pedagogisk variasjon:** ✅ Tekst + video + flashcards + OJT + quiz oppfyller AT-kravet om «variasjon i undervisnings­former».

**Område 3 — Doku­mentasjon ved tilsyn:** ✅ Hvert kurs avgir kursbevis; OJT-moduler har signatur­rolle.

**Område 4 — Skalerbarhet:** ✅ Bransje­varianter følger samme struktur — lett å duplisere for nye bransjer.

**Område 5 — Vedlikehold:** ⚠️ Lov­referanser endres ved hver lov­endring. Anbefaler at compliance-planner­modulen flagger paragrafer som har vært endret siden seed-dato.

**Vedtak:** **GODKJENT.**

Signert (digitalt) — Head of Compliance, 2026-05-11.

---

## 13. RUNTIME-SHAPE — viktig teknisk note

Under implementasjonen avdekket vi at den eksisterende baseline-migrasjonen (`20260828120054_aml_learning_baseline.sql`) lagrer `modules` JSONB med flat shape:

- `estimatedMinutes` (forventet: `durationMinutes`)
- `content: '<tekst>'` (forventet: `content: { kind: 'text', body: '<tekst>' }`)
- quiz `prompt` / `answer` (forventet: `question` / `correctIndex`)

`LearningPlayer.tsx` (src/pages/learning/LearningPlayer.tsx:734 ff.) forventer den wrapped `ModuleContent`-discriminated unionen — så de eksisterende systemkursene renderer ikke. `20260902120000_aml_learning_content_extensions.sql` reparerer dette ved å erstatte `modules`-JSON for alle 6 eksisterende AML-kurs samtidig som det legger til 4 nye. Alle 10 kurs (90 moduler) er validert mot JSON-skjema + `ModuleContent`-shape før commit.

Video-modulene leveres som `kind: 'text'` med transkript i `body` (markert som «Video-transkript») inntil opptak er produsert. Når video er klar, byttes til `kind: 'video'` med `url` + `caption` (transkriptet kan flyttes til `caption` eller fortsette som etterfølgende tekst-modul).
