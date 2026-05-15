-- Seed a new system course: "Arbeidsmiljøloven for ledere: Den harde
-- juridiske realiteten" (c-aml-masterclass-2026-v6 / aml-ledere-pro).
--
-- This is an additional masterclass alongside the existing c-aml-ledere
-- (the "Fra paragraf til praksis" course). The v6 export goes deeper on
-- straffeansvar, arbeidstid (Veireno-saken), Verneombudets stansingsrett,
-- varsling (Kap. 2 A) og ulovlig innleie — built for ledere som ønsker
-- en ufiltrert juridisk overlevelsesguide.
--
-- Source: gemini export, version 6 schema (2026-05-14).
-- Idempotent: insert ... on conflict do update on both rows.
--
-- Self-audit (Arbeidstilsynet POV):
--  • Pålegg-grunner addressed: AML § 2-1 (delegasjonsfellen), kap. 10
--    (arbeidstid), kap. 2 A (varsling), § 14-12 (ulovlig innleie),
--    § 6-3 (VO stansingsrett), § 19-1 (straffeansvar).
--  • Restrisiko: dette er et tekst- og refleksjonskurs, ikke en
--    quiz-basert sertifisering — supplement med kontrollspørsmål når
--    bedriftens compliance-rutiner krever det.

-- 1. Upsert the new system course.
insert into public.learning_system_courses (id, slug, default_locale, law_refs)
values (
  'c-aml-masterclass-2026-v6',
  'aml-ledere-pro',
  'nb',
  '["AML § 2-1","AML kap. 2 A","AML § 4-3","AML § 4-6","AML § 6-3","AML kap. 10","AML § 14-12","AML § 19-1"]'::jsonb
)
on conflict (id) do update set
  slug = excluded.slug,
  default_locale = excluded.default_locale,
  law_refs = excluded.law_refs;

-- 2. Upsert the nb locale with title, description, modules, meta.
insert into public.learning_system_course_locales (
  system_course_id, locale, title, description, modules, meta
)
values (
  'c-aml-masterclass-2026-v6',
  'nb',
  'Arbeidsmiljøloven for ledere: Den harde juridiske realiteten',
  'En ufiltrert Masterclass i arbeidsrett, straffeansvar og ledelsens handlingsplikt. Kurset dekker Høyesterettspraksis, Arbeidstilsynets sanksjonsregime (opptil 4% av omsetning) og gir deg verktøyene for å unngå personlig straffeansvar.',
  $AMPRO_MODULES$[
    {
      "id": "pro-m01",
      "title": "Kapittel 1: Din nye rolle som juridisk garantist (og skyteskive)",
      "order": 1,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 200,
        "badgeId": "badge-commander"
      },
      "content": {
        "bodyMarkdown": "### Realiteten: Bøter på opptil 4 % av omsetningen\n\nLa oss legge bort HR-flosklene et øyeblikk. Arbeidsmiljøloven § 2-1 slår fast at det er du som daglig leder som svarer for at systemet fungerer. Hvis du feiler, er sanksjonene i dag ekstreme. Regjeringen har nylig hevet den øvre grensen for Arbeidstilsynets overtredelsesgebyr til hele **50 G (ca. 6,5 millioner kroner) eller 4 % av virksomhetens omsetning**, avhengig av hva som er høyest. I tillegg er det nå innført et **rent objektivt foretaksstraffansvar**. Det betyr at selskapet ditt får millionbøter uavhengig av om du eller noen andre i ledelsen har utvist personlig skyld.\n\nDu kan gjerne delegere oppgaven med å gå en vernerunde, men du kan aldri delegere bort ansvaret for at systemet fungerer.",
        "leadershipInsight": "I 2025 delte Arbeidstilsynet ut gebyrer for nær 90 millioner kroner i over 570 saker. Dette er ikke papirtigere; det er inndragning av din bunnlinje. Å ha et digitalt HMS-system (som Comlitor/Aimsly) er din eneste forsikring.",
        "deepDive": "#### Rettspraksis: Dommen som endret alt (HR-2019-2205-A)\nI denne saken ble en toppleder straffedømt selv om han hadde delegert HMS-ansvaret skriftlig til en avdelingsleder. Hvorfor? Fordi topplederen aldri hadde *etterspurt* dokumentasjon på at avdelingslederen faktisk gjorde jobben sin. Manglende dokumentasjon av et HMS-system er i seg selv straffbart.",
        "keyTakeaways": [
          "Overtredelsesgebyret er hevet til maks 4 % av selskapets omsetning.",
          "Foretaksstraffen i Norge er nå rent objektiv – selskapet straffes selv om ingen har direkte skyld.",
          "Delegasjon fritar ikke for straffeansvar dersom du ikke aktivt kontrollerer delegasjonen."
        ],
        "commonPitfalls": [
          "Delegasjonsfellen: Å tro at et delegasjonsdokument i personalmappen fritar deg for ansvar. Arbeidstilsynet vil kreve å se *loggen* for hvordan du kontrollerte at delegasjonen ble fulgt opp."
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
      "config": {
        "isCompulsory": true,
        "points": 350
      },
      "content": {
        "bodyMarkdown": "### Ubetinget fengsel for systematiske overtidsovertramp\n\nTror du Arbeidstilsynet bare deler ut bøter? Feil. Arbeidsmiljøloven Kapittel 10 setter absolutte grenser for hvor mye de ansatte kan jobbe. Maksimalt 9 timer om dagen og minimum 11 timer hviletid mellom øktene er hovedregelen.\n\nI den historiske høyesterettsdommen fra 2020 (**Veireno-saken**) ble daglig leder dømt til **120 dagers ubetinget fengsel**. Han ble holdt personlig strafferettslig ansvarlig for 1080 brudd på arbeidstidsbestemmelsene. Høyesterett slo fast at systematiske brudd på hviletid og overtid er grov arbeidslivskriminalitet, uansett om det skjedde for å \"redde et prosjekt\".",
        "leadershipInsight": "I teknologiselskaper er overtidsbruk ofte et symptom på dårlig prosjektstyring eller ressursmangel. Bruk arbeidstidsdata proaktivt for å beskytte dine ansatte mot utbrenthet – og deg selv mot straffeforfølgelse.",
        "deepDive": "#### Særlig uavhengig stilling (§ 10-12)\nMange bedrifter går i fellen ved å definere konsulenter eller seniorer som 'særlig uavhengig stilling' i kontrakten for å unngå overtidsbetaling. Rettspraksis er knallhard her: Det holder ikke at de styrer sin egen arbeidsdag. Hvis de er underlagt stramme prosjektfrister, kundekrav eller krav om faktureringsgrad, er de *ikke* uavhengige i lovens forstand.",
        "keyTakeaways": [
          "Systematiske brudd på AML kapittel 10 kan medføre ubetinget fengsel for daglig leder.",
          "Tittelen 'Senior' eller 'Manager' gir ikke automatisk unntak fra overtidsreglene.",
          "De ansatte kan ikke inngå private, frivillige avtaler om å fravike lovens minimumskrav til hviletid."
        ],
        "commonPitfalls": [
          "Feilklassifisering: Å gi en ansatt fastlønn og tro man er fritatt fra AML kap. 10. Dette kan føre til tilbakevirkende krav om overtidsbetaling for flere år."
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
      "config": {
        "isCompulsory": true,
        "points": 250
      },
      "content": {
        "bodyMarkdown": "### Når din egen ansatt stenger ned driften\n\nDu leder bedriften, men verneombudet (VO) er lovens forlengede arm på arbeidsplassen. Mange ledere får et brutalt møte med loven den dagen verneombudet benytter seg av **stansingsretten (§ 6-3)**.",
        "leadershipInsight": "Involver verneombudet tidlig i alle endringsprosesser. Et godt samarbeid med VO er din beste forsikring mot at konflikter eskalerer ut av huset.",
        "deepDive": "#### Maktfordelingen: Du kan ikke overprøve VO\nVerneombudet har lovfestet rett til å stanse arbeidet dersom det er umiddelbar fare for liv og helse. Dette gjelder også psykososial helse (ekstremt arbeidspress/trakassering). **Som leder har du ikke lov til å overprøve denne stansen.** Kun Arbeidstilsynet kan oppheve en stans initiert av VO. Å beordre ansatte tilbake i arbeid etter at VO har stanset driften, vil bli ansett som et grovt og straffbart lovbrudd fra din side.",
        "keyTakeaways": [
          "Innleide konsulenter teller med når du skal beregne om dere overstiger 10 ansatte (krav for VO) eller 30 ansatte (krav for AMU).",
          "Verneombudets stansingsrett er absolutt inntil Arbeidstilsynet fatter et vedtak."
        ],
        "commonPitfalls": [
          "Ignoreringsfellen: Å ta beslutninger om omorganisering eller nye prosjekter uten å formelt drøfte de arbeidsmiljømessige konsekvensene med VO først."
        ],
        "refLawIds": ["aml-6-3"]
      },
      "durationMinutes": 35
    },
    {
      "id": "pro-m04",
      "title": "Kapittel 4: Varsling (Kap. 2 A) – Minefeltet for erstatning",
      "order": 4,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 300,
        "badgeId": "badge-ethics-officer"
      },
      "content": {
        "bodyMarkdown": "### Aktivitetsplikt og gjengjeldelsesforbud\n\nNår en ansatt sier fra om kritikkverdige forhold utløses reglene i Kapittel 2 A. Lovverket beskytter varsleren ekstremt sterkt, og kravene til arbeidsgiver er rigide.",
        "leadershipInsight": "En kultur for varsling er en sunn kultur. Det betyr at problemene løses internt før de havner i media eller hos advokater.",
        "deepDive": "#### Forbudet mot gjengjeldelse (§ 2 A-4)\nFra det sekundet du mottar et varsel, har du *aktivitetsplikt* (§ 2 A-3). Saken må undersøkes. Det er et **absolutt forbud mot gjengjeldelse** mot varsleren (§ 2 A-4). Dette inkluderer subtile ting som endring i arbeidsoppgaver, sosial utfrysing, eller uforklarlig stans i karriereutvikling. **Merk:** Det er *arbeidsgiver* som har bevisbyrden for at gjengjeldelse ikke har funnet sted.",
        "keyTakeaways": [
          "Virksomheter med 5 eller flere ansatte skal ha skriftlige, interne varslingsrutiner.",
          "Arbeidsgiver har bevisbyrden ved påstander om gjengjeldelse.",
          "Erstatningsansvaret ved brudd på varslervernet er objektivt og kan bli svært kostbart for bedriften."
        ],
        "commonPitfalls": [
          "Identifikasjonsfellen: Å dele navnet på varsleren med den det varsles på. Brudd på konfidensialitet i startfasen av en varslingssak er et alvorlig tillitsbrudd og potensielt lovbrudd."
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
      "config": {
        "isCompulsory": true,
        "points": 300
      },
      "content": {
        "bodyMarkdown": "### Slutten på det fleksible konsulentmarkedet?\n\nNorsk lov krever at ansatte i utgangspunktet skal ha fast stilling. Innleieregler for bemanningsforetak (§ 14-12) er kraftig strammet inn, og brudd her har nå høy prioritet hos Arbeidstilsynet for utstedelse av milliongebyrer.",
        "leadershipInsight": "Skillet mellom å kjøpe en hyllevare/tjeneste (entreprise) og å 'leie inn en person' er den farligste gråsonen for en bedrift i dag.",
        "deepDive": "#### Krav om fast ansettelse ved ulovlig innleie\nInnleie fra bemanningsbyrå er stort sett kun tillatt for rene vikariater ved reelt fravær. Hvis du i praksis leier inn en konsulent fra et byrå til å dekke et fast behov (fordi dere ikke har egen kapasitet), er dette ofte ulovlig. Konsekvens: Konsulenten kan saksøke dere, kreve *fast ansettelse* direkte i deres selskap, samt erstatning.",
        "keyTakeaways": [
          "Arbeidstilsynet har ulovlig innleie som et høyprioritert satsingsområde.",
          "Ved entreprise (lovlig kjøp av tjeneste) må leverandøren ha prosjektledelsen og resultansvaret.",
          "Bemanningsforetak som leier ut ulovlig risikerer også å miste sin godkjenning."
        ],
        "commonPitfalls": [
          "Kamuflert innleie: Å skrive 'konsulentoppdrag' i avtalen, når realiteten er at personen sitter i deres lokaler og underlegges din daglige instruksjonsmyndighet. Retten dømmer etter realitet, ikke kontraktstittel."
        ],
        "refLawIds": ["aml-14-12"]
      },
      "durationMinutes": 40
    },
    {
      "id": "pro-oj-legal-audit",
      "title": "OJT: Juridisk Due Diligence på eget hus",
      "order": 6,
      "kind": "on_job",
      "config": {
        "points": 800,
        "requiresApproval": true,
        "badgeId": "badge-legal-auditor"
      },
      "content": {
        "tasks": [
          {
            "id": "audit-exercise",
            "title": "Avdekk bedriftens største økonomiske risiko",
            "description": "Logg inn i Aimsly Compliance-modulen. Du skal velge det området (Arbeidstid, Innleie, eller Manglende HMS-dokumentasjon) der dere i dag har størst risiko for et overtredelsesgebyr. Beskriv kort dagens praksis og formuler en strakstiltaksplan. Må godkjennes av selskapets styreleder eller VO for å tildele poeng.",
            "evidenceType": "text_response",
            "requiredRole": "Styreleder / Verneombud",
            "actionLink": "/compliance/legal-audit"
          }
        ]
      },
      "durationMinutes": 180
    }
  ]$AMPRO_MODULES$::jsonb,
  $AMPRO_META$
  {
    "schemaVersion": 6,
    "status": "published",
    "tags": ["masterclass","leadership","legal-safety","aimsly-pro","compliance"],
    "lawRefs": [
      {"id":"aml-2-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 2-1","title":"Arbeidsgivers ansvar"},
      {"id":"aml-2a-1","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 2 A","title":"Varsling om kritikkverdige forhold"},
      {"id":"aml-4-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-3","title":"Psykososialt arbeidsmiljø"},
      {"id":"aml-4-6","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-6","title":"Tilrettelegging for arbeidstakere med redusert arbeidsevne"},
      {"id":"aml-6-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 6-3","title":"Verneombudets rett til å stanse farlig arbeid"},
      {"id":"aml-10","lawName":"Arbeidsmiljøloven","paragraph":"Kapittel 10","title":"Arbeidstid"},
      {"id":"aml-14-12","lawName":"Arbeidsmiljøloven","paragraph":"§ 14-12","title":"Innleie fra bemanningsforetak"},
      {"id":"aml-19-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 19-1","title":"Straff"}
    ]
  }
  $AMPRO_META$::jsonb
)
on conflict (system_course_id, locale) do update set
  title = excluded.title,
  description = excluded.description,
  modules = excluded.modules,
  meta = excluded.meta;
