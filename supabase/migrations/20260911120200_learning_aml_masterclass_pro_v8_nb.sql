-- Update c-aml-masterclass-2026-v6 with v8 content (gemini export 2026-05-15
-- 22:00 UTC). v8 expands from 8 text chapters + 1 OJT to 10 + 1 OJT.
--
-- New chapters:
--  • Kap 9: Kontrolltiltak og det digitale overvåkingssamfunnet
--    (AML kap. 9 + GDPR-koblingen, badge-privacy-guardian, 300 XP)
--  • Kap 10: Bedriftshelsetjeneste og lovpålagt meldeplikt
--    (AML § 3-3 + kap. 5, 250 XP)
--
-- Expanded chapters:
--  • Kap 1 (Din rolle som juridisk garantist): now also covers
--    arbeidstakers medvirkningsplikt (§ 2-3) — bodyMarkdown carries two
--    `###` sections; renders cleanly through Tailwind Typography.
--  • Kap 5 (Innleie): bumped from a short alert to a full taxonomy of
--    entreprise vs innleie + the 2023 rule-change ("midlertidig behov"
--    fjernet for bemanningsforetak) + a 4-spørsmåls test.
--  • Kap 7 (Oppsigelse): adds prøvetidsfellen (§ 15-6) under deepDive.
--
-- Refreshed course-level law_refs: 15 anchors (added § 2-3, § 3-3,
-- kap. 5, kap. 9, § 15-6). Idempotent: insert … on conflict do update.
--
-- Course id / slug / title intentionally unchanged so any existing
-- learner progress survives the v7→v8 bump. meta.schemaVersion = 8.
--
-- Applied to remote first via Supabase MCP on 2026-05-15.

insert into public.learning_system_courses (id, slug, default_locale, law_refs)
values (
  'c-aml-masterclass-2026-v6',
  'aml-ledere-pro',
  'nb',
  '["AML § 2-1","AML § 2-3","AML kap. 2 A","AML § 3-3","AML § 4-3","AML § 4-6","AML kap. 5","AML § 6-3","AML kap. 9","AML kap. 10","AML kap. 13","AML § 14-12","AML § 15-6","AML § 15-7","AML § 19-1"]'::jsonb
)
on conflict (id) do update set
  slug = excluded.slug,
  default_locale = excluded.default_locale,
  law_refs = excluded.law_refs;

insert into public.learning_system_course_locales (
  system_course_id, locale, title, description, modules, meta
)
values (
  'c-aml-masterclass-2026-v6',
  'nb',
  'Arbeidsmiljøloven for ledere: Den harde juridiske realiteten',
  'En ufiltrert Masterclass i arbeidsrett, straffeansvar og ledelsens handlingsplikt. Kurset dekker Høyesterettspraksis, Arbeidstilsynets sanksjonsregime og gir deg verktøyene for å unngå personlig straffeansvar.',
  $AMPRO_V8$[
    {
      "id": "pro-m01",
      "title": "Kapittel 1: Din rolle som juridisk garantist (og skyteskive)",
      "order": 1,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 200, "badgeId": "badge-commander" },
      "content": {
        "bodyMarkdown": "### 🏛️ Realiteten: Bøter på opptil 4 % av omsetningen\n\nLa oss legge bort HR-flosklene et øyeblikk. **Arbeidsmiljøloven § 2-1** slår fast at det er *du* som daglig leder som svarer for at systemet fungerer.\n\nHvis du feiler, er sanksjonene i dag ekstreme. Den øvre grensen for Arbeidstilsynets overtredelsesgebyr er nå:\n* 💰 **50 G** (ca. 6,5 millioner kroner) ELLER\n* 📈 **4 %** av virksomhetens totale omsetning (det som er høyest).\n\nI tillegg er det innført et **rent objektivt foretaksstraffansvar**. Det betyr at selskapet får millionbøter uavhengig av om du eller andre i ledelsen har utvist personlig skyld.\n\n### 🤝 Arbeidstakers medvirkningsplikt (§ 2-3)\nHMS er ikke enveiskjøring. Lovverket pålegger faktisk de ansatte et selvstendig ansvar. Etter § 2-3 *skal* arbeidstakerne medvirke ved gjennomføring av HMS-tiltak. Hvis en ansatt nekter å følge sikkerhetsrutiner, unnlater å melde fra om feil, eller trakasserer en kollega, bryter de loven. Som leder må du slå ned på dette – ikke bare for å korrigere den ansatte, men for å beskytte bedriftens ansvar.",
        "leadershipInsight": "I 2025 delte Arbeidstilsynet ut gebyrer for nær 90 millioner kroner. Dette er inndragning av bunnlinjen. Å bruke våre digitale HMS-verktøy aktivt er din viktigste forsikring.",
        "deepDive": "#### ⚖️ Rettspraksis: Dommen som endret alt (HR-2019-2205-A)\nI denne saken ble en toppleder straffedømt til tross for skriftlig delegering av HMS-ansvaret. **Hvorfor?** Topplederen hadde aldri *etterspurt* dokumentasjon på at jobben faktisk ble gjort. Manglende dokumentasjon av et system er i seg selv straffbart.",
        "keyTakeaways": [
          "Gebyret er hevet til maks 4 % av omsetningen.",
          "Foretaksstraffen er rent objektiv.",
          "Delegasjon fritar *ikke* for straffeansvar uten aktiv kontroll.",
          "Ansatte har en streng, lovpålagt medvirkningsplikt (§ 2-3) som du som leder må håndheve."
        ],
        "commonPitfalls": [
          "Delegasjonsfellen: Å tro at et delegasjonsdokument i personalmappen fritar deg for ansvar. Arbeidstilsynet vil alltid kreve å se loggen for din oppfølging."
        ],
        "refLawIds": ["aml-2-1", "aml-19-1"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m02",
      "title": "Kapittel 2: Arbeidstid – Fellen som endte i fengsel",
      "order": 2,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 350 },
      "content": {
        "bodyMarkdown": "### ⏰ Ubetinget fengsel for systematiske overtramp\n\nArbeidsmiljøloven Kapittel 10 setter absolutte grenser for hvor mye de ansatte kan jobbe:\n* **Maks 9 timer** om dagen.\n* **Min 11 timer** hviletid mellom øktene.\n\nI den historiske høyesterettsdommen fra 2020 (**Veireno-saken**) ble daglig leder dømt til **120 dagers ubetinget fengsel**. Han ble holdt personlig ansvarlig for 1080 brudd på arbeidstidsbestemmelsene, selv om det ble gjort for å 'redde oppdraget'.",
        "leadershipInsight": "Overtidsbruk er ofte et symptom på dårlig prosjektstyring. Bruk arbeidstidsdata proaktivt for å beskytte ansatte mot utbrenthet – og deg selv mot straffeforfølgelse.",
        "deepDive": "#### 💼 Særlig uavhengig stilling (§ 10-12)\nMange bedrifter går i fellen ved å definere konsulenter som 'særlig uavhengig stilling' for å unngå overtidsbetaling. Rettspraksis er knallhard: Hvis de er underlagt stramme prosjektfrister, kundekrav eller faktureringsgrad, er de *ikke* uavhengige i lovens forstand.",
        "keyTakeaways": [
          "Brudd på AML kapittel 10 kan medføre ubetinget fengsel.",
          "Tittelen 'Senior' gir ikke automatisk unntak fra reglene.",
          "Ansatte kan ikke inngå frivillige avtaler om å droppe hviletiden."
        ],
        "commonPitfalls": [
          "Feilklassifisering: Å gi en ansatt fastlønn og tro man er fritatt fra overtid. Dette kan føre til tilbakevirkende krav for flere år."
        ],
        "refLawIds": ["aml-10", "aml-19-1"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m03",
      "title": "Kapittel 3: Verneombudet og stansingsretten (§ 6-3)",
      "order": 3,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 250 },
      "content": {
        "bodyMarkdown": "### 🛑 Når din egen ansatt stenger ned driften\n\nDu leder bedriften, men **Verneombudet (VO)** er lovens forlengede arm. Mange ledere får et brutalt møte med loven den dagen VO benytter seg av stansingsretten.\n\n**Hvem må ha hva?**\n* 👥 **10+ ansatte:** Skal ha Verneombud.\n* 🏢 **30+ ansatte:** Skal ha Arbeidsmiljøutvalg (AMU).",
        "leadershipInsight": "Involver VO tidlig i alle endringsprosesser. Et godt samarbeid er din beste forsikring mot at konflikter eskalerer ut av huset.",
        "deepDive": "#### 🛡️ Maktfordelingen: Du kan ikke overprøve VO\nVerneombudet har lovfestet rett til å stanse arbeidet dersom det er umiddelbar fare for liv og helse (inkludert psykososial helse). **Som leder har du ikke lov til å overprøve stansen.** Kun Arbeidstilsynet kan oppheve den. Å beordre ansatte tilbake i arbeid er et grovt og straffbart lovbrudd.",
        "keyTakeaways": [
          "Innleide konsulenter teller med i beregningen for VO og AMU.",
          "VO's stansingsrett er absolutt inntil Arbeidstilsynet fatter vedtak."
        ],
        "commonPitfalls": [
          "Ignoreringsfellen: Å ta beslutninger om omorganisering eller nye IT-systemer uten å formelt drøfte de arbeidsmiljømessige konsekvensene med VO først."
        ],
        "refLawIds": ["aml-6-3"]
      },
      "durationMinutes": 35
    },
    {
      "id": "pro-m04",
      "title": "Kapittel 4: Varsling (Kap. 2 A) – Minefeltet",
      "order": 4,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 300, "badgeId": "badge-ethics-officer" },
      "content": {
        "bodyMarkdown": "### 📢 Aktivitetsplikt og gjengjeldelsesforbud\n\nNår en ansatt sier fra om kritikkverdige forhold, utløses Kapittel 2 A. Lovverket beskytter varsleren ekstremt sterkt.\n\nDu får umiddelbart en **aktivitetsplikt (§ 2 A-3)**, og saken må undersøkes metodisk.",
        "leadershipInsight": "En kultur for varsling er en sunn kultur. Det betyr at problemene løses internt før de havner i media eller hos advokater.",
        "deepDive": "#### 🚫 Forbudet mot gjengjeldelse (§ 2 A-4)\nDet er et absolutt forbud mot gjengjeldelse mot varsleren. Dette inkluderer subtile ting som:\n* Endring i arbeidsoppgaver\n* Sosial utfrysing\n* Uforklarlig stans i karriereutvikling\n\n**Merk:** Det er *arbeidsgiver* som har bevisbyrden for at gjengjeldelse ikke har skjedd.",
        "keyTakeaways": [
          "Virksomheter med 5+ ansatte skal ha skriftlige varslingsrutiner.",
          "Arbeidsgiver har bevisbyrden ved påstander om gjengjeldelse.",
          "Erstatningsansvaret ved brudd er objektivt."
        ],
        "commonPitfalls": [
          "Identifikasjonsfellen: Å dele navnet på varsleren med den det varsles på. Brudd på konfidensialitet er et alvorlig tillitsbrudd og ofte lovbrudd."
        ],
        "refLawIds": ["aml-2a-1"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m05",
      "title": "Kapittel 5: Konsulentfellen – Er det innleie eller entreprise?",
      "order": 5,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 300 },
      "content": {
        "bodyMarkdown": "### 🕵️‍♂️ Hva er egentlig en konsulent?\n\nI jussen finnes ikke begrepet 'konsulent'. Når du henter inn ekstern bistand, havner forholdet i én av to kurver:\n\n**1. Entreprise (Lovlig tjenestekjøp):**\nDu kjøper et *resultat*. Konsulenten leverer en ferdig løsning. Leverandøren har instruksjonsmyndighet over sine ansatte og risikoen for resultatet.\n\n**2. Innleie (Leie av arbeidskraft):**\nDu kjøper *tid*. Konsulenten trer inn i din organisasjon, bruker din PC, rapporterer til deg og utfører oppgaver etter din løpende instruks. Dette er innleie, uansett hva kontrakten sier.\n\n#### ⏱️ Lange vs. korte oppdrag: Myten om 'midlertidighet'\nFør 2023 kunne man leie inn folk ved 'midlertidig behov' (arbeidstopper). **Dette er nå fjernet for bemanningsforetak.** \nSelv om du bare trenger en utvikler i tre uker for en 'topp', er det som hovedregel ulovlig å leie fra et bemanningsbyrå.",
        "leadershipInsight": "I teknologibedrifter er det fristende å fylle huller i teamet med 'konsulenter' på timebasis. Hvis de sitter i dine lokaler og styres av deg, er de juridisk sett innleide. Alle konsulentkontrakter bør være resultatorienterte entrepriser.",
        "deepDive": "#### ⚖️ Testen: Er det innleie? (Etter rettspraksis)\nHvis du svarer 'JA' på mer enn to av disse, er det sannsynligvis innleie og ikke entreprise:\n1. Leder du den eksterne ressursen i det daglige?\n2. Er det du som holder utstyret (PC, lisenser, tilgang)?\n3. Er ressursen integrert i det sosiale miljøet på linje med ansatte?\n4. Betaler du per time uten at leverandøren har risiko for resultatet?",
        "keyTakeaways": [
          "Entreprise = Kjøp av resultat. Innleie = Kjøp av tid.",
          "Det er ikke lenger lov å leie fra byrå for å ta unna 'arbeidstopper'.",
          "Realiteten (hvem som leder arbeidet) trumfer alltid kontraktens tittel."
        ],
        "commonPitfalls": [
          "Integrasjonsfellen: Å gi eksterne konsulenter 'Employee of the Month'-priser eller invitere dem på strategisamlinger som om de var ansatte. Dette er sterke bevis for innleie i en rettssak."
        ],
        "refLawIds": ["aml-14-12"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m06",
      "title": "Kapittel 6: Sykefravær og tilretteleggingens grenser",
      "order": 6,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 300, "badgeId": "badge-people-care" },
      "content": {
        "bodyMarkdown": "### 🏥 Hva gjør du når stolen står tom?\n\nSykefraværsoppfølging (§ 4-6) handler ikke om å kontrollere *hva* som feiler folk, men om å legge til rette for restarbeidsevnen. \n\n**Viktige frister:**\n* 📅 **4 uker:** Skriftlig oppfølgingsplan.\n* 🤝 **7 uker:** Dialogmøte 1.",
        "leadershipInsight": "Hver dag en ansatt er borte, taper teamet fremdrift. Rask dialog og tilrettelegging er din beste strategi for å beholde kompetanse.",
        "deepDive": "#### 🚧 Hvor går grensen for tilrettelegging?\nLoven krever at du tilrettelegger 'så langt det er mulig'. Men rettspraksis setter en grense: Du er ikke pliktig til å opprette en helt ny stilling («make-work»), og det skal ikke gå uforholdsmessig mye ut over resten av teamet.",
        "keyTakeaways": [
          "Lag alltid en skriftlig plan innen uke 4 – ditt viktigste bevis ved tilsyn.",
          "Fokuser på restarbeidsevne, aldri på diagnosen.",
          "Plikten er vid, men den ødelegger ikke for bedriftens kjernevirksomhet."
        ],
        "commonPitfalls": [
          "Diagnosefellen: Å spørre 'Hva feiler det deg?'. Spør i stedet: 'Hvilke oppgaver klarer du å utføre akkurat nå?'.",
          "Uendelig tilrettelegging: Hvis tilretteleggingen medfører at resten av teamet må jobbe konstant overtid, er grensen krysset."
        ],
        "refLawIds": ["aml-4-6"]
      },
      "durationMinutes": 40
    },
    {
      "id": "pro-m07",
      "title": "Kapittel 7: Oppsigelse og det tapte dokumentasjonssporet",
      "order": 7,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 350, "badgeId": "badge-hr-legal" },
      "content": {
        "bodyMarkdown": "### 🚪 Veien ut må bygges på papir\n\nOppsigelse krever **saklig grunn (§ 15-7)**. Det stilles enorme krav i norsk rett når det gjelder oppsigelse på grunn av ansattes egne forhold (prestasjon, samarbeid).",
        "leadershipInsight": "Å beholde en underpresterende medarbeider som sprer negativitet er urettferdig overfor resten av teamet. En formell prosess er nødvendig omsorg for fellesskapet.",
        "deepDive": "#### 📝 Drøftingsmøtet (§ 15-1) og advarsler\nFør oppsigelse besluttes, *må* du ha et drøftingsmøte. Men en gyldig oppsigelse for dårlig prestasjon starter aldri her. Den starter måneder i forveien med korrigerende samtaler og skriftlige advarsler. Uten dette dokumentasjonssporet, vil retten kjenne oppsigelsen ugyldig på grunn av saksbehandlingsfeil.\n\n#### ⏳ Prøvetidsfellen (§ 15-6)\nMange ledere tror at prøvetiden (ofte 6 måneder) er en 'frikort-periode' hvor man kan si opp folk på dagen. Det er feil. Terskelen for oppsigelse er noe lavere (knyttet til tilpasning, dyktighet eller pålitelighet), men kravene til *dokumentasjon* er like strenge. Hvis du sier opp en ansatt i måned 5, vil dommeren spørre: 'Fikk arbeidstakeren tilstrekkelig opplæring og reell sjanse til å korrigere seg?' Hvis du mangler referater fra evalueringssamtaler i måned 1, 3 og 4, taper du saken.",
        "keyTakeaways": [
          "Oppsigelsen kan være materielt riktig, men bli ugyldig på grunn av prosessfeil.",
          "Drøftingsmøtet skal skje *før* endelig beslutning tas.",
          "Syke og gravide har forsterket vern."
        ],
        "commonPitfalls": [
          "Hastefellen: Å kalle inn til drøftingsmøte for manglende prestasjoner uten å ha referater fra 6-12 måneder med korrigerende samtaler å vise til."
        ],
        "refLawIds": ["aml-15-7"]
      },
      "durationMinutes": 50
    },
    {
      "id": "pro-m08",
      "title": "Kapittel 8: Trakassering og den 'omvendte' bevisbyrden",
      "order": 8,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 400, "badgeId": "badge-integrity-master" },
      "content": {
        "bodyMarkdown": "### ⚖️ Når subjektiv opplevelse blir juridisk virkelighet\n\nArbeidsmiljøloven forbyr diskriminering, og **Kapittel 13** slår spesifikt ned på trakassering. Loven ser ikke bare på *hensikten* din, men på hvordan handlingen **oppleves**.\n\n**Trakassering defineres som:**\n* 🛑 Krenkende eller fientlige ytringer\n* 📉 Nedverdigende behandling\n* 🥶 Sosial utfrysing",
        "leadershipInsight": "I din rolle er oppgaven å bygge en kultur der 'gråsoner' ikke aksepteres. Du har ansvaret for å *forebygge*, ikke bare reparere.",
        "deepDive": "#### 🪤 Den juridiske fellen: Delt bevisbyrde (§ 13-8)\nI vanlige rettssaker skal saksøker bevise sitt krav. I trakasseringssaker er bevisbyrden **delt**. Hvis en ansatt kan 'sannsynliggjøre' at trakassering har skjedd, går bevisbyrden over på deg som leder. Da er det *du* som må bevise din uskyld. Uten skriftlig dokumentasjon på dine undersøkelser, taper du i retten.",
        "keyTakeaways": [
          "Trakassering er forbudt uavhengig av om hensikten var 'vennlig ment'.",
          "Arbeidsgiver har en objektiv plikt til å forebygge.",
          "Oppreisning utmåles uavhengig av økonomisk tap."
        ],
        "commonPitfalls": [
          "Passivitetsfellen: Å tro du ikke trenger å gjøre noe fordi offeret 'ikke vil lage en sak ut av det'. Loven krever handling straks du får kunnskap om situasjonen."
        ],
        "refLawIds": ["aml-13"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m09-kontroll",
      "title": "Kapittel 9: Kontrolltiltak og det digitale overvåkingssamfunnet",
      "order": 9,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 300, "badgeId": "badge-privacy-guardian" },
      "content": {
        "bodyMarkdown": "### 👁️ Kan du lese de ansattes e-post?\n\nAML **Kapittel 9** regulerer kontrolltiltak i virksomheten. Å logge ansattes databruk, innføre adgangskontroll med sporing, eller lese e-posten til en ansatt, ligger i et farlig krysningspunkt mellom Arbeidsmiljøloven og Personvernforordningen (GDPR).\n\nEt kontrolltiltak kan kun innføres hvis det har en **saklig grunn** knyttet til virksomheten, og det ikke er uforholdsmessig belastende for den ansatte. Før du aktiverer programvare som måler de ansattes produktivitet, *må* du drøfte dette med de tillitsvalgte (§ 9-2).",
        "leadershipInsight": "I en moderne IT-infrastruktur har vi teknisk mulighet til å overvåke alt. Men teknisk mulighet er ikke det samme som juridisk rett. Åpenhet om hva som logges bygger tillit; skjult overvåking ødelegger den.",
        "deepDive": "#### 📧 Innsyn i e-post (Egen forskrift)\nDu kan *ikke* bare logge deg inn i e-posten til en ansatt for å finne et viktig dokument mens de er på ferie. Innsyn krever en streng prosedyre. Den ansatte skal varsles på forhånd og ha rett til å være til stede (eller ha med tillitsvalgt) når e-postkassen åpnes. Brudd på disse reglene fører ofte til massive bøter fra Datatilsynet i tillegg til Arbeidstilsynet.",
        "keyTakeaways": [
          "Kontrolltiltak (som logging og kamera) skal alltid drøftes med tillitsvalgte *før* innføring.",
          "Du har ikke fritt innsyn i ansattes e-post, selv om bedriften eier domenet.",
          "Informasjon innhentet ulovlig kan som hovedregel ikke brukes som bevis i en oppsigelsessak."
        ],
        "commonPitfalls": [
          "Snik-innføring: Å aktivere funksjoner i Microsoft 365 eller Google Workspace som måler individuelt aktivitetsnivå uten å informere de ansatte. Dette er et ulovlig kontrolltiltak."
        ],
        "refLawIds": ["aml-9"]
      },
      "durationMinutes": 35
    },
    {
      "id": "pro-m10-ulykker",
      "title": "Kapittel 10: Bedriftshelsetjeneste og lovpålagt meldeplikt",
      "order": 10,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 250 },
      "content": {
        "bodyMarkdown": "### 🚑 Når krisen inntreffer (Kapittel 3 og 5)\n\nHar bedriften din riktig støtteapparat? **AML § 3-3** krever at arbeidsgiver knytter til seg en godkjent Bedriftshelsetjeneste (BHT) dersom risikoforholdene tilsier det. Mange bransjer har et absolutt krav om BHT uavhengig av risiko.\n\nVidere, hvis en ulykke faktisk skjer, trer **Kapittel 5** inn. Du har en beinhard meldeplikt. Alvorlige ulykker skal meldes til Arbeidstilsynet og nærmeste politimyndighet **straks**.",
        "leadershipInsight": "Ikke bruk BHT som en 'plaster-tjeneste' etter at folk har blitt syke. De er rådgivere. Bruk dem proaktivt i kartleggingen av det psykososiale arbeidsmiljøet eller når du skal vurdere tilrettelegging.",
        "deepDive": "#### 📝 Varsling vs. Registrering\nDet er forskjell på hendelser:\n1. **Alvorlige ulykker (§ 5-2):** Skal meldes *straks* (på telefon). Ikke rydd åstedet før politiet/Arbeidstilsynet gir tillatelse.\n2. **Registrering av nesten-ulykker (§ 5-1):** Alle skader og ulykker som *kunne* ha medført skade skal registreres i ditt HMS-system. Denne loggen vil Arbeidstilsynet kreve å se ved neste tilsyn for å sjekke om dere lærer av feil.",
        "keyTakeaways": [
          "Sjekk om din bransje er lovpålagt å ha en avtale med godkjent BHT.",
          "BHT skal bistå *både* arbeidsgiver og arbeidstakerne for å skape et sunt arbeidsmiljø.",
          "Ved alvorlig personskade har du umiddelbar meldeplikt til politi og Arbeidstilsyn."
        ],
        "commonPitfalls": [
          "Papir-BHT: Å betale for en BHT-avtale, men aldri bruke dem aktivt i det forebyggende arbeidet (f.eks. til ergonomisk kartlegging eller vernerunder). Arbeidstilsynet gir pålegg for 'sovende' avtaler."
        ],
        "refLawIds": ["aml-3-3", "aml-5-1"]
      },
      "durationMinutes": 30
    },
    {
      "id": "pro-oj-legal-audit",
      "title": "OJT: Juridisk Due Diligence",
      "order": 11,
      "kind": "on_job",
      "config": { "points": 800, "requiresApproval": true, "badgeId": "badge-legal-auditor" },
      "content": {
        "tasks": [
          {
            "id": "audit-exercise",
            "title": "🔍 Avdekk bedriftens største risiko",
            "description": "Logg inn i plattformens Risk-modul. Velg det området (Arbeidstid, Innleie, Varsling) der dere har størst risiko for gebyr. Formuler en strakstiltaksplan. Må godkjennes av VO/Styreleder.",
            "evidenceType": "text_response",
            "requiredRole": "Styreleder / Verneombud",
            "actionLink": "/compliance/legal-audit"
          }
        ]
      },
      "durationMinutes": 180
    }
  ]$AMPRO_V8$::jsonb,
  $AMPRO_V8_META$
  {
    "schemaVersion": 8,
    "status": "published",
    "tags": ["masterclass","leadership","legal-safety","aimsly-pro","compliance"],
    "lawRefs": [
      {"id":"aml-2-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 2-1 og § 2-3","title":"Arbeidsgivers ansvar og arbeidstakers medvirkningsplikt"},
      {"id":"aml-2a-1","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 2 A","title":"Varsling om kritikkverdige forhold"},
      {"id":"aml-3-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 3-3","title":"Bedriftshelsetjeneste"},
      {"id":"aml-4-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-3","title":"Psykososialt arbeidsmiljø"},
      {"id":"aml-4-6","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-6","title":"Tilrettelegging for arbeidstakere med redusert arbeidsevne"},
      {"id":"aml-5-1","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 5","title":"Registrering og melding av skader og ulykker"},
      {"id":"aml-6-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 6-3","title":"Verneombudets rett til å stanse farlig arbeid"},
      {"id":"aml-9","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 9","title":"Kontrolltiltak i virksomheten"},
      {"id":"aml-10","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 10","title":"Arbeidstid"},
      {"id":"aml-13","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 13","title":"Vern mot diskriminering og trakassering"},
      {"id":"aml-14-12","lawName":"Arbeidsmiljøloven","paragraph":"§ 14-12","title":"Innleie fra bemanningsforetak"},
      {"id":"aml-15-7","lawName":"Arbeidsmiljøloven","paragraph":"§ 15-6 og § 15-7","title":"Vern mot usaklig oppsigelse og prøvetid"},
      {"id":"aml-19-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 19-1","title":"Straff"}
    ]
  }
  $AMPRO_V8_META$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title,
  description = excluded.description,
  modules = excluded.modules,
  meta = excluded.meta;
