# Survey-modul — oppsummering og implementasjonskø

**Sist oppdatert:** 2026-04-28

**Sti (main):** `Claude/Survey/` — med **stor S** (Linux skiller store og små bokstaver).

**Referanse:** `Claude/Survey/COMPLIANCE.md`, `Claude/Survey/CURSOR_QUEUE.md`, `Claude/AI_INSTRUCTION_SET.md`

**Engelsk review / funn (v2):** `Claude/Survey/04-review-summary-v2.md`, samt `01-compliance-review.md`, `02-ui-ux-review.md`, `03-code-review.md`.

---

## Utført (siste koderunde)

| # | Endring | Filer |
|---|---------|--------|
| 1–14 | *Se tidligere tabeller i git-historikk / forrige versjon av dette dokumentet* | — |

| 15 | **C10** · AMU- og Handlingsplan-faner skjules for ikke-interne undersøkelser og når leverandørnavn/org.nr er satt | `SurveyDetailView.tsx` |
| 16 | **C4** · Eksterne/leverandørundersøkelser krever personlig lenke (`invite`) for anonyme eller ikke-innloggede; innlogget identifisert kan svare uten. RPC `survey_external_requires_personal_link` | `submitSurveyResponse.ts`, migrasjon `20260828120015_*` |
| 17 | **C6** · Dedupe anonyme svar: kolonne `respondent_session_token`, unik indeks per undersøkelse, klient genererer stabil token per fane | migrasjon, `types`, `surveyRespondSession.ts`, `submitSurveyResponse.ts` |
| 18 | **C3 (del)** · RPC `survey_question_choice_counts_for_org` — returnerer valgtelling kun når antall besvarelser ≥ `anonymity_threshold` (serverside gate for aggregater). *Analyse-fanen bruker fortsatt klientaggregater — koble til RPC ved behov for strengeste modell.* | migrasjon |
| 19 | **Filopplasting** · Bucket `survey_response_files`, RLS; ved innsending lastes `data:` for fil/signatur opp og det lagres `fileRef:…` i `answer_text` | migrasjon, `surveyUploadDataUrl.ts`, `submitSurveyResponse.ts`, `surveyRespondValidation.ts`, `SurveyRespondPage.tsx` |
| 20 | **Malbibliotek (del)** · Utvidet `CatalogQuestionTypeSchema`, full mapping i `catalogQuestionToUpsert`, rikere `orgQuestionToCatalogQuestion` inkl. obligatorisk lov fra rad | `surveyTemplateCatalogTypes.ts`, `surveyTemplateApply.ts`, `surveyTemplateCatalogHelpers.ts` |
| 21 | **Signatur (del)** · Tegnflate (`canvas`) på svarskjema; PNG lagres via samme Storage-flyt som fil | `SurveyRespondPage.tsx` |
| 22 | **R1 (del)** · `submitSurveyResponse` utskilt fra `useSurvey.ts` | `submitSurveyResponse.ts`, `useSurvey.ts` |

---

## Kø — gjenstår / neste anbefalte steg

Prioritet 1 — **Analyse og korrekthet**

1. **C3 full** · Bruk `survey_question_choice_counts_for_org` (evt. tilsvarende for numerikk) i **Analyse**-fanen slik at aggregater ikke kan utledes fra råsvar i nettleseren før terskel er nådd — eller dokumenter hybrid og lukk bevisst.

Prioritet 2 — **Refaktor og flyt**

2. **R1** · Fortsett å splitte `useSurvey` (`useSurveyQuestions`, AMU/tiltak, evt. import/export).

3. **Ekte forgreining** · Datamodell og UI utover `showIf` (spor/hopp mellom spørsmål).

Prioritet 3 — **Drift og kvalitet**

4. **Cron** · Verifiser `scheduled_initial_send_at` og påminnelser i produksjon.

5. **STEP_10** · Kjør sjekkliste `Claude/Survey/STEP_10_REVIEW.md` (rå HTML, engelske strenger, design-system).

### Valgfritt / senere

- **R17-forbedring** · Gjennomsnittsrang / gjennomsnittlig plass for rangeringsspørsmål.
- **Matrise** · Heatmap, CSV med alle celler (ikke bare topp).
- **C4 skjerping** · Produktvalg: skal identifiserte eksterne uten `invite` fortsatt kunne svare? (I dag: ja, for å matche «åpen lenke med innlogging».)

---

## Hurtigfeilsøking

| Problem | Tiltak |
|---------|--------|
| `Could not find column 'audience_location_ids'` | Kjør migrasjoner (`supabase db push` eller bruk `20260802120012_*`). |
| `Could not find column 'survey_purpose'` | Kjør migrasjon `20260802120013_survey_purpose_and_amu_summary.sql` / `supabase db push`. |
| `Could not find function survey_amu_review_sign_as_chair` | Kjør migrasjon `20260802120014_survey_amu_sign_identity_and_protocol_lock.sql` / `supabase db push`. |
| `Could not find column 'amu_chair_signed_by'` | Kjør migrasjon `20260802120014_survey_amu_sign_identity_and_protocol_lock.sql` / `supabase db push`. |
| `Could not find column 'respondent_session_token'` / bucket `survey_response_files` | Kjør `20260828120015_survey_storage_k_anon_vendor_session.sql` / `supabase db push`. |
| PostgREST schema cache | `select pg_notify('pgrst', 'reload schema');` eller restart API. |

---

## Commit-format

`feat(survey): kort norsk/imperativ beskrivelse`
