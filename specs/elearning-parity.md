# E-learning Architectural Parity

> **Read this first:** `specs/PLAYBOOK.md` (process spec, capability inventory,
> task shape, checkpoint protocol). Then `specs/survey-parity.md` for the
> reference port — e-learning is the most parity-friendly module of the
> three target modules.

**Reference module:** compliance checklists at `main` after commit `a3c1c77`
(survey port also useful as a second reference).
**Target module:** `src/pages/learning/`, `src/components/learning/`,
`src/hooks/useLearning.ts`, plus `learning_courses` /
`learning_course_progress` / `learning_certificates` / etc.
**Owner of this spec:** human.
**Spec status:** `📋 ready to execute` (after architect sign-off in §13).

---

## 1 · One-paragraph framing

E-learning has the most directly parity-friendly bones of the three modules
that haven't been ported yet. `learning_courses` ≈ template, `learning_course_
progress` ≈ instance, `learning_certificates` ≈ signed artefact. Everything
the playbook does is genuinely useful here: categories
(HMS-grunnopplæring vs Brann vs Verneombud), per-course `metadata_schema`
(cert ID, external course hours, practical-test score), org-context filters
(department / participant), and crucially **two e-learning-specific
extensions** — a *certification expiry* filter dimension and a *user × course
heatmap* widget kind. Both are genuinely new capabilities, not just ports.

---

## 2 · Mapping table — checklist concept → e-learning concept

| Checklist (reference) | E-learning (target) | Notes |
|---|---|---|
| `compliance_checklist_templates` (template) | `learning_courses` | Existing `tags text[]` is free-form; structured categories replace it. |
| `compliance_checklist_executions` (instance) | `learning_course_progress` | Composite PK `(user_id, course_id)`. Different cardinality from checklists (one row per user-course pair, not one per attempt). |
| `compliance_checklist_responses` | per-module progress in `learning_course_progress.module_progress` jsonb | Not normalised; analytics buckets per-module separately. |
| `compliance_checklist_categories` | `learning_categories` (NEW) | Per-org (no pack scope — see §13 OQ-L2). |
| `signed_at` | `completed_at` on progress + `learning_certificates.issued_at` | "Lock" event = course completed; cert issued. |
| `attendees text[]` | (none — single learner per progress row) | N/A. |
| Org-context FKs on instance | `learning_course_progress.location_id` / `department_id` (NEW) | Resolved at completion time from the user's org_member row, not editable per-progress. Optional override columns for ILT events. |
| `metadata_schema` | `learning_courses.metadata_schema` | Same shape; common fields: external_cert_id (text), external_hours (number), practical_test_score (number), provider (select). |
| `useChecklistModule` | `useLearning` | Same hook role. |

---

## 3 · Capability map (playbook §4 → e-learning)

| Capability | Decision | Notes |
|---|---|---|
| **C-1 Categories DB + admin** | ✅ in scope | High value — courses span domains naturally. |
| **C-2 Categories on hub + sidebar** | ✅ in scope | The existing `LearningCoursesList` becomes the "hub"; categories drive its grouping. Sidebar gains collapsible category groups under "Læring". |
| **C-3 Sidebar fixed children** | ✅ in scope | Analyse + Innstillinger before pinned courses. |
| **C-4 Analyse page** | ✅ in scope | Replaces or supplements `LearningDashboard.tsx`. |
| **C-5 Editable metadata post-lock** | ✅ in scope | Re-issue scenarios: name corrections on certs, late practical-test score recording. Different shape from checklists — see §6. |
| **C-6 Org-context FKs** | ✅ in scope (resolved, not stored on progress) | Department + location come from the user's org_member row at completion. Don't store on progress (would go stale on transfer). Add `location_id` / `department_id` *snapshot* columns capturing the user's org context AT completion time. |
| **C-7 Template `metadata_schema`** | ✅ in scope | Smaller than checklist — courses care about external_cert_id, external_hours, score, provider. |
| **C-8 Schema-driven UI** | ✅ in scope | Slot in `LearningPlayer` completion screen + the course detail in admin. |
| **C-9 Analytics filter dimensions** | ✅ in scope (extended) | Standard set + **certification-expiry** dimension (see §7). |
| **NEW E-1 Heatmap widget kind** | ⏸ deferred to its own micro-feature | Dashboard engine extension — see §11. The port can launch without it; the table widget covers the same data temporarily. |

---

## 4 · Dependency graph

```
T1 (Categories DB + admin)
  └─ T2 (Categories on courses list + sidebar)
       └─ T3 (Sidebar Settings + Analyse fixed children)

T4 (Analyse page + scope registration)

T5 (Org-context snapshot columns on progress)
  └─ T6 (metadata_schema + dynamic completion-screen panel)
       └─ T7 (Analytics dimensions including certification-expiry) ← also depends on T4

E-1 (Heatmap widget kind — engine extension) — independent; can land
                                                   any time after T4.
```

Recommended order: **T1 → T2 → T3 → T4 → T5 → T6 → T7**. E-1 lands
opportunistically.

---

## 5 · Phase plan

### Phase A · Categories + sidebar (T1, T2, T3)
Same shape as survey/checklist port. ~0.5 day.

### Phase B · Analyse page (T4)
Third consumer of the engine. Validates the registry's
"new module = two files + a route" claim. ~0.5 day.

### Phase C · Org-context + metadata_schema (T5, T6)
Smallest of the three Phase C blocks across modules — courses are
simpler than checklists. ~0.5 day.

### Phase D · Analytics dimensions including expiry (T7)
Adds the genuinely-new "ekspirerer innen X" filter. ~0.5 day.

### Phase E · Heatmap widget kind (E-1)
Standalone engine extension. ~1 day. Defer until phases A-D are
proven against real data.

**Total without E-1:** ~2 days. Lined up correctly because the
engine is now battle-tested.

---

## 6 · Tasks

### Task T1 · Learning categories — DB + admin CRUD

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<next>_learning_categories.sql` — new
  `learning_categories(id, org_id, slug, name, description, position,
  is_active, is_system, deleted_at, created_at, updated_at, unique(org, slug))`.
  RLS by org. **No pack scope** — e-learning doesn't have packs (per §13 OQ-L2).
  Default seeds: HMS-grunnopplæring, Brann, Førstehjelp, Verneombud,
  Onboarding, Eksterne kurs.
- `supabase/migrations/<next+1>_learning_courses_category_id.sql` —
  `alter learning_courses add column category_id uuid references
  learning_categories(id) on delete set null`. Index. Backfill from existing
  `tags` where the first tag matches a seeded category.
- `src/hooks/useLearning.ts` — add `categories`, `loadCategories`,
  `createCategory`, `updateCategory`, `softDeleteCategory`. Mirror the
  shape from `useSurveyCategories.ts`.
- `src/pages/learning/LearningCategoriesAdmin.tsx` — new page or
  panel inside `LearningSettings.tsx`. Mirror `SurveyKategorierTab.tsx`
  but drop the pack-pill (no packs).
- `src/pages/learning/LearningSettings.tsx` — wire the admin tab/panel.

**Reference precedent:** Commit `9db20ec` ("survey: T1 — admin-defined
template categories").

**Acceptance criteria:**
- [ ] Migration applies cleanly + idempotent.
- [ ] `/learning/settings` (or wherever the admin lives) shows a "Kategorier" surface.
- [ ] Adding/renaming/deactivating/soft-deleting works; system rows can't be hard-deleted.
- [ ] After provisioning a fresh org, default categories exist.
- [ ] Existing courses with tags matching a seeded category get auto-linked.
- [ ] TS + lint clean.

**Open questions:** OQ-L1 (best place for the admin surface — separate page or panel inside LearningSettings).

---

### Task T2 · Categories on `LearningCoursesList` + sidebar

**Status:** 📋 not started

**Files to touch:**
- `src/pages/learning/LearningCoursesList.tsx` — group course tiles by `category_id`. Uncategorised courses fall into an "Annet" bucket at the end.
- `src/hooks/useLearningNav.ts` (NEW) — fetches pinned courses + categories. Mirrors `useSurveyNav.ts`.
- `src/components/layout/AticsShell.tsx` — extend the "Læring" group's flatSubs with the same `kind:'header'` SubItem + collapse pattern. The `expandedHeaders` state in the shell already handles the collapse.

**Reference precedent:** Commits `4b318d2` + `1d4492a` (checklist + survey T2).

**Acceptance criteria:**
- [ ] LearningCoursesList shows category headings + course count chips.
- [ ] Sidebar under "Læring" shows category headers (FolderTree icon + chevron).
- [ ] No regression on checklist or survey sidebar.

**Open questions:** OQ-L5 (does e-learning have a notion of "pinned course"? if not, T2 only ships category headers without per-course nav entries).

---

### Task T3 · Sidebar fixed Settings + Analyse children

**Status:** 📋 not started

**Files to touch:**
- `src/components/layout/AticsShell.tsx` — `learningFixedSubs` mirroring
  the survey/compliance versions. Wire icons + routes (`/learning/settings`,
  `/learning/analyse`).

**Acceptance criteria:**
- [ ] Sidebar under "Læring" shows Analyse + Innstillinger as the first
  two children.
- [ ] Both navigate.

---

### Task T4 · `/learning/analyse` page + scope registration

**Status:** 📋 not started

**Files to touch:**
- `src/pages/learning/dashboards/learningDashboardScope.ts` — new file
  registering `learning` scope. Datasets in §7.
- `src/pages/learning/LearningAnalysePage.tsx` — new page mirroring
  `SurveyAnalysePage.tsx`. Datasets computed from `useLearning` data.
- `src/App.tsx` — `<Route path="learning/analyse" element={<LearningAnalysePage />} />`.

**Reference precedent:** Commit `4c1bbc4` (survey T4).

**Acceptance criteria:**
- [ ] `/learning/analyse` opens.
- [ ] Default layout: 4-up KPI strip (active learners / completed YTD / avg score / certs expiring 30d) → completions-over-time line → status donut → top-courses bar.
- [ ] Filter chip bar present (chips wired in T7).
- [ ] Edit Layout / Add Widget / per-widget editor all work.
- [ ] No regression on existing analyse pages.

**Open questions:** OQ-L3 (which expiry KPI is the default — 30/60/90 days?). Default: 30 days; admin can edit the widget to change.

---

### Task T5 · Snapshot org-context on `learning_course_progress`

**Status:** 📋 not started

**Why "snapshot" not FK:** A learner who completes a course in
Department A then transfers to Department B should keep their
completion's audit context as Department A. So the columns on the
progress row are *immutable snapshots* set at completion time, not
live FKs to the user's current org_member row.

**Files to touch:**
- `supabase/migrations/<next>_learning_progress_orgcontext_snapshot.sql`:
  ```
  alter learning_course_progress add column
    location_id_at_completion uuid references locations(id) on delete set null,
    department_id_at_completion uuid references departments(id) on delete set null,
    team_id_at_completion uuid references teams(id) on delete set null;
  ```
  AFTER UPDATE trigger: when `completed_at` transitions from null to non-null, snapshot the user's current `organization_members` row's location/department/team into these columns. Once set, they're immutable (the trigger only writes when the previous values were null).
- `src/hooks/useLearning.ts` — add the new fields to the parsed type.

**Reference precedent:** Commit `b0b5a43` (survey T5) — but note the
"immutable snapshot" pattern differs from surveys' "amendable FK" pattern.

**Acceptance criteria:**
- [ ] Columns added + indexed.
- [ ] On completion, the trigger fills them.
- [ ] Subsequent updates to org_member or progress don't change them.
- [ ] TS clean.

**Open questions:** OQ-L4 (do we want an admin override path for "I completed this from a former employer's department"? Defer — same row can be hand-edited via SQL until a real use case lands.).

---

### Task T6 · Course `metadata_schema` + dynamic completion panel

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<next>_learning_courses_metadata_schema.sql` —
  `alter learning_courses add column metadata_schema jsonb default
  '{"fields":[]}'`.
- `src/types/learning.ts` (or wherever course types live) — add
  `metadata_schema` field. Re-export `TemplateMetadataField` /
  `TemplateMetadataSchema` from `modules/compliance/types.ts` (the types
  are module-agnostic; don't redeclare).
- `src/hooks/useLearning.ts` — add `metadata` to progress save payload;
  `updateCourse` accepts `metadata_schema`.
- `src/pages/learning/LearningCompletionMetadataPanel.tsx` (NEW) —
  schema-driven panel. Slots into `LearningPlayer` completion screen
  *and* into `LearningCourseBuilder` for admin authoring.

**Common fields per spec OQ-L6:**
- external_cert_id (text) — for certs sourced from third parties
- external_hours (number) — for ILT or external programmes
- practical_test_score (number)
- provider (select)

**Acceptance criteria:**
- [ ] Course admin can add metadata fields.
- [ ] Learner sees them on the completion screen and can fill in.
- [ ] Values persist on `learning_course_progress.metadata`.
- [ ] Re-issuing a cert (post-lock edit) preserves all metadata.

---

### Task T7 · Analytics dimensions + certification-expiry filter

**Status:** 📋 not started

**Files to touch:**
- `src/pages/learning/LearningAnalysePage.tsx` — add dimensions:
  - **Kategori** (loadOptions from useLearning.categories)
  - **Kurs** (loadOptions from useLearning.courses)
  - **Status** (`enrolled`, `in_progress`, `completed`, `expired`)
  - **Avdeling** (loadOptions from orgSetup.departments — applies via the snapshot column added in T5)
  - **Bruker** (loadOptions from orgSetup.members)
  - **Utløp** (date_range over certificate expiry; the filter resolves to "completion + recurrence_months" or a dedicated `expires_at` column added in T5 if we choose to denormalise)
- `src/pages/learning/dashboards/learningDashboardScope.ts` — extra
  datasets for `learning_completions_by_department`,
  `learning_certs_expiring_window`.

**Acceptance criteria:**
- [ ] All dimensions appear in "+ Filter" picker.
- [ ] Adding a chip narrows every widget.
- [ ] "Utløp" with "next 30 days" returns currently-expiring certs.

---

## 7 · Datasets for the learning scope

| Key | Shape | Bucket logic |
|---|---|---|
| `learning_kpi_summary` | kpi-record | `{ totalCourses, activeLearners, completedYtd, certsExpiring30d, avgScore }` |
| `learning_status_distribution` | segments | `{ Påmeldt, Pågående, Fullført, Utløpt }` |
| `learning_category_distribution` | segments | per category |
| `learning_completions_over_time` | series | last 12 months by `completed_at` |
| `learning_top_courses` | segments | top 8 by completion count |
| `learning_certs_expiring_window` | segments | bucket by 0-30d / 30-60d / 60-90d / 90+d |
| `learning_completions_by_department` | segments | via department_id_at_completion |
| `learning_completions_by_user_heatmap` | rows | one row per user × course pair (E-1 widget consumer) |

---

## 8 · Acceptance criteria for the *whole* port

After T1-T7 are `✅`:
- [ ] `/learning/analyse` is the canonical analytics surface.
- [ ] Categories + metadata_schema work end-to-end.
- [ ] At least the certification-expiry filter is wired and useful.
- [ ] No regression on checklist/survey/tasks analyse pages.
- [ ] `ROADMAP.md` gets a learning section flipping items to ✅.

E-1 (heatmap) ships when convenient — not in the parity-port scope.

---

## 9 · Open questions

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-L1 | Best place for the categories admin? | New tab inside `LearningSettings.tsx`. |
| OQ-L2 | Categories scoped per pack or org-global? | **Org-global** — e-learning doesn't have a packs concept analogous to compliance/survey. |
| OQ-L3 | Default expiry-window for the KPI tile? | 30 days. |
| OQ-L4 | Admin override path for the immutable snapshot columns? | Defer; SQL-edit until a real use case demands UI. |
| OQ-L5 | Pinned-course concept exists? | Not currently. T2 ships category headers without per-course nav entries; pinning lands later if the team wants it. |
| OQ-L6 | Default metadata_schema fields? | `[external_cert_id, external_hours, practical_test_score, provider]`. |

---

## 10 · Estimated effort

| Phase | Tasks | Effort | Risk |
|---|---|---|---|
| A | T1, T2, T3 | 0.5 day | low |
| B | T4 | 0.5 day | low (engine is mature now) |
| C | T5, T6 | 0.5 day | medium (snapshot trigger logic) |
| D | T7 | 0.5 day | low |
| **Total without E-1** | | **~2 days** | |
| **E** | E-1 (heatmap widget kind) | +1 day | medium (engine extension) |

The compression vs. survey (~3 days) reflects the engine's maturity.
Most of the cost is now data shape, not infrastructure.

---

## 11 · E-1 · Heatmap widget kind (engine extension, separate)

> Out of scope for the parity port. Spec'd here so it doesn't get lost.

**Goal:** add `kind: 'heatmap'` to `ReportModule` so a single widget
can render a users × courses grid coloured by completion state. The
type already accepts free-form colSpan + rowBreak, so no layout-system
changes needed.

**Rough shape:**
```ts
type ReportModuleHeatmap = ReportModuleBase & {
  kind: 'heatmap'
  /** Path to array of { rowLabel, colLabel, value: number, status?: string } */
  cellsPath: string
  /** Color mapping per status — defaults to a green→red scale. */
  statusColors?: Record<string, string>
}
```

**Renderer:** inline SVG, same approach as the existing `LineMini`. Cell
size adaptive to the matrix dimensions; tooltip on hover; click forwards
to a `onCellClick` (T8 candidate: drill-down).

**Compatible kinds (lossless switch):** rows-shaped data only — heatmap
↔ table.

**Acceptance:**
- [ ] New widget type renders against the existing dashboard runtime.
- [ ] DashboardEditWidgetPanel preview supports the new kind.
- [ ] Add Widget catalog can stamp a fresh heatmap module.
- [ ] At least one consumer (the learning analyse page) ships with a
  default heatmap widget showing users × required-courses completion.

Wins beyond e-learning: any module with a "subjects × items" matrix
benefits — checklist coverage by department, survey coverage by
respondent group, etc.

---

## 12 · Migration ordering

```
<ts+0> learning_categories.sql                          (T1)
<ts+1> learning_courses_category_id.sql                 (T1)
<ts+2> learning_progress_orgcontext_snapshot.sql        (T5)
<ts+3> learning_courses_metadata_schema.sql             (T6)
```

After every migration, verify column existence + counts as in survey-parity.md §11.

---

## 13 · Senior architect review (self-review pass)

Running playbook §7:

- [x] Reference precedent linked for every task.
- [x] Vertical slices verified.
- [x] Dependency graph is a DAG.
- [x] Acceptance criteria are observable.
- [x] Open questions enumerated.
- [x] Migrations are additive (no destructive renames).
- [x] Spec is self-contained.
- [x] Playbook stays generic.

**Concerns identified during self-review:**

1. **The "snapshot" pattern on T5 differs from surveys' "live FK" pattern.**
   Documented in §6 with rationale — completion audit context shouldn't
   change when a learner transfers departments. Implementer must read
   that note before writing the trigger.
2. **Categories don't have a pack scope on e-learning** (per OQ-L2). The
   admin tab + sidebar templates need to be adapted from the survey
   port to drop the pack-pill UI. Cheap.
3. **`learning_courses.tags` already exists** as free-form text array.
   The migration should backfill `category_id` from tags where possible
   so the upgrade isn't pure data loss. Spec calls this out in T1.
4. **The heatmap widget (E-1) is genuinely new infrastructure** —
   I deliberately scoped it out of the port and into its own
   micro-feature so the parity work doesn't get blocked behind it.
   The `kind: 'table'` widget covers the same data shape until E-1
   ships. This decision should be re-confirmed by whoever takes the
   port — it could go either way depending on UX appetite.

**Result:** spec moves from `🚧 draft` to `📋 ready to execute`.
