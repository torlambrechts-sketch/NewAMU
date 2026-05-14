-- Replace c-aml-ledere/nb locale with the v4 masterclass content
-- (6 modules: 5 text chapters + 1 on_job risk-assessment exercise).
-- Course-level law_refs realigned to the new module set. The `en` locale is
-- left untouched and continues to carry the v3-shaped 21-module course.
-- Applied to remote first via Supabase MCP on 2026-05-14; this migration
-- exists so fresh DBs converge to the same state via `npm run db:migrate`.
-- Idempotent: UPDATE statements, safe to re-run.

update public.learning_system_courses
set law_refs = '["AML § 2-1","AML § 4-3","AML § 4-6","AML § 10-12","AML § 15-7"]'::jsonb
where id = 'c-aml-ledere';

update public.learning_system_course_locales
set
  title = 'Arbeidsmiljøloven for ledere: Fra paragraf til praksis',
  description = 'Dette er ikke et teorikurs. Det er din overlevelsesguide som leder. Vi oversetter Arbeidsmiljøloven til praktiske verktøy som sikrer dine ansatte, din bedrift og deg personlig.',
  modules = $MASTERCLASS$[
    {
      "id": "pro-m01",
      "title": "Kapittel 1: Din nye rolle som juridisk garantist",
      "order": 1,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 200,
        "badgeId": "badge-commander"
      },
      "content": {
        "bodyMarkdown": "### Velkommen til lederbordet – her stopper ansvaret\n\nMange tror at HMS handler om gule vester og vernebriller. Sannheten er at det handler om **tillit og risiko**. Arbeidsmiljøloven § 2-1 slår fast at det er du som daglig leder som svarer for lovbrudd. Du kan gjerne delegere oppgaven med å gå en vernerunde, men du kan aldri delegere bort selve ansvaret for at systemet fungerer.",
        "leadershipInsight": "Se på HMS-ansvaret som en forsikringspolise for din egen karriere. Ved å ha orden i sysakene, bygger du en kultur der folk tør å si ifra før små feil blir til store katastrofer.",
        "deepDive": "#### Rettspraksis: Dommen som endret alt (HR-2019-2205-A)\nI denne saken ble en toppleder straffedømt selv om han hadde delegert HMS-ansvaret skriftlig til en avdelingsleder. Hvorfor? Fordi topplederen aldri hadde *etterspurt* dokumentasjon på at avdelingslederen faktisk gjorde jobben sin. Delegasjon uten kontroll er ansvarsfraskrivelse i rettens øyne.",
        "keyTakeaways": [
          "Du har et objektivt ansvar for alt som skjer i din avdeling.",
          "Delegasjon krever aktiv oppfølging – du må etterspørre bevis.",
          "Manglende dokumentasjon av et HMS-system er i seg selv straffbart."
        ],
        "commonPitfalls": [
          "Delegasjonsfellen: Å tro at et delegasjonsdokument fritar deg for ansvar. Praktisk tips: Sett opp en fast påminnelse i Aimsly hvor du halvårlig krever logg fra dem du har delegert oppgaver til."
        ],
        "refLawIds": ["aml-2-1"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m02",
      "title": "Kapittel 2: Arbeidstid og den dyre uavhengighetsfellen",
      "order": 2,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 250
      },
      "content": {
        "bodyMarkdown": "### Når er en ansatt egentlig uavhengig?\n\nArbeidsmiljøloven Kapittel 10 setter strenge grenser for hvor mye de ansatte kan jobbe. Maksimalt 9 timer om dagen og minimum 11 timer hviletid mellom øktene er hovedregelen. Brudd her er en av de vanligste årsakene til overtredelsesgebyr fra Arbeidstilsynet.",
        "leadershipInsight": "I teknologiselskaper er overtidsbruk ofte et symptom på dårlig prosjektstyring eller ressursmangel. Bruk arbeidstidsdata proaktivt for å beskytte dine beste ressurser mot utbrenthet.",
        "deepDive": "#### Særlig uavhengig stilling (§ 10-12)\nMange bedrifter går i fellen ved å definere konsulenter eller seniorer som 'særlig uavhengig stilling' i kontrakten for å unngå overtidsbetaling. Rettspraksis er knallhard her: Det holder ikke at de styrer sin egen arbeidsdag. Hvis de er underlagt stramme prosjektfrister, kundekrav eller krav om faktureringsgrad, er de *ikke* uavhengige i lovens forstand.",
        "keyTakeaways": [
          "Arbeidstidsgrensene gjelder for nesten alle ansatte, uansett om overtiden er 'frivillig'.",
          "Tittelen 'Senior' eller 'Manager' gir ikke automatisk unntak fra overtidsreglene.",
          "Systematiske brudd på arbeidstidsreglene kan gi straffeansvar for deg som leder."
        ],
        "commonPitfalls": [
          "Feilklassifisering: Å gi en ansatt fastlønn og tro man er fritatt fra AML kap. 10. Dette kan føre til tilbakevirkende krav om overtidsbetaling for flere år, noe som kan velte hele budsjetter."
        ],
        "refLawIds": ["aml-10-12"]
      },
      "durationMinutes": 45
    },
    {
      "id": "pro-m03",
      "title": "Kapittel 3: Sykefravær og tilretteleggingens grenser",
      "order": 3,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 300,
        "badgeId": "badge-people-care"
      },
      "content": {
        "bodyMarkdown": "### Hva gjør du når stolen står tom?\n\nSykefraværsoppfølging etter **AML § 4-6** handler ikke om å kontrollere *hva* som feiler folk, men om å legge til rette for at de kan jobbe med det de har av restarbeidsevne. Du må overholde fristene for oppfølgingsplan (4 uker) og dialogmøte (7 uker).",
        "leadershipInsight": "Kompetanse er ferskvare. Hver dag en ansatt er borte, taper teamet fremdrift. Rask dialog og tilrettelegging er din beste 'retention'-strategi.",
        "deepDive": "#### Hvor går grensen for tilrettelegging?\nLoven krever at du tilrettelegger 'så langt det er mulig'. Men rettspraksis slår fast at plikten har en grense. Du er ikke pliktig til å opprette en helt ny stilling («make-work»), og tilretteleggingen skal ikke gå uforholdsmessig mye ut over andre ansatte i teamet.",
        "keyTakeaways": [
          "Lag alltid en skriftlig oppfølgingsplan innen uke 4 – dette er ditt viktigste bevis ved tilsyn.",
          "Fokuser på restarbeidsevne, aldri på diagnosen (GDPR-hensyn).",
          "Tilretteleggingsplikten er vid, men ikke absolutt hvis den ødelegger for bedriftens kjernevirksomhet."
        ],
        "commonPitfalls": [
          "Diagnosefellen: Å spørre den ansatte 'Hva feiler det deg?'. Spør i stedet: 'Hvilke oppgaver klarer du å utføre akkurat nå?'.",
          "Uendelig tilrettelegging: Hvis en ansatts krav om tilrettelegging fører til at resten av teamet må jobbe konstant overtid, har man krysset grensen for hva som er 'rimelig'."
        ],
        "refLawIds": ["aml-4-6"]
      },
      "durationMinutes": 40
    },
    {
      "id": "pro-m04",
      "title": "Kapittel 4: Konflikter, varsling og det usynlige miljøet",
      "order": 4,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 250
      },
      "content": {
        "bodyMarkdown": "### Når ord står mot ord\n\nAML § 4-3 krever at arbeidet legges til rette slik at arbeidstakerens integritet og verdighet ivaretas. Varslingssaker og påstander om trakassering er de mest krevende sakene en leder kan havne i, spesielt fordi de ofte mangler objektive bevis.",
        "leadershipInsight": "De flinkeste folka slutter sjelden på grunn av selve oppgavene; de slutter på grunn av et dårlig psykososialt miljø. Å håndtere konflikter raskt bygger tillit.",
        "deepDive": "#### Håndtering av ord-mot-ord\nHvis ansatt A påstår seg utfryst av B, og B nekter for alt, hva gjør du da? Lovens krav er ikke at du skal være dommer i en rettssal. Kravet er at du undersøker saken metodisk, nøytralt og at du dokumenterer prosessen. Mens undersøkelsen pågår, bør du sette inn midlertidige tiltak, som for eksempel å endre hvem som rapporterer til hvem.",
        "keyTakeaways": [
          "Du har plikt til å forebygge og håndtere konflikter aktivt.",
          "Det er den ansattes *subjektive opplevelse* som ofte trigger en undersøkelse.",
          "Dokumenter hvem du har snakket med, når, og hvilke konklusjoner som ble trukket."
        ],
        "commonPitfalls": [
          "Dommerfellen: Å tro du må finne en objektiv 'vinner' i en ord-mot-ord sak. Retten ser på om din saksbehandling og dine undersøkelser var habile og forsvarlige."
        ],
        "refLawIds": ["aml-4-3"]
      },
      "durationMinutes": 50
    },
    {
      "id": "pro-m05",
      "title": "Kapittel 5: Oppsigelse og det tapte dokumentasjonssporet",
      "order": 5,
      "kind": "text",
      "config": {
        "isCompulsory": true,
        "points": 350,
        "badgeId": "badge-hr-legal"
      },
      "content": {
        "bodyMarkdown": "### Veien ut må bygges på papir\n\nOppsigelse etter kapittel 15 krever **saklig grunn**. Det stilles enorme krav til arbeidsgiver i norsk rett når det gjelder oppsigelse grunnet arbeidstakers egne forhold (manglende prestasjon, samarbeidsproblemer).",
        "leadershipInsight": "Å beholde en underpresterende medarbeider som sprer negativitet er urettferdig overfor resten av teamet. En formell og ryddig oppsigelsesprosess er ofte nødvendig for å ivareta det store fellesskapet.",
        "deepDive": "#### Drøftingsmøtet (§ 15-1) og advarsler\nFør en oppsigelse besluttes, *må* du avholde et drøftingsmøte. Men en gyldig oppsigelse for dårlig prestasjon starter aldri med dette møtet. Den starter måneder i forveien. Uten formelle, skriftlige advarsler og referater fra oppfølgingssamtaler der arbeidstakeren ble gitt sjansen til å forbedre seg, vil oppsigelsen kjennes ugyldig av retten som følge av saksbehandlingsfeil.",
        "keyTakeaways": [
          "En oppsigelse kan være materielt riktig, men kjennes ugyldig på grunn av prosessfeil.",
          "Drøftingsmøtet (§ 15-1) skal skje *før* en endelig beslutning er tatt.",
          "Syke og gravide har et forsterket vern mot oppsigelse i loven."
        ],
        "commonPitfalls": [
          "Manglende dokumentasjonsspor: Å kalle inn til drøftingsmøte for manglende prestasjoner uten å ha referater fra 6-12 måneder med korrigerende samtaler og skriftlige advarsler å vise til."
        ],
        "refLawIds": ["aml-15-7"]
      },
      "durationMinutes": 50
    },
    {
      "id": "pro-oj-risk",
      "title": "Praktisk trening: Din første risikovurdering",
      "order": 6,
      "kind": "on_job",
      "config": {
        "points": 600,
        "requiresApproval": true,
        "badgeId": "badge-risk-master"
      },
      "content": {
        "tasks": [
          {
            "id": "ros-exercise",
            "title": "Kartlegg risikobildet",
            "description": "Logg inn i Aimsly Risk-modulen. Utfør en konkret ROS-analyse (Risiko- og Sårbarhetsanalyse) på din egen avdeling, med spesielt fokus på psykososiale farer knyttet til høyt arbeidspress eller prosjektfrister. Verneombudet må signere analysen elektronisk før poengene frigjøres.",
            "evidenceType": "file_upload",
            "requiredRole": "Verneombud",
            "actionLink": "/compliance/risk-assessment"
          }
        ]
      },
      "durationMinutes": 120
    }
  ]$MASTERCLASS$::jsonb,
  meta = jsonb_build_object(
    'schemaVersion', 4,
    'status', 'published',
    'tags', jsonb_build_array('masterclass','leadership','legal-safety','aimsly-pro'),
    'lawRefs', $LAWREFS$[
      {"id":"aml-2-1","lawName":"Arbeidsmiljøloven","paragraph":"§ 2-1","title":"Arbeidsgivers ansvar"},
      {"id":"aml-4-3","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-3","title":"Psykososialt arbeidsmiljø"},
      {"id":"aml-4-6","lawName":"Arbeidsmiljøloven","paragraph":"§ 4-6","title":"Tilrettelegging for arbeidstakere med redusert arbeidsevne"},
      {"id":"aml-10-12","lawName":"Arbeidsmiljøloven","paragraph":"§ 10-12","title":"Unntak fra arbeidstidsbestemmelsene"},
      {"id":"aml-15-7","lawName":"Arbeidsmiljøloven","paragraph":"§ 15-7","title":"Vern mot usaklig oppsigelse"}
    ]$LAWREFS$::jsonb
  )
where system_course_id = 'c-aml-ledere' and locale = 'nb';
