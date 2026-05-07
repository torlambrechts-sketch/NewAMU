# Tasks (Oppgaver) Architectural Parity

> **Read this first:** `specs/PLAYBOOK.md` (process spec, capability inventory,
> task shape, checkpoint protocol). Then read `specs/survey-parity.md` for the
> reference port — this spec is materially **smaller** because tasks have
> different bones than checklists/surveys.

**Reference module:** compliance checklists at `main` after commit `a3c1c77`
(survey port also useful as a second reference).
**Target module:** `modules/tasks/` + `src/pages/TasksPage.tsx` +
`src/hooks/useTasks.ts`.
**Owner of this spec:** human.
**Spec status:** `📋 ready to execute` after audit findings reviewed (§3).

---

## 1 · One-paragraph framing

Tasks are not a normalised SQL table. They live in a jsonb payload
(`org_module_payload` keyed `'tasks'`) and represent an aggregated *inbox*
of work items spawned from many sources (`TaskSourceType`: manual, council,
hse_inspection, hse_sja, survey, ros_measure, …). That changes the parity
port: most of the playbook's checklist/survey machinery doesn't apply.
The high-value work for tasks is **the analytics page** — a unified view
across every source feeding the inbox, with chip-driven filters by
status / source / module / priority / assignee. Categories, metadata_schema
and post-lock metadata edits intentionally **drop out of scope**.

---

## 2 · Mapping table — checklist concept → tasks concept

| Checklist (reference) | Tasks (target) | Notes |
|---|---|---|
| `compliance_checklist_executions` (table) | `org_module_payload[scope='tasks'].store.tasks` (jsonb) | No normalised table. Reads via `useTasks`, writes via `upsertOrgModulePayload`. |
| `compliance_checklist_categories` | `Task.sourceType` | The enum already segments tasks logically (manual, council, hse_*, survey, ros_measure, etc). Don't add a parallel category table. |
| `compliance_checklist_templates` | (none) | Tasks aren't template-driven. They're spawned from sources or created manually. |
| `signed_at` (sign event) | `Task.assigneeSignature.signedAt` | Tasks lock at sign-off (assignee + optionally management). The current model already allows metadata edits via `useTasks` regardless of sign state, so no trigger work needed. |
| Org-context FKs | `Task.assigneeEmployeeId`, `leaderEmployeeId` | Tasks reference *employees*, not locations / departments directly. Department/location can still be filter dimensions by following the employee → org_member join, but they're not stored on the task. |
| `useChecklistModule` | `useTasks` | Same hook role. |
| `dashboardRegistry` scope | new `tasks` scope | Yes — same engine, new scope. |

---

## 3 · Capability map (playbook §4 → tasks)

| Capability | Decision | Rationale |
|---|---|---|
| **C-1 Categories DB + admin** | ❌ skip | `sourceType` is the categorisation. A parallel categories table would just shadow the enum. |
| **C-2 Categories on hub + sidebar** | ❌ skip | Same reason. The Tasks page already has a tab strip; we don't need a hub. |
| **C-3 Sidebar fixed children (Analyse + Innstillinger)** | ✅ in scope | Same shape as compliance + survey. Settings link points to whatever the existing tasks admin / settings is; Analyse is the new T1. |
| **C-4 `/tasks/management/analyse` page** | ✅ in scope | The only really high-value capability for tasks. Replaces the existing ad-hoc dashboard with the engine. |
| **C-5 Editable metadata post-lock** | ❌ skip | `useTasks` already permits metadata edits regardless of sign state — the signature is on the task, not on the row's mutability. No trigger work. |
| **C-6 Org-context FKs** | ❌ skip | Tasks are jsonb; FKs don't apply. Filter dimensions (location/department) resolved via employee join in the page. |
| **C-7 Template `metadata_schema`** | ❌ skip | Not template-driven. |
| **C-8 Schema-driven UI** | ❌ skip | Same reason. |
| **C-9 Analytics filter dimensions** | ✅ in scope | Status / Module / Source / Priority / Assignee / Due-window / Department (resolved). |

**Reduced scope:** two real tasks (T1 + T2) plus a small T3 to wire the
sidebar entry. No DB migrations.

---

## 4 · Dependency graph

```
T1 (Tasks dashboard scope + analyse page)
  └─ T2 (Filter dimensions)
       └─ T3 (Sidebar fixed Settings + Analyse children)
```

Critical path: **T1 → T2 → T3**. No checkpoint between them; the whole
port is small enough to ship as a single phase.

---

## 5 · Tasks

### Task T1 · `/tasks/management/analyse` page using ModuleAnalyticsDashboard

**Status:** 📋 not started

**Why this is independent:** New page; no existing route changes meaning.
Uses the dashboard runtime that's already shipped (commit `67d7421`).

**Files to touch:**
- `modules/tasks/dashboards/tasksDashboardScope.ts` — new file. `registerDashboardScope({ scopeId: 'tasks', label: 'Oppgaver', defaultLayout, widgetCatalog, datasets })`. Datasets in §6.
- `modules/tasks/TasksAnalysePage.tsx` — new file. Mirrors `SurveyAnalysePage.tsx`. Uses `useTasks`. No org-context filtering yet; that's T2.
- `src/App.tsx` — add `<Route path="tasks/management/analyse" element={<TasksAnalysePage />} />`. (Keep `/tasks/management` as the existing flat URL; analyse is a sibling.)
- `src/pages/TasksPage.tsx` (or `TasksManagementPage`) — header "Analyse" button matching the size of other module Analyse buttons (default Button, secondary, BarChart3 icon).

**Reference precedent:** Commit `4c1bbc4` ("survey: T4 — /survey/analyse page using ModuleAnalyticsDashboard").

**Acceptance criteria:**
- [ ] `/tasks/management/analyse` opens. Header has "Tilbake" + "Rediger oppsett" + "Legg til widget" buttons matching size.
- [ ] Default layout: 4-up KPI strip (total / open / overdue / completed-YTD) → tasks-over-time line → status donut → source bar → module donut.
- [ ] Filter chip bar at top (T2 will add the actual chips; T1 ships the structural slot).
- [ ] Edit Layout drag works; saving persists across reload.
- [ ] Add Widget catalog has all the entries.
- [ ] No regressions on checklist or survey analyse pages (all three use the same engine).
- [ ] TS + lint clean.

**Verification steps:**
1. `npx tsc -b 2>&1 | tail -10`
2. `npx eslint modules/tasks/TasksAnalysePage.tsx modules/tasks/dashboards/tasksDashboardScope.ts 2>&1 | tail -10`
3. Visit `/tasks/management/analyse`. KPI tiles render with non-zero values when tasks exist.
4. Save a layout change, hard reload, layout persists.
5. Smoke-test `/compliance/checklists/analyse` and `/survey/analyse` — still work.

**Open questions:** OQ-T1 (where exactly does the Analyse link live in the existing TasksManagementPage chrome? confirm by reading the file).

---

### Task T2 · Filter dimensions for tasks analyse

**Status:** 📋 not started

**Why this is independent:** Pure addition to T1's page. Adds five chip dimensions.

**Files to touch:**
- `modules/tasks/TasksAnalysePage.tsx` — add dimensions array + extend `FilterSelectors` type + apply selectors when bucketing.

**Dimensions:**
- **Status** (enum: `todo`, `in_progress`, `done`)
- **Modul** (enum: `general`, `council`, `members`, `org_health`, `hse`, `hrm`, `learning`)
- **Kilde** (enum: `TaskSourceType` values)
- **Prioritet** (enum: `low`/`medium`/`high`/`critical` — only available if the org uses the task extensions feature; falls back gracefully when not)
- **Tildelt** (enum: org members; loadOptions from `useOrgSetupContext().members`)
- **Forfall** (date_range over `Task.dueDate`)
- **Avdeling** (resolved via `Task.assigneeEmployeeId → organization_members.department_id`; the page does the join client-side)

**Reference precedent:** Commit `36bd0f9` ("survey: T7 — analytics filters by category / location / department / participant").

**Acceptance criteria:**
- [ ] All seven dimensions appear in the "+ Filter" picker.
- [ ] Adding a chip narrows every widget consistently.
- [ ] "Avdeling" filter falls back gracefully when an assigneeEmployeeId is missing or doesn't resolve.
- [ ] TS + lint clean.

**Open questions:** none.

---

### Task T3 · Sidebar fixed Settings + Analyse children for Oppgaver

**Status:** 📋 not started

**Why this is independent:** Two flat-sub entries under "Oppgaver". No data
changes.

**Files to touch:**
- `src/components/layout/AticsShell.tsx` — `tasksFixedSubs` mirror of
  `surveyFixedSubs` / `complianceFixedSubs`. Wire icons (`Settings`,
  `BarChart3`) and routes. The "Innstillinger" link should point at the
  existing Tasks settings entry — confirm by reading App.tsx for routes
  named `tasks/admin` or similar; if none exists, drop the Innstillinger
  entry until a settings page lands.

**Acceptance criteria:**
- [ ] Sidebar under "Oppgaver" shows Analyse + (Innstillinger if a route exists).
- [ ] Both links navigate.
- [ ] No regression on the existing pinned templates / sub-items.
- [ ] TS + lint clean.

**Open questions:** OQ-T3 (does a Tasks settings/admin page exist today?).

---

## 6 · Datasets for the tasks scope (T1 input)

| Key | Shape | Bucket logic |
|---|---|---|
| `tasks_kpi_summary` | kpi-record | `{ total, open, overdue, completedYtd, requiringSignOff }` |
| `tasks_status_distribution` | segments | `{ Todo, In progress, Done }` |
| `tasks_source_distribution` | segments | top-N by `sourceType` |
| `tasks_module_distribution` | segments | by `module` |
| `tasks_completed_over_time` | series | last 12 months by completion month (proxy: `assigneeSignature.signedAt`) |
| `tasks_overdue_over_time` | series | snapshot count per month-end (or a simpler "currently overdue per month due") |

T2 adds:
- `tasks_distribution_by_assignee` (top assignees)
- `tasks_distribution_by_department` (resolved via employee join)

---

## 7 · Acceptance criteria for the *whole* port

After T1 + T2 + T3 are `✅`:

- [ ] `/tasks/management/analyse` is the canonical analytics surface for the
  tasks system.
- [ ] Filter chips persist as the org's shared dashboard layout (handled by
  the engine; nothing tasks-specific).
- [ ] No regression on `/compliance/checklists/analyse` or `/survey/analyse`.
- [ ] `ROADMAP.md` gets a new section 4 (or extends an existing tasks section)
  flipping these capabilities to ✅.

---

## 8 · Open questions (resolve before starting)

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-T1 | Where in `TasksManagementPage` does the "Analyse" header button slot? | Use the existing header action area; mirror what `SurveyPage` does on hub mode. |
| OQ-T2 | Should the analytics page be `/tasks/analyse` or `/tasks/management/analyse`? | **Latter** — the main app surface is `/tasks/management`; the analyse page is its sibling. `/tasks` already exists and has different scope. |
| OQ-T3 | Does a Tasks settings/admin page exist today? | Audit `src/App.tsx` for any `tasks/admin` route; if none, defer the Innstillinger sidebar child to a follow-up. |
| OQ-T4 | Department filter resolution requires loading `organization_members` and joining client-side. Acceptable, or do we need a server-side aggregate? | Acceptable for v1 — the orgs we care about have <200 employees; client-side join is fine. Revisit if it becomes a perf issue. |

---

## 9 · Estimated effort

| Phase | Tasks | Effort | Risk |
|---|---|---|---|
| Single | T1 + T2 + T3 | ~1 day | low (no DB; reuses engine) |

Materially simpler than the survey port because no schema work. The
dashboard engine is now battle-tested through two consumers.

---

## 10 · Senior architect review (self-review pass)

Running playbook §7:

- [x] Reference precedent linked for every task.
- [x] Vertical slices verified — T1 ships a working analyse page end-to-end.
- [x] Dependency graph is a DAG (T1 → T2 → T3, no cycles).
- [x] Acceptance criteria are observable.
- [x] Open questions enumerated.
- [x] No DB migrations — nothing to roll back.
- [x] Spec is self-contained.
- [x] Playbook stays generic.

**Concerns identified during self-review:**

1. **The "department filter" via employee join may surprise callers.** Documented as an OQ-T4 trade-off; if the join becomes expensive we add an RPC.
2. **Tasks don't have a "lock" event in the same sense as checklists / surveys.** The `assigneeSignature` provides traceability but doesn't immutability-gate the row. I called this out in §2 + §3 (skip C-5) so the implementer doesn't waste effort on trigger work.
3. **The `module` enum and `sourceType` enum overlap conceptually** ("hse" vs "hse_inspection" / "hse_sja"). Two filter dimensions is correct because they answer different questions (modul = which module owns it, kilde = how was it spawned), but the analyse page should label them clearly.

**Result:** spec moves from `🚧 draft` to `📋 ready to execute`.
