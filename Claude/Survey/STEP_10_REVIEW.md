# Step 10 — Self-Review, Compliance Audit & Legacy Cleanup

This is a checklist-only step. No new code. Run through every item and fix before reporting done.

**Read `Claude/Survey/COMPLIANCE.md` in full before starting this step.**

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

## 7b. Norwegian Labour Law Compliance Audit

Run each check. All must be ✓ before marking done.

### GDPR / Personvern
- [ ] **k-Anonymitet**: `s.anonymity_threshold` (never < `SURVEY_K_ANONYMITY_MIN = 5`) applied before showing any result in Analyse tab
- [ ] **Fritekst suppression**: `question_type = 'text'` results show count ONLY — no content visible in UI
- [ ] **Anonymous respond**: `submitResponse` called with `userId: user?.id ?? null` — never hardcoded `null`
- [ ] **Non-anon gate**: respond page shows login-required message when `!user && !survey.is_anonymous`
- [ ] **ComplianceBanner on respond page** states whether survey is anonymous or identified
- [ ] **Respondent retraction notice** shown on respond page for non-anonymous surveys
- [ ] **Suppressed results** shown as `<EyeOff />` + "Skjult (n<5)" — never as empty row

### AML § 4-3 — Psykososialt arbeidsmiljø
- [ ] `is_mandatory = true` set on questions flagged with AML § 4-3 keywords during template seeding
- [ ] Mandatory questions display `<Badge variant="danger">AML § 4-3</Badge>` in Bygger tab
- [ ] Delete button for mandatory questions shows error «Lovpålagt — kan ikke slettes» instead of deleting
- [ ] At least one HMS-klima or Edmondson template question in the question bank covers trakassering, integritet, medvirkning, sikkerhet, psykososial belastning

### AML § 7-2 — AMU-presentasjonsplikt
- [ ] AMU-gjennomgang tab shows `<ComplianceBanner refs={['AML § 7-2', 'IK-forskriften § 5']}>`
- [ ] `survey_amu_reviews` row blocks further edits once both `amu_chair_signed_at` and `vo_signed_at` are set (DB RLS + UI)
- [ ] Pre-flight checklist in AMU tab includes: "Protokolltekst er skrevet", "Møtedato er registrert", "Undersøkelsen er lukket"
- [ ] Both signature cards rendered in AMU tab

### IK-forskriften § 5 — Systematisk HMS-arbeid og dokumentasjon
- [ ] `surveys.action_threshold` column exists in DB (migration STEP_01)
- [ ] Handlingsplan tab shows compliance banner referencing AML § 3-1 and IK-f § 5
- [ ] Action plans are NOT deletable when `status = 'closed'` (DB RLS policy)
- [ ] `surveys.status = 'archived'` blocks DELETE via RLS policy in STEP_01 migration

### AML § 3-1 — Systematisk kartleggingssyklus
- [ ] `surveys.recurrence_months` column exists in DB
- [ ] Admin settings page allows setting `recurrence_months` (even if just a number input)

### Mandatory DB columns (verify in migration file)
```bash
# Run against your Supabase project or local migration
grep -n 'anonymity_threshold\|amu_review_required\|action_threshold\|recurrence_months' \
  supabase/migrations/20260801100000_survey_additions.sql
```
All four must appear.

---

## 8. Smoke-test (manual)

Walk through these scenarios in the browser after all steps are deployed:

| Scenario | Expected |
|---|---|
| Admin visits `/survey` | List page with `ModulePageShell`, template picker, compliance banner |
| Admin creates a survey from HMS-klima template | Survey created, questions seeded, mandatory ones show `AML § 4-3` badge |
| Admin tries to delete a mandatory question | Error «Lovpålagt — kan ikke slettes» shown, question remains |
| Admin publishes the survey | Status = Aktiv, question editor locked |
| **Unauthenticated** user visits respond page for **anonymous** survey | Form shown without login requirement |
| **Unauthenticated** user visits respond page for **non-anonymous** survey | Login-required message shown, no form |
| Authenticated respondent submits a non-anonymous survey | `org_survey_responses.user_id` = user's UUID in DB |
| Authenticated respondent submits an anonymous survey | `org_survey_responses.user_id` = NULL in DB |
| Admin opens Analyse tab with < 5 responses | `<EyeOff>` suppression shown for all numeric questions |
| Admin opens Analyse tab with ≥ 5 responses | Scores shown; text questions show count only |
| Admin opens text question results | Count shown; **no individual text answers visible** |
| Admin closes survey | Status = Lukket |
| Admin opens AMU tab | Pre-flight checklist + protocol form shown |
| Admin fills protocol, saves, signs both | Both signed = form disabled, "Fullført" banner |
| Admin tries to edit signed AMU protocol | Fields disabled (DB RLS blocks update) |
| Admin opens Handlingsplan tab | Empty state shown |
| Admin manually adds action plan | Row with red left border in Åpne tiltak |
| Admin changes action plan to "Pågår" | Orange border |
| Admin archives survey (future) | DELETE blocked by RLS (`status = 'archived'`) |
| Admin opens module settings | Settings load, question bank shown |

---

## Commit

```
chore(survey): self-review — no raw HTML, all Norwegian, RLS gating
```
