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
| 18 | **C3 (full)** · `survey_question_choice_counts_for_org` + `survey_question_numeric_stats_for_org` (k-anonymitet) brukt i Analyse-fanen og CSV-eksport når terskel er nådd; ellers faller visning tilbake til klientaggregater / «Skjult» | `20260828120016_survey_analytics_rpc_extend.sql`, `surveyAnalyticsRpc.ts`, `SurveyAnalyseTab.tsx`, `surveyExportCsv.ts` |
| 19 | **Filopplasting** · Bucket `survey_response_files`, RLS; ved innsending lastes `data:` for fil/signatur opp og det lagres `fileRef:…` i `answer_text` | migrasjon, `surveyUploadDataUrl.ts`, `submitSurveyResponse.ts`, `surveyRespondValidation.ts`, `SurveyRespondPage.tsx` |
| 20 | **Malbibliotek (del)** · Utvidet `CatalogQuestionTypeSchema`, full mapping i `catalogQuestionToUpsert`, rikere `orgQuestionToCatalogQuestion` inkl. obligatorisk lov fra rad | `surveyTemplateCatalogTypes.ts`, `surveyTemplateApply.ts`, `surveyTemplateCatalogHelpers.ts` |
| 21 | **Signatur (del)** · Tegnflate (`canvas`) på svarskjema; PNG lagres via samme Storage-flyt som fil | `SurveyRespondPage.tsx` |
| 22 | **R1 (del)** · `submitSurveyResponse` utskilt fra `useSurvey.ts`; AMU/tiltak i `useSurveyAmuAndActions.ts` | `submitSurveyResponse.ts`, `useSurveyAmuAndActions.ts`, `useSurvey.ts` |
| 23 | **R17** · Gjennomsnittlig plass for rangering; matrise-heatmap og full matrise i CSV | `surveyAnalytics.ts`, `SurveyAnalyseTab.tsx`, `surveyExportCsv.ts` |
| 24 | **Forgreining** · `logic_jump.branchHide` + `SurveyBranchingEditor` + `hiddenQuestionIdsFromBranching` på svarskjema | `surveyBranching.ts`, `SurveyBranchingEditor.tsx`, `SurveyQuestionFormFields.tsx`, `SurveyRespondPage.tsx` |

---

## Kø — gjenstår / neste anbefalte steg

### Manuell drift / QA (ikke automatisert her)

1. **Cron** · Verifiser `scheduled_initial_send_at` og påminnelser i produksjon.
2. **STEP_10** · Gå gjennom `Claude/Survey/STEP_10_REVIEW.md` (rå HTML, engelske strenger, design-system).

### Valgfritt / senere

- **R1** · Eventuell ytterligere splitting av `useSurvey` (spørsmål, distribusjon, import/export) etter behov.
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
| Manglende analyse-RPC eller utvidet multi_select-telling | Kjør `20260828120016_survey_analytics_rpc_extend.sql` / `supabase db push`. |
| PostgREST schema cache | `select pg_notify('pgrst', 'reload schema');` eller restart API. |

---

## Commit-format

`feat(survey): kort norsk/imperativ beskrivelse`
