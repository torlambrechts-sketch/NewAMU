# Step 10 — Self-Review & Legacy Cleanup

This is a checklist-only step. No new code. Run through every item and fix before reporting done.

---

## 1. Raw HTML audit

Run these greps in order. Each must return **zero matches**:

```bash
# Forbidden raw interactive elements in survey module
grep -rn '<button className=' modules/survey/ src/pages/SurveyRespondPage.tsx src/pages/SurveyModuleAdminPage.tsx
grep -rn '<input className=' modules/survey/ src/pages/SurveyRespondPage.tsx src/pages/SurveyModuleAdminPage.tsx
grep -rn '<textarea className=' modules/survey/ src/pages/SurveyRespondPage.tsx src/pages/SurveyModuleAdminPage.tsx
grep -rn '<select' modules/survey/ src/pages/SurveyRespondPage.tsx src/pages/SurveyModuleAdminPage.tsx
```

**Named exception** — `RatingScale` in `SurveyRespondPage.tsx` uses raw `<button>` for circular rating pips. This is acceptable **only** if:
- The buttons have `type="button"` (not implicit submit)
- Each button has `aria-label="Vurdering {n}"`
- Each button has `aria-pressed={value === n}`
- A comment reads: `{/* Scale control — no ui/Button equivalent for circular rating pips */}`

All other raw HTML interactive elements must be rewritten.

---

## 2. Norwegian Bokmål audit

Grep for common English UI strings:

```bash
grep -rn '"Cancel"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Save"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Delete"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Edit"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Close"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Submit"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Loading"' modules/survey/ src/pages/Survey*.tsx
grep -rn '"Error"' modules/survey/ src/pages/Survey*.tsx
```

Each match is a bug. Replace:
- "Cancel" → "Avbryt"
- "Save" → "Lagre"
- "Delete" → "Slett"
- "Edit" → "Rediger"
- "Close" → "Lukk"
- "Submit" → "Send inn" (or "Bekreft" where appropriate)
- "Loading…" → "Laster…"
- "Error" → "Feil"

---

## 3. Design-system compliance

- [ ] Every page wraps in `<ModulePageShell>` (survey list, survey detail, admin settings)
- [ ] Respond page uses `bg-[#F9F7F2]` page background, white card panels
- [ ] `<ComplianceBanner>` present on: list page, detail view, AMU tab, action plan tab, respond page
- [ ] `<WarningBox>` used for all `survey.error` renders — never plain text div
- [ ] `<Badge>` used for all status pills — never inline-styled `<span>`
- [ ] `<ModuleSectionCard>` wraps all tab panel content
- [ ] `<ModulePreflightChecklist>` present in AMU tab before signature cards

---

## 4. Authorization gates audit

Check every mutating action has a `canManage` gate:

| Action | Gate |
|---|---|
| Create survey | `canManage` |
| Publish survey | `canManage` |
| Close survey | `canManage` |
| Add/edit/delete question | `canManage` |
| Upsert AMU review | `canManage` |
| Sign AMU (chair or VO) | `canManage` |
| Create/update action plan | `canManage` |
| Delete question bank entry | `canManage` |
| Module admin settings | `canManage` |
| Submit survey response | No gate — any authenticated user |

---

## 5. RLS chain verification

Confirm in `supabase/migrations/20260801100000_survey_additions.sql`:
- `survey_amu_reviews` has SELECT, INSERT, UPDATE policies
- `survey_action_plans` has SELECT, INSERT, UPDATE, DELETE policies
- UPDATE on `survey_amu_reviews` blocks edits when both parties have signed (policy checks `amu_chair_signed_at is null OR vo_signed_at is null`)
- UPDATE on `survey_action_plans` blocks closed records

---

## 6. TypeScript strictness

```bash
npx tsc --noEmit
```

Zero errors required. Common issues to check:
- `survey.amuReview` is typed `SurveyAmuReviewRow | null` — access `.id` with null check
- `survey.actionPlans` is typed `SurveyActionPlanRow[]` — no `undefined` items
- `SurveyDetailTab` prop type from `./tabs/types.ts` is used in all 6 tab components

---

## 7. Legacy file cleanup

Confirm these files have been deleted (they should be gone from each prior step):

```
src/modules/survey/types.ts              (Step 2)
src/modules/survey/useSurveyLegacy.ts   (Step 3)
src/modules/survey/schema.ts             (Step 3)
src/modules/survey/SurveyModuleView.tsx  (Step 4)
src/modules/survey/index.ts              (Step 5)
src/modules/survey/SurveyBuilderTab.tsx  (Step 5)
src/modules/survey/SurveyResultsTab.tsx  (Step 5)
src/modules/survey/SurveyAnalysisPage.tsx (Step 5)
src/modules/survey/SurveyAmuTab.tsx      (Step 6)
src/modules/survey/SurveyActionTab.tsx   (Step 7)
src/modules/survey/SurveyResponsesTab.tsx (Step 8)
```

If `src/modules/survey/` is now empty, delete the directory.

Check that no remaining file in `src/` or `modules/` imports from deleted files:

```bash
grep -rn "from '.*src/modules/survey/SurveyModuleView'" src/ modules/
grep -rn "from '.*useSurveyLegacy'" src/ modules/
grep -rn "from '.*SurveyBuilderTab'" src/ modules/
grep -rn "from '.*SurveyResultsTab'" src/ modules/
grep -rn "from '.*SurveyResponsesTab'" src/ modules/
```

Each must return zero matches.

---

## 8. Smoke-test (manual)

Walk through these scenarios in the browser after all steps are deployed:

| Scenario | Expected |
|---|---|
| Admin visits `/survey` | List page with `ModulePageShell`, template picker, compliance banner |
| Admin creates a survey from UWES-9 template | Survey created, 9 questions seeded, redirected to detail |
| Admin publishes the survey | Status changes to Aktiv, question editor locked |
| Respondent visits `/survey/respond/:id` | Questions rendered, submit works, confirmation shown |
| Admin closes survey | Status changes to Lukket |
| Admin opens AMU tab | Protocol form shown, pre-flight checklist present |
| Admin fills + saves protocol, signs both | Both signed = form disabled, banner = "Fullført" |
| Admin opens Handlingsplan tab | Empty state shown (no auto plans yet) |
| Admin manually adds action plan | Row appears in Åpne tiltak with red left border |
| Admin changes status to "Pågår" | Border changes to orange |
| Admin opens module settings | Settings load, question bank shown |

---

## Commit

```
chore(survey): self-review — no raw HTML, all Norwegian, RLS gating
```
