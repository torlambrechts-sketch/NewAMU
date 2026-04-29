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
| 9 | **Prioritet 1 (del)** · **R20** — `loadSurveyDetail`: AMU, tiltak, distribusjoner og invitasjoner lastes parallelt etter kjernedata | `modules/survey/useSurvey.ts` |
| 10 | **Prioritet 1 (del)** · **R1+R19** — `reorderQuestions` / `reorderSections` bruker parallelle oppdateringer (Promise.all) | `modules/survey/useSurvey.ts` |
| 11 | **Prioritet 1 (del)** · **C2 + C8** — AMU-signatur via RPC (`survey_amu_review_sign_as_*`), navn fra `profiles`, kolonner `*_signed_by`; trigger låser protokoll etter første signatur | `20260802120014_*`, `types`, `useSurvey`, `SurveyAmuTab` |

---

## Kø — neste anbefalte steg (samkjørt med review v2)

Prioritet 1 — **Kritisk korrekthet og analyse**

1. **R17** · Utvid `surveyAnalytics` og analyse-UI for matrise/rangering (aggregerte visninger — ikke bare «tekst»).
2. **R1** · Fortsett å splitte `useSurvey` i mindre moduler / hooks der det gir vedlikeholdsgevinst.

Prioritet 2 — **Etterlevelse og distribusjon**

3. **C1 + R5** · Erstatt nøkkelord-deteksjon AML § 4-3 med mal-flagg; én sannhetskilde.
4. **C3** · k-anonymitet håndhevet serverside (view/RPC).
5. **C6** · Dedupe anonyme svar (token / constraint).
6. **C10** · Skjul AMU/Tiltak-faner for eksterne/leverandørundersøkelser.
7. **C4** · Full vendor-token-håndheving i flyten.

Prioritet 3 — **Personvern og drift (tidligere «egen» kø)**

8. **Filopplasting → Supabase Storage** — ikke base64 i DB.
9. **Malbibliotek / `orgQuestionToCatalogQuestion`** — bedre støtte alle typer ved eksport/import.
10. **Signatur** · Valgfri tegnflate (canvas).

Prioritet 4 — **Flyt, UX, STEP_10**

11. **Ekte forgreining** utover `showIf` (hopp/spor — delvis dekket av visuell betinget visning).
12. **Cron** · Verifiser `scheduled_initial_send_at` og påminnelser i prod.
13. Kjør sjekkliste `Claude/Survey/STEP_10_REVIEW.md` (rå HTML, engelske strenger).

---

## Hurtigfeilsøking

| Problem | Tiltak |
|---------|--------|
| `Could not find column 'audience_location_ids'` | Kjør migrasjoner (`supabase db push` eller bruk `20260802120012_*`). |
| `Could not find column 'survey_purpose'` | Kjør migrasjon `20260802120013_survey_purpose_and_amu_summary.sql` / `supabase db push`. |
| `Could not find function survey_amu_review_sign_as_chair` | Kjør migrasjon `20260802120014_survey_amu_sign_identity_and_protocol_lock.sql` / `supabase db push`. |
| `Could not find column 'amu_chair_signed_by'` | Kjør migrasjon `20260802120014_survey_amu_sign_identity_and_protocol_lock.sql` / `supabase db push`. |
| PostgREST schema cache | `select pg_notify('pgrst', 'reload schema');` eller restart API. |

---

## Commit-format

`feat(survey): kort norsk/imperativ beskrivelse`
