# Developer Pass — 02: Data Layer

**Role:** Developer  
**Focus:** Database design, Supabase queries, data integrity, performance

---

## Database tables (inferred from frontend code)

| Table | Purpose | Notes |
|-------|---------|-------|
| `learning_courses` | Course metadata | `organization_id`, `prerequisite_course_ids[]`, `course_version`, `recertification_months` |
| `learning_modules` | Course modules | `sort_order`, `kind`, `content` (JSONB) |
| `learning_system_courses` | Shared catalog | `slug`, `default_locale` |
| `learning_system_course_locales` | Translated catalog | `system_course_id`, `locale`, `title`, `description`, `modules` (JSONB) |
| `learning_org_course_settings` | Per-org catalog toggle | `system_course_id`, `enabled`, `forked_course_id` |
| `learning_course_progress` | Per-user completion | `module_progress` (JSONB), `started_at`, `completed_at` |
| `learning_certificates` | Issued certificates | `learner_name`, `verify_code`, `course_version` |
| `learning_certification_renewals` | Recertification tracking | `expires_at`, `status` |
| `learning_external_certificates` | External cert uploads | `storage_path`, `status` |
| `learning_ilt_events` | Instructor-led sessions | `starts_at`, `location_text`, `meeting_url` |
| `learning_ilt_rsvps` | Attendee RSVPs | `event_id`, `user_id`, `status` |
| `learning_ilt_attendance` | Attendance records | `present`, `marked_by`, `marked_at` |
| `learning_streaks` | Weekly activity | `streak_weeks` |
| `learning_quiz_reviews` | Spaced repetition | `review_at`, `dismissed_at` |
| `learning_flow_settings` | Webhook config | `teams_webhook_url`, `slack_webhook_url` |
| `learning_paths` | Learning paths | `slug`, `description` |
| `learning_path_courses` | Path → course mapping | `sort_order` |
| `learning_path_rules` | Auto-enrollment rules | `metadata_key`, `expected_value` |
| `learning_path_enrollments` | User enrollments | `enrolled_at` |
| `learning_module_assignments` | Flow-of-work assignments | Referenced in settings, not fetched in hook |

---

## JSONB content field analysis

`learning_modules.content` stores `ModuleContent` as JSONB. This is appropriate for the variety of module types (10 kinds with different schemas).

### Concern: no schema validation at DB level

The JSONB column has no check constraint validating `content->>'kind'` against allowed values. A corrupted or manually-inserted row with invalid content JSON will cause a runtime error in `ModulePlayer` (falls through to `return null`).

**Recommendation:** Add a check constraint:
```sql
ALTER TABLE learning_modules 
ADD CONSTRAINT valid_content_kind CHECK (
  content->>'kind' IN 
  ('flashcard','quiz','text','image','video','checklist','tips','on_job','event','other')
);
```

---

## `module_progress` JSONB column

`learning_course_progress.module_progress` stores:
```json
{
  "<moduleId>": {
    "moduleId": "...",
    "completed": true,
    "score": 85,
    "lastAnswers": {"q1": 2, "q2": 0}
  }
}
```

### Issue: unbounded growth
As modules are added/removed, the JSONB accumulates orphaned keys for deleted modules. This is harmless for reads but wastes storage over time.

### Issue: `lastAnswers` stores user quiz responses permanently
`lastAnswers: Record<string, number>` maps `questionId → selectedOptionIndex` and is stored indefinitely. This is:
1. Potentially sensitive data (see GDPR privacy pass)
2. Never cleaned up even after `dismissed_at` on the review

**Recommendation:** Strip `lastAnswers` from `module_progress` after the spaced repetition review period has passed. Or store it in `learning_quiz_reviews` (which has `dismissed_at`) and remove from `module_progress`.

---

## Query efficiency

### N+1 risk in `profileNameById` lookup

`useLearning.ts` lines 741-753:
```ts
const progressUserIds = [...new Set(progressRows.map((r) => r.user_id))]
const { data: profRows } = await supabase
  .from('profiles')
  .select('id, display_name')
  .in('id', progressUserIds)
```

This is a correct bulk lookup — ✅ no N+1.

### Batch module update in `reorderModules`

Lines 1209-1222: reorderModules loops and issues one `UPDATE` per module:
```ts
for (let i = 0; i < moduleIds.length; i++) {
  await supabase.from('learning_modules').update({ sort_order: i }).eq('id', mid)
}
```

This is O(n) sequential writes — for a course with 30 modules this is 30 round trips.

**Recommendation:** Use a Supabase RPC with `unnest`:
```sql
CREATE OR REPLACE FUNCTION learning_reorder_modules(
  p_course_id UUID,
  p_org_id UUID,
  p_module_ids UUID[]
) RETURNS void LANGUAGE SQL AS $$
  UPDATE learning_modules m
  SET sort_order = ord.sort_order
  FROM (
    SELECT unnest(p_module_ids) AS id, 
           generate_series(0, array_length(p_module_ids,1)-1) AS sort_order
  ) AS ord
  WHERE m.id = ord.id 
    AND m.course_id = p_course_id 
    AND m.organization_id = p_org_id;
$$;
```

### No pagination on progress/certificates

`learning_course_progress` and `learning_certificates` are fetched without `.limit()`. For large organisations, this could return thousands of rows.

**Recommendation:**
- Add `.limit(500)` + cursor-based pagination to `LearningParticipants` table
- Add `.limit(200)` to certificates list in `LearningCertifications`

---

## RPC functions referenced but not reviewed

The following RPCs are called but their SQL is not in this repo (in Supabase migrations or dashboard):

| RPC | Called from |
|-----|-------------|
| `learning_ensure_system_course_rows` | `refreshLearning()` |
| `learning_set_system_course_enabled` | `setSystemCourseEnabled()` |
| `learning_fork_system_course` | `forkSystemCourse()` |
| `learning_bump_course_version` | `bumpCourseVersion()` |
| `learning_issue_certificate` | `issueCertificate()` (Supabase path) |
| `learning_record_activity` | `setModuleCompleted()` after Supabase write |
| `learning_department_leaderboard` | `refreshLearning()` |
| `learning_compliance_matrix` | `refreshLearning()` (canManage only) |
| `learning_refresh_path_enrollments_for_user` | `saveLearningPath()` |
| `learning_approve_external_certificate` | `approveExternalCertificate()` |

**These must be reviewed separately** for security (SECURITY DEFINER vs INVOKER), correct `organization_id` scoping, and RLS compliance. Particularly `learning_issue_certificate` — this must verify that the calling user has completed all modules before issuing.

---

## Local storage usage

`STORAGE_KEY = 'atics-learning-v1'` is used for demo mode (no Supabase).

The seed data (`seedCourses`) is embedded in `useLearning.ts` — this is appropriate for demo.

**Concern:** `localStorage.setItem(STORAGE_KEY, JSON.stringify(state))` can store large amounts of data if courses have many modules with long text content. Browsers typically cap `localStorage` at 5–10 MB.

**Recommendation:** Add a try/catch around `save()` (already done ✅) and add a size check warning if the payload exceeds 2 MB.

---

## Type safety

### `ModuleContent` discriminated union ✅

The `ModuleContent` type is a proper discriminated union — `kind` field narrows the type correctly. All `if (c.kind === 'X')` branches in `ModulePlayer` are type-safe.

### Loose `as` casts in DB row mapping

`useLearning.ts` uses several `as` casts on raw DB responses:
```ts
const courseRows = (cRes.data ?? []) as DbCourseRow[]
const moduleRows = (mRes.data ?? []) as DbModuleRow[]
```

This is acceptable given that Supabase's generated types would normally handle this, but without the generated DB types these casts bypass compile-time safety. If a column is renamed in the DB, the type cast will still "succeed" but produce undefined values.

**Recommendation:** Enable Supabase type generation and replace `as DbCourseRow[]` with properly typed response using `Database['public']['Tables']['learning_courses']['Row'][]`.

### `content` field typed as `ModuleContent` from DB

Line 440: `content: ModuleContent` in `DbModuleRow` — this trusts that whatever JSONB is stored will match the union type. If a module has malformed content JSONB, this will cause a runtime error.

**Recommendation:** Add a Zod schema for `ModuleContent` and validate at the DB layer boundary:
```ts
import { moduleContentSchema } from '../lib/learningValidation'
content: moduleContentSchema.parse(m.content) // throws if invalid
```
