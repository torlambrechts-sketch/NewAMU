# Step 2 — Types & Zod Schemas

**Replace** `modules/survey/types.ts` entirely.  
**Delete** `src/modules/survey/types.ts` after the replacement compiles cleanly.

Depends on: Step 1 (new DB tables `survey_amu_reviews` and `survey_action_plans` must exist).

---

## Context

There are currently two type files:
- `modules/survey/types.ts` — the active file; has `SurveyRow`, `OrgSurveyQuestionRow`, `OrgSurveyResponseRow`, `OrgSurveyAnswerRow`, `SurveyQuestionBankRow`, `SurveyStatus`, `SurveyQuestionType`
- `src/modules/survey/types.ts` — legacy file; has `SurveyCampaignRow`, `SurveyPillar`, `SurveyQuestionType` (different shape), `SurveyResultRow`, `SurveyActionPlanRow`, `AmuReviewRow`

After this step, `modules/survey/types.ts` is the single source of truth. The legacy file is deleted.

---

## What to write in `modules/survey/types.ts`

Keep all existing exports that `modules/survey/useSurvey.ts` and `modules/survey/SurveyDetailView.tsx` currently import. Add the missing types for `survey_amu_reviews` and `survey_action_plans`. Add runtime Zod parsers for each row type.

### 1. Primitive unions

```ts
export type SurveyStatus = 'draft' | 'active' | 'closed'

export type SurveyQuestionType = 'rating_1_to_5' | 'text' | 'multiple_choice'

export type SurveyActionPlanStatus = 'open' | 'in_progress' | 'closed'

export type SurveyPillar =
  | 'psychosocial'
  | 'physical'
  | 'organization'
  | 'safety_culture'
  | 'custom'
```

### 2. Row types (match DB columns exactly)

```ts
export type SurveyRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  status: SurveyStatus
  is_anonymous: boolean
  published_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type OrgSurveyQuestionRow = {
  id: string
  survey_id: string
  organization_id: string
  question_text: string
  question_type: SurveyQuestionType
  order_index: number
  is_required: boolean
  created_at: string
  updated_at: string
}

export type OrgSurveyResponseRow = {
  id: string
  survey_id: string
  organization_id: string
  user_id: string | null
  submitted_at: string
  created_at: string
  updated_at: string
}

export type OrgSurveyAnswerRow = {
  id: string
  response_id: string
  question_id: string
  organization_id: string
  answer_value: number | null
  answer_text: string | null
  created_at: string
  updated_at: string
}

export type SurveyQuestionBankRow = {
  id: string
  organization_id: string
  category: string
  question_text: string
  question_type: SurveyQuestionType
  created_at: string
  updated_at: string
}

export type SurveyAmuReviewRow = {
  id: string
  organization_id: string
  survey_id: string
  meeting_date: string | null
  agenda_item: string | null
  protocol_text: string | null
  amu_chair_name: string | null
  amu_chair_signed_at: string | null
  vo_name: string | null
  vo_signed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type SurveyActionPlanRow = {
  id: string
  organization_id: string
  survey_id: string
  category: string
  pillar: SurveyPillar
  title: string
  description: string | null
  score: number | null
  status: SurveyActionPlanStatus
  responsible: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}
```

### 3. Zod schemas and parsers

Import `z` from `zod`. Write one schema per row type, named `[TypeName]Schema`. Write one parser function per type, named `parse[TypeName](raw: unknown)`, returning `{ success: true; data: T } | { success: false }`.

Do NOT throw inside parsers — they are used in `collect()` inside the hook and must be safe.

Example pattern for `SurveyRow`:

```ts
import { z } from 'zod'

const SurveyStatusSchema = z.enum(['draft', 'active', 'closed'])
const SurveyQuestionTypeSchema = z.enum(['rating_1_to_5', 'text', 'multiple_choice'])
const SurveyActionPlanStatusSchema = z.enum(['open', 'in_progress', 'closed'])
const SurveyPillarSchema = z.enum(['psychosocial', 'physical', 'organization', 'safety_culture', 'custom'])

export const SurveyRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: SurveyStatusSchema,
  is_anonymous: z.boolean(),
  published_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseSurveyRow(raw: unknown): { success: true; data: SurveyRow } | { success: false } {
  const r = SurveyRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}
```

Write schemas and parsers for all 7 row types:
- `SurveyRow` / `parseSurveyRow`
- `OrgSurveyQuestionRow` / `parseOrgSurveyQuestionRow`
- `OrgSurveyResponseRow` / `parseOrgSurveyResponseRow`
- `OrgSurveyAnswerRow` / `parseOrgSurveyAnswerRow`
- `SurveyQuestionBankRow` / `parseSurveyQuestionBankRow`
- `SurveyAmuReviewRow` / `parseSurveyAmuReviewRow`
- `SurveyActionPlanRow` / `parseSurveyActionPlanRow`

### 4. Label maps (keep from legacy — needed by tabs)

```ts
export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  closed: 'Lukket',
}

export const SURVEY_PILLAR_LABEL: Record<SurveyPillar, string> = {
  psychosocial: 'Psykososialt arbeidsmiljø',
  physical: 'Fysisk arbeidsmiljø',
  organization: 'Organisasjon og samarbeid',
  safety_culture: 'Sikkerhetskultur',
  custom: 'Egendefinert',
}

export const ACTION_PLAN_STATUS_LABEL: Record<SurveyActionPlanStatus, string> = {
  open: 'Åpen',
  in_progress: 'Pågår',
  closed: 'Lukket',
}
```

---

## What NOT to do

- Do NOT copy `SurveyCampaignRow`, `SurveyResultRow`, `PILLAR_COLOR`, `STATUS_COLOR` from the legacy file — those are campaign-model types that do not map to the current DB schema.
- Do NOT add `pillar` or `category` fields to `OrgSurveyQuestionRow` — the DB column `org_survey_questions` does not have them. They live only in `survey_action_plans`.
- Do NOT inline the Zod schema inside the parser function. Declare schema as a `const` at module scope so it can be reused.

---

## Validation checklist

- [ ] File exports all 7 row types and all 7 parsers
- [ ] No `as any` anywhere in the file
- [ ] Zod schemas are at module scope (not inside functions)
- [ ] Label maps are exported
- [ ] `SurveyAmuReviewRow` matches `survey_amu_reviews` columns exactly (check Step 1 migration)
- [ ] `SurveyActionPlanRow` matches `survey_action_plans` columns exactly
- [ ] `src/modules/survey/types.ts` is deleted after this step compiles cleanly

## Commit

```
feat(survey): consolidate types and Zod schemas
```
