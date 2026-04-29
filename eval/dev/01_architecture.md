# Developer Pass — 01: Architecture

**Role:** Developer  
**Focus:** Module structure, data flow, routing, component design

---

## Module architecture overview

```
LearningLayout (shell + nav)
  ├── /learning              → LearningDashboard
  ├── /learning/courses      → LearningCoursesList
  ├── /learning/courses/:id  → LearningCourseBuilder
  ├── /learning/play/:id     → LearningPlayer
  ├── /learning/flow         → LearningFlowEntry (QR deep-link)
  ├── /learning/certifications → LearningCertifications
  ├── /learning/insights     → LearningInsights
  ├── /learning/participants → LearningParticipants
  ├── /learning/compliance   → LearningComplianceMatrix
  ├── /learning/paths        → LearningPathsPage
  ├── /learning/external     → LearningExternalTraining
  └── /learning/settings     → LearningSettings
```

**Assessment:** Clean route structure. The `LearningLayout` correctly delegates to `Outlet` and applies shared page heading / nav. Each page is a separate component — no excessive shared state between pages.

---

## Data layer: `useLearning` hook

### Strengths

1. **Dual backend** (local/Supabase) — elegant fallback for demo mode
2. **Session snapshot** (`learningSnapshotMemory` + `sessionStorage`) — prevents redundant fetches on navigation
3. **Parallel data fetching** — all DB tables fetched with `Promise.all()` ✅
4. **Typed return** — all DB row types defined locally ✅
5. **Error isolation** — individual query errors caught and surfaced via `learningError` state
6. **Optimistic local updates** — local state updated immediately before Supabase writes

### Concerns

**1. Hook size: 1,935 lines**  
`useLearning.ts` is a 1,935-line monolith. This makes it:
- Hard to test individual operations
- Slow to parse and navigate in IDE
- Risky to modify (any change affects all consumers)

**Recommendation:** Split into domain-specific hooks:
```
useLearningCourses.ts     — CRUD for courses + modules
useLearningProgress.ts    — progress tracking, completion, streaks
useLearningCertificates.ts — certificate issuance, renewals, external certs
useLearningPaths.ts       — learning paths + enrollments
useLearningAdmin.ts       — system courses, compliance matrix, flow settings
```
Export a combined `useLearning()` that assembles these, maintaining backward compatibility.

**2. All data fetched for all users**
`refreshLearning()` fetches courses, modules, settings, system courses, progress, certs, streaks, reviews, leaderboard, flow settings, renewals, external certs, ILT events, learning paths, enrollments, compliance matrix — 14+ queries per page load.

For non-manager users, most of this is irrelevant. The compliance matrix is already gated (`canManage ? ... : Promise.resolve`), but renewals, leaderboard, external certs, and learning paths are fetched for everyone.

**Recommendation:** Gate expensive queries behind `canManage`:
```ts
const renewQuery = canManage ? supabase.from('learning_certification_renewals')... : null
const matrixPromise = canManage ? supabase.rpc('learning_compliance_matrix') : Promise.resolve({ data: null, error: null })
// etc.
```

**3. No request deduplication for `refreshLearning`**
Multiple components can call `ensureProgress` simultaneously, each potentially triggering `refreshLearning`. The `learningSessionHydrated` flag prevents repeated full fetches, but within a single hydration cycle there is no mutex — parallel calls could cause redundant state updates.

**Recommendation:** Add a `refreshInFlight` ref to gate concurrent refresh calls.

**4. `setState` on unmounted component**  
Several async functions (notably `refreshLearning`, `setModuleCompleted`) update React state after awaiting Supabase calls. If the user navigates away mid-request, this will cause React's "state update on unmounted component" warning. The `useCallback` dependencies don't include an abort controller.

**Recommendation:** Add `AbortController` or `isMounted` flag pattern.

---

## Component complexity

### `LearningPlayer.tsx` — 1,081 lines

The player file contains:
- `LearningPlayer` component (top-level)
- `ModulePlayer` function (renders per module type)
- `EventModuleSection` component
- `VideoPlayer` component with full URL detection + embed logic
- `ProgressBar` utility

This is too much in one file. Recommended split:
```
LearningPlayer.tsx          — main player layout (sidebar + module area)
LearningModulePlayer.tsx    — ModulePlayer dispatch function
LearningVideoPlayer.tsx     — VideoPlayer with URL detection
LearningProgressBar.tsx     — shared ProgressBar (move to components/learning/)
```

### `LearningCourseBuilder.tsx` — 1,039 lines

Contains:
- `LearningCourseBuilder` main component
- `ModuleEditor` component
- `IltScheduleForm` component
- `ContentFields` component (renders per content kind)

Same problem. Split:
```
LearningCourseBuilder.tsx   — main builder shell + tabs
LearningModuleEditor.tsx    — ModuleEditor + ContentFields
LearningIltForm.tsx         — IltScheduleForm
```

---

## Routing

### Issues found

**1. Player accessible without progress row**
`LearningPlayer.tsx` calls `ensureProgress(courseId)` in a `useEffect` — but does not prevent rendering until progress is confirmed. A user can arrive at the player directly (without going through `LearningFlowEntry`) and start interacting before `ensureProgress` completes.

**Impact:** Low — the progress will be created on next completion event anyway, but the first module might not show a started state in the manager view.

**2. No 404 handling for invalid courseId in player**
If `courseId` is an invalid UUID, the Supabase query will return empty and the player shows the "not published" error — which is slightly confusing for admins.

**Recommendation:** Explicitly check `course === undefined && !learningLoading` → render a "Kurset finnes ikke" 404 state.

**3. `LearningFlowEntry` navigation race**
`LearningFlowEntry.tsx` navigates to `/learning/play/:id` after `ensureProgress`. If `ensureProgress` throws, the error is silently swallowed (the useEffect doesn't catch). The user sees the spinner indefinitely.

**Fix:** Add error handling in the `useEffect`:
```tsx
try {
  await ensureProgress(courseId)
  navigate(...)
} catch {
  navigate('/learning/courses', { replace: true })
}
```

---

## State management

The module uses React `useState` within each page component, coordinated through `useLearning`. This is appropriate for the scale — no Redux/Zustand overhead needed.

The snapshot pattern (`learningSnapshotMemory` + `sessionStorage`) is clever but has one issue: **stale snapshot after concurrent browser tabs**. If the user opens the learning module in two tabs and completes a module in Tab A, Tab B's snapshot is stale and will show incorrect progress until next navigation.

**Recommendation:** Listen to `storage` events (for localStorage changes from other tabs) to invalidate the session snapshot. Or use BroadcastChannel for cross-tab coordination.
