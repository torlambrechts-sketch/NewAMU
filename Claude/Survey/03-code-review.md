# Survey Module — Code Review
*Perspective: Architecture, correctness, performance, security, maintainability*
*Date: 2026-04-29*

---

## R1 · `useSurvey` is a 1334-line god-object

**File:** `useSurvey.ts` (entire file)

The hook exports 33 methods and manages 14 independent state slices. This violates the AI_MODULE_SPEC anti-monolith rule (≤300 LOC per component/hook) and creates real-world problems:

- Every call to any exported method recreates the return object, triggering re-renders in all consumers.
- Tests and TypeScript type-checking must load the entire hook to test a single function.
- The `UseSurveyState` exported type is a 33-member interface — impossible to satisfy in stubs.

**Recommendation:** Split into three focused hooks:
- `useSurveyList` — `loadSurveys`, `createSurvey`, `surveys` list state.
- `useSurveyDetail` — `loadSurveyDetail`, `questions`, `responses`, `answers`, `upsertQuestion`, `reorderQuestions`, `deleteQuestion`.
- `useSurveyCompliance` — `amuReview`, `actionPlans`, `upsertAmuReview`, `signAmuChair`, `signVo`, `upsertActionPlan`.

`SurveyPage` uses `useSurveyList`; `SurveyDetailView` composes all three.

---

## R2 · `reorderQuestions` makes N sequential database round trips

**File:** `useSurvey.ts:604-612`

```ts
for (let i = 0; i < orderedQuestionIds.length; i++) {
  const { error: e } = await supabase
    .from('org_survey_questions')
    .update({ order_index: i })
    .eq('id', orderedQuestionIds[i]!)
    ...
  if (e) throw e
}
```

For a 20-question survey, this fires 20 sequential HTTP requests. Each drag-and-drop fires this entire chain. On a slow connection it takes several seconds and any failure partway leaves the order in an inconsistent state.

**Recommendation:** Use a single batch upsert:
```ts
const rows = orderedQuestionIds.map((id, i) => ({
  id,
  survey_id: surveyId,
  organization_id: oid,
  order_index: i,
}))
await supabase
  .from('org_survey_questions')
  .upsert(rows, { onConflict: 'id' })
```

Or add a `reorder_survey_questions(survey_id, ordered_ids)` Postgres function.

---

## R3 · `applyTemplateToSurvey` makes N sequential upsert calls

**File:** `useSurvey.ts:1173-1190`

Same pattern as R2 — loops over `questions.length` and calls `upsertQuestion` sequentially. For a 30-question QPS-Nordic template, this makes 30 DB calls before the user sees any result. There is also no rollback if one question fails mid-loop.

**Recommendation:** Batch-insert all questions in a single `.insert(rows)` call. The `org_survey_questions_before_insert` trigger will validate each row server-side.

---

## R4 · `PaletteItem` uses raw `<button>` — violates AI_MODULE_SPEC rule 1

**File:** `SurveyBuilderStage.tsx:53-68`

```tsx
<button
  ref={setNodeRef}
  type="button"
  {...listeners}
  {...attributes}
  className={[...].join(' ')}
>
```

The spec prohibits raw HTML control elements; all interactive elements must use shared UI components (`Button`, `StandardInput`, etc.).

**Recommendation:** The `Button` component needs a `ref` prop to support dnd-kit's `setNodeRef`. Add `React.forwardRef` to `Button` and pass `ref={setNodeRef}` to it, along with `{...listeners}` and `{...attributes}` via a spread.

---

## R5 · `isMandatoryAml4_3` is duplicated

**File:** `SurveyPage.tsx:38-43` and `useSurvey.ts:1179`

The same keyword array and matching logic exists in two places with no shared import. They will diverge silently.

**Recommendation:** Export a single `isAml4_3Mandatory(text: string): boolean` function from a shared location (e.g. `modules/survey/surveyCompliance.ts`) and import it in both files.

---

## R6 · `SurveyDetailView` exceeds spec size limit at 784 lines

**File:** `SurveyDetailView.tsx` (entire file)

Inline tab components (`OversiktTab`, `ByggerTab`, `SvarTab`, `AnalyseTab`) are defined within the same file as `SurveyDetailView`. Each is 50–100 lines and belongs in `tabs/`.

**Recommendation:** Move each to its own file:
- `tabs/SurveyOversiktDetailTab.tsx` (OversiktTab)
- `tabs/SurveyByggerTab.tsx` (ByggerTab — wraps SurveyBuilderStage)
- `tabs/SurveySvarTab.tsx` (SvarTab)
- `tabs/SurveyAnalyseTab.tsx` (AnalyseTab)

This also enables lazy loading each tab.

---

## R7 · `loadSurveyDetail` chains 6 queries, answers are serial

**File:** `useSurvey.ts:280-344`

The function loads: survey, questions, responses (parallel), then conditionally fetches answers (serial after responses), then calls `loadAmuReview` and `loadActionPlans` (both serial). Critical path:

```
survey → [questions + responses] → answers → AMU review → action plans
```

Answers, AMU review, and action plans could all be fetched in parallel once `survey_id` and `org_id` are known.

**Recommendation:**
```ts
const [qRes, rRes, amuRes, actRes] = await Promise.all([
  supabase.from('org_survey_questions')...,
  supabase.from('org_survey_responses')...,
  supabase.from('survey_amu_reviews')...,
  supabase.from('survey_action_plans')...,
])
// Then answers from response IDs
```

---

## R8 · `handleCreate` legacy template path fires N sequential upserts

**File:** `SurveyPage.tsx:149-174`

The fallback path for legacy (`ALL_SURVEY_TEMPLATES`) questions:
```ts
for (let i = 0; i < tpl.questions.length; i++) {
  await survey.upsertQuestion({ ... })
}
```

This runs serially, one request per question. For a 20-question template, the user waits for 20 sequential round trips before being navigated to the new survey.

**Recommendation:** Add a `batchInsertQuestions` method to `useSurvey` that does a single `.insert(rows)`. The legacy code path should be removed entirely once the template catalog is fully seeded.

---

## R9 · `saveOrgTemplate` generates a pseudo-random ID unnecessarily

**File:** `useSurvey.ts:1235-1238`

```ts
const newId =
  typeof globalThis.crypto !== 'undefined' && ...
    ? globalThis.crypto.randomUUID()
    : `tpl-${Date.now()}-${Math.random()...}`
```

Org-owned templates don't need a text primary key — that pattern exists for system templates like `tpl-uwes` where the ID is a stable slug. Org templates should let Postgres generate a UUID via `gen_random_uuid()`.

**Recommendation:** For org templates, omit the `id` field from the insert. The `tpl-${Date.now()}` fallback is also unnecessary since `crypto.randomUUID` is available in all modern browsers and Node 18+.

---

## R10 · `deleteQuestion` fires without optimistic update

**File:** `SurveyDetailView.tsx:763-772`, `useSurvey.ts:634-675`

When the user clicks "Slett spørsmål", the panel closes immediately (`closePanel()`), but the question row remains visible on the canvas until the async DB delete completes. On a slow connection this can take 1–2 seconds of confusion.

**Recommendation:** Optimistically remove the question from local state before the DB call:
```ts
setQuestions(prev => prev.filter(q => q.id !== questionId)) // optimistic
const { error } = await supabase.from('org_survey_questions').delete()...
if (error) {
  setQuestions(prev => [...prev, qToDelete]) // rollback
  setError(...)
}
```

---

## R11 · `OversiktTab` in `SurveyDetailView` loses edits on survey reload

**File:** `SurveyDetailView.tsx:94-111`

The `OversiktTab` component initializes `titleEdit` and `descEdit` from `s.title` and `s.description` at mount time only. If the parent reloads `selectedSurvey` (e.g. after publishing), local edits are preserved in state even though the server has a different value. The `key={s.id}` on the component means this only resets on survey ID change, not on metadata change.

**Recommendation:** Sync local edit state from the server value using a `useEffect` that fires when `s.title` or `s.description` changes, but only when the user is not actively editing (track a `isDirty` boolean).

---

## R12 · Database: `surveys` status check constraint not enforced on core migration

**Migration:** `20260101000000_enterprise_survey_module_core.sql:14-16`

The initial `surveys` table only permits `'draft', 'active', 'closed'`. The `'archived'` status is added by `20260801100000_survey_additions.sql`. If migrations are applied in a new environment, the `'archived'` status is unavailable until the second migration runs — but TypeScript types already include it.

**Recommendation:** This is already resolved by the migration order, but add a comment in the core migration: `-- 'archived' added in 20260801100000_survey_additions.sql` to make the dependency explicit.

---

## R13 · `upsertAmuReview` conflict target may fail on multi-survey orgs

**File:** `useSurvey.ts:797-800`

```ts
.upsert(
  { survey_id: surveyId, organization_id: oid, ...patch },
  { onConflict: 'survey_id' },
)
```

The `unique (survey_id)` constraint on `survey_amu_reviews` is correct (one review per survey), but the `onConflict` in PostgREST must reference the exact constraint name. If the constraint is ever renamed or the unique index is rebuilt, this silently becomes an insert-only operation.

**Recommendation:** Use `onConflict: 'survey_id'` as-is (correct for this schema) but add a comment. Also verify the constraint name matches the migration: `unique (survey_id)` creates an implicit index named `survey_amu_reviews_survey_id_key`.

---

## R14 · TypeScript: `created_by` is never populated on AMU review insert

**File:** `useSurvey.ts:797-800`, `types.ts:237`

`SurveyAmuReviewRow` has `created_by: string | null` but the upsert payload never includes it:
```ts
.upsert({ survey_id, organization_id, ...patch }, ...)
```

`auth.uid()` is available server-side but not passed from the client. The field is always `null`.

**Recommendation:** Either remove the column if it's not used, or include it via the database trigger (`survey_amu_reviews_before_insert` should set `new.created_by := auth.uid()`).

---

## R15 · `SurveyBuilderStage`: drag from palette inserts at end, then tries to move

**File:** `SurveyBuilderStage.tsx:183-202`

When a palette item is dropped onto an existing question row, the code:
1. Inserts the new question at `nextIndex` (end of list).
2. Tries to reorder using the drop target's ID.

But `reorderQuestions` validates that `orderedQuestionIds.length === existingIds.size`. After the insert, `existingIds` has `n+1` items but the reorder call passes `[...itemIds.slice(0, at), row.id, ...itemIds.slice(at)]` which is also `n+1`. This should work — but if the insert fails (DB error), the reorder still runs with a stale `itemIds` that doesn't include the new question, causing `existingIds.size` mismatch and silently returning `false`.

**Recommendation:** Guard the reorder call inside the `if (!row) return` early exit. Already done, but the `existingIds` set is computed from `questions.filter(q => q.survey_id === surveyId)` which relies on state being updated synchronously after the insert — which `setQuestions` (async state update) does not guarantee. Add `await` on the insert and re-fetch `itemIds` from the updated state before reordering.

---

## R16 · `surveyAdminSettingsSchema.ts` not reviewed — potential gap

**File:** `surveyAdminSettingsSchema.ts`

This file is imported in `useSurvey.ts:6` but was not included in the module file listing initially. The `default_anonymous` setting is read from org module payload during `createSurvey`. If the schema validation fails (wrong shape), `parseSurveyModuleSettings` may throw and block all survey creation.

**Recommendation:** Review this file and ensure `parseSurveyModuleSettings` returns a safe default (e.g. `{ default_anonymous: false }`) on parse failure rather than throwing.
