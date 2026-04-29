# Survey Module — Code Review (v2)
*Perspective: Architecture, correctness, performance, security, maintainability*
*Date: 2026-04-29 · Updated after main merge*

---

## R1 · `useSurvey` god-object grew from 1 334 → 2 153 lines (worsened ❌)

**File:** `useSurvey.ts`

The main update added sections, distributions, and invitations — all inside the same hook. It now exports 40+ methods and manages 18 state slices. Every state update recreates the return object and triggers re-renders in all consumers. The `UseSurveyState` interface has become impossible to mock in tests.

**Recommendation:** Split into four focused hooks and compose them in the view components:

| Hook | Responsibility |
|------|---------------|
| `useSurveyList` | `loadSurveys`, `createSurvey`, `surveys[]` |
| `useSurveyDetail` | `loadSurveyDetail`, `questions`, `sections`, `upsertQuestion`, `upsertSection`, `reorderQuestions`, `reorderSections`, `deleteQuestion`, `deleteSection` |
| `useSurveyCompliance` | `amuReview`, `actionPlans`, `upsertAmuReview`, `signAmuChair`, `signVo`, `upsertActionPlan`, `updateActionPlanStatus` |
| `useSurveyDistribution` | `distributions`, `invitations`, `loadDistributions`, `loadInvitations`, `createDistribution`, `generateInvitations`, `sendInvitations`, `sendReminders` |

---

## R2 · `reorderQuestions` N sequential DB calls — unchanged (open)

**File:** `useSurvey.ts:762-828`

The implementation did not change. For a 20-question survey, drag-and-drop fires 20 sequential HTTP requests. Any failure midway leaves order inconsistent.

**Fix:**
```ts
const rows = orderedQuestionIds.map((id, i) => ({
  id,
  survey_id: surveyId,
  organization_id: oid,
  order_index: i,
}))
const { error } = await supabase
  .from('org_survey_questions')
  .upsert(rows, { onConflict: 'id' })
```

---

## R17 · `surveyAnalytics` handles only 7 of 22 question types (new — critical)

**File:** `surveyAnalytics.ts`

The analytics engine was written for the original 7 question types. After the main update introduced 15 new types, the analytics function is unaware of:

`short_text`, `long_text`, `email`, `number`, `rating_visual`, `slider`, `dropdown`, `image_choice`, `likert_scale`, `matrix`, `ranking`, `nps`, `file_upload`, `datetime`, `signature`

All 15 fall through to the default branch, producing empty `numbers[]`, `textCount: 0`, and `choiceCounts: {}`. The `AnalyseTab` then renders a blank card with "Ingen flervalgssvar registrert" for matrix questions, NPS scores, and slider values — completely wrong.

**Recommendation:** Extend `buildAnalyticsByQuestionId` with branches for each new type:
- `nps` / `rating_visual` / `likert_scale` / `slider` → treat as numeric (same as `rating_1_to_5`)
- `number` → numeric
- `short_text` / `long_text` / `email` / `signature` → textCount only
- `dropdown` / `image_choice` → choiceCounts (same as `single_select`)
- `datetime` / `file_upload` → textCount only (count submitted)
- `matrix` / `ranking` → new aggregate structure (map of row → score distribution)

The `AnalyseTab` also needs dedicated rendering components for `matrix`, `ranking`, and `nps`.

---

## R19 · `reorderSections` also N sequential DB calls (new — critical)

**File:** `useSurvey.ts:979+`

The same N-sequential-updates pattern from `reorderQuestions` was replicated in `reorderSections`. Each section drag fires one update per section.

**Fix:** Same batch upsert approach as R2. Apply to both functions in the same PR.

---

## R20 · `loadSurveyDetail` doesn't load sections or distributions (new)

**File:** `useSurvey.ts:437+`

`loadSurveyDetail` fetches: survey, questions, responses, answers, AMU review, action plans — but not `surveySections` or `distributions`. When `SurveySectionBuilder` renders after `loadSurveyDetail`, `survey.surveySections` is empty until something triggers `loadSections`. This causes a flash of the "Uten seksjon" root view regardless of actual section structure.

**Recommendation:** Add `loadSections(surveyId)` and `loadDistributions(surveyId)` to the `Promise.all` inside `loadSurveyDetail`.

---

## R3 · `applyTemplateToSurvey` N sequential upserts (open)

**File:** `useSurvey.ts:1548+`

Template application calls `upsertQuestion` in a loop. For a 30-question template, this is 30 sequential DB round trips with no rollback on failure.

**Recommendation:** Batch-insert all questions in a single `.insert(rows)` call. The `org_survey_questions_before_insert` trigger validates each row server-side.

---

## R4 · `PaletteDragItem` uses raw `<button>` — spec violation persists (open)

**File:** `SurveySectionBuilder.tsx:108-126`

The `SurveySectionBuilder` copied the same `<button>` pattern from `SurveyBuilderStage` rather than fixing it. The `SortableQuestionTableRow` drag handle (line ~200) also uses a raw `<button>`.

**Fix:** Add `React.forwardRef` to the shared `Button` component to accept `ref`, then use `Button` in both palette and drag-handle positions. Pass `{...listeners}` and `{...attributes}` via spread.

---

## R5 · `isMandatoryAml4_3` duplicated — still (open)

**File:** `SurveyPage.tsx` and `useSurvey.ts` (applyTemplateToSurvey)

Two identical keyword arrays in two files. No change in main update.

**Recommendation:** Export `isAml4_3Mandatory(text: string): boolean` from `modules/survey/surveyCompliance.ts` and import in both files. Prefer removing the function entirely in favour of template-body flags (see C1).

---

## R6 · `SurveyDetailView` grew to 926 lines (worsened ❌)

**File:** `SurveyDetailView.tsx`

`OversiktTab`, `ByggerTab`, `SvarTab`, and `AnalyseTab` are still defined inline. The file grew from 784 to 926 lines. The `ByggerTab` now also imports and wraps `SurveySectionBuilder`, making the component boundary even less clear.

**Recommendation:** Move each tab to `tabs/`:
- `tabs/SurveyOversiktDetailTab.tsx`
- `tabs/SurveyByggerTab.tsx` (thin wrapper around `SurveySectionBuilder`)
- `tabs/SurveySvarTab.tsx`
- `tabs/SurveyAnalyseTab.tsx`

---

## R7 · `loadSurveyDetail` serial query chain (open)

**File:** `useSurvey.ts`

The load sequence is: survey → `[questions + responses]` parallel → answers (serial after responses) → AMU → action plans (both serial). With sections and distributions now also needed, the chain is even longer.

**Recommendation:** Load survey first (to get `organization_id`), then fire all remaining queries in parallel:
```ts
const [qRes, rRes, secRes, amuRes, actRes, distRes] = await Promise.all([
  supabase.from('org_survey_questions')...,
  supabase.from('org_survey_responses')...,
  supabase.from('survey_sections')...,
  supabase.from('survey_amu_reviews')...,
  supabase.from('survey_action_plans')...,
  supabase.from('survey_distributions')...,
])
// Then answers from response IDs (depends on rRes)
```

---

## R8 · Legacy template path N sequential upserts (open)

**File:** `SurveyPage.tsx` `handleCreate`

The `ALL_SURVEY_TEMPLATES` fallback still calls `upsertQuestion` in a loop. Now that the template catalog is seeded, this code path is effectively dead but still present and still slow if triggered.

**Recommendation:** Mark the fallback with `// TODO: remove after all orgs have migrated to survey_template_catalog` and batch the inserts.

---

## R15 · Drag-insert race condition — moved to SurveySectionBuilder (open)

**File:** `SurveySectionBuilder.tsx` `onDragEnd`

The new section builder drops a palette item at `nextIndex = max(order_index) + 1`, then returns without attempting a move. This is safer than the old `SurveyBuilderStage` which tried to reorder immediately after insert. However, the `nextIndex` calculation uses `questionsInView` (client state), which may lag behind the DB after the async upsert if another user is editing simultaneously.

**Low risk for single-user sessions** but worth noting for multi-admin orgs.

---

## R18 · `SurveyPendingInvitesBanner` makes 2 serial queries that could JOIN (new)

**File:** `SurveyPendingInvitesBanner.tsx:17-44`

The component first fetches `survey_invitations` for the current user, then fetches `surveys` for those IDs. Two round trips that could be collapsed to:

```ts
supabase
  .from('survey_invitations')
  .select('survey_id, surveys!inner(id, title, status)')
  .eq('profile_id', user.id)
  .eq('status', 'pending')
  .eq('surveys.status', 'active')
```

Minor performance issue but adds latency on every page load for invited users.

---

## R9 · `saveOrgTemplate` pseudo-random ID fallback unnecessary (open)

**File:** `useSurvey.ts:1621+`

Org templates don't need a text primary key. The `tpl-${Date.now()}` fallback is only needed for system templates with stable slug IDs like `tpl-uwes`. For org templates, omit `id` from the insert and let Postgres generate a UUID.

---

## R10 · Question delete has no optimistic update (open)

**File:** `SurveyDetailView.tsx`, `useSurvey.ts`

When the user clicks "Slett spørsmål", the panel closes immediately but the question row stays visible until the DB delete completes. Optimistic removal would improve perceived responsiveness.

**Recommendation:**
```ts
setQuestions(prev => prev.filter(q => q.id !== questionId)) // optimistic
const { error } = await supabase.from('org_survey_questions').delete()...
if (error) {
  setQuestions(prev => [...prev, qToDelete].sort(...)) // rollback
}
```

---

## R11 · OversiktTab loses edits on survey reload (open)

**File:** `SurveyDetailView.tsx` `OversiktTab`

Local `titleEdit`/`descEdit` state is initialized from `s.title`/`s.description` at mount only. If `selectedSurvey` is updated by the parent (e.g. after publish), local edits persist silently. The `key={s.id}` only resets on survey ID change.

**Recommendation:** Sync from server value using a `useEffect` gated by an `isDirty` boolean.

---

## R14 · `created_by` never populated on AMU review insert (open)

**File:** `useSurvey.ts` `upsertAmuReview`

The upsert payload omits `created_by`. The column exists in `survey_amu_reviews` but is always `null`.

**Recommendation:** Either populate via a `BEFORE INSERT` trigger (`new.created_by := auth.uid()`) or pass it explicitly from the client.

---

## R16 · `surveyAdminSettingsSchema` parse error blocks all survey creation (open)

**File:** `useSurvey.ts` `createSurvey:586+`

If `parseSurveyModuleSettings` throws on a malformed org settings payload, `createSurvey` returns `null` and the user sees no explanation. No change in main update.

**Recommendation:** Return a safe default `{ default_anonymous: false }` on parse failure rather than propagating the exception.
