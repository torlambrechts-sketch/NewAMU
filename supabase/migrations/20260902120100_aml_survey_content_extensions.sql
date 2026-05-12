-- AML undersøkelser — innholds-utvidelser fase 1.
--
-- Coverage gap closed (compliance-analyse 2026-05-11, DEL 2):
--   * Fire eksisterende stub-maler får validert innhold:
--       tpl-qps-nordic (5→34 items, 7 subskaler)
--       tpl-ark        (4→21 items, 5 subskaler)
--       tpl-mobbing    (3→14 items, NAQ-R + sex.trakassering + ledelse)
--   * Sju nye maler legges til:
--       tpl-arp-likestilling     LDL § 26 — ARP-kartlegging
--       tpl-vold-trusler         AML § 4-3 (3) — vold/trusler
--       tpl-stikkprove-fysisk    AML § 4-4 — fysisk arbeids­miljø
--       tpl-endring-baseline     AML § 4-1 (3) — FØR omstilling
--       tpl-endring-puls         AML § 4-1 (3) — UNDER omstilling
--       tpl-endring-etter        AML § 4-1 (3) — ETTER omstilling
--       tpl-amu-arsrapport-input AML § 7-2 g — AMU paritetisk vurdering
--   * Fire nye question-typer (catalog-only): voting, consent,
--     traffic_light, priority_top3 — DB CHECK på org_survey_questions
--     utvides slik at materialisering fra katalog ikke feiler.
--   * mandatory_law-enum utvides med AML_4_3_3, AML_4_1_3, LDL_26.
--
-- Self-audit (Arbeidstilsynet + Datatilsynet POV):
--   * § 4-3 hovedkartlegging: ≥ 15 mandatory items dekket av QPS Nordic.
--   * § 4-3 (3) trakassering: NAQ-R kortform + separat sex.trakassering.
--   * § 4-1 (3) endring: FØR/UNDER/ETTER med samme kjernel-items for
--     direkte sammenligning baseline → puls → etter.
--   * LDL § 26: alle seks diskriminerings­grunnlag dekket; demografi
--     bak `consent`-trinn (GDPR Art. 7).
--   * Anonymitet: k≥5 default, k≥10 advarsel for trakassering.
--   * Restrisiko: UI-render for nye typer (voting/consent/traffic_light/
--     priority_top3) er ikke implementert — markert restanse fase 2.
--     Katalog­dataen er forward-kompatibel; manglende renderer faller
--     tilbake til generic display.
--
-- Spec: specs/aml-survey-content.md
-- Tilhørende TS-endring: modules/survey/surveyTemplateCatalogTypes.ts

set local search_path = public, pg_catalog;

-- ── 1. Utvid CHECK-constraint på org_survey_questions for nye typer ──────

alter table public.org_survey_questions
  drop constraint if exists org_survey_questions_question_type_check;

alter table public.org_survey_questions
  add constraint org_survey_questions_question_type_check
  check (question_type in (
    'rating_1_to_5',
    'rating_1_to_10',
    'text',
    'yes_no',
    'single_select',
    'multi_select',
    'multiple_choice',
    -- Compliance-driven (specs/aml-survey-content.md §2):
    'voting',
    'consent',
    'traffic_light',
    'priority_top3'
  ));

alter table public.survey_question_bank
  drop constraint if exists survey_question_bank_question_type_check;

alter table public.survey_question_bank
  add constraint survey_question_bank_question_type_check
  check (question_type in (
    'rating_1_to_5',
    'rating_1_to_10',
    'text',
    'yes_no',
    'single_select',
    'multi_select',
    'multiple_choice',
    'voting',
    'consent',
    'traffic_light',
    'priority_top3'
  ));

-- ── 2. UPDATE — tpl-qps-nordic (full QPS Nordic 34+) ─────────────────────

update public.survey_template_catalog set
  name = 'QPS Nordic 34+',
  description = 'Validert spørreskjema for psykososialt arbeids­miljø — STAMI/NIVA. Dekker syv subskaler: jobbkrav, rolle­forventninger, kontroll, forutsigbarhet, mestring, sosial støtte, ledelse. Anbefalt for hovedkartlegging hvert annet år.',
  source = 'STAMI / NIVA — QPSNordic-34+ (Pejtersen, Kristensen, Borg & Bjorner)',
  use_case = 'Hovedmåling psykososialt arbeids­miljø. Anbefalt cadence: hvert annet år; mellom­målinger via tpl-pulse.',
  estimated_minutes = 12,
  scoring_note = 'Snitt per subskala (skala 1-5). Risikoindikatorer: Jobbkrav > 3.5 (overbelastning); Kontroll < 3.0; Forutsigbarhet < 3.0; Sosial støtte < 3.5; Ledelse < 3.5. Subskala under terskel utløser tiltaks­plikt etter IK-f § 5 nr. 6.',
  body = $jsonb$
{
  "version": 2,
  "questions": [
    {"id":"qps1","text":"Er arbeidsbelastningen din ujevnt fordelt slik at det hoper seg opp?","type":"likert_5","required":true,"subscale":"Jobbkrav","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps2","text":"Må du jobbe overtid?","type":"likert_5","required":true,"subscale":"Jobbkrav","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps3","text":"Har du for mye å gjøre?","type":"likert_5","required":true,"subscale":"Jobbkrav","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps4","text":"Krever arbeidet ditt rask reaksjon på uventede situasjoner?","type":"likert_5","required":true,"subscale":"Jobbkrav","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps5","text":"Er det nødvendig å jobbe i et høyt tempo?","type":"likert_5","required":true,"subscale":"Jobbkrav","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps6","text":"Kjenner du tydelig til hvilke ansvars­områder du har?","type":"likert_5","required":true,"subscale":"Rolleforventninger","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps7","text":"Vet du nøyaktig hva som forventes av deg på jobben?","type":"likert_5","required":true,"subscale":"Rolleforventninger","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps8","text":"Får du mot­stridende beskjeder fra to eller flere personer?","type":"likert_5","required":true,"subscale":"Rolleforventninger","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps9","text":"Får du arbeids­oppgaver uten tilstrekkelige hjelpemidler eller ressurser?","type":"likert_5","required":true,"subscale":"Rolleforventninger","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps10","text":"Kan du selv bestemme arbeids­tempoet ditt?","type":"likert_5","required":true,"subscale":"Kontroll","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps11","text":"Kan du påvirke beslutninger som er viktige for arbeidet ditt?","type":"likert_5","required":true,"subscale":"Kontroll","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps12","text":"Kan du selv bestemme hvordan du skal utføre arbeidet?","type":"likert_5","required":true,"subscale":"Kontroll","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps13","text":"Hvis det finnes alternative metoder, kan du selv velge fremgangsmåte?","type":"likert_5","required":true,"subscale":"Kontroll","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps14","text":"Får du informasjon om viktige beslutninger, endringer og fremtids­planer i god tid?","type":"likert_5","required":true,"subscale":"Forutsigbarhet","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps15","text":"Får du all den informasjonen du trenger for å gjøre arbeidet ditt godt?","type":"likert_5","required":true,"subscale":"Forutsigbarhet","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps16","text":"Er du bekymret for å bli overflødig?","type":"likert_5","required":true,"subscale":"Forutsigbarhet","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps17","text":"Er du fornøyd med kvaliteten på arbeidet du utfører?","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps18","text":"Er du fornøyd med arbeidet du har gjort i løpet av siste 4 uker?","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps19","text":"Er det tilfreds­stillelse i arbeidet ditt?","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps20","text":"Føler du at du gjør noe nyttig på jobb?","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps21","text":"Hvis du trenger det, kan du få støtte og hjelp i arbeidet ditt fra kollegene dine?","type":"likert_5","required":true,"subscale":"Sosial støtte","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps22","text":"Hvis du trenger det, kan du få støtte og hjelp i arbeidet ditt fra nærmeste leder?","type":"likert_5","required":true,"subscale":"Sosial støtte","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps23","text":"Snakker du med kollegene dine om hvordan du har det på jobb?","type":"likert_5","required":true,"subscale":"Sosial støtte","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps24","text":"Føler du deg som del av et fellesskap på arbeidsplassen?","type":"likert_5","required":true,"subscale":"Sosial støtte","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps25","text":"Er det god stemning mellom deg og kollegene dine?","type":"likert_5","required":true,"subscale":"Sosial støtte","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps26","text":"Tar nærmeste leder hensyn til dine synspunkter?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps27","text":"Stoler nærmeste leder på sine medarbeidere?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps28","text":"Hjelper nærmeste leder deg med å utvikle dine ferdigheter?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps29","text":"Behandler nærmeste leder de ansatte rettferdig og likt?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps30","text":"Fordeler nærmeste leder arbeidet på en god måte?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Nesten alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"qps31","text":"Hva er det viktigste som fungerer godt på arbeidsplassen?","type":"long_text","required":false},
    {"id":"qps32","text":"Hva er det viktigste som bør forbedres?","type":"long_text","required":false},
    {"id":"qps33","text":"Har du opplevd uønskede hendelser (mobbing, trakassering, vold) siste 12 mnd? (Ved ja — kontakt verneombud eller bruk fordypnings­undersøkelse.)","type":"yes_no","required":false},
    {"id":"qps34","text":"Andre kommentarer (valgfritt)","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  updated_at = now()
where id = 'tpl-qps-nordic';

-- ── 3. UPDATE — tpl-ark (21 items) ───────────────────────────────────────

update public.survey_template_catalog set
  name = 'ARK Arbeidsmiljø',
  description = 'Bredt validert instrument for norsk arbeidsliv — NTNU. Dekker belastning, mestring, ledelse, kultur, helse. Egnet som hovedmåling for større virksomheter (≥ 30 ansatte).',
  source = 'NTNU — ARK Arbeidsmiljø-undersøkelsen',
  use_case = 'Hovedmåling for større virksomheter. Anbefalt hvert annet år.',
  estimated_minutes = 10,
  scoring_note = 'Snitt per subskala (1-5). Følg ARK-veiledning for terskler og benchmark mot bransje. Subskala under 3.5 utløser tiltaks­vurdering (IK-f § 5 nr. 6).',
  body = $jsonb$
{
  "version": 2,
  "questions": [
    {"id":"ark1","text":"Jeg har klare arbeids­oppgaver","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark2","text":"Jeg har påvirknings­muligheter på arbeidet mitt","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark3","text":"Min arbeidsmengde er overkommelig over tid","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark4","text":"Tidsfrister er realistiske","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark5","text":"Jeg har tid til oppgavene jeg er ansvarlig for","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark6","text":"Jeg får utviklet mine ferdigheter på jobben","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark7","text":"Jeg får tilbakemelding på arbeidet mitt","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark8","text":"Min kompetanse blir verdsatt og brukt","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark9","text":"Jeg ser muligheter for å utvikle meg videre her","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark10","text":"Min nærmeste leder behandler ansatte med respekt","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark11","text":"Min leder lytter til mine synspunkter","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark12","text":"Jeg samarbeider godt med kollegene mine","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark13","text":"Konflikter blir håndtert på en konstruktiv måte","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark14","text":"Jeg opplever rettferdig fordeling av arbeids­oppgaver","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark15","text":"Vi lærer av feil i avdelingen min","type":"likert_5","required":true,"subscale":"Kultur","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark16","text":"Endringer blir kommunisert i god tid","type":"likert_5","required":true,"subscale":"Kultur","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark17","text":"Det er rom for å si fra om kritikkverdige forhold","type":"likert_5","required":true,"subscale":"Kultur","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3"},
    {"id":"ark18","text":"Jeg trives på jobben min","type":"likert_5","required":true,"subscale":"Helse","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"ark19","text":"Jeg har god balanse mellom jobb og fritid","type":"likert_5","required":true,"subscale":"Helse","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"ark20","text":"Jeg ser på jobben med engasjement","type":"likert_5","required":true,"subscale":"Helse","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"ark21","text":"Hva er det viktigste vi bør jobbe med fremover?","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  updated_at = now()
where id = 'tpl-ark';

-- ── 4. UPDATE — tpl-mobbing (NAQ-R+ — 14 items) ──────────────────────────

update public.survey_template_catalog set
  name = 'Mobbing & trakassering — NAQ-R+',
  description = 'NAQ-R kortform (Negative Acts Questionnaire — Revised) supplert med dedikerte items for seksuell trakassering og ledelses­håndtering. Skjerpet anonymitet (k≥10). Brukes ved oppfølging av rødt flagg fra hovedmåling, etter varsel, eller som målrettet halvårlig kartlegging.',
  source = 'Einarsen, Hoel & Notelaers (2009) — NAQ-R kortform; supplert med Datatilsynets anbefalinger for seksuell trakassering',
  use_case = 'Oppfølging av varsel eller fordypning ved utslag i hoved­målingen. Krever sterk anonymitet og tydelig kommunikasjon om håndtering av frittekst.',
  estimated_minutes = 7,
  scoring_note = 'Mobbing-status: respondent regnes som mobbet hvis minst én NAQ-R-item rapporteres «ukentlig eller oftere» siste 6 mnd (Einarsens definisjon). Aggregat per avdeling kun hvis k≥10. Frittekst eksporteres aldri uten manuell anonymiserings­gjennomgang fra varslings­mottak.',
  law_ref = 'AML § 4-3 (3)',
  body = $jsonb$
{
  "version": 2,
  "questions": [
    {"id":"naqr1","text":"Noen har holdt tilbake informasjon som påvirket arbeidet ditt","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr2","text":"Du har blitt ignorert eller utestengt","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr3","text":"Du har vært utsatt for ryktespredning","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr4","text":"Noen har gjort seg lystig på din bekostning eller drevet gjøn med deg","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr5","text":"Noen har kommet med fornærmende eller støtende kommentarer","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr6","text":"Du har blitt fratatt ansvar eller arbeids­oppgaver, eller fått oppgaver med urimelige tids­frister","type":"likert_5","required":true,"subscale":"Arbeids-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr7","text":"Du har fått overdreven overvåkning av arbeidet ditt","type":"likert_5","required":true,"subscale":"Arbeids-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr8","text":"Du har blitt utsatt for press for å unngå å kreve det du har rett til (sykepenger, ferie, reise­utgifter)","type":"likert_5","required":true,"subscale":"Arbeids-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"naqr9","text":"Du har blitt utsatt for trusler om vold eller fysisk overgrep, eller direkte utsatt for det","type":"likert_5","required":true,"subscale":"Person-rettet","anchors":{"low":"Aldri","high":"Daglig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"st1","text":"Har du i løpet av siste 6 mnd vært utsatt for uønsket seksuell oppmerksomhet (ord, bilder, fysisk berøring) på arbeidsplassen?","type":"yes_no","required":true,"subscale":"Seksuell trakassering","is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"st2","text":"Hvis ja — ble det meldt?","type":"single_select","required":false,"subscale":"Seksuell trakassering","options":["Ja, til leder","Ja, til verneombud","Ja, til varslings­mottak","Ja, til tillitsvalgt","Nei","Vet ikke"]},
    {"id":"led1","text":"Hvis du varslet om mobbing/trakassering — opplevde du at det ble tatt på alvor?","type":"single_select","required":false,"subscale":"Ledelse","options":["Ikke aktuelt","Helt uenig","Litt uenig","Verken/eller","Litt enig","Helt enig"]},
    {"id":"led2","text":"Føler du deg trygg nok til å si fra hvis du opplever uakseptabel atferd?","type":"likert_5","required":true,"subscale":"Ledelse","anchors":{"low":"Aldri","high":"Alltid"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"ft1","text":"Beskriv kort (valgfritt). Svaret behandles konfidensielt og anonymisert. IKKE skriv navn eller detaljer som kan identifisere personer.","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  updated_at = now()
where id = 'tpl-mobbing';

-- ── 5. INSERT — tpl-arp-likestilling (LDL § 26 — ARP-kartlegging) ────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-arp-likestilling', null, true,
  'ARP — Likestilling og diskriminering',
  'ARP',
  'Aktivitets- og redegjørelses­plikten (LDL § 26). Kartlegger oppfattet forskjellsbehandling pga. kjønn, etnisitet, religion, funksjons­nedsettelse, alder og seksuell orientering. Krever eksplisitt samtykke før demografi spørres.',
  'LDL § 26 + Datatilsynets veileder 2023 for ansatte­undersøkelser',
  'Årlig ARP-kartlegging — krever redegjørelse i års­beretning ≥ 50 ansatte (eller ≥ 20 hvis parter krever).',
  'compliance', 'internal', 8, true,
  'Snitt per subskala (Direkte forskjellsbehandling, Strukturell). Items 12-13 rapporteres som forekomst. Krysstabuleringer kun hvis hver celle k≥5. Samtykke på item 1 styrer om demografi inkluderes.',
  'LDL § 26',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"cs1","text":"Vi spør om kjønn, etnisitet, religion, funksjons­nedsettelse, alder og seksuell orientering for å oppfylle aktivitets­plikten i LDL § 26. Du kan trekke samtykket tilbake når som helst (GDPR Art. 7 (3)). Samtykker du?","type":"consent","required":true},
    {"id":"arp2","text":"Jeg opplever at alle ansatte hos oss behandles likt uavhengig av kjønn","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp3","text":"Jeg opplever at alle ansatte behandles likt uavhengig av etnisk bakgrunn","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp4","text":"Jeg opplever at alle ansatte behandles likt uavhengig av religion / livssyn","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp5","text":"Jeg opplever at alle ansatte behandles likt uavhengig av funksjons­nedsettelse","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp6","text":"Jeg opplever at alle ansatte behandles likt uavhengig av alder","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp7","text":"Jeg opplever at alle ansatte behandles likt uavhengig av seksuell orientering / kjønnsidentitet","type":"likert_5","required":true,"subscale":"Direkte","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp8","text":"Karriere­muligheter er like tilgjengelige for alle uavhengig av bakgrunn","type":"likert_5","required":true,"subscale":"Strukturell","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp9","text":"Lønns- og forfremmelses­beslutninger oppleves som rettferdige","type":"likert_5","required":true,"subscale":"Strukturell","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp10","text":"Foreldre­permisjon eller deltids­arbeid har ikke negativ effekt på karriere­utviklingen","type":"likert_5","required":true,"subscale":"Strukturell","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp11","text":"Vi har en kultur der alle kan delta på lik linje (møter, sosiale arrangement, beslutnings­fora)","type":"likert_5","required":true,"subscale":"Strukturell","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp12","text":"Har du opplevd diskriminering eller trakassering basert på et av de ovennevnte grunnlagene siste 12 mnd?","type":"yes_no","required":true,"subscale":"Trakassering","is_mandatory":true,"mandatory_law":"LDL_26"},
    {"id":"arp13","text":"Hvis ja — på hvilket grunnlag?","type":"multi_select","required":false,"subscale":"Trakassering","options":["Kjønn","Etnisitet","Religion / livssyn","Funksjons­nedsettelse","Alder","Seksuell orientering / kjønnsidentitet","Annet"]},
    {"id":"arp14","text":"Hvilke tre tiltak bør prioriteres i ARP-arbeidet neste år?","type":"priority_top3","required":false,"options":["Lønns­kartlegging","Rekrutterings­prosesser","Forfremmelses­kriterier","Tilrettelegging","Trakasserings­rutiner","Lederopplæring","Inkluderings­kultur","Permisjons­rettigheter","Annet"]}
  ]
}
$jsonb$::jsonb,
  'compliance'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 6. INSERT — tpl-vold-trusler (AML § 4-3 (3)) ─────────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-vold-trusler', null, true,
  'Vold og trusler (§ 4-3 (3))',
  'Vold/trusler',
  'Bransje­tilpasset kartlegging for arbeidsplasser med eksponering for vold/trusler — helse/omsorg, utdanning, vakt/sikkerhet, transport, publikums­mottak. Frekvens­basert eksponerings­måling siste 6 mnd + risiko­situasjoner + tiltaks­vurdering.',
  'Tilpasset Arbeidstilsynets veiledning + STAMI-rapport «Vold og trusler i arbeidslivet»',
  'Halvårlig kartlegging i bransjer med eksponering. Resultater legges fram for AMU.',
  'safety', 'internal', 7, true,
  'Eksponerings-items rapporteres som forekomst per kategori. Tiltaks-items snittes (1-5). Lav score (< 3.0) på rutiner/oppfølging utløser tiltaks­plikt etter § 4-3 (3) + IK-f § 5 nr. 6.',
  'AML § 4-3 (3)',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"vt1","text":"Verbal trussel om vold (på jobb) siste 6 mnd","type":"single_select","required":true,"subscale":"Eksponering","options":["Aldri","Én gang","2–3 ganger","Månedlig","Ukentlig","Daglig"],"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt2","text":"Fysisk trussel uten kontakt (knyttet hånd, slag i luft, kasting av gjenstand)","type":"single_select","required":true,"subscale":"Eksponering","options":["Aldri","Én gang","2–3 ganger","Månedlig","Ukentlig","Daglig"],"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt3","text":"Lett fysisk vold (dytting, holding, klyping)","type":"single_select","required":true,"subscale":"Eksponering","options":["Aldri","Én gang","2–3 ganger","Månedlig","Ukentlig","Daglig"],"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt4","text":"Alvorlig fysisk vold (slag, spark, skade)","type":"single_select","required":true,"subscale":"Eksponering","options":["Aldri","Én gang","2–3 ganger","Månedlig","Ukentlig","Daglig"],"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt5","text":"Trussel utenfor arbeidstid relatert til jobben (sosiale medier, hjem, off. rom)","type":"single_select","required":true,"subscale":"Eksponering","options":["Aldri","Én gang","2–3 ganger","Månedlig","Ukentlig","Daglig"],"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt6","text":"I hvilke situasjoner opplever du høyest risiko?","type":"multi_select","required":false,"subscale":"Risiko","options":["Alenearbeid","Hjemmebesøk","Kvelds-/natt-vakt","Publikums­mottak","Pasienter med ruslidelse","Pasienter med psykisk lidelse","Konflikt med pårørende","Andre"]},
    {"id":"vt7","text":"Det finnes klare rutiner for hvordan vold/trusler skal meldes","type":"likert_5","required":true,"subscale":"Tiltak","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt8","text":"Når jeg har meldt en hendelse, har den blitt fulgt opp","type":"likert_5","required":true,"subscale":"Tiltak","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt9","text":"Jeg har fått tilbud om opplæring i deeskalerings­teknikker","type":"likert_5","required":true,"subscale":"Tiltak","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt10","text":"Tilstrekkelig sikkerhet er på plass (alarm, makker, GPS, fluktveier)","type":"likert_5","required":true,"subscale":"Tiltak","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt11","text":"Etter alvorlige hendelser har jeg fått debrifing eller annen oppfølging","type":"likert_5","required":true,"subscale":"Tiltak","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_3_3"},
    {"id":"vt12","text":"Beskriv kort hvilke tiltak du mener vil redusere risiko (valgfritt). IKKE navngi enkeltpersoner.","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 7. INSERT — tpl-stikkprove-fysisk (AML § 4-4) ────────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-stikkprove-fysisk', null, true,
  'Fysisk arbeids­miljø — stikkprøve',
  'Fysisk',
  'Halvårlig stikkprøve mellom vernerunder. Trafikklys-vurdering av inneklima, lys, støy, renhold, plass, verneutstyr + spesifikke risiko­elementer.',
  'Tilpasset IK-f § 5 nr. 6 + Arbeidstilsynets veiledning for fysisk arbeids­miljø',
  'Halvårlig — supplement til årlig vernerunde. Røde/gule funn legges som avvik.',
  'safety', 'internal', 7, true,
  'Trafikklys aggregeres per element (% grønn / gul / rød). Items 7-10 snittes (1-5). Item 11 utløser direkte avviks­handling.',
  'AML § 4-4',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"sf1","text":"Inneklima (temperatur, ventilasjon, luftkvalitet)","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf2","text":"Lys (dagslys + arbeidslys)","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf3","text":"Støy","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf4","text":"Renhold og orden","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf5","text":"Plass og adkomst","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf6","text":"Verneutstyr — tilgjengelig og i orden","type":"traffic_light","required":true,"subscale":"Trafikklys","is_mandatory":true,"mandatory_law":"AML_4_4"},
    {"id":"sf7","text":"Min arbeidsstilling er ergonomisk forsvarlig","type":"likert_5","required":true,"subscale":"Spesifikt","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"sf8","text":"Tunge løft kan utføres med hjelpemidler","type":"likert_5","required":true,"subscale":"Spesifikt","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"sf9","text":"Kjemikalier jeg bruker har tilgjengelig sikkerhets­datablad (SDS)","type":"likert_5","required":false,"subscale":"Spesifikt","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"sf10","text":"Jeg har relevant verneutstyr og bruker det","type":"likert_5","required":true,"subscale":"Spesifikt","anchors":{"low":"Helt uenig","high":"Helt enig"}},
    {"id":"sf11","text":"Har du registrert risiko­forhold du mener bør vurderes? (Hvis ja — meld via avviks­modul.)","type":"yes_no","required":true},
    {"id":"sf12","text":"Beskriv hva som er det viktigste å løse fysisk i din enhet (valgfritt)","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 8. INSERT — tpl-endring-baseline (FØR omstilling) ────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-endring-baseline', null, true,
  'Endring — baseline (FØR omstilling)',
  'Endring FØR',
  'Baseline-måling før omstilling/omorganisering/digitalisering. Speiler items i tpl-endring-etter for direkte sammenligning. Items hentet fra COPSOQ III subskaler «Job insecurity», «Organizational justice», «Quantitative demands» med norsk tilpasning.',
  'COPSOQ III + AML § 4-1 (3) / § 4-2',
  'Engang før beslutning. Brukes for å vise risiko­grupper og forventet effekt.',
  'safety', 'internal', 8, true,
  'Snitt per subskala (Informasjon, Medvirkning, Belastning, Mestring). Risikogrupper identifiseres ved krysstabulering ansiennitet × avdeling — kun celler k≥5.',
  'AML § 4-1 (3)',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"eb1","text":"Samtykker du til at vi spør om hvor lenge du har vært ansatt og hvilken avdeling? Vi grupperer kun for analyse (k≥5).","type":"consent","required":true},
    {"id":"eb2","text":"Ansiennitet","type":"single_select","required":false,"options":["<1 år","1–3 år","3–5 år","5–10 år",">10 år"]},
    {"id":"eb3","text":"Avdeling","type":"single_select","required":false,"options":["(fylles ved publisering)"]},
    {"id":"eb4","text":"Jeg er godt informert om hvorfor endringen kommer","type":"likert_5","required":true,"subscale":"Informasjon","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb5","text":"Jeg har fått tilstrekkelig tid til å forstå konsekvensene","type":"likert_5","required":true,"subscale":"Informasjon","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb6","text":"Verneombud og tillitsvalgte er involvert i prosessen","type":"likert_5","required":true,"subscale":"Informasjon","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb7","text":"Mine synspunkter er etterspurt før beslutningen tas","type":"likert_5","required":true,"subscale":"Medvirkning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb8","text":"Jeg har en reell mulighet til å påvirke utfallet","type":"likert_5","required":true,"subscale":"Medvirkning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb9","text":"Jeg er bekymret for jobbsituasjonen min etter endringen","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb10","text":"Endringen oppleves som en stor merbelastning","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb11","text":"Jeg er bekymret for kollega­miljøet etter endringen","type":"likert_5","required":true,"subscale":"Belastning","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb12","text":"Jeg ser positivt på endringen","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb13","text":"Jeg tror jeg vil mestre nye krav som følger","type":"likert_5","required":true,"subscale":"Mestring","anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"eb14","text":"Hva er din viktigste bekymring eller forventning?","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 9. INSERT — tpl-endring-puls (UNDER omstilling) ──────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-endring-puls', null, true,
  'Endring — puls (UNDER omstilling)',
  'Endring puls',
  'Kort månedlig pulsmåling under aktiv omstillings­fase. Eskalerings­regel: hvis snitt på item 3-5 faller > 0.5 mellom to målinger → varsel til AMU + tiltaks­plikt.',
  'COPSOQ III + intern erfaring',
  'Månedlig under omstillings­fase. Stop ved gjennomført endring.',
  'safety', 'internal', 3, true,
  'Snitt alle items. Sammenlign mot baseline. Trigger ved fall > 0.5 mellom to puls­målinger.',
  'AML § 4-1 (3)',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"ep1","text":"Jeg får tilstrekkelig informasjon underveis i endringen","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ep2","text":"Jeg opplever at mine synspunkter blir tatt med","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ep3","text":"Min arbeidsbelastning er håndterbar","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ep4","text":"Jeg mestrer kravene som stilles til meg","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ep5","text":"Jeg ser positivt på utviklingen så langt","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ep6","text":"Kort kommentar (valgfritt)","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 10. INSERT — tpl-endring-etter (ETTER omstilling) ────────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-endring-etter', null, true,
  'Endring — etter­måling',
  'Endring ETTER',
  'Etter­måling 3 og 6 mnd etter endrings­iverksettelse. Items speilet til baseline for direkte sammenligning + eNPS-style item for total­vurdering.',
  'COPSOQ III + Reichheld eNPS',
  '3 mnd og 6 mnd etter at endringen er iverksatt.',
  'safety', 'internal', 6, true,
  'Sammenlign hver subskala mot tpl-endring-baseline. Negativ utvikling utløser tiltaks­plikt + AMU-fremlegg.',
  'AML § 4-1 (3)',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"ee1","text":"Endringen oppleves nå som en forbedring","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee2","text":"Jeg er fornøyd med hvordan endringen ble gjennomført","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee3","text":"Min arbeidsbelastning er på akseptabelt nivå nå","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee4","text":"Mine bekymringer fra før endringen ble tatt på alvor","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee5","text":"Verneombud og tillitsvalgte var godt involvert","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee6","text":"Jeg har fått nødvendig opplæring til nye oppgaver","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee7","text":"Det psykososiale arbeids­miljøet er på samme nivå eller bedre enn før","type":"likert_5","required":true,"anchors":{"low":"Helt uenig","high":"Helt enig"},"is_mandatory":true,"mandatory_law":"AML_4_1_3"},
    {"id":"ee8","text":"Jeg vurderer å slutte i jobben pga. endringen","type":"yes_no","required":true},
    {"id":"ee9","text":"Hvor sannsynlig er det at du anbefaler oss som arbeidsplass i dag? (0–10)","type":"scale_10","required":true,"anchors":{"low":"Svært usannsynlig","high":"Svært sannsynlig"}},
    {"id":"ee10","text":"Hva fungerte best i gjennomføringen?","type":"long_text","required":false},
    {"id":"ee11","text":"Hva burde vært gjort annerledes?","type":"long_text","required":false},
    {"id":"ee12","text":"Andre kommentarer (valgfritt)","type":"long_text","required":false}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();

-- ── 11. INSERT — tpl-amu-arsrapport-input (paritetisk) ───────────────────

insert into public.survey_template_catalog (
  id, organization_id, is_system, name, short_name, description, source, use_case,
  category, audience, estimated_minutes, recommend_anonymous, scoring_note, law_ref, body, pack
) values (
  'tpl-amu-arsrapport-input', null, true,
  'AMU årsrapport — input',
  'AMU input',
  'Strukturert input til AMUs årsrapport (§ 7-4). IKKE anonym — respondenten identifiseres med rolle (arbeidsgiver-side / arbeidstaker-side / verneombud / sekretær). Bruker voting-type for paritetisk avstemming. Stemmer aggregeres separat per side.',
  'AML § 7-2, § 7-4 — paritetisk vurderings­prosess',
  'En gang før års­rapport-skriving — typisk Q1 hvert år.',
  'safety', 'internal', 8, false,
  'Voting-items rapporteres med stemme­tall per side (arbeidsgiver/arbeidstaker). Traffic_light-items aggregeres til konsensus eller dissens. Priority_top3 sammenstilles til topp 5-liste. Brukes som vedlegg til AMU-årsrapport.',
  'AML § 7-2 g',
  $jsonb$
{
  "version": 1,
  "questions": [
    {"id":"amu1","text":"Min rolle i AMU","type":"single_select","required":true,"options":["Arbeidsgiver-side","Arbeidstaker-side","Verneombud","Sekretær"]},
    {"id":"amu2","text":"AMU har oppfylt sitt mandat siste år (§ 7-2)","type":"voting","required":true,"options":["For","Mot","Avhold"],"is_mandatory":true,"mandatory_law":"AML_6_2"},
    {"id":"amu3","text":"HMS-status i virksomheten har bedret seg siste år","type":"voting","required":true,"options":["For","Mot","Avhold"]},
    {"id":"amu4","text":"AMU bør fokusere mer på psyko­sosialt arbeids­miljø neste år","type":"voting","required":true,"options":["For","Mot","Avhold"]},
    {"id":"amu5","text":"Topp 3 områder AMU bør prioritere neste år","type":"priority_top3","required":true,"options":["Psykososialt","Fysisk","Kjemisk","Ergonomi","Sykefravær","Opplæring","Vernetjeneste","ARP","Endrings­håndtering","Annet"]},
    {"id":"amu6","text":"Vurdering av AMU-arbeidet som helhet","type":"traffic_light","required":true,"subscale":"Helhet"},
    {"id":"amu7","text":"Vurdering av samspill med BHT","type":"traffic_light","required":true,"subscale":"BHT"},
    {"id":"amu8","text":"Vurdering av lederens HMS-engasjement","type":"traffic_light","required":true,"subscale":"Ledelse"},
    {"id":"amu9","text":"Hva er den viktigste enkelt­saken AMU bør løfte i årsrapporten?","type":"long_text","required":true}
  ]
}
$jsonb$::jsonb,
  'arbeidsmiljo'
)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, description = excluded.description,
  source = excluded.source, use_case = excluded.use_case, category = excluded.category,
  audience = excluded.audience, estimated_minutes = excluded.estimated_minutes,
  recommend_anonymous = excluded.recommend_anonymous, scoring_note = excluded.scoring_note,
  law_ref = excluded.law_ref, body = excluded.body, pack = excluded.pack, updated_at = now();
