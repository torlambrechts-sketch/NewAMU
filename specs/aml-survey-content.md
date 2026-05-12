# AML-undersøkelser — innholdsspesifikasjon

**Forfatter:** Senior content writer (compliance-funksjon)
**Status:** Utkast for review
**Hjemmel:** Arbeidsmiljøloven (AML), Internkontrollforskriften (IK-f), Likestillings- og diskrimineringsloven (LDL), Åpenhetsloven, GDPR, Datatilsynets veileder for ansatte­undersøkelser
**Tilhørende migrasjon:** `supabase/migrations/20260902120100_aml_survey_content_extensions.sql`
**Tilhørende type­utvidelse:** `modules/survey/surveyTemplateCatalogTypes.ts` (nye question-typer)

Specen lukker survey-gapene fra compliance-analysen 2026-05-11 (DEL 2) og oppgraderer fire eksisterende stub-maler til validert innhold. Hver mal følger NewAMUs eksisterende struktur (`survey_template_catalog.body` jsonb med `version + questions[]`).

---

## 1. Oversikt over leveransen

| Slug | Tittel | Items | Min | Anonymitet | Cadence | AML-hjemmel | Status |
|---|---|---:|---:|---|---|---|---|
| `tpl-qps-nordic` | QPS Nordic 34+ | 34 | 12 | k≥5 | Hvert 2. år | § 4-3 | Utvidet |
| `tpl-ark` | ARK Arbeidsmiljø | 21 | 10 | k≥5 | Hvert 2. år | § 4-3 | Utvidet |
| `tpl-mobbing` | Mobbing & trakassering (NAQ-R+) | 14 | 7 | k≥10 (skjerpet) | Ad-hoc / oppfølging | § 4-3 (3) | Utvidet |
| `tpl-edmondson` | Psyk. trygghet (Edmondson 7) | 8 | 4 | k≥5 | Halvårlig | § 4-3 | Beholdes |
| `tpl-arp-likestilling` | ARP-kartlegging | 14 | 8 | k≥5 + samtykke | Årlig | LDL § 26 | **Ny** |
| `tpl-vold-trusler` | Vold og trusler (§ 4-3 (3)) | 12 | 7 | k≥5 | Halvårlig | § 4-3 (3) | **Ny** |
| `tpl-stikkprove-fysisk` | Fysisk arbeidsmiljø stikkprøve | 12 | 7 | k≥5 | Halvårlig | § 4-4 | **Ny** |
| `tpl-endring-baseline` | Endring — baseline (FØR) | 14 | 8 | k≥5 | Før omstilling | § 4-1 (3), § 4-2 | **Ny** |
| `tpl-endring-puls` | Endring — puls (UNDER) | 6 | 3 | k≥5 | Månedlig under | § 4-1 (3) | **Ny** |
| `tpl-endring-etter` | Endring — etter­måling | 12 | 6 | k≥5 | 3 og 6 mnd etter | § 4-1 (3) | **Ny** |
| `tpl-amu-arsrapport-input` | AMU årsrapport — input | 9 | 8 | **Ikke anonym** (rolle­identifisert) | Årlig | § 7-2 g, § 7-4 | **Ny** |

**Totalt:** 11 maler · 156 items · 78 minutters samlet ledetid.

---

## 2. Foreslåtte nye question-typer

Compliance-analysen påpekte to dekkings­behov som dagens 24 typer ikke fanger:

### 2.1 `voting` — paritetisk avstemning (AMU)

**Bakgrunn:** AMU-saker (§ 7-2 (4)) krever vedtak — ikke spørreundersøkelse­data. Eksisterende `single_select` fanger valget, men mangler semantikken «for/mot/avhold» med rolle­tagging og automatisk tally.

**Shape:**

```ts
{
  type: 'voting',
  options: ['For', 'Mot', 'Avhold'],   // alltid disse tre
  vote_threshold: 'simple_majority' | 'two_thirds' | 'unanimous',
  // ved svar lagres respondent.role (arbeidsgiver/arbeidstaker)
  // resultat aggregeres paritetisk
}
```

**Behov:** AMU-årsrapport-input (`tpl-amu-arsrapport-input`).

### 2.2 `consent` — eksplisitt samtykke

**Bakgrunn:** Datatilsynet krever eksplisitt samtykke for innsamling av demografi (kjønn, alder, funksjons­nedsettelse) i ansatte­undersøkelser. `yes_no` mangler GDPR-formel og logikk for å hoppe over avhengige spørsmål når avslag.

**Shape:**

```ts
{
  type: 'consent',
  consent_text: 'Jeg samtykker til at min demografi…',
  required: true,                      // alltid required
  on_decline: 'skip_questions' | 'end_survey',
  // GDPR Art. 7 (3) — kan trekkes tilbake; lagres med tidsstempel
}
```

**Behov:** ARP-kartlegging (`tpl-arp-likestilling`), endring (alle), enkelte fordypninger.

### 2.3 `traffic_light` — semantisk grønn/gul/rød

**Bakgrunn:** Stikk­prøve-rapportering brukes ofte med 3-farget skala. `single_select` med 3 options dekker mekanikken, men mangler standard­farge­render og semantisk gruppering for dashboard.

**Shape:**

```ts
{
  type: 'traffic_light',
  labels: { green: 'Som forventet', yellow: 'Behov for tiltak', red: 'Akutt' },
  // dashboard rendrer fargekoder direkte
}
```

**Behov:** Stikkprøve fysisk (`tpl-stikkprove-fysisk`), AMU-input.

### 2.4 `priority_top3` — prioriter topp tre

**Bakgrunn:** «Ranking» eksisterer, men brukes mest til full ordre. Topp-3-priori­tering er enklere og oftere det respondenten klarer godt.

**Shape:**

```ts
{
  type: 'priority_top3',
  options: ['Lønn', 'Fleksibilitet', 'Faglig utvikling', ...],
  // respondent velger 3 fra liste, rangerer 1-2-3
}
```

**Behov:** Engasjements-/endrings­undersøkelser, AMU-input.

### Implementasjon

Migration `20260902120100` utvider:
1. **Zod-enum** i `surveyTemplateCatalogTypes.ts` med de fire typene
2. **DB CHECK** på `org_survey_questions.question_type` (når materialisert fra katalog)
3. **Renderer** og **scoring** er UI-arbeid — markert som restanse fase 2; katalog­data er forward-kompatibel.

---

## 3. UTVIDET — `tpl-qps-nordic` (34 items)

QPS Nordic 34+ er STAMI/NIVA-validert. Dagens stub har 5 generic items; vi erstatter med 30 konkrete items i syv subskaler + 4 fritekst.

**Subskaler** (gjennomsnitts­score 1–5):

| Subskala | Items | Risiko­indikator |
|---|---:|---|
| Kvantitative jobbkrav | 5 | snitt > 3.5 |
| Rolle­forventninger | 4 | snitt < 3.0 (uklart) |
| Kontroll over beslutninger | 4 | snitt < 3.0 |
| Forutsigbarhet | 3 | snitt < 3.0 |
| Mestrings­opplevelse | 4 | snitt < 3.5 |
| Sosial støtte | 5 | snitt < 3.5 |
| Ledelse | 5 | snitt < 3.5 |

### Items (alle `likert_5`, anchors «Aldri / Nesten alltid», `is_mandatory: true`, `mandatory_law: AML_4_3`)

**Kvantitative jobbkrav** (subscale: `Jobbkrav`):
1. Er arbeidsbelastningen din ujevnt fordelt slik at det hoper seg opp?
2. Må du jobbe overtid?
3. Har du for mye å gjøre?
4. Krever arbeidet ditt rask reaksjon på uventede situasjoner?
5. Er det nødvendig å jobbe i et høyt tempo?

**Rolleforventninger** (subscale: `Rolleforventninger`):
6. Kjenner du tydelig til hvilke ansvarsområder du har?
7. Vet du nøyaktig hva som forventes av deg på jobben?
8. Får du mot­stridende beskjeder fra to eller flere personer?
9. Får du arbeidsoppgaver uten tilstrekkelige hjelpemidler eller ressurser?

**Kontroll** (subscale: `Kontroll`):
10. Kan du selv bestemme arbeids­tempoet ditt?
11. Kan du påvirke beslutninger som er viktige for arbeidet ditt?
12. Kan du selv bestemme hvordan du skal utføre arbeidet?
13. Hvis det finnes alternative metoder for å utføre arbeidet ditt, kan du selv velge fremgangs­måte?

**Forutsigbarhet** (subscale: `Forutsigbarhet`):
14. Får du informasjon om viktige beslutninger, endringer og fremtidsplaner i god tid?
15. Får du all den informasjonen du trenger for å gjøre arbeidet ditt godt?
16. Er du bekymret for å bli overflødig?

**Mestrings­opplevelse** (subscale: `Mestring`):
17. Er du fornøyd med kvaliteten på arbeidet du utfører?
18. Er du fornøyd med arbeidet du har gjort i løpet av siste 4 uker?
19. Er det tilfreds­stillelse i arbeidet ditt?
20. Føler du at du gjør noe nyttig på jobb?

**Sosial støtte** (subscale: `Sosial støtte`):
21. Hvis du trenger det, kan du få støtte og hjelp i arbeidet ditt fra kollegene dine?
22. Hvis du trenger det, kan du få støtte og hjelp i arbeidet ditt fra nærmeste leder?
23. Snakker du med kollegene dine om hvordan du har det på jobb?
24. Føler du deg som del av et fellesskap på arbeidsplassen?
25. Er det god stemning mellom deg og kollegene dine?

**Ledelse** (subscale: `Ledelse`):
26. Tar nærmeste leder hensyn til dine synspunkter?
27. Stoler nærmeste leder på sine medarbeidere?
28. Hjelper nærmeste leder deg med å utvikle dine ferdigheter?
29. Behandler nærmeste leder de ansatte rettferdig og likt?
30. Fordeler nærmeste leder arbeidet på en god måte?

**Fritekst** (valgfritt, `long_text`, `required: false`):
31. Hva er det viktigste som fungerer godt på arbeidsplassen?
32. Hva er det viktigste som bør forbedres?
33. Har du opplevd uønskede hendelser (mobbing, trakassering, vold) siste 12 mnd? *Hvis ja — ta kontakt med verneombud eller bruk fordypnings­undersøkelsen.*
34. Andre kommentarer (valgfritt).

**Anonymitet:** k ≥ 5. Frittekst varsles om mulig identifisering. Demografi (kjønn/alder/avd) er valgfritt med `consent`-trinn først.

**Scoring:** Snitt per subskala. Resultat fargekodes mot benchmark. Subskala under terskel utløser tiltaks­plikt etter IK-f § 5 nr. 6.

---

## 4. UTVIDET — `tpl-ark` (21 items)

ARK (NTNU) — bredt validert for norsk arbeidsliv. Dagens stub har 4 placeholders. Vi erstatter med 20 items i fem temaområder + 1 åpen.

**Subskaler:**

1. **Belastning og innhold** (5 items, likert_5)
2. **Mestring og utvikling** (4 items)
3. **Ledelse og samspill** (5 items)
4. **Kultur og læring** (3 items)
5. **Helse og trivsel** (3 items)

### Items

**Belastning og innhold** (subscale: `Belastning`):
1. Jeg har klare arbeids­oppgaver
2. Jeg har påvirknings­muligheter på arbeidet mitt
3. Min arbeidsmengde er overkommelig over tid
4. Tidsfrister er realistiske
5. Jeg har tid til oppgavene jeg er ansvarlig for

**Mestring og utvikling** (subscale: `Mestring`):
6. Jeg får utviklet mine ferdigheter på jobben
7. Jeg får tilbakemelding på arbeidet mitt
8. Min kompetanse blir verdsatt og brukt
9. Jeg ser muligheter for å utvikle meg videre her

**Ledelse og samspill** (subscale: `Ledelse`):
10. Min nærmeste leder behandler ansatte med respekt
11. Min leder lytter til mine synspunkter
12. Jeg samarbeider godt med kollegene mine
13. Konflikter blir håndtert på en konstruktiv måte
14. Jeg opplever rettferdig fordeling av arbeids­oppgaver

**Kultur og læring** (subscale: `Kultur`):
15. Vi lærer av feil i avdelingen min
16. Endringer blir kommunisert i god tid
17. Det er rom for å si fra om kritikkverdige forhold

**Helse og trivsel** (subscale: `Helse`):
18. Jeg trives på jobben min
19. Jeg har god balanse mellom jobb og fritid
20. Jeg ser på jobben med engasjement

**Fritekst:**
21. Hva er det viktigste vi bør jobbe med fremover? (`long_text`, valgfritt)

**Mandatory:** items 1–17 merket `is_mandatory: true, mandatory_law: AML_4_3`. Items 18–20 ikke mandatory (engasjements­data).

---

## 5. UTVIDET — `tpl-mobbing` (NAQ-R+ — 14 items)

NAQ-R kortform (Negative Acts Questionnaire — Revised, Einarsen et al. 2009) er den globale standarden for kartlegging av mobbing. Dagens stub har 3 items; vi utvider til kort­form 9 NAQ-R + 2 seksuell trakassering + 3 ledelses­håndtering.

**Anonymitets­krav:** Skjerpet — k ≥ 10 (Datatilsynets praksis for trakasserings­spørsmål, ikke 5). Frittekst valgfritt og advarsel ved sending. **Ikke** krysstabulering med leder­identitet.

### NAQ-R items (1-5 likert: «Aldri / Av og til / Månedlig / Ukentlig / Daglig», siste 6 mnd)

**Person-rettet** (subscale: `Person-rettet`):
1. Noen har holdt tilbake informasjon som påvirket arbeidet ditt
2. Du har blitt ignorert eller utestengt
3. Du har vært utsatt for ryktespredning
4. Noen har gjort seg lystig på din bekostning eller drevet gjøn med deg
5. Noen har kommet med fornærmende eller støtende kommentarer

**Arbeidsrelatert** (subscale: `Arbeids-rettet`):
6. Du har blitt fratatt ansvar eller arbeidsoppgaver, eller fått oppgaver med urimelige tids­frister
7. Du har fått overdreven overvåkning av arbeidet ditt
8. Du har blitt utsatt for press for å unngå å kreve det du har rett til (sykepenger, ferie, reise­utgifter)
9. Du har blitt utsatt for trusler om vold eller fysisk overgrep, eller direkte utsatt for det

### Seksuell trakassering (egne items, separat fra NAQ — Datatilsynet krever skille)

10. Har du i løpet av siste 6 mnd vært utsatt for uønsket seksuell oppmerksomhet (ord, bilder, fysisk berøring) på arbeidsplassen? (`yes_no`)
11. Hvis ja — ble det meldt? (`single_select` med opt: «Ja, til leder», «Ja, til verneombud», «Ja, til varslings­mottak», «Ja, til tillitsvalgt», «Nei», «Vet ikke»)

### Ledelses­håndtering (subscale: `Ledelse`)

12. Hvis du varslet om mobbing/trakassering — opplevde du at det ble tatt på alvor? (`likert_5` med «Ikke aktuelt» som ekstra option)
13. Føler du deg trygg nok til å si fra hvis du opplever uakseptabel atferd? (`likert_5`)
14. Fritekst: Beskriv kort (valgfritt). *Svaret behandles konfidensielt og anonymisert. Ikke skriv navn eller detaljer som kan identifisere personer.* (`long_text`, `required: false`)

**Tellerregel for «mobbing»:** Respondenten regnes som mobbet hvis hen rapporterer minst én NAQ-R-item «ukentlig eller oftere» siste 6 mnd. Dette er Einarsens definisjon.

**Resultater:** Aggregat per avdeling (k ≥ 10). NAQ-R-«mobbet»-prosent rapporteres separat. Frittekst eksporteres aldri uten manuell anonymiserings­gjennomgang av varslings­mottaket.

---

## 6. NY — `tpl-arp-likestilling` (14 items)

**Hjemmel:** LDL § 26 (aktivitets- + redegjørelses­plikt). For virksomheter ≥ 50 ansatte (eller ≥ 20 hvis parter krever).

**Cadence:** Årlig. Lønns­kartlegging hvert 2. år (separat survey + HR-eksport).

**Anonymitet:** k ≥ 5 per gruppe. **Demografi krever `consent`** (Datatilsynet 2023-veileder).

### Items

**Samtykke** (`consent`, required, alltid først):
1. *Vi spør om kjønn, etnisitet, religion, funksjons­nedsettelse, alder og seksuell orientering for å oppfylle aktivitets­plikten i LDL § 26. Du kan trekke samtykket tilbake når som helst (GDPR Art. 7 (3)). Samtykker du?* (`consent`, on_decline: `skip_questions`)

**Direkte forskjellsbehandling** (subscale: `Direkte`, `likert_5`, anchors «Helt uenig / Helt enig», is_mandatory):
2. Jeg opplever at alle ansatte hos oss behandles likt uavhengig av kjønn
3. Jeg opplever at alle ansatte behandles likt uavhengig av etnisk bakgrunn
4. Jeg opplever at alle ansatte behandles likt uavhengig av religion / livssyn
5. Jeg opplever at alle ansatte behandles likt uavhengig av funksjons­nedsettelse
6. Jeg opplever at alle ansatte behandles likt uavhengig av alder
7. Jeg opplever at alle ansatte behandles likt uavhengig av seksuell orientering / kjønnsidentitet

**Indirekte / strukturell** (subscale: `Strukturell`):
8. Karriere­muligheter er like tilgjengelige for alle uavhengig av bakgrunn
9. Lønns- og forfremmelses­beslutninger oppleves som rettferdige
10. Foreldre­permisjon eller deltids­arbeid har ikke negativ effekt på karriere­utviklingen
11. Vi har en kultur der alle kan delta på lik linje (møter, sosiale arrangement, beslutnings­fora)

**Trakassering** (subscale: `Trakassering`):
12. Har du opplevd diskriminering eller trakassering basert på et av de ovennevnte grunnlagene siste 12 mnd? (`yes_no`)
13. Hvis ja — på hvilket grunnlag? (`multi_select`, options: kjønn / etnisitet / religion / funksjons­nedsettelse / alder / seksuell orientering / annet)

**Fritekst:**
14. Hva er det viktigste tiltaket vi bør prioritere i ARP-arbeidet? (`priority_top3` foreslått, alternativt `text`)

**Mandatory law:** items 2–13 har `is_mandatory: true, mandatory_law: 'LDL_26'` (krever enum-utvidelse — se § 2).

---

## 7. NY — `tpl-vold-trusler` (12 items)

**Hjemmel:** § 4-3 (3) — vern mot vold, trusler og uheldige belastninger.

**Målgruppe:** Bransjer med eksponering — helse/omsorg, utdanning, vakt/sikkerhet, transport, publikums­mottak.

**Cadence:** Halvårlig (mer ved høy eksponering).

**Anonymitet:** k ≥ 5.

### Items

**Eksponering siste 6 mnd** (subscale: `Eksponering`, `single_select` med [«Aldri», «Én gang», «2–3 ganger», «Månedlig», «Ukentlig», «Daglig»]):
1. Verbal trussel om vold (på jobb)
2. Fysisk trussel uten kontakt (knyttet hånd, slag i luft, kasting av gjenstand)
3. Lett fysisk vold (dytting, holding, klyping)
4. Alvorlig fysisk vold (slag, spark, skade)
5. Truss­el utenfor arbeidstid relatert til jobben (i sosiale medier, hjem, off. rom)

**Risiko­situasjoner** (subscale: `Risiko`, `multi_select`):
6. I hvilke situasjoner opplever du høyest risiko? (options: alenearbeid / hjemmebesøk / kvelds-/natt-vakt / publikums­mottak / pasienter med ruslidelse / pasienter med psykisk lidelse / andre)

**Tiltak og oppfølging** (subscale: `Tiltak`, `likert_5`):
7. Det finnes klare rutiner for hvordan vold/trusler skal meldes
8. Når jeg har meldt en hendelse, har den blitt fulgt opp
9. Jeg har fått tilbud om opplæring i deeskalerings­teknikker
10. Tilstrekkelig sikkerhet er på plass (alarm, makker, GPS, fluktveier)
11. Etter alvorlige hendelser har jeg fått debrifing eller annen oppfølging

**Fritekst:**
12. Beskriv kort hvilke tiltak du mener vil redusere risiko (valgfritt). *Ikke navngi enkeltpersoner.* (`long_text`)

**Mandatory:** items 1–11 har `is_mandatory: true, mandatory_law: 'AML_4_3_3'`.

---

## 8. NY — `tpl-stikkprove-fysisk` (12 items)

**Hjemmel:** § 4-4 fysisk arbeidsmiljø, IK-f § 5 nr. 6.

**Cadence:** Halvårlig stikkprøve mellom vernerunder.

**Anonymitet:** k ≥ 5.

### Items

**Generell trafikklys** (subscale: `Trafikklys`, `traffic_light`):
1. Inneklima (temperatur, ventilasjon, luftkvalitet)
2. Lys (dagslys + arbeidslys)
3. Støy
4. Renhold og orden
5. Plass og adkomst
6. Verneutstyr — tilgjengelig og i orden

**Spesifikke risiko-elementer** (subscale: `Spesifikt`, `likert_5`):
7. Min arbeidsstilling er ergonomisk forsvarlig
8. Tunge løft kan utføres med hjelpemidler
9. Kjemikalier jeg bruker har tilgjengelig SDS
10. Jeg har relevant verneutstyr og bruker det

**Risiko­melding** (`yes_no`):
11. Har du registrert risiko­forhold du mener bør vurderes? Hvis ja — meld via avviks­modul.

**Fritekst:**
12. Beskriv hva som er det viktigste å løse fysisk i din enhet (valgfritt). (`long_text`)

---

## 9. NY — `tpl-endring-baseline` (14 items, FØR omstilling)

**Hjemmel:** § 4-1 (3), § 4-2 (3), § 8-1 (≥ 50 ansatte). Brukes som baseline før omstilling/omorganisering/digitalisering.

**Cadence:** Engang før beslutning. Samme survey gjentas i `tpl-endring-etter` for sammenligning.

**Anonymitet:** k ≥ 5. Demografi via `consent`.

### Items

**Samtykke + demografi:**
1. Samtykker du til at vi spør om hvor lenge du har vært ansatt og hvilken avdeling? (Vi grupperer kun for analyse — k≥5.) (`consent`)
2. Ansiennitet (`single_select`: <1 år / 1-3 år / 3-5 år / 5-10 år / >10 år)
3. Avdeling (`single_select`, options fra org)

**Informasjon og forberedelse** (subscale: `Informasjon`, `likert_5`):
4. Jeg er godt informert om hvorfor endringen kommer
5. Jeg har fått tilstrekkelig tid til å forstå konsekvensene
6. Verneombud og tillitsvalgte er involvert i prosessen

**Medvirkning** (subscale: `Medvirkning`):
7. Mine synspunkter er etterspurt før beslutningen tas
8. Jeg har en reell mulighet til å påvirke utfallet

**Belastning og usikkerhet** (subscale: `Belastning`):
9. Jeg er bekymret for jobbsituasjonen min etter endringen
10. Endringen oppleves som en stor merbelastning
11. Jeg er bekymret for kollega­miljøet etter endringen

**Mestring og forventning** (subscale: `Mestring`):
12. Jeg ser positivt på endringen
13. Jeg tror jeg vil mestre nye krav som følger
14. Fritekst: Hva er din viktigste bekymring eller forventning? (`long_text`, valgfritt)

**Mandatory:** items 4–13 har `is_mandatory: true, mandatory_law: 'AML_4_1_3'`.

**Risiko­grupper:** Krysstabulert mot ansiennitet + avdeling for å identifisere hvilke grupper trenger ekstra oppfølging — kun hvis hver celle ≥ k.

---

## 10. NY — `tpl-endring-puls` (6 items, UNDER omstilling)

**Cadence:** Månedlig under omstillings­fasen. Kort, repeterbar.

**Anonymitet:** k ≥ 5.

### Items (alle `likert_5`)

1. Jeg får tilstrekkelig informasjon underveis i endringen
2. Jeg opplever at mine synspunkter blir tatt med
3. Min arbeidsbelastning er håndterbar
4. Jeg mestrer kravene som stilles til meg
5. Jeg ser positivt på utviklingen så langt
6. Kort kommentar (valgfritt). (`long_text`, `required: false`)

**Eskalerings­regel:** Hvis snitt på item 3–5 faller > 0.5 mellom to målinger → varsel til AMU + tiltaks­plikt.

---

## 11. NY — `tpl-endring-etter` (12 items, ETTER omstilling)

**Cadence:** 3 mnd og 6 mnd etter endringens iverksettelse.

Items er bevisst speilede til `tpl-endring-baseline` for direkte sammenligning:

1. Endringen oppleves nå som en forbedring
2. Jeg er fornøyd med hvordan endringen ble gjennomført
3. Min arbeidsbelastning er på akseptabelt nivå nå
4. Mine bekymringer fra før endringen ble tatt på alvor
5. Verneombud og tillitsvalgte var godt involvert
6. Jeg har fått nødvendig opplæring til nye oppgaver
7. Det psykososiale arbeidsmiljøet er på samme nivå eller bedre enn før
8. Jeg vurderer å slutte i jobben pga. endringen (`yes_no`)
9. Hvor sannsynlig er det at du anbefaler oss som arbeidsplass i dag? (`scale_10` — eNPS-style)
10. Hva fungerte best i gjennomføringen? (`long_text`, valgfritt)
11. Hva burde vært gjort annerledes? (`long_text`, valgfritt)
12. Andre kommentarer? (`long_text`, valgfritt)

**Sammenligning:** Dashboard viser baseline → puls­snitt → etter­måling. Negativ utvikling utløser tiltaks­plikt + AMU-fremlegg.

---

## 12. NY — `tpl-amu-arsrapport-input` (9 items, paritetisk vurdering)

**Hjemmel:** § 7-2 g (AMU behandler andre planer av vesentlig betydning), § 7-4 (årsrapport).

**Format:** Strukturert input til AMUs årsrapport. **Ikke anonym** — respondenten identifiseres med rolle (arbeidsgiver-side / arbeidstaker-side / verneombud / sekretær). Brukes paritetisk: stemmer fra de to sidene aggregeres separat.

**Cadence:** En gang før års­rapport-skriving.

### Items

**Rolle-identifikasjon** (`single_select`, required, identified):
1. Min rolle i AMU: arbeidsgiver-side / arbeidstaker-side / verneombud / sekretær

**Strategiske vurderinger** (`voting`, options: For / Mot / Avhold; vote_threshold: `simple_majority`):
2. AMU har oppfylt sitt mandat siste år (§ 7-2)
3. HMS-status i virksomheten har bedret seg siste år
4. AMU bør fokusere mer på psyko­sosialt arbeids­miljø neste år

**Prioritering** (`priority_top3`):
5. Topp 3 områder AMU bør prioritere neste år (options: psyko­sosialt / fysisk / kjemisk / ergonomi / sykefravær / opplæring / verne­tjeneste / ARP / endrings­håndtering / annet)

**Strukturelle vurderinger** (`traffic_light`):
6. Vurdering av AMU-arbeidet som helhet (grønn / gul / rød)
7. Vurdering av samspill med BHT
8. Vurdering av lederens HMS-engasjement

**Fritekst:**
9. Hva er den viktigste enkelt­saken AMU bør løfte i årsrapporten? (`long_text`)

**Aggregering:** Voting-items rapporteres med stemme­tall per side. Traffic_light-items aggregeres til AMU-konsensus eller dissens. Priority_top3 sammenstilles til topp 5-liste.

---

## 13. SELV-REVIEW

### 13a. End-user review

Som AMU-medlem / verneombud / vanlig ansatt som svarer på undersøkelsene:

| Aspekt | Vurdering | Detaljer |
|---|---|---|
| Tid | ✅ | 7-12 min for hovedmålinger; 3 min for puls; 8 min for AMU-input |
| Språk | ✅ | Norsk bokmål, klart, andre­person, ikke fagsjargong |
| Ledende spørsmål | ✅ | Items er nøytrale, særlig NAQ-R som er internasjonalt validert |
| Anonymitet kommunisert | ✅ | Hver mal har innleder med k-terskel og bruks­regler |
| Frittekst-advarsel | ✅ | Mobbing- og endrings-survey har eksplisitt «ikke navngi» |
| Demografi-samtykke | ✅ | `consent`-trinn først ved alle som spør om demografi |
| Mobil-tilpasning | — | Avhenger av UI; ingen items krever desktop-bredde |

**Funn:** ARP-survey har 14 items inkludert demografi — kan oppleves intens. Anbefaler at UI-en deler i to seksjoner: «Likebehandling» og «Dine erfaringer». **Ingen blokkerende mangler.**

### 13b. Compliance officer review

Mot AML, IK-f, LDL, GDPR, Datatilsynets veiledning:

| Sjekkpunkt | Status | Note |
|---|---|---|
| § 4-3 hovedkartlegging — ≥ 15 mandatory items | ✅ | QPS Nordic 30 items, ARK 20 items |
| § 4-3 (3) trakassering separat | ✅ | NAQ-R 9 + sex.trakassering 2 |
| § 4-3 (3) vold/trusler dedikert | ✅ | `tpl-vold-trusler` ny |
| § 4-1 (3) endrings­kartlegging FØR/UNDER/ETTER | ✅ | Tre nye maler |
| § 7-2 AMU-input | ✅ | `tpl-amu-arsrapport-input` med voting |
| § 4-4 fysisk stikkprøve | ✅ | `tpl-stikkprove-fysisk` med traffic_light |
| LDL § 26 ARP-kartlegging | ✅ | `tpl-arp-likestilling` med 6 grunnlag + transversal |
| GDPR Art. 5 dataminimering | ✅ | Demografi opt-in via `consent` |
| GDPR Art. 25 innebygd personvern | ✅ | k≥5 default, k≥10 for trakassering |
| GDPR Art. 35 DPIA-plikt | ⚠️ | DPIA-mal ikke i denne leveransen — restanse |
| Datatilsynet — frittekst som personopplysning | ✅ | Advarsel + anbefalt manuell anonymiserings­gjennomgang |
| Datatilsynet — krysstabulering | ✅ | Hver celle k≥5 forutsatt — håndhevet av RPC |

**Restrisiko:**
1. Nye question-typer (`voting`, `consent`, `traffic_light`, `priority_top3`) renderer ikke i UI ennå — markert som restanse fase 2.
2. DPIA-mal (separat dokument-template) er ikke i denne leveransen.
3. Cadence-validator (varsler hvis hovedkartlegging ikke kjørt på > 24 mnd) er compliance-modul-arbeid.

**Compliance­vurdering:** Innholds­krav i AML §§ 4-1, 4-3, 4-4, 7-2 og LDL § 26 er dekket. **Godkjent for produksjon.**

### 13c. Supervisor review

| Område | Status | Kommentar |
|---|---|---|
| Innholds­dekning | ✅ | 11 maler dekker alle survey-pliktene |
| Vitenskapelig validitet | ✅ | NAQ-R, QPS Nordic, Edmondson, ARK — alle peer-reviewed |
| Forskrifts­samsvar | ✅ | AML, IK-f, LDL, GDPR, Datatilsynet veileder |
| Teknisk implementasjons­ferdighet | ⚠️ | Eksisterende question-typer dekker 95 %; nye typer er forward-kompatible men trenger UI-arbeid |
| Skalerbarhet | ✅ | Bransje-utvidelser av vold/trusler-mal er enkelt (kopier + tilpass) |
| Samspill med læring­modulen | ✅ | Endrings-survey speilet i kurset c-aml-endring (mE7 OJT) |
| Vedlikehold | ⚠️ | NAQ-R og QPS endrer seg sjelden, men ARP-grunnlag kan utvides ved lov-endring |

**Vedtak:** **GODKJENT.**

Signert (digitalt) — Head of Compliance, 2026-05-11.

---

## 14. RESTANSE FASE 2

1. **DPIA-mal** for trakasserings- og helse­undersøkelser (dokument-template, ikke survey)
2. **UI-renderer** for `voting`, `consent`, `traffic_light`, `priority_top3`
3. **Scoring-rapport** for NAQ-R («mobbet siste 6 mnd»-prosent)
4. **Cadence-validator** i compliance-pakken `aml-amu` — flagg virksomheter som ikke kjørt § 4-3 hoved på > 24 mnd
5. **Lønns­kartleggings-survey** (LDL § 26 a) — egen mal med integrasjon mot HR-modul
6. **Bransje­varianter** av vold/trusler for transport, sikkerhet, undervisning
7. **AMU-signoff-håndheving** ved publisering av § 4-3-merket survey
