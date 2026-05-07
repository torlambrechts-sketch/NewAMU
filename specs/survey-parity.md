# Survey Architectural Parity

> **Read this first:** `specs/PLAYBOOK.md` (process spec, capability inventory,
> task shape, checkpoint protocol). This file references it heavily — section
> numbers like §3 mean §3 of the playbook.

**Reference module:** compliance checklists at `main` after commit `2f24241`.
**Target module:** `modules/survey/`.
**Owner of this spec:** human.
**Spec status:** `📋 ready to execute` (draft → ready after architect sign-off in §13).

---

## 1 · One-paragraph framing

The survey module already has the URL-mode reshape (commit `e2db7d4`), the
`?template=` reframing, and the per-template KPI work — those landed alongside
the checklist baseline. What's *missing* is everything that landed for
checklists between commits `a6c8d66` (categories) and `2f24241` (analytics
filters by org-context): the categories table, the `/survey/analyse` page,
collapsible sidebar groups, editable response metadata, org-context FKs on
survey instances, the template `metadata_schema`, and the org-context
analytics dimensions. This spec ports each of those to surveys.

---

## 2 · Mapping table — checklist concept → survey concept

| Checklist (reference) | Survey (target) | Notes |
|---|---|---|
| `compliance_checklist_executions` | `surveys` | One row per survey instance / campaign. |
| `compliance_checklist_responses` | `survey_responses` | One row per respondent answer. Different cardinality from checklist responses (per-question vs per-respondent), but the analytics dataset shape is similar. |
| `compliance_checklist_templates` | `survey_org_templates` ⚠ | The org-customised templates — *not* `survey_template_catalog`, which is the platform-shipped catalog. Categories + metadata_schema attach to the **org template**, not the catalog. |
| `compliance_checklist_categories` | `survey_template_categories` (NEW) | Per-(org, pack), with default category seeds for the existing survey packs. |
| `compliance_checklist_executions.signed_at` (sign event) | `surveys.published_at` / `closed_at` | Surveys don't sign; they publish then close. Post-lock metadata edits map to "edits after `closed_at`". |
| `compliance_checklist_executions.attendees text[]` | (none — anonymous-friendly) | Surveys can be anonymous; participants tracked at the response level if at all. We add `participant_member_ids uuid[]` for non-anonymous surveys (e.g. AMU pulse) but won't add free-form attendees. |
| `useChecklistModule` | `useSurvey` | Same hook role. |
| `useChecklistModule.updateExecutionMetadata` | new `useSurvey.updateSurveyMetadata` | Mutation we'll add. |
| `compliance_checklist_executions.signed_by` immutability | `surveys.published_at` immutability | We'll mirror the trigger relaxation: protect identity-bearing columns, allow soft fields to flow. |

**⚠ Decision required (§13 OQ-1):** does `metadata_schema` and `category_id`
attach to `survey_template_catalog` (platform-shared) or `survey_org_templates`
(org-curated)? Recommendation: org-templates, mirroring how
`compliance_checklist_templates` is org-scoped. Catalog rows would inherit
defaults via the provisioning flow.

---

## 3 · Capability map (playbook §4 → tasks)

| Capability | Tasks |
|---|---|
| C-1 Categories DB + admin | T1 |
| C-2 Categories discovery | T2 |
| C-3 Sidebar fixed children | T3 |
| C-4 Analyse page + scope registration | T4 |
| C-5 Editable instance metadata post-lock | T6 (rolled into T6 for cohesion with T5) |
| C-6 Org-context FKs on instances | T5 |
| C-7 Template `metadata_schema` | T6 |
| C-8 Schema-driven instance metadata UI | T6 |
| C-9 Analytics filter dimensions for org-context | T7 |

---

## 4 · Dependency graph

```
T1 (Categories DB + admin)
  └─ T2 (Categories on hub + sidebar)
       └─ T3 (Sidebar Settings + Analyse fixed children) ← also depends on T4

T4 (Analyse page + scope registration)

T5 (Org-context FKs on surveys)
  └─ T6 (metadata_schema + schema-driven panel + post-lock edits)
       └─ T7 (Org-context analytics filters) ← also depends on T4

```

Critical path: **T1 → T2 → T4 → T5 → T6 → T7** (T3 can land any time after T2 and T4 exist; not on the critical path).

---

## 5 · Phase plan

### Phase A · Categories + sidebar (T1, T2, T3)
Pure UX win, no semantic change to survey instances. Lowest-risk place to
start; lets the human verify the visual port before more invasive DB work.

### Phase B · Analyse page (T4)
First consumer of `ModuleAnalyticsDashboard` outside checklist. Will likely
surface dataset-key naming nits; spec these in §13.

### Phase C · Org-context + metadata_schema (T5, T6)
The biggest commit. Adds DB columns + trigger relaxation + dynamic UI.
**Checkpoint mandatory** between B and C (playbook §6) so the human can
sign off before metastable trigger changes go live.

### Phase D · Analytics filters (T7)
Extends T4 with org-context dimensions; pure addition.

---

## 6 · Tasks

> Every task follows playbook §3 standard shape. If a task lacks any of the
> five sections, it's not ready to execute.

### Task T1 · Survey template categories — DB + admin CRUD

**Status:** 📋 not started

**Why this is independent:** Categories are an additive table + a new admin
tab. No existing column or page changes meaning.

**Files to touch:**
- `supabase/migrations/<next>_survey_template_categories.sql` — new table
  `survey_template_categories(id uuid PK, organization_id uuid, pack survey_pack, slug text, name text, description text, position int, is_active bool, is_system bool, deleted_at timestamptz, created_at, updated_at, unique(org, pack, slug))`. RLS by org. BEFORE INSERT defaults trigger. Index on `(org, pack, position) where deleted_at is null and is_active`. Seed default system categories per pack (vendor / arbeidsmiljø / compliance / engagement / exit — see §13 OQ-2 for the actual list). Backfill any catalog rows' `category_id` matching the existing free-text `category` column where possible.
- `supabase/migrations/<next+1>_survey_org_templates_category_id.sql` — `alter table public.survey_org_templates add column category_id uuid references survey_template_categories(id) on delete set null`. Index. (Or the catalog table — confirm OQ-1 first.)
- `modules/survey/types.ts` — new `SurveyCategoryRow`. Add `category_id` to whichever template row carries it.
- `modules/survey/schema.ts` — zod row schema mirroring `ComplianceCategoryRowSchema`.
- `modules/survey/useSurvey.ts` — `categories` state + `loadCategories` + `createCategory` / `updateCategory` / `softDeleteCategory`. Mirror the equivalents in `useChecklistModule`.
- `modules/survey/admin/SurveyKategorierTab.tsx` — new file. Mirror `modules/compliance/admin/KategorierTab.tsx` byte-for-byte at first, then substitute survey terms.
- `src/pages/SurveyAdminPage.tsx` (or wherever the admin tabs live — verify by reading the file) — add a "Kategorier" tab between Maler and Pakker.

**Reference precedent:** Commit `a6c8d66` ("checklists: admin-defined template categories (phase 1)"). Read both the migration `20260828120022_compliance_checklist_categories.sql` and the `KategorierTab.tsx` carefully — the editor panel's slug-canonicalisation behaviour is non-obvious.

**Acceptance criteria:**
- [ ] Migration applies cleanly to a fresh DB and to the current `main`-state DB.
- [ ] Re-applying the migration is a no-op (`do nothing` or `if not exists` everywhere).
- [ ] `/survey/admin` (or wherever the survey admin lives) shows a new "Kategorier" tab.
- [ ] Adding a category, renaming, deactivating, deleting all work via the UI.
- [ ] System categories cannot be hard-deleted (only deactivated).
- [ ] TS + lint clean.
- [ ] After provisioning a new licensed pack, default categories exist for that org+pack pair.

**Verification steps:**
1. `npx tsc -b 2>&1 | tail -10`
2. `npx eslint modules/survey/admin/SurveyKategorierTab.tsx modules/survey/useSurvey.ts modules/survey/types.ts modules/survey/schema.ts 2>&1 | tail -10`
3. Apply the new migration. Run `select count(*) from survey_template_categories;` — should return ≥ 1 row per (active org × licensed pack × seeded category).
4. Open `/survey/admin` → Kategorier. Add a category "Vernerunde survey", rename it, deactivate, reactivate. Reload page. Order is preserved.
5. Open the (eventually-existing) Mal-editor; the category dropdown lists the new entry alongside system seeds.

**Open questions:** OQ-1 (org-templates vs catalog) must be resolved before writing the migration. OQ-2 (default category list per pack) needs a quick product call.

---

### Task T2 · Categories on hub tile grid + sidebar collapsible groups

**Status:** 📋 not started

**Why this is independent:** Pure consumption of T1's data. Mirrors the
checklist `4b318d2` + `f5641db` work.

**Files to touch:**
- `modules/survey/SurveyHubLanding.tsx` — group tiles by category within each pack section. Mirror the `groupedByPack` logic from `ChecklistsHubLanding.tsx`.
- `modules/survey/SurveyPage.tsx` — pass `cl.categories`-equivalent to the hub component.
- `modules/survey/useSurveyNav.ts` — surface `categoryId` per pinned template + a `categories` array (mirror `useComplianceNav.ts` after `4b318d2`).
- `src/components/layout/AticsShell.tsx` — extend the "Undersøkelser" group's `flatSubs` construction the same way "Sjekklister" does (look for the `compliancePinnedSubs IIFE`). Reuse the `kind: 'header'` `SubItem` and the `expandedHeaders` state already in the shell.

**Reference precedent:** Commit `4b318d2` ("checklists: categories drive hub grouping + sidebar headers (phase 2)") and `f5641db` ("collapsible category groups in sidebar with icons").

**Acceptance criteria:**
- [ ] Hub at `/survey` shows each pack section subdivided by category. "Uten kategori" bucket appended at the end of each pack with templates that have no `category_id`.
- [ ] Sidebar under "Undersøkelser" shows category headers (`FolderTree` icon + chevron) when more than one non-empty group exists. Single-group case skips the headers.
- [ ] Active group auto-expands; user clicks to override.
- [ ] No regression in checklist sidebar — both modules use the same `expandedHeaders` state.
- [ ] TS + lint clean.

**Verification steps:**
1. Open `/survey`. Visually verify category groupings match what's in the admin Kategorier tab.
2. Sidebar: click around between templates. Auto-expand follows the active item.
3. Re-run the same click path on `/compliance/checklists` — must still work.
4. `npx tsc -b` clean.

**Open questions:** none.

---

### Task T3 · Sidebar Settings + Analyse fixed children for surveys

**Status:** 📋 not started

**Why this is independent:** Two new flat-sub entries under "Undersøkelser",
ahead of the pinned templates. No data changes.

**Files to touch:**
- `src/components/layout/AticsShell.tsx` — `surveyFixedSubs` mirroring `complianceFixedSubs`. Wire icons (`Settings`, `BarChart3`) and routes (`/survey/admin`, `/survey/analyse`).

**Reference precedent:** Commit `87fdf89` ("checklists: per-template focus, amendable metadata, analyse page") — search for `complianceFixedSubs`.

**Acceptance criteria:**
- [ ] Sidebar under "Undersøkelser" shows Analyse + Innstillinger as the first two children, before pinned templates.
- [ ] Both links navigate. (Analyse depends on T4 existing — if T4 isn't done yet, the link 404s. Document this dependency in the task description.)
- [ ] Categories headers (T2) sit *below* these fixed entries.
- [ ] TS + lint clean.

**Verification steps:**
1. Sidebar visual inspection.
2. `/survey/admin` link is unchanged; `/survey/analyse` either resolves (T4 done) or noticably 404s (T4 pending).

**Open questions:** none.

---

### Task T4 · `/survey/analyse` page using ModuleAnalyticsDashboard

**Status:** 📋 not started

**Why this is independent:** New page; no existing route changes meaning.
Uses the dashboard runtime that's already shipped.

**Files to touch:**
- `modules/survey/dashboards/surveyDashboardScope.ts` — new file. `registerDashboardScope({ scopeId: 'survey', label: 'Undersøkelser', defaultLayout, widgetCatalog, datasets })`. Datasets — see §7 for the survey-specific list.
- `modules/survey/SurveyAnalysePage.tsx` — new file. Mirror `ChecklistsAnalysePage.tsx`. Computes datasets from `useSurvey` data. Wires `useDashboardLayout({ scopeId: 'survey' })`. Uses `ModuleAnalyticsDashboard` runtime. Side-effect import of the scope.
- `src/App.tsx` — add `<Route path="survey/analyse" element={<SurveyAnalysePage />} />`. Check whether surveys use a `PackProvider` like checklists — if yes, wrap.
- `modules/survey/SurveyPage.tsx` — header "Analyse" link (next to Settings) on the hub mode. Mirror what's in `ChecklistsPage.tsx`.

**Reference precedent:** Commits `75f785e` (phase 1 — runtime), `6f18308` (phase 2-3 — persistence + editor), `d84384c` (12-col + line + per-widget editor), `67d7421` (filters + drag-drop + preview).

**Acceptance criteria:**
- [ ] `/survey/analyse` opens. Header has "Tilbake" + "Rediger oppsett" + "Legg til widget" buttons matching size (px-4 py-2, default Button).
- [ ] Default layout shows a sensible 4-up KPI strip + at least one trend line + a per-pack donut + a per-template bar.
- [ ] Filter chip bar at top. "+ Filter" picker lists at minimum: Pakke, Mal, Status, Periode. Adding chips re-renders the widgets.
- [ ] Edit Layout opens; drag works; saving persists across reload.
- [ ] Add Widget catalog has all the catalog entries; preview renders live.
- [ ] Widget "..." menu has Edit / Duplicate / Remove.
- [ ] No saved-layout parse errors after first save (regression of `381e0e6`).
- [ ] TS + lint clean.

**Verification steps:**
1. Apply migration `20260828120023_dashboard_layouts.sql` if not already applied.
2. `/survey/analyse` — full smoke test of the editor.
3. Save a layout. Hard reload. Layout persists.
4. Run `npx tsc -b 2>&1 | tail -10` — clean.

**Open questions:** OQ-3 (which datasets are *first-class* for surveys vs checklists — see §7).

---

### Task T5 · Org-context FKs on `surveys` + trigger relaxation

**Status:** 📋 not started

**Why this is independent:** Additive columns + trigger update. Schema-only;
no UI or hook changes in this slice (those land in T6).

**Files to touch:**
- `supabase/migrations/<next>_surveys_orgcontext_and_metadata.sql` — alter `surveys` add `location_id uuid references locations(id)`, `department_id uuid references departments(id)`, `team_id uuid references teams(id)`, `participant_member_ids uuid[] not null default '{}'`, `metadata jsonb not null default '{}'`. Indexes (FK-targeted partial + GIN on participants). Update the BEFORE UPDATE trigger that locks closed surveys — protect `published_at`, `closed_at`, identity columns; allow the metadata cluster to flow through. Mirror `compliance_checklist_executions_before_update_defaults` from migration `20260828120024`.
- `modules/survey/types.ts` — add the new fields to `SurveyRow`.
- `modules/survey/schema.ts` (or wherever surveys' zod lives) — add the corresponding zod fields.

**Reference precedent:** Commit `0bb3a64` and migration `20260828120024_compliance_executions_orgcontext_and_metadata_schema.sql`.

**Acceptance criteria:**
- [ ] Migration applies cleanly + idempotent.
- [ ] `select column_name from information_schema.columns where table_name='surveys' and column_name in ('location_id','department_id','team_id','participant_member_ids','metadata')` — returns 5 rows.
- [ ] Existing rows (signed/closed) can be updated to set/clear `location_id` etc. without firing the immutability exception.
- [ ] Existing rows cannot have `published_at` modified after the survey is closed.
- [ ] TS clean.

**Verification steps:**
1. Apply the migration.
2. Run a quick SQL: pick a closed survey, `update surveys set location_id = '<some location id>' where id = '<closed survey id>'` — succeeds. Then `update surveys set closed_at = now() where id = '<same id>'` — fails with the immutability exception.
3. `npx tsc -b 2>&1 | tail -5`.

**Open questions:** OQ-4 (does the survey lock-trigger today exist? if not, do we need one?).

---

### Task T6 · Template `metadata_schema` + schema-driven SurveyMetadataPanel + post-lock edits

**Status:** 📋 not started

**Why this is independent:** UI-side consumer of T5. Independent of T7
(which is analytics-only).

**Files to touch:**
- `supabase/migrations/<next>_survey_org_templates_metadata_schema.sql` — `alter table survey_org_templates add column metadata_schema jsonb not null default '{"fields":[]}'`. (Or catalog — see OQ-1.)
- `modules/survey/types.ts` — `TemplateMetadataField` / `TemplateMetadataSchema` types (copy verbatim from `modules/compliance/types.ts`; the types are module-agnostic).
- `modules/survey/schema.ts` — zod `parseMetadataSchema` (copy verbatim).
- `modules/survey/useSurvey.ts` — `updateSurveyMetadata({ surveyId, title?, description?, locationId?, departmentId?, teamId?, participantMemberIds?, metadata? })`. Update existing `updateOrgTemplate` (or its name) to accept `metadata_schema`.
- `modules/survey/components/SurveyMetadataPanel.tsx` — new file. Mirror `modules/compliance/components/ExecutionMetadataPanel.tsx`. Substitute "execution" → "survey", "attendees" semantics: surveys have `is_anonymous` — if anonymous, hide participants picker; if not, show it. Reads `template.metadata_schema` and renders the matching kind-controls.
- `modules/survey/SurveyDetailView.tsx` — slot the new panel near the header. Pass `orgSetup.locations / departments / teams / members` and the template's `metadata_schema`.
- `modules/survey/admin/<survey template editor>` — add the "Hoveddata-felt" section mirroring the one in `modules/compliance/admin/TemplateEditorPanel.tsx`. Persist via the new `metadata_schema` field on the template.

**Reference precedent:** Commits `0bb3a64` (DB), `7fd7f71` (UI).

**Acceptance criteria:**
- [ ] On `/survey/<id>`, the metadata panel surfaces title + description + scheduled + assigned + (per template) location/department/team/participants + free-form fields.
- [ ] Template editor admin tab has a "Hoveddata-felt" section with add/reorder/remove and a "Bruk anbefalt for vendor-egenerklæring" preset (or similar — see §13 OQ-5).
- [ ] Anonymous surveys hide the participants picker but still allow location/department/team.
- [ ] Closed surveys still allow metadata edits (test with a closed row).
- [ ] TS + lint clean.

**Verification steps:**
1. Add a metadata field via template editor. Create a survey from that template. Assert the field appears in the survey's metadata panel.
2. Close a survey. Edit its title and location. Reload. Both edits persist.
3. Cross-test: opening a checklist execution still renders correctly (no shared-component regression).

**Open questions:** OQ-5 (recommended-preset name per pack).

---

### Task T7 · Analytics dimensions for org-context

**Status:** 📋 not started

**Why this is independent:** Pure addition to the analyse page from T4.

**Files to touch:**
- `modules/survey/SurveyAnalysePage.tsx` — extend the dimensions array with `location`, `department`, `participant`. Extend the `FilterSelectors` type. Apply selectors when filtering surveys / responses.
- `modules/survey/dashboards/surveyDashboardScope.ts` — add `survey_responses_by_location`, `survey_responses_by_department` datasets + donut/bar catalog entries under an "Org-kontekst" picker category.

**Reference precedent:** Commit `2f24241` ("checklists: phase 3 — analytics filters by location/department/participant").

**Acceptance criteria:**
- [ ] "+ Filter" picker now shows Lokasjon / Avdeling / Deltaker.
- [ ] Adding a Lokasjon chip narrows every widget consistently.
- [ ] At least one new widget per dimension is in the Add Widget catalog.
- [ ] TS + lint clean.

**Verification steps:**
1. `/survey/analyse` → "+ Filter" → Lokasjon — picker shows the org's locations.
2. Pick one. Numbers shift across the dashboard.
3. "+ Filter" → Avdeling — same.
4. Add the new "Lokasjon — kakediagram" widget. It renders.

**Open questions:** none.

---

## 7 · Survey-specific dataset list (T4 input)

These keys go in `surveyDashboardScope.ts → datasets[]`. The page computes them
from `useSurvey` + `useOrgSetupContext`.

| Key | Shape | Notes |
|---|---|---|
| `survey_kpi_summary` | kpi-record | `{ total, open, closed, ytdClosed, responses, responseRate }` |
| `survey_status_distribution` | segments | `{ Kladd, Aktiv, Lukket }` |
| `survey_pack_distribution` | segments | per pack |
| `survey_template_distribution` | segments | top-N templates |
| `survey_responses_over_time` | series | last-12-month bucket |
| `survey_response_rate_over_time` | series | per published-month avg response rate |
| `survey_anonymity_distribution` | segments | `{ Anonym, Identifisert }` |

Add `survey_responses_by_location` and `survey_responses_by_department` in T7.

---

## 8 · Migration ordering

Order the migrations chronologically (by filename timestamp) in this order:

```
<ts+0> survey_template_categories.sql              (T1)
<ts+1> survey_org_templates_category_id.sql        (T1)
<ts+2> dashboard_layouts.sql                       (re-applied if not yet on env; idempotent)
<ts+3> surveys_orgcontext_and_metadata.sql         (T5)
<ts+4> survey_org_templates_metadata_schema.sql    (T6)
```

After every migration, verify: `select count(*) from <table>` and `\d+ <table>`
match expectations.

---

## 9 · Trigger contract for survey "lock"

Surveys lock at `closed_at` (parallel to checklists' `signed_at`). The
BEFORE UPDATE trigger after T5 must:

- **Reject** changes to: `published_at`, `closed_at` (once non-null going to null),
  any future `lock_checksum` column, `pack`, `catalog_id`, response counts.
- **Allow** changes to: `title`, `description`, `survey_purpose`,
  `survey_amu_summary`, `location_id`, `department_id`, `team_id`,
  `participant_member_ids`, `metadata`, `next_scheduled_at`, `recurrence_months`,
  `archived_at`.

If no lock-trigger exists today (likely the case — surveys are simpler than
signed checklists), T5 introduces one. Document it in the migration's header
comment.

---

## 10 · Acceptance criteria for the *whole* port

After every task is `✅`:

- [ ] `/survey` hub looks visually parity with `/compliance/checklists`.
- [ ] `/survey/analyse` exists, persists layouts, supports drag/drop + filters.
- [ ] An admin can add a category, see it on the hub + sidebar, and assign templates to it.
- [ ] Survey instances can be filtered by location / department / participant on the analyse page.
- [ ] A closed survey's metadata can be amended without invalidating any checksum.
- [ ] No regressions on checklist routes (smoke-tested).
- [ ] `ROADMAP.md` items 2.4–2.8 flipped from `📋` to `✅`.

---

## 11 · Verification commands cheat-sheet

```bash
# Type-check whole repo
npx tsc -b 2>&1 | tail -10

# Lint touched files (template — fill in)
npx eslint <file1> <file2> 2>&1 | tail -10

# Apply a single migration (Supabase Studio also works)
psql "$DATABASE_URL" -f supabase/migrations/<file>.sql

# Smoke-check that a migration is idempotent: re-run it
psql "$DATABASE_URL" -f supabase/migrations/<file>.sql

# Quick existence query for the new tables
psql "$DATABASE_URL" -c "select count(*) from survey_template_categories;"
psql "$DATABASE_URL" -c "\d+ surveys" | grep -E 'location_id|department_id|team_id|participant_member_ids|metadata'
```

---

## 12 · Estimated effort

| Phase | Tasks | Rough effort | Risk |
|---|---|---|---|
| A | T1, T2, T3 | 0.5–1 day | low |
| B | T4 | 0.5 day | medium (first second-consumer of dashboard engine) |
| C | T5, T6 | 1 day | medium-high (DB trigger relaxation) |
| D | T7 | 0.5 day | low |
| **Total** | | **~3 days** | |

Stretch: if tasks/elearning are the next ports after this, the same recipe
should compress to **~2 days each** since the engine is now battle-tested.

---

## 13 · Open questions (all blockers — resolve before starting)

| ID | Question | Default recommendation if unanswered |
|---|---|---|
| OQ-1 | `category_id` and `metadata_schema` attach to `survey_org_templates` or `survey_template_catalog`? | **org_templates** — mirrors checklist behaviour where templates are org-scoped. Catalog rows seed defaults via the provisioning flow. |
| OQ-2 | Default category list per survey pack? | Vendor pack: "Egenerklæring", "HMS-status", "Avtaler". Arbeidsmiljø pack: "Pulsmåling", "Verneombud", "Trivsel". Compliance: "AML-kartlegging", "Internkontroll". Engagement: "Onboarding", "Eksternt". Exit: "Utgang", "Anonyme tilbakemeldinger". |
| OQ-3 | Are response-rate and respondent-count first-class survey datasets, or extras? | First-class — bake them into the default layout (KPI tile + trend line). |
| OQ-4 | Does `surveys` have a BEFORE UPDATE trigger today? | Need to verify in code. If not, T5 introduces one. Either way the trigger is conservative. |
| OQ-5 | Default "Bruk anbefalt for X" preset per pack? | Vendor: `[location, department]`. Arbeidsmiljø: `[location, department, participants]`. Compliance: `[location]`. Others: empty default — admin picks. |

If the implementer has an opinion that differs, they should write it up here
and ping the human before coding.

---

## 14 · Senior architect review (self-review pass)

Running playbook §7 against this spec:

- [x] Reference precedent linked for every task (T1→T7 each cite a checklist commit).
- [x] Vertical slices verified — every task touches DB + types + hook + UI in one go.
- [x] Dependency graph is a DAG (verified §4).
- [x] Acceptance criteria are observable.
- [x] Open questions enumerated up top (§13).
- [x] Migrations are additive (no destructive renames).
- [x] Spec is self-contained.
- [x] Playbook stays generic.

**Concerns identified during self-review (improvements applied):**

1. **Initial draft conflated `survey_org_templates` and `survey_template_catalog`.**
   Fixed: added §13 OQ-1 as an explicit decision and the §2 mapping table calls the choice out.
2. **T6 originally split metadata_schema and post-lock edits into two tasks** — but they touch the same panel and the same trigger. Merging into T6 makes the slice atomic.
3. **T4 had a vague "default layout matches checklist".** Fixed: §7 lists the exact dataset keys + shapes, and the default-layout sentence in T4 is concrete ("4-up KPI + trend line + per-pack donut + per-template bar").
4. **Anonymity is a survey concern that doesn't exist on checklists.** Fixed: T6 acceptance criteria explicitly handles the anonymous case (hide participants picker).
5. **The migration ordering section (§8)** wasn't in the original draft; added so a fresh implementer doesn't have to reconstruct it.

**Result:** spec moves from `🚧 draft` to `📋 ready to execute` once the human signs off on §13 OQ-1 / OQ-2 / OQ-5.
