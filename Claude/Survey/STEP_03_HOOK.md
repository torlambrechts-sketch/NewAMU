# Step 3 — Hook: Consolidate useSurvey

**Replace** `modules/survey/useSurvey.ts` entirely.  
**Delete** after this step compiles: `src/modules/survey/useSurveyLegacy.ts`, `src/modules/survey/schema.ts`.

Depends on: Step 2 (types must be final).

---

## Context

The current `modules/survey/useSurvey.ts` is mostly correct but is missing:
- `amuReview: SurveyAmuReviewRow | null` — state for AMU review
- `actionPlans: SurveyActionPlanRow[]` — state for action plans
- `upsertAmuReview(surveyId, patch)` — create or update AMU review
- `signAmuChair(reviewId, name)` — set `amu_chair_name` + `amu_chair_signed_at`
- `signVo(reviewId, name)` — set `vo_name` + `vo_signed_at`
- `loadActionPlans(surveyId)` — fetch action plans for a survey
- `upsertActionPlan(input)` — create or update action plan row
- `updateActionPlanStatus(id, status)` — flip status

The `src/modules/survey/useSurveyLegacy.ts` also has `seedQpsNordic` and `createCampaign` — these are campaign-model methods that do NOT map to the current schema. Do NOT port them.

---

## What to write

### `UpsertQuestionInput` extension

The existing `UpsertQuestionInput` type in `useSurvey.ts` must be extended with mandatory-question fields. Read the current type in `modules/survey/useSurvey.ts` first, then add:

```ts
type UpsertQuestionInput = {
  id?: string
  surveyId: string
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
  isMandatory?: boolean        // AML § 4-3 — defaults to false
  mandatoryLaw?: 'AML_4_3' | 'AML_4_4' | 'AML_6_2' | null
}
```

Inside `upsertQuestion`, include these fields in the `row` object sent to Supabase:

```ts
const row = {
  survey_id: input.surveyId,
  organization_id: oid,
  question_text: input.questionText,
  question_type: input.questionType,
  order_index: input.orderIndex,
  is_required: input.isRequired,
  is_mandatory: input.isMandatory ?? false,
  mandatory_law: input.mandatoryLaw ?? null,
}
```

Also block deletion of mandatory questions in `deleteQuestion`:

```ts
// Prevent deletion of legally mandatory questions
const qToDelete = questions.find((q) => q.id === questionId)
if (qToDelete?.is_mandatory) {
  setError('Dette spørsmålet er lovpålagt (AML § 4-3) og kan ikke slettes.')
  return
}
```

### State shape additions

Add to the `UseSurveyState` exported type (existing state is unchanged — only append):

```ts
amuReview: SurveyAmuReviewRow | null
actionPlans: SurveyActionPlanRow[]
loadAmuReview: (surveyId: string) => Promise<void>
upsertAmuReview: (surveyId: string, patch: Partial<Pick<SurveyAmuReviewRow,
  'meeting_date' | 'agenda_item' | 'protocol_text'>>) => Promise<SurveyAmuReviewRow | null>
signAmuChair: (reviewId: string, name: string) => Promise<boolean>
signVo: (reviewId: string, name: string) => Promise<boolean>
loadActionPlans: (surveyId: string) => Promise<void>
upsertActionPlan: (input: {
  id?: string
  surveyId: string
  category: string
  pillar: SurveyPillar
  title: string
  description?: string | null
  score?: number | null
  responsible?: string | null
  due_date?: string | null
}) => Promise<SurveyActionPlanRow | null>
updateActionPlanStatus: (id: string, status: SurveyActionPlanStatus) => Promise<void>
```

### State variables to add inside `useSurvey`

```ts
const [amuReview, setAmuReview] = useState<SurveyAmuReviewRow | null>(null)
const [actionPlans, setActionPlans] = useState<SurveyActionPlanRow[]>([])
```

### `loadAmuReview`

```ts
const loadAmuReview = useCallback(async (surveyId: string) => {
  if (!supabase) return
  const oid = assertOrg()
  if (!oid) return
  const { data, error: e } = await supabase
    .from('survey_amu_reviews')
    .select('*')
    .eq('survey_id', surveyId)
    .eq('organization_id', oid)
    .maybeSingle()
  if (e) { setError(getSupabaseErrorMessage(e)); return }
  if (!data) { setAmuReview(null); return }
  const p = parseSurveyAmuReviewRow(data)
  setAmuReview(p.success ? p.data : null)
}, [supabase, assertOrg])
```

Call `loadAmuReview(surveyId)` inside `loadSurveyDetail` after the questions/responses fetch — it is a separate await so it does not block the main load.

### `upsertAmuReview`

```ts
const upsertAmuReview = useCallback(
  async (surveyId: string, patch: Partial<Pick<SurveyAmuReviewRow,
    'meeting_date' | 'agenda_item' | 'protocol_text'>>
  ): Promise<SurveyAmuReviewRow | null> => {
    if (!supabase) return null
    if (!requireManage()) return null
    const oid = assertOrg()
    if (!oid) return null
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('survey_amu_reviews')
        .upsert(
          { survey_id: surveyId, organization_id: oid, ...patch },
          { onConflict: 'survey_id' }
        )
        .select()
        .single()
      if (e) throw e
      const p = parseSurveyAmuReviewRow(data)
      if (!p.success) throw new Error('Ugyldig svar fra database')
      setAmuReview(p.data)
      return p.data
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      return null
    }
  },
  [supabase, assertOrg, requireManage],
)
```

### `signAmuChair`

```ts
const signAmuChair = useCallback(
  async (reviewId: string, name: string): Promise<boolean> => {
    if (!supabase) return false
    const oid = assertOrg()
    if (!oid) return false
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('survey_amu_reviews')
        .update({
          amu_chair_name: name.trim(),
          amu_chair_signed_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .eq('organization_id', oid)
        .select()
        .single()
      if (e) throw e
      const p = parseSurveyAmuReviewRow(data)
      if (p.success) setAmuReview(p.data)
      return true
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      return false
    }
  },
  [supabase, assertOrg],
)
```

### `signVo`

Same shape as `signAmuChair` but sets `vo_name` and `vo_signed_at`.

### `loadActionPlans`

```ts
const loadActionPlans = useCallback(async (surveyId: string) => {
  if (!supabase) return
  const oid = assertOrg()
  if (!oid) return
  const { data, error: e } = await supabase
    .from('survey_action_plans')
    .select('*')
    .eq('survey_id', surveyId)
    .eq('organization_id', oid)
    .order('created_at', { ascending: true })
  if (e) { setError(getSupabaseErrorMessage(e)); return }
  setActionPlans(collect(data, parseSurveyActionPlanRow))
}, [supabase, assertOrg])
```

Call `loadActionPlans(surveyId)` inside `loadSurveyDetail`.

### `upsertActionPlan`

Follow the same upsert pattern as `upsertAmuReview`. `requireManage()` check required.

### `updateActionPlanStatus`

```ts
const updateActionPlanStatus = useCallback(
  async (id: string, status: SurveyActionPlanStatus) => {
    if (!supabase) return
    if (!requireManage()) return
    const oid = assertOrg()
    if (!oid) return
    setError(null)
    try {
      const { error: e } = await supabase
        .from('survey_action_plans')
        .update({ status })
        .eq('id', id)
        .eq('organization_id', oid)
      if (e) throw e
      setActionPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      )
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  },
  [supabase, assertOrg, requireManage],
)
```

### Return value additions

Append to the returned object:
```ts
amuReview,
actionPlans,
loadAmuReview,
upsertAmuReview,
signAmuChair,
signVo,
loadActionPlans,
upsertActionPlan,
updateActionPlanStatus,
```

---

## Authorization rules

- `canManage = isAdmin || can('survey.manage')` — already in file, keep it
- `upsertAmuReview`, `signAmuChair`, `signVo`, `upsertActionPlan`, `updateActionPlanStatus` all call `requireManage()` before any mutation
- `loadAmuReview` and `loadActionPlans` do NOT require manage (read is available to all org members)

---

## What NOT to do

- Do NOT remove any existing method from `useSurvey` — `SurveyDetailView` depends on all of them
- Do NOT port `seedQpsNordic`, `createCampaign`, `results`, `computeResults`, `amuReview` from `useSurveyLegacy` — those are the campaign-model methods for the deprecated tables
- Do NOT import from `src/modules/survey/` inside `modules/survey/`

---

## Validation checklist

- [ ] `UseSurveyState` type export includes all new methods
- [ ] `amuReview` state is typed `SurveyAmuReviewRow | null`
- [ ] `actionPlans` state is typed `SurveyActionPlanRow[]`
- [ ] `loadSurveyDetail` now also calls `loadAmuReview` and `loadActionPlans`
- [ ] `requireManage()` guard on all mutating methods
- [ ] `getSupabaseErrorMessage` used in every catch
- [ ] No `console.log` anywhere in the file
- [ ] `src/modules/survey/useSurveyLegacy.ts` deleted after compile
- [ ] `src/modules/survey/schema.ts` deleted after compile

## Commit

```
feat(survey): consolidate hook — add amu review + action plan methods
```
