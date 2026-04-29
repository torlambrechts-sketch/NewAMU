# Survey-modul — oppsummering og implementasjonskø

**Sist oppdatert:** 2026-04-28

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

| 12 | **R17** · Matrise og rangering i **Analyse** — aggregerte bar-diagram per rad/element; CSV med korte oppsummeringer | `surveyAnalytics.ts`, `surveyExportCsv.ts`, `SurveyDetailView.tsx`, `surveyRespondValidation.ts` |

| 13 | **C1 + R5** · Lovkrav fra mal uten nøkkelord — `mandatoryFromCatalogQuestion`, `SurveyPage` fallback ved legacy-mal, HMS-mal med `mandatory_law: AML_4_3` på kjernelikert-spørsmål | `surveyMandatoryLaw.ts`, `SurveyPage.tsx`, `surveyTemplates.ts`, `applyTemplateToSurvey` |

| 14 | **R1 (del)** · Distribusjon og invitasjoner ut i `useSurveyDistribution`; ryddet ubrukte imports i `useSurvey` | `useSurveyDistribution.ts`, `useSurvey.ts` |

---

## Kø — neste anbefalte steg (samkjørt med review v2)

Prioritet 1 — **Kritisk korrekthet og analyse**

1. **R1** · Fortsett å splitte `useSurvey` (f.eks. `useSurveyQuestions`, AMU/tiltak) der det gir gevinst — filen er fortsatt stor.

Prioritet 2 — **Etterlevelse og distribusjon**

2. **C3** · k-anonymitet håndhevet serverside (view eller RPC som filtrerer før klient).
3. **C6** · Dedupe anonyme svar (token mot `org_survey_responses` eller unik constraint der mulig).
4. **C10** · Skjul AMU- og Tiltak-faner for eksterne/leverandørundersøkelser (`SurveyDetailView` `buildTabs`).
5. **C4** · Full vendor-token-håndheving i invitasjons-/svarflyt (Edge + RLS).

Prioritet 3 — **Personvern og drift**

7. **Filopplasting → Supabase Storage** — ikke base64 i `org_survey_answers`.
8. **Malbibliotek / `orgQuestionToCatalogQuestion`** — full støtte alle spørsmålstyper ved eksport/import.
9. **Signatur** · Valgfri tegnflate (canvas) i tillegg til dagens tekst/RPC-flyt.

Prioritet 4 — **Flyt, UX, STEP_10**

10. **Ekte forgreining** utover `showIf` (spor/hopp mellom spørsmål — planlegg datamodell).
11. **Cron** · Verifiser `scheduled_initial_send_at` og påminnelser i produksjon.
12. Kjør sjekkliste `Claude/Survey/STEP_10_REVIEW.md` (rå HTML, engelske strenger).

### Valgfritt / senere

- **R17-forbedring** · Gjennomsnittsrang eller «gjennomsnittlig plass» som ekstra tall for rangering.
- **Matrise** · Heatmap eller tabellvisning (CSV utvidet med alle celler, ikke bare topp).

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
