# Survey-modul — oppsummering og implementasjonskø

**Sist oppdatert:** 2026-04-30

**Sti (main):** `Claude/Survey/` — med **stor S** (Linux skiller store og små bokstaver).

**Referanse:** `Claude/Survey/COMPLIANCE.md`, `Claude/Survey/CURSOR_QUEUE.md`, `Claude/AI_INSTRUCTION_SET.md`

**Engelsk review / funn (v2):** `Claude/Survey/04-review-summary-v2.md`, samt `01-compliance-review.md`, `02-ui-ux-review.md`, `03-code-review.md`.

---

## Utført (siste koderunde)

| # | Endring | Filer |
|---|---------|--------|
| 1 | **Oversikt — AMU compliance-kort** etter COMPLIANCE §4: sjekkliste (lukket undersøkelse, møtedato, AMU-leder sign., VO sign.), merking Oppfylt/Mangler, snarvei til AMU-fanen | `modules/survey/SurveyDetailView.tsx` |
| 2 | **Bygger — kolonne «Lovkrav»** for obligatoriske spørsmål (`mandatory_law`, f.eks. AML § 4-3) i seksjonstabellen | `modules/survey/SurveySectionBuilder.tsx` |
| 3 | **Liste — GDPR-banner** (`ComplianceBanner`) under regelverksbanner på modulens hovedside | `modules/survey/SurveyPage.tsx` |
| 4 | **Database:** kolonne `audience_location_ids` m.fl. — migrasjon `supabase/migrations/20260802120012_survey_distributions_columns_repair.sql` | drift |
| 5 | **Formål + AMU-oppsummering** på undersøkelsen (`survey_purpose`, `survey_amu_summary`), ny undersøkelse + Oversikt | `20260802120013_*`, `types`, `useSurvey`, `SurveyDetailView`, `SurveyPage` |
| 6 | **Bygger — spørsmålsveiviser** — typekort, forslag fra formål, betinget visning uten JSON, avansert JSON kun org-admin | `SurveyQuestionFormFields`, `SurveyQuestionConditionEditor`, `surveyPurposeSuggestions` |
| 7 | **Analyse** — CSV-eksport, forklaring på andeler, numerikk for slider/tall | `surveyExportCsv`, `surveyAnalytics`, `SurveyDetailView` |
| 8 | **Fremdrift + bekreftelser** — stripe øverst, dialog ved publiser/lukk, workflow-knapper kun admin | `SurveyDetailView` |

---

## Kø — neste anbefalte steg (samkjørt med review v2)

Prioritet 1 — **Kritisk korrekthet og analyse**

1. **R17** · Utvid `surveyAnalytics` ytterligere (matrise/rangering som egne visualiseringer — tall telles i dag).
2. **R1 + R19** · Del opp `useSurvey`; batch `reorderSections` og `reorderQuestions`.
3. **C2** · AMU-signatur koblet til `auth.uid()` (ikke fritekst-navn alene).
4. **C8** · RLS: blokker protokoll etter første signatur.
5. **R20** · `loadSurveyDetail`: last `surveySections` og distribusjoner (parallelt der mulig).

Prioritet 2 — **Etterlevelse og distribusjon**

6. **C1 + R5** · Erstatt nøkkelord-deteksjon AML § 4-3 med mal-flagg; én sannhetskilde.
7. **C3** · k-anonymitet håndhevet serverside (view/RPC).
8. **C6** · Dedupe anonyme svar (token / constraint).
9. **C10** · Skjul AMU/Tiltak-faner for eksterne/leverandørundersøkelser.
10. **C4** · Full vendor-token-håndheving i flyten.

Prioritet 3 — **Personvern og drift (tidligere «egen» kø)**

11. **Filopplasting → Supabase Storage** — ikke base64 i DB.
12. **Malbibliotek / `orgQuestionToCatalogQuestion`** — bedre støtte alle typer ved eksport/import.
13. **Signatur** · Valgfri tegnflate (canvas).

Prioritet 4 — **Flyt, UX, STEP_10**

14. **Ekte forgreining** utover `showIf` (hopp/spor — delvis dekket av visuell betinget visning).
15. **Cron** · Verifiser `scheduled_initial_send_at` og påminnelser i prod.
16. Kjør sjekkliste `Claude/Survey/STEP_10_REVIEW.md` (rå HTML, engelske strenger).

---

## Hurtigfeilsøking

| Problem | Tiltak |
|---------|--------|
| `Could not find column 'audience_location_ids'` | Kjør migrasjoner (`supabase db push` eller bruk `20260802120012_*`). |
| `Could not find column 'survey_purpose'` | Kjør migrasjon `20260802120013_survey_purpose_and_amu_summary.sql` / `supabase db push`. |
| PostgREST schema cache | `select pg_notify('pgrst', 'reload schema');` eller restart API. |

---

## Commit-format

`feat(survey): kort norsk/imperativ beskrivelse`
