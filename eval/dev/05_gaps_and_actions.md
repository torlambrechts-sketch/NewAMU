# Developer Pass — 05: Prioritised Gaps & Cursor Action Prompts

**Role:** Developer  
**Use:** Copy each Cursor prompt directly into Cursor agent mode.

---

## GAP-DEV01 — Split `useLearning.ts` monolith

**Severity:** High  
**File:** `src/hooks/useLearning.ts` (1,935 lines)

### Cursor prompt
```
Split src/hooks/useLearning.ts into domain-specific hooks without breaking any existing consumer.

Create these files:
- src/hooks/learning/useLearningCourses.ts    — createCourse, updateCourse, deleteModule, reorderModules, forkSystemCourse, bumpCourseVersion
- src/hooks/learning/useLearningProgress.ts   — ensureProgress, setModuleCompleted, updateStreak, dismissQuizReview
- src/hooks/learning/useLearningCertificates.ts — issueCertificate, certificationRenewals, externalCertificates, approveExternalCertificate
- src/hooks/learning/useLearningPaths.ts      — saveLearningPath, deleteLearningPath, pathEnrollments
- src/hooks/learning/useLearningAdmin.ts      — flowSettings, saveFlowSettings, complianceMatrix, systemCourses, setSystemCourseEnabled

Keep src/hooks/useLearning.ts as a barrel that:
1. Calls all sub-hooks
2. Assembles a single return object identical to the current interface
3. Re-exports all types

Rules:
- Do NOT change the public interface of useLearning() — all destructured fields must remain
- Move shared state (learningLoading, learningError, supabase, orgId, canManageLearning) into a shared context or pass as parameters
- Keep the local/Supabase dual-backend pattern intact in each sub-hook
- Move STORAGE_KEY and save() into a shared src/hooks/learning/learningStorage.ts
- Move seed data (seedCourses) into src/data/learningSeedData.ts
```

---

## GAP-DEV02 — Batch `reorderModules` with a single RPC

**Severity:** Medium  
**File:** `src/hooks/useLearning.ts` around line 1209

### Cursor prompt
```
In src/hooks/useLearning.ts, replace the sequential loop in reorderModules with a Supabase RPC call.

Current code (approximately line 1209):
  for (let i = 0; i < moduleIds.length; i++) {
    const mid = moduleIds[i]
    await supabase.from('learning_modules').update({ sort_order: i }).eq('id', mid)...
  }

Step 1 — Create the SQL migration file at supabase/migrations/YYYYMMDD_learning_reorder_modules.sql:
  CREATE OR REPLACE FUNCTION learning_reorder_modules(
    p_course_id UUID,
    p_org_id UUID,
    p_module_ids UUID[]
  ) RETURNS void
  LANGUAGE SQL
  SECURITY INVOKER
  AS $$
    UPDATE learning_modules m
    SET sort_order = ord.idx
    FROM (
      SELECT unnest(p_module_ids) AS id,
             generate_series(0, array_length(p_module_ids, 1) - 1) AS idx
    ) AS ord
    WHERE m.id = ord.id
      AND m.course_id = p_course_id
      AND m.organization_id = p_org_id;
  $$;

Step 2 — Replace the loop in useLearning.ts with:
  if (supabase) {
    const { error } = await supabase.rpc('learning_reorder_modules', {
      p_course_id: courseId,
      p_org_id: orgId,
      p_module_ids: moduleIds,
    })
    if (error) throw error
  }
  // local path: update sort_order in local state directly (already done)

Do not change the function signature or any callers of reorderModules().
```

---

## GAP-DEV03 — Fix file extension whitelist in upload

**Severity:** High (security)  
**File:** `src/hooks/useLearning.ts` around line 1721

### Cursor prompt
```
In src/hooks/useLearning.ts, fix the file extension validation in the external certificate upload function.

Find this code:
  const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const safeExt = ext.length <= 8 ? ext : 'bin'

Replace with:
  const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const ALLOWED_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])
  const safeExt = ALLOWED_EXTS.has(ext) ? ext : 'bin'

This prevents filenames like "malware.js" or "payload.html" from being stored
with their original extension in the Supabase storage bucket.

Also update the file input accept attribute in LearningExternalTraining.tsx:
  Find: accept="application/pdf,image/*"
  Keep as is (browser hint) — but add a client-side validation before upload:

  In the upload handler, before calling the hook:
    const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
    if (!ALLOWED_MIME.includes(file.type)) {
      alert('Kun PDF og bildefiler er tillatt.')
      return
    }

Do not change any other logic in the upload flow.
```

---

## GAP-DEV04 — Add `organization_id` filter to ILT attendance query

**Severity:** Medium (security/data isolation)  
**File:** `src/pages/learning/LearningPlayer.tsx` — `EventModuleSection` component

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, find the EventModuleSection component
and its Supabase query for learning_ilt_attendance.

Find this query pattern:
  const { data } = await supabase
    .from('learning_ilt_attendance')
    .select('user_id, present')
    .eq('event_id', ev.id)

Add an organization_id filter:
  const { data } = await supabase
    .from('learning_ilt_attendance')
    .select('user_id, present')
    .eq('event_id', ev.id)
    .eq('organization_id', organization.id)

Where `organization` comes from the existing useOrgSetupContext() call already
present in EventModuleSection (or pass it as a prop from LearningPlayer).

If organization is not already available in EventModuleSection, add it as a prop:
  type EventModuleSectionProps = {
    ...existing props...
    organizationId: string
  }
And pass organization?.id from LearningPlayer when rendering EventModuleSection.

Do not change any other part of EventModuleSection.
```

---

## GAP-DEV05 — Add pagination to participants and certificates

**Severity:** Medium (performance)  
**Files:** `src/hooks/useLearning.ts`, `src/pages/learning/LearningParticipants.tsx`, `src/pages/learning/LearningCertifications.tsx`

### Cursor prompt
```
Add .limit() guards to the two largest unbounded queries in src/hooks/useLearning.ts.

1. Find the learning_course_progress fetch (used for LearningParticipants):
   Add: .limit(500).order('started_at', { ascending: false })

2. Find the learning_certificates fetch (used for LearningCertifications):
   Add: .limit(200).order('issued_at', { ascending: false })

In LearningParticipants.tsx, add a note below the table when results may be truncated:
  {progressRows.length >= 500 && (
    <p className="mt-2 text-xs text-neutral-500">
      Viser de 500 nyeste deltakerne. Eksporter for full oversikt.
    </p>
  )}

In LearningCertifications.tsx, add similarly:
  {certificates.length >= 200 && (
    <p className="mt-2 text-xs text-neutral-500">
      Viser de 200 nyeste sertifikatene.
    </p>
  )}

Do not implement full cursor pagination — the .limit() guard is sufficient for now.
```

---

## GAP-DEV06 — Add route-level code splitting

**Severity:** Medium (performance)  
**File:** Main router file (App.tsx or equivalent router config)

### Cursor prompt
```
Add React.lazy() code splitting for all learning routes to prevent the learning
module from being included in the initial app bundle.

Find where the learning routes are defined in App.tsx (or the router config file).

Replace direct imports like:
  import LearningLayout from './pages/learning/LearningLayout'
  import LearningDashboard from './pages/learning/LearningDashboard'
  import LearningPlayer from './pages/learning/LearningPlayer'
  import LearningCourseBuilder from './pages/learning/LearningCourseBuilder'
  // ... etc

With lazy imports:
  const LearningLayout = React.lazy(() => import('./pages/learning/LearningLayout'))
  const LearningDashboard = React.lazy(() => import('./pages/learning/LearningDashboard'))
  const LearningPlayer = React.lazy(() => import('./pages/learning/LearningPlayer'))
  const LearningCourseBuilder = React.lazy(() => import('./pages/learning/LearningCourseBuilder'))
  const LearningCoursesList = React.lazy(() => import('./pages/learning/LearningCoursesList'))
  const LearningCertifications = React.lazy(() => import('./pages/learning/LearningCertifications'))
  const LearningInsights = React.lazy(() => import('./pages/learning/LearningInsights'))
  const LearningParticipants = React.lazy(() => import('./pages/learning/LearningParticipants'))
  const LearningComplianceMatrix = React.lazy(() => import('./pages/learning/LearningComplianceMatrix'))
  const LearningPathsPage = React.lazy(() => import('./pages/learning/LearningPathsPage'))
  const LearningExternalTraining = React.lazy(() => import('./pages/learning/LearningExternalTraining'))
  const LearningSettings = React.lazy(() => import('./pages/learning/LearningSettings'))
  const LearningFlowEntry = React.lazy(() => import('./pages/learning/LearningFlowEntry'))

Wrap the learning route subtree with a Suspense boundary:
  <Suspense fallback={<div className="flex h-screen items-center justify-center text-neutral-400">Laster...</div>}>
    <Route path="/learning" element={<LearningLayout />}>
      ...
    </Route>
  </Suspense>

Import React at the top if not already: import React from 'react'
Do not change any route paths, nesting structure, or auth guards.
```

---

## GAP-DEV07 — Abort controller for async state updates

**Severity:** Low (correctness)  
**File:** `src/hooks/useLearning.ts`

### Cursor prompt
```
In src/hooks/useLearning.ts, add an isMounted guard to refreshLearning() to
prevent setState calls after the component unmounts.

At the top of the hook body (inside useLearning), add:
  const isMounted = useRef(true)
  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

In refreshLearning(), before each setState call, wrap with:
  if (!isMounted.current) return
  setLearningState(...)

Example — find the setState at the end of refreshLearning:
  setLearningState(next)
  setLearningLoading(false)

Replace with:
  if (!isMounted.current) return
  setLearningState(next)
  setLearningLoading(false)

Apply the same guard to setModuleCompleted and any other async function that
calls setLearningState or setLearningLoading.

Do not change any logic, just wrap setState calls with the isMounted check.
```

---

## GAP-DEV08 — Zod validation at DB boundary for ModuleContent

**Severity:** Low (robustness)  
**Files:** `src/hooks/useLearning.ts`, new `src/lib/learningValidation.ts`

### Cursor prompt
```
Create src/lib/learningValidation.ts with a Zod schema for ModuleContent,
and use it when parsing JSONB from the database.

Step 1 — Create src/lib/learningValidation.ts:
  import { z } from 'zod'

  const baseModule = z.object({ kind: z.string(), title: z.string().optional() })

  export const moduleContentSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), html: z.string() }),
    z.object({ kind: z.literal('image'), imageUrl: z.string(), caption: z.string().optional() }),
    z.object({ kind: z.literal('video'), videoUrl: z.string() }),
    z.object({ kind: z.literal('quiz'), questions: z.array(z.object({
      id: z.string(), question: z.string(), options: z.array(z.string()), correctIndex: z.number()
    })) }),
    z.object({ kind: z.literal('flashcard'), cards: z.array(z.object({
      id: z.string(), front: z.string(), back: z.string()
    })) }),
    z.object({ kind: z.literal('checklist'), items: z.array(z.object({
      id: z.string(), label: z.string()
    })) }),
    z.object({ kind: z.literal('tips'), tips: z.array(z.string()) }),
    z.object({ kind: z.literal('on_job'), instructions: z.string().optional() }),
    z.object({ kind: z.literal('event'), eventId: z.string().optional() }),
    z.object({ kind: z.literal('other'), html: z.string().optional() }),
  ])

  export type ModuleContent = z.infer<typeof moduleContentSchema>

Step 2 — In src/hooks/useLearning.ts, when mapping DB rows to modules:
  Find where content is mapped:
    content: m.content as ModuleContent

  Replace with:
    content: (() => {
      const result = moduleContentSchema.safeParse(m.content)
      if (!result.success) {
        console.warn('Invalid module content for module', m.id, result.error)
        return { kind: 'other', html: '' } as ModuleContent
      }
      return result.data
    })(),

Step 3 — Install zod if not already present:
  npm install zod

Do not change any other type definitions. The ModuleContent type in src/types/learning.ts
can be replaced with: export type { ModuleContent } from '../lib/learningValidation'
```
