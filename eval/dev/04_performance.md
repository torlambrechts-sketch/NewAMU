# Developer Pass — 04: Performance

**Role:** Developer  
**Focus:** Bundle size, render performance, caching, lazy loading, network efficiency

---

## Bundle splitting

The entire learning module is co-located in `src/pages/learning/` and `src/hooks/useLearning.ts`. There is no evidence of route-level code splitting.

**Expected bundle impact:**
- `useLearning.ts` — 1,935 lines, includes seed course JSON, all hook logic
- `LearningPlayer.tsx` — 1,081 lines, includes video URL regexes, module renderers
- `LearningCourseBuilder.tsx` — 1,039 lines, includes ILT form, content fields
- Estimated learning chunk size: **~180–240 kB minified + gzipped** (before tree-shaking)

The app uses React Router. If routes are not wrapped with `React.lazy()` + `Suspense`, every user who visits any page loads the entire learning module bundle, even if they never touch it.

**Recommendation:**
```tsx
// In App.tsx or router definition
const LearningLayout = React.lazy(() => import('./pages/learning/LearningLayout'))
const LearningPlayer = React.lazy(() => import('./pages/learning/LearningPlayer'))
const LearningCourseBuilder = React.lazy(() => import('./pages/learning/LearningCourseBuilder'))
```

---

## `useLearning` re-render scope

`useLearning` returns a large object with ~40+ state fields and callbacks. All consumers of `useLearning()` re-render when **any** field changes, even if they only use 2 fields.

**Pattern issue:**
```ts
// In LearningDashboard.tsx
const { courses, certificates, learningLoading, ... } = useLearning()
```

Any state change in `useLearning` (e.g., a progress update on another tab) triggers re-render of `LearningDashboard`, `LearningCoursesList`, `LearningParticipants`, etc. simultaneously.

**Recommendation:** After splitting the hook (see GAP-DEV01), each page should consume only the sub-hook it needs:
```ts
const { courses } = useLearningCourses()
const { progress } = useLearningProgress()
```

This prevents cross-domain re-renders.

---

## `refreshLearning` — 14+ sequential Promise.all calls

`refreshLearning()` issues 14+ queries in a `Promise.all`. This is correct (parallel). However:

1. The entire result set is stored in a single state update — causing one large re-render
2. If any single query fails, the `Promise.all` does not fail-fast — individual errors are caught per-query ✅
3. The snapshot is invalidated on **every** full refresh, meaning navigating back to a page triggers a full re-fetch

**Observation:** The session snapshot (`learningSnapshotMemory`) caches across navigation within a session, but the TTL/invalidation strategy is "cleared on any mutation". After `setModuleCompleted`, the full state is re-fetched. For a user completing 10 modules in sequence, this is 10 full refreshes × 14 queries = 140 DB round trips per session.

**Recommendation:** Invalidate only affected slices:
```ts
// After setModuleCompleted — only refresh progress
await refreshProgressOnly(userId, orgId)
// Not the full refreshLearning()
```

---

## Video player performance

`VideoPlayer` in `LearningPlayer.tsx` embeds YouTube/Vimeo via `<iframe>` and direct MP4 via `<video>`. Issues:

1. **No `loading="lazy"` on iframe** — YouTube iframe loads immediately on module render, including third-party scripts (~500 kB)
2. **No YouTube Lite embed** — `youtube-lite` or `@lite-youtube-embed` defer the heavy YouTube player until user clicks play
3. **MP4 `<video>` has no `preload="metadata"`** — browser may buffer full video

**Recommendation:**
```tsx
// iframe: add loading="lazy" + title
<iframe
  src={embedUrl}
  loading="lazy"
  title={title}
  allow="autoplay; encrypted-media"
  allowFullScreen
/>

// video: add preload metadata
<video controls preload="metadata" className="w-full rounded-xl">
```

---

## Image module performance

Line ~703 in `LearningPlayer.tsx`:
```tsx
<img src={c.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />
```

No `loading="lazy"` attribute. In a course with many image modules, all images load immediately on player mount, even if the user hasn't navigated to those modules.

**Recommendation:**
```tsx
<img src={c.imageUrl} alt={c.caption || 'Kursbilde'} loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
```

---

## `useMemo` / `useCallback` coverage

`useLearning.ts` defines functions with `useCallback`. The consumer components compute derived data inline:

```tsx
// In LearningDashboard.tsx (inferred)
const publishedCourses = courses.filter(c => c.status === 'published')
const draftCourses = courses.filter(c => c.status === 'draft')
```

If these are computed inside render (not memoized), every re-render of the parent recomputes them. With large course arrays this is O(n) per render.

**Recommendation:** Use `useMemo` for filtered/sorted lists:
```tsx
const publishedCourses = useMemo(
  () => courses.filter(c => c.status === 'published'),
  [courses]
)
```

---

## Compliance matrix performance

`LearningComplianceMatrix.tsx` renders a table with rows = users × columns = courses. For an org with 100 users and 20 courses, this is 2,000 cells. Each cell renders a coloured `<div>`.

**Risk:** For large orgs this could cause a jank-y initial render.

**Recommendation:**
- Virtualise rows using `react-window` or `react-virtual` for orgs with >50 users
- Or add `.limit(100)` on the compliance matrix RPC response

---

## Spaced repetition — `review_at` polling

`LearningDashboard` shows a spaced repetition panel with due reviews. The `review_at` field is set server-side. Currently the panel re-evaluates on full `refreshLearning`.

No real-time subscription (Supabase Realtime) is set up for due reviews. This is appropriate — spaced repetition doesn't need real-time updates.

---

## `localStorage` write frequency

In demo/local mode, `save()` serialises the full state to `localStorage` on every mutation:
```ts
const save = useCallback((s: LocalState) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}, [])
```

If a user is completing a flashcard deck (10 cards), this triggers 10 full serialisations per deck. With large seed data, each serialisation could be slow.

**Recommendation:** Debounce `save()`:
```ts
const debouncedSave = useMemo(
  () => debounce((s: LocalState) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
  }, 300),
  []
)
```

---

## Module list sort — client-side only

`learning_modules` are fetched and sorted client-side by `sort_order`. For a course with 50 modules, this is fine. The sort is O(n log n) and happens once after fetch. ✅

---

## Summary

| Issue | Impact | Effort |
|-------|--------|--------|
| No route-level code splitting | High — users load full bundle | Low |
| 140 DB queries per session on module completion | Medium — network/Supabase cost | Medium |
| YouTube iframe not lazy | Medium — page weight | Low |
| Images not lazy | Low — within a module | Trivial |
| Compliance matrix virtualisation | Low for small orgs | Medium |
| localStorage debounce | Low — demo mode only | Trivial |
