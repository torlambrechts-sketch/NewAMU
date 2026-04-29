# Survey Module — Cursor Implementation Queue

Oversikt over status og kø: **`Claude/Survey/00-summary.md`** · Engelsk prioriteringsmatrise (review v2): **`Claude/Survey/04-review-summary-v2.md`**

Paste **one step file** at a time into Cursor. Commit after each step before moving on.

## Before you start

**Set Cursor timeout:** Settings → AI → Request Timeout → **300** (seconds).

**Design rules:** Every rule in `Claude/AI_INSTRUCTION_SET.md` is mandatory. Read it before step 1.

**Target directories:**
- `modules/survey/` — all new canonical files live here
- `src/pages/` — respond page + admin page (already routed)
- `src/modules/survey/` — LEGACY; files here are deleted in step order below

**Anti-hallucination rules (non-negotiable):**
1. Every file path in these specs has been verified against the real codebase. Do not rename, move, or create alternative paths. If a referenced path does not exist, stop and report before touching anything.
2. All types come from `modules/survey/types.ts`. Never inline `type X = …` inside a component.
3. Do not add npm packages without stating: (a) package name, (b) exact version, (c) why no existing package covers the need.
4. Every Supabase schema change ships with a migration file in `supabase/migrations/`. Naming: `YYYYMMDDHHMMSS_description.sql`.
5. All user-facing strings in Norwegian Bokmål only. No English in the UI.
6. No stub implementations. Every function must be complete and callable.
7. TypeScript `strict: true`. No `as any`, `@ts-ignore`, or `@ts-nocheck`.
8. Every new table has RLS and at least one meaningful policy.
9. Before reporting done: run through the validation checklist in the step file. All items must be ✓.
10. Before editing any file: read its current full content. Never assume structure from memory.

---

## Current state (read before coding)

The survey module exists in **two parallel implementations**:

| Location | Status | Action |
|---|---|---|
| `modules/survey/` | Newer; uses design-system components | **Keep — extend** |
| `src/modules/survey/` | Legacy; raw `<button>`, `<input>`, `<select>` — violates AI rules | **Delete per step order below** |

DB tables exist: `surveys`, `org_survey_questions`, `org_survey_responses`, `org_survey_answers`, `survey_question_bank`. Missing: `survey_amu_reviews`, `survey_action_plans`, audit triggers, org-id auto-fill triggers.

---

## Step order

| # | File to paste | Creates / replaces | Deletes legacy | Commit message |
|---|---|---|---|---|
| 1 | `STEP_01_DB.md` | `supabase/migrations/…_survey_additions.sql` | — | `feat(survey): migration — amu_reviews, action_plans, audit triggers` |
| 2 | `STEP_02_TYPES.md` | `modules/survey/types.ts` (replace) | `src/modules/survey/types.ts` | `feat(survey): consolidate types and Zod schemas` |
| 3 | `STEP_03_HOOK.md` | `modules/survey/useSurvey.ts` (replace) | `src/modules/survey/useSurveyLegacy.ts` | `feat(survey): consolidate hook — add amu review + action plan methods` |
| 4 | `STEP_04_LIST_PAGE.md` | `modules/survey/SurveyPage.tsx` (replace) | `src/modules/survey/SurveyModuleView.tsx` | `feat(survey): list page — ModulePageShell + template picker` |
| 5 | `STEP_05_DETAIL_SHELL.md` | `modules/survey/SurveyDetailView.tsx` (replace) | `src/modules/survey/index.ts` | `feat(survey): detail view — 6-tab shell, Oversikt, Bygger, Svar, Analyse` |
| 6 | `STEP_06_AMU_TAB.md` | `modules/survey/tabs/SurveyAmuTab.tsx` (new) | `src/modules/survey/SurveyAmuTab.tsx` | `feat(survey): AMU-gjennomgang tab — protocol, dual sign-off` |
| 7 | `STEP_07_TILTAK_TAB.md` | `modules/survey/tabs/SurveyTiltakTab.tsx` (new) | `src/modules/survey/SurveyActionTab.tsx` | `feat(survey): Handlingsplan tab — auto-generated action items` |
| 8 | `STEP_08_RESPOND_PAGE.md` | `src/pages/SurveyRespondPage.tsx` (replace) | `src/modules/survey/SurveyResponsesTab.tsx` | `feat(survey): respondent form — full question type rendering` |
| 9 | `STEP_09_ADMIN_PAGE.md` | `src/pages/SurveyModuleAdminPage.tsx` (replace) | — | `feat(survey): admin settings — intro html, default anonymous, question bank` |
| 10 | `STEP_10_REVIEW.md` | — (checklist only) | Remaining legacy files | `chore(survey): self-review — no raw HTML, all Norwegian, RLS gating` |

---

## Dependency notes

- Step 1 must run before all others.
- Step 2 must run before Step 3.
- Step 3 must run before Steps 4–9.
- Steps 4–9 are independent of each other but all depend on Step 3.
- Step 10 runs last.

## Legacy files deleted by step

After step 2: `src/modules/survey/types.ts`  
After step 3: `src/modules/survey/useSurveyLegacy.ts`, `src/modules/survey/schema.ts`  
After step 4: `src/modules/survey/SurveyModuleView.tsx`  
After step 5: `src/modules/survey/index.ts`, `src/modules/survey/SurveyBuilderTab.tsx`, `src/modules/survey/SurveyResultsTab.tsx`, `src/modules/survey/SurveyAnalysisPage.tsx`  
After step 6: `src/modules/survey/SurveyAmuTab.tsx`  
After step 7: `src/modules/survey/SurveyActionTab.tsx`  
After step 8: `src/modules/survey/SurveyResponsesTab.tsx`  
After step 10: `src/modules/survey/` directory (if empty)

## Commit message format

```
feat(survey): <imperative description>
```

Migration files and application code **must** be in the same commit.
