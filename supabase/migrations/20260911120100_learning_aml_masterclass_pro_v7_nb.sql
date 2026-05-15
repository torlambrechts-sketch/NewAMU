-- Update c-aml-masterclass-2026-v6 with v7 content (gemini export 2026-05-15).
--
-- v7 expands the course from 5 text chapters + 1 OJT to 8 text chapters
-- + 1 OJT, adds Kapittel 6 (sykefravær), Kapittel 7 (oppsigelse), Kapittel 8
-- (trakassering + delt bevisbyrde). All chapters now use richer markdown
-- (emoji headings, bold bullets) that lands cleanly through Tailwind
-- Typography in the Hjem player.
--
-- Course id, slug and title intentionally unchanged so existing learner
-- progress survives the bump. Meta.schemaVersion bumps to 7.
--
-- Applied to remote first via Supabase MCP on 2026-05-15.
-- Idempotent: insert ... on conflict do update on both rows.

-- 1. Refresh course-level law_refs (10 anchors now — adds AML kap. 13 and § 15-7).
insert into public.learning_system_courses (id, slug, default_locale, law_refs)
values (
  'c-aml-masterclass-2026-v6',
  'aml-ledere-pro',
  'nb',
  '["AML § 2-1","AML kap. 2 A","AML § 4-3","AML § 4-6","AML § 6-3","AML kap. 10","AML kap. 13","AML § 14-12","AML § 15-7","AML § 19-1"]'::jsonb
)
on conflict (id) do update set
  slug = excluded.slug,
  default_locale = excluded.default_locale,
  law_refs = excluded.law_refs;

-- 2. Replace nb locale modules + meta with v7 content (8 text + 1 OJT).
insert into public.learning_system_course_locales (
  system_course_id, locale, title, description, modules, meta
)
values (
  'c-aml-masterclass-2026-v6',
  'nb',
  'Arbeidsmiljøloven for ledere: Den harde juridiske realiteten',
  'En ufiltrert Masterclass i arbeidsrett, straffeansvar og ledelsens handlingsplikt. Kurset dekker Høyesterettspraksis, Arbeidstilsynets sanksjonsregime og gir deg verktøyene for å unngå personlig straffeansvar.',
  $AMPRO_V7$[
    {
      "id": "pro-m01",
      "title": "Kapittel 1: Din rolle som juridisk garantist (og skyteskive)",
      "order": 1,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 200, "badgeId": "badge-commander" },
      "content": {
        "bodyMarkdown": "### 🏛️ Realiteten: Bøter på opptil 4 % av omsetningen\n\nLa oss legge bort HR-flosklene et øyeblikk. **Arbeidsmiljøloven § 2-1** slår fast at det er *du* som daglig leder som svarer for at systemet fungerer.\n\nHvis du feiler, er sanksjonene i dag ekstreme. Den øvre grensen for Arbeidstilsynets overtredelsesgebyr er nå:\n* 💰 **50 G** (ca. 6,5 millioner kroner) ELLER\n* 📈 **4 %** av virksomhetens totale omsetning (det som er høyest).\n\nI tillegg er det innført et **rent objektivt foretaksstraffansvar**. Det betyr at selskapet får millionbøter uavhengig av om du eller andre i ledelsen har utvist personlig skyld.",
        "leadershipInsight": "I 2025 delte Arbeidstilsynet ut gebyrer for nær 90 millioner kroner. Dette er inndragning av bunnlinjen. Å bruke plattformen vår aktivt er din viktigste forsikring.",
        "deepDive": "#### ⚖️ Rettspraksis: Dommen som endret alt (HR-2019-2205-A)\nI denne saken ble en toppleder straffedømt til tross for skriftlig delegering av HMS-ansvaret. **Hvorfor?** Topplederen hadde aldri *etterspurt* dokumentasjon på at jobben faktisk ble gjort. Manglende dokumentasjon av et system er i seg selv straffbart.",
        "keyTakeaways": [
          "Gebyret er hevet til maks 4 % av omsetningen.",
          "Foretaksstraffen er rent objektiv.",
          "Delegasjon fritar *ikke* for straffeansvar uten aktiv kontroll."
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
      "title": "Kapittel 5: Ulovlig innleie – En garantert søksmålsrisiko",
      "order": 5,
      "kind": "text",
      "config": { "isCompulsory": true, "points": 300 },
      "content": {
        "bodyMarkdown": "### 🤝 Slutten på det fleksible konsulentmarkedet?\n\nNorsk lov krever at ansatte i utgangspunktet skal ha fast stilling. Innleieregler fra bemanningsforetak (§ 14-12) er kraftig strammet inn og er nå høyt prioritert av Arbeidstilsynet.",
        "leadershipInsight": "Skillet mellom å kjøpe en 'tjeneste' (entreprise) og å 'leie inn en person' er den farligste gråsonen for en bedrift i dag.",
        "deepDive": "#### ⚠️ Krav om fast ansettelse ved ulovlig innleie\nInnleie fra bemanningsbyrå er stort sett kun tillatt for rene vikariater ved reelt fravær. Hvis du i praksis leier inn en IT-konsulent for å dekke et fast kapasitetsbehov, er dette ofte ulovlig. **Konsekvens:** Konsulenten kan saksøke dere, kreve *fast ansettelse* direkte i deres selskap, samt massiv erstatning.",
        "keyTakeaways": [
          "Arbeidstilsynet har ulovlig innleie som satsingsområde.",
          "Ved entreprise (kjøp av tjeneste) *må* leverandøren ha prosjektledelsen."
        ],
        "commonPitfalls": [
          "Kamuflert innleie: Å skrive 'konsulentoppdrag' i avtalen, når personen faktisk sitter i deres lokaler underlagt din daglige instruksjonsmyndighet. Retten dømmer etter realitet, ikke tittel."
        ],
        "refLawIds": ["aml-14-12"]
      },
      "durationMinutes": 40
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
        "deepDive": "#### 📝 Drøftingsmøtet (§ 15-1) og advarsler\nFør oppsigelse besluttes, *må* du ha et drøftingsmøte. Men en gyldig oppsigelse for dårlig prestasjon starter aldri her. Den starter måneder i forveien med korrigerende samtaler og skriftlige advarsler. Uten dette dokumentasjonssporet, vil retten kjenne oppsigelsen ugyldig på grunn av saksbehandlingsfeil.",
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
      "id": "pro-oj-legal-audit",
      "title": "OJT: Juridisk Due Diligence",
      "order": 9,
      "kind": "on_job",
      "config": { "points": 800, "requiresApproval": true, "badgeId": "badge-legal-auditor" },
      "content": {
        "tasks": [
          {
            "id": "audit-exercise",
            "title": "🔍 Avdekk bedriftens største risiko",
            "description": "Logg inn i Risk-modulen. Velg det området (Arbeidstid, Innleie, Varsling) der dere har størst risiko for gebyr. Formuler en strakstiltaksplan. Må godkjennes av VO/Styreleder.",
            "evidenceType": "text_response",
            "requiredRole": "Styreleder / Verneombud",
            "actionLink": "/compliance/legal-audit"
          }
        ]
      },
      "durationMinutes": 180
    }
  ]$AMPRO_V7$::jsonb,
  $AMPRO_V7_META$
  {
    "schemaVersion": 7,
    "status": "published",
    "tags": ["masterclass","leadership","legal-safety","aimsly-pro","compliance"],
    "lawRefs": [
      {"id":"aml-2-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 2-1","title":"Arbeidsgivers ansvar"},
      {"id":"aml-2a-1","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 2 A","title":"Varsling om kritikkverdige forhold"},
      {"id":"aml-4-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-3","title":"Psykososialt arbeidsmiljø"},
      {"id":"aml-4-6","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-6","title":"Tilrettelegging for arbeidstakere med redusert arbeidsevne"},
      {"id":"aml-6-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 6-3","title":"Verneombudets rett til å stanse farlig arbeid"},
      {"id":"aml-10","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 10","title":"Arbeidstid"},
      {"id":"aml-13","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 13","title":"Vern mot diskriminering og trakassering"},
      {"id":"aml-14-12","lawName":"Arbeidsmiljøloven","paragraph":"§ 14-12","title":"Innleie fra bemanningsforetak"},
      {"id":"aml-15-7","lawName":"Arbeidsmiljøloven","paragraph":"§ 15-7","title":"Vern mot usaklig oppsigelse"},
      {"id":"aml-19-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 19-1","title":"Straff"}
    ]
  }
  $AMPRO_V7_META$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title,
  description = excluded.description,
  modules = excluded.modules,
  meta = excluded.meta;
