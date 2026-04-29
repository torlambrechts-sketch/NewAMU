# Survey Module — Norsk lovkomplians og GDPR-krav

**Rolle:** Compliance-referanse for utviklere og revisorer. Les denne FØR du implementerer noe.

---

## 1. Lovgrunnlag (fullstendig)

| Lov / Forskrift | §§ | Hva det betyr for survey-modulen |
|---|---|---|
| **Arbeidsmiljøloven (AML)** | § 3-1 | Systematisk HMS-arbeid. Kartlegginger skal gjennomføres regelmessig (anbefalt hvert 12–24 mnd) og føre til konkrete tiltak. |
| AML | § 4-1 | Generelle krav til arbeidsmiljøet — grunnlaget for å kartlegge. |
| AML | § 4-3 | Psykososialt arbeidsmiljø: integritet, verdighet, trakassering, seksuell trakassering, belastning. **Fem spørsmål er lovpålagte**: integritet, medvirkning, sikkerhet, helse, trakassering. |
| AML | § 4-4 | Fysisk arbeidsmiljø — spørsmål om ergonomi, støy, kjemikalier er lovkrav der dette er relevant. |
| AML | § 6-2 | Verneombudets rett til innsyn i kartleggingsresultater. |
| AML | § 7-2 (2)e | AMU **skal behandle** resultater fra medarbeiderundersøkelser. `amu_review_required = true` og `survey_amu_reviews` dokumenterer gjennomgang. |
| AML | § 7-2 (6) | AMU **skal levere årsrapport**. Survey-resultater er kildedata til § 1 og § 5 i årsrapporten. |
| AML | § 2 A-3 | Varsling: bare aggregerte tall presenteres for AMU. Survey-svar er IKKE varslingssaker. |
| **IK-forskriften** | § 5 nr. 5 | Resultater fra kartlegging skal dokumenteres og følges opp. PDF-eksport + AMU-protocol = dokumentasjon. |
| IK-forskriften | § 5 nr. 7 | Tiltak iverksettes ved avvik. `survey_action_plans` er den tekniske gjennomføringen. |
| **GDPR / personopplysningsloven** | Art. 5(1)(e) | Lagringsminimering. Surveysvar slettes eller arkiveres etter formålet er oppfylt (anbefalt 5 år). |
| GDPR | Art. 25 | Privacy by Design. Anonyme svar lagres uten bruker-ID. k-anonymitet ≥ 5 før resultater vises. |
| GDPR | Art. 9 | Helse og psykisk helse er særskilte kategorier. Aggregering og suppression er obligatorisk. |
| **Likestillings- og diskrimineringsloven** | § 26 | Aktivitetsplikt (virksomheter ≥ 50 ansatte). Kartlegginger av arbeidsklima er en del av dokumentasjonen. |

---

## 2. k-Anonymitet (GDPR Art. 25)

### Regel
Resultater for grupper (avdelinger, enheter) med **færre enn 5 respondenter** (konstantert i `src/lib/orgSurveyKAnonymity.ts: SURVEY_K_ANONYMITY_MIN = 5`) **skal aldri vises** — verken score, gjennomsnitt eller fritekst.

### Per-survey terskel
`surveys.anonymity_threshold` (default 5) kan økes per undersøkelse der organisasjonen er liten.

### Implementasjonskrav
- Analyse-fanen: for hvert spørsmål / kategori, sjekk `answers.length >= anonymity_threshold` FØR du viser noe.
- Suppressed resultater vises som `<EyeOff />` + "Skjult (n<5)" — aldri som en tom rad.
- Fritekst-svar (`question_type = 'text'`): vises ALDRI per spørsmål. Kun antall svar vises.
- `survey.selectedSurvey.anonymity_threshold` brukes som grenseverdi. Fallback: `SURVEY_K_ANONYMITY_MIN`.

### Konsekvens ved brudd
Brudd på GDPR Art. 25 kan medføre gebyr opp til 4 % av global omsetning (GDPR Art. 83(4)).

---

## 3. AML § 4-3 — Lovpålagte spørsmål

Disse fem spørsmålene er lovpålagte der de er relevante. De kan ikke slettes fra en aktiv undersøkelse. Sett `is_mandatory = true` og `mandatory_law = 'AML_4_3'` i DB.

| Spørsmål | Tema |
|---|---|
| Om du opplever uønsket seksuell oppmerksomhet, trakassering eller diskriminering fra noen på arbeidsplassen | Trakassering / seksuell trakassering |
| Om du kan utføre arbeidet ditt uten å krenke din integritet | Integritet |
| Om du har mulighet til å delta i avgjørelser som angår ditt eget arbeid | Medvirkning |
| Om du mener arbeidsmiljøet er trygt mht. ulykkes- og helserisiko | Sikkerhet og helse |
| Om du opplever den psykiske og sosiale belastningen som akseptabel | Psykososial belastning |

Implementasjonsregel: Når template er importert og `is_mandatory = true`, vises slette-knappen som disabled med tooltip «Obligatorisk — AML § 4-3». Bruk `<Badge variant="danger">AML § 4-3</Badge>` på raden.

---

## 4. AMU-presentasjonsplikt (AML § 7-2 (2)e)

Survey-modulen er ikke ferdig lovkompliant for en undersøkelse FØR:
1. `surveys.status = 'closed'`
2. `survey_amu_reviews.meeting_date IS NOT NULL`
3. `survey_amu_reviews.amu_chair_signed_at IS NOT NULL`
4. `survey_amu_reviews.vo_signed_at IS NOT NULL`

Denne sjekksekvensen er en **compliance gate**. Undersøkelsen er ikke «ferdigbehandlet» før alle fire er oppfylt. Vis dette tydelig i Oversikt-fanen.

### Linkobling til AMU-modulen
Ideelt sett skal `survey_amu_reviews.meeting_date` korrespondere med en `amu_meetings`-rad i AMU-modulen. I MVP er manuell registrering av dato tilstrekkelig. Fremtidig: FK til `amu_agenda_items` (se `Claude/05_LEGAL_RULES.md`).

---

## 5. IK-forskriften § 5 — Dokumentasjon og oppbevaring

| Dokument | Minimum oppbevaringstid | Hvem arkiverer |
|---|---|---|
| Survey-resultater (aggregert) | 5 år | Automatisk (DB-tabell) |
| AMU-protokoll fra gjennomgang | 5 år | `survey_amu_reviews` tabell |
| Handlingsplan med tiltak | 5 år etter tiltaket er lukket | `survey_action_plans` tabell |
| PDF-eksport (rapport) | 5 år | Bør lagres i Supabase Storage |

Implementasjonsregel: Status `'archived'` blokkerer sletting av `surveys`-rader via RLS. Se STEP_01_DB.md.

---

## 6. Systematisk kartleggingssyklus (AML § 3-1)

`surveys.recurrence_months` (null = ingen syklus, 12 = årlig, 24 = annethvert år) driver en fremtidig påminnelsesfunksjon. I MVP vises kun informasjon; ingen automatisk ny undersøkelse opprettes.

Anbefalt: AMU-modul sin `amu_compliance_status`-view bør sjekke `last_survey_closed_at + recurrence_months * interval '1 month' < today` og markere dette som en compliance-mangel.

---

## 7. Respondentrettigheter (GDPR Art. 15–21)

| Rettighet | Implementasjon |
|---|---|
| Innsyn | Anonyme svar har ingen kobling til person → ikke aktuelt. Identifiserte svar: admin kan slette via Supabase. |
| Sletting | `surveys` DELETE-policy (kun `status = 'draft'`) + kaskade-sletting av `org_survey_responses` og `org_survey_answers` |
| Portabilitet | Ikke implementert i MVP. Legg til PDF-eksport i fremtidig steg. |
| Innsigelse | Anonyme undersøkelser: ikke aktuelt. Identifiserte: kontakt admin. |

UI-krav: Respondentskjemaet (`SurveyRespondPage.tsx`) SKAL vise:
- Om undersøkelsen er anonym eller identifisert (vis `<ComplianceBanner>`)
- At identifiserte svar bare er synlige for administrator
- At svar kan trekkes tilbake innen [X dager] ved å kontakte administrator

---

## 8. Verneombudsrettigheter (AML § 6-2)

Verneombud (VO) har rett til innsyn i kartleggingsresultater. I survey-modulen:
- VO trenger `survey.manage` ELLER en dedikert `survey.view_results`-tillatelse.
- Frem til en `survey.view_results`-tillatelse er innført: gi VO `survey.manage`.
- VO er den ene av to som signerer AMU-protokollen.

---

## 9. Forbud mot identifisering gjennom fritekst (GDPR Art. 9)

Fritekst-svar (`question_type = 'text'`) kan avsløre identitet gjennom kontekst (avdeling + kjønn + sykdom etc.).

Implementasjonsregler:
- Fritekst-svar vises ALDRI per respondent — bare antall (`textCount`).
- Anonyme undersøkelser: fritekst-svar slettes 6 måneder etter undersøkelsen lukkes (fremtidig cron-jobb).
- I MVP: vis en `<ComplianceBanner>` på Analyse-fanen: «Fritekst-svar vises kun som antall og er ikke tilgjengelige i klartekst.»

---

## 10. Compliance-kompletthetsindikator

Legg til en `survey_compliance_status`-funksjon (computed, ikke materialisert view) som returnerer:

| Flag | Sjekk | Referanse |
|---|---|---|
| `questions_ok` | `count(questions) > 0` | AML § 4-3 |
| `mandatory_covered` | `count(questions where is_mandatory=true) >= 3` | AML § 4-3 |
| `amu_review_done` | `survey_amu_reviews.amu_chair_signed_at IS NOT NULL AND vo_signed_at IS NOT NULL` | AML § 7-2 |
| `action_plans_open` | `count(action_plans where status != 'closed') = 0` | IK-f § 5 |
| `anonymity_ok` | `anonymity_threshold >= 5` | GDPR |
| `recurrence_set` | `recurrence_months IS NOT NULL` | AML § 3-1 |

Vis disse flaggene i Oversikt-fanen med fargekoder: ✓ grønn / ⚠ gul / ✗ rød.
