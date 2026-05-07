# Documents (Wiki, prosedyrer & maler) Architectural Parity

> **Read this first:** `specs/PLAYBOOK.md` (process spec, capability inventory,
> task shape, checkpoint protocol). Then read `specs/elearning-parity.md` —
> documents has the closest shape to learning (templates + per-org overrides
> + first-class content), so its sequencing is the best reference.

**Reference module:** compliance checklists / surveys / learning, all on `main` after
commit `349c519` (composite scopes shipped).
**Target module:** `src/pages/documents/` + `src/hooks/useDocuments.tsx` +
`modules/documents/` + the 21 archived `wiki_*` / `document_*` migrations.
**Owner of this spec:** human.
**Spec status:** `📋 ready to execute` after audit findings reviewed (§3) and
open questions (§9) answered.

---

## 1 · One-paragraph framing

Documents is a content module, not an event module. The user-facing primitive
is a **wiki page** — long-lived, edited continuously, optionally created from
a per-org template (`document_org_templates`). There is no sign / close / archive
event with the audit-trail semantics that drive the post-lock editability work
on checklists / surveys / learning, so capabilities **C-5 (post-lock metadata
edit)** and **C-6 (org-context FK columns)** drop out of scope. What's high-value
is everything else: a top-level menu group with pinned templates surfaced in the
sidebar (D-1, D-2), an analyse page wired to the dashboard engine (C-4, C-9), a
template `metadata_schema` driving a schema-driven panel when authoring a page
from template (C-7, C-8), and a provision bundle that recovers orgs whose
`document_org_templates` rows never got mirrored (D-3 — exact parallel to the
20260828120031 survey bundle). After this port, Documents reads like Sjekklister /
Undersøkelser / Læring in the IA, with the same widget engine + chooser + CSV
export + drill-down behaviour.

---

## 2 · Mapping table — checklist concept → documents concept

| Checklist (reference) | Documents (target) | Notes |
|---|---|---|
| `compliance_checklist_executions` (table) | `wiki_pages` | First-class content table. Page lifecycle is `draft → published → archived`; no signing event. |
| `compliance_checklist_categories` | `wiki_spaces` | Existing per-org "space" already functions as a category (a wiki page belongs to one space; spaces have a curated tile in the hub). **No parallel `document_categories` table.** |
| `compliance_checklist_templates` | `document_system_templates` (system catalog) + `document_org_templates` (per-org overrides) + `document_org_template_settings` (per-org enable/disable). | Three-table structure already exists; mirror the `nav_pinned` column on `document_org_templates`. |
| `signed_at` (sign event) | `wiki_pages.published_at` (publish event) | Soft-lock equivalent. Editing a published page creates a new revision in `wiki_revisions`; the page row stays mutable. No trigger work needed. |
| Org-context FKs | (none) | Wiki pages are space-scoped, not location/department-scoped. Access is governed by `wiki_space_access_grants` (finer-grained than dept FKs). C-6 stays N/A. |
| `useChecklistModule` | `useDocuments` | Same hook role; already exists at `src/hooks/useDocuments.tsx`. |
| `dashboardRegistry` scope | new `documents` scope | Same engine, new scope. |
| `provision_compliance_baseline_for_org` | `provision_documents_baseline_for_org` (NEW) | Mirror the survey/compliance pattern: trigger on settings insert/update + a re-runnable bundle migration. |

---

## 3 · Capability map (playbook §4 → documents)

| Capability | Decision | Rationale |
|---|---|---|
| **C-1 Categories DB + admin** | ❌ skip | `wiki_spaces` already function as categories. A parallel `document_categories` table would shadow them. Spaces are admin-curated per org and link to the hub today. |
| **C-2 Categories discovery (hub + sidebar)** | ✅ in scope | Spaces should drive sidebar groups (one header per space) and the hub tile sections. The hub tiles partially do this; the sidebar today is empty (`documentsSubs: []`). |
| **C-3 Sidebar Settings + Analyse fixed children** | ✅ in scope | Two fixed `flatSubs` ahead of pinned templates / spaces. Innstillinger → `/documents/admin`; Analyse → new T2. |
| **C-4 `/documents/analyse` page + registry** | ✅ in scope | Brand new page. KPIs: total pages, published, pending reviews, retention overdue, access requests open. |
| **C-5 Editable metadata post-lock** | ❌ N/A | Documents have no sign event; pages stay editable indefinitely. The revision history (`wiki_revisions`) handles audit trails. |
| **C-6 Org-context FKs on instances** | ❌ skip | Pages are space-scoped, not location/department-scoped. Existing `wiki_space_access_grants` provide finer-grained access control. |
| **C-7 Template `metadata_schema`** | ✅ in scope | New jsonb column on `document_org_templates`. Drives a schema-driven panel when a page is created from template — typical fields: `applies_to` (department), `next_review_date`, `legal_basis`, `compliance_pack`. |
| **C-8 Schema-driven UI** | ✅ in scope | Mirrors `LearningCompletionMetadataPanel` / `SurveyMetadataPanel`. Slot into `DocumentEditorWorkbench` above the body. Free-form fields persist into a new `wiki_pages.metadata jsonb` column. |
| **C-9 Analytics filter dimensions** | ✅ in scope | Space, template, status (draft/published/archived), retention bucket (overdue / due-30d / future), reviewer, owner. |

**Documents-specific capabilities** (not in PLAYBOOK §4 because they emerged after surveys):

| Capability | Decision | Rationale |
|---|---|---|
| **D-1 Promote to top-level NavGroup** | ✅ in scope | Same flatSubs treatment as Sjekklister / Undersøkelser / Oppgaver / Læring. Currently lives in "Gamle moduler". |
| **D-2 Pinned templates in sidebar (`nav_pinned`)** | ✅ in scope | New column on `document_org_templates`; reads via a new `useDocumentNav` hook mirroring `useSurveyNav`. |
| **D-3 Provision bundle (recovery migration)** | ✅ in scope | Re-runnable migration like `20260828120031_survey_provision_bundle.sql`. Pins pristine system overrides; idempotent. |

**Reduced scope:** C-5 + C-6 dropped. Total tasks: T1–T11 across four phases.

---

## 4 · Dependency graph

```
T1 (Promote to top-level NavGroup, fixed Analyse + Innstillinger children)
  └─ T2 (Documents dashboard scope + /documents/analyse page)
       └─ T3 (Analytics filter dimensions)
            └─ T4 (Drill-down on space/status donuts)

T5 (DB: nav_pinned on document_org_templates)
  └─ T6 (useDocumentNav hook + sidebar pinned-templates render)
       └─ T7 (Provision bundle migration — recovery for orgs missing rows)

T8 (DB: metadata_schema on document_org_templates + metadata on wiki_pages)
  └─ T9 (Schema-driven panel in DocumentEditorWorkbench)
       └─ T10 (Admin authoring UI in DocumentTemplatesSettings)

T11 (Comparison-mode datasets — pages-published yoy)
```

**Recommended order** (shortest critical path):

```
Phase A · Discovery + analyse (T1 → T2 → T3 → T4)              ──┐
Phase B · Pinned templates + provision parity (T5 → T6 → T7)     │ → ship checkpoint
Phase C · Template metadata_schema (T8 → T9 → T10)              │
Phase D · Polish (T11)                                          ┘
```

Phase A unlocks the new IA + analytics surface end-to-end without DB changes
(T1 → T4 are pure UI / scope registration). Phase B and Phase C are the DB
migrations; both are additive and idempotent. Phase D is opportunistic.

Phase A is the natural ship checkpoint — at that point the user sees Documents
in the main menu next to its peers, with a working analyse page. Stop here and
get sign-off before B/C.

---

## 5 · Tasks

### Task T1 · Promote Documents to a top-level NavGroup

**Status:** 📋 not started

**Why this is independent:** Pure AticsShell change. No DB, no new components.

**Files to touch:**
- `src/components/layout/AticsShell.tsx` — define `DOCUMENTS_NAV_PERMS`, build `documentsGroup` with `flatSubs: true`, remove the legacy entry from `gamleModulerModules`, insert the new group between `surveyGroup` and `tasksGroup` (alphabetical-ish: Sjekklister → Undersøkelser → Dokumenter → Oppgaver → Læring).
- `src/data/documentsNav.ts` — re-use existing space list as the flatSubs source (no new file).

**Reference precedent:** Commit `9e9726b` ("learning: 5.6 + 5.8 + promote to top-level menu" — the e-learning promotion in the same shape).

**Acceptance criteria:**
- [ ] Sidebar shows "Dokumenter" as its own group with the FileText icon.
- [ ] Sub-items: existing space list, plus an Analyse + Innstillinger fixed pair (T2 + T3 fill these in).
- [ ] Existing `/documents` route + sub-routes still resolve.
- [ ] Removed entry from "Gamle moduler" doesn't leave a stale link.
- [ ] TS clean.

**Verification steps:**
1. `npx tsc -b 2>&1 | tail -10`
2. `npx eslint src/components/layout/AticsShell.tsx 2>&1 | tail -10`
3. Visit `/`, confirm Dokumenter appears between Undersøkelser and Oppgaver in the side-nav.
4. Click each sub-link, confirm pages load.

**Open questions:** OQ-D1 (should "Wiki, prosedyrer & maler" stay as the longer label, or shorten to "Dokumenter"? — UX call).

---

### Task T2 · `/documents/analyse` page using ModuleAnalyticsDashboard

**Status:** 📋 not started

**Why this is independent:** New page; uses the dashboard runtime that already
ships across four scopes (compliance, survey, tasks, learning). No DB changes.

**Files to touch:**
- `src/pages/documents/dashboards/documentsDashboardScope.ts` — new file. `registerDashboardScope({ scopeId: 'documents', label: 'Dokumenter', defaultLayout, widgetCatalog, datasets, accent: '#0f766e' /* deep teal — distinct from learning */ })`. Datasets in §6.
- `src/pages/documents/dashboards/useDocumentsDatasets.ts` — new file. Computes the datasets map from `useDocuments` + `wiki_pages` + `document_org_templates`. Mirrors the shape of `useChecklistDatasets`.
- `src/pages/documents/DocumentsAnalysePage.tsx` — new file. Mirrors `LearningAnalysePage.tsx`. Uses `useDocuments` + `useDashboardLayout` + `getDashboardScope` for accent.
- `src/App.tsx` — `<Route path="documents/analyse" element={<DocumentsAnalysePage />} />`.
- `src/pages/documents/DocumentsHome.tsx` — header "Analyse" button (BarChart3 icon, secondary variant) matching the size used on other module headers.

**Reference precedent:** Commits `94eabeb` (learning T4) + `7cab6f9` (compute-as-a-hook).

**Acceptance criteria:**
- [ ] `/documents/analyse` opens. Header shows DashboardChooser inline with the title (3.2.3 already available).
- [ ] Default layout: 4-up KPI strip (total / published / pending review / retention overdue) → published-over-time line → status donut → space distribution bar → top-templates bar.
- [ ] Edit Layout drag works; saving persists across reload.
- [ ] Add Widget catalog populates from the registered scope.
- [ ] CSV export works on every widget (3.4.1 already shipped).
- [ ] No regressions on other analyse pages.
- [ ] TS + lint clean.

**Verification steps:**
1. `npx tsc -b 2>&1 | tail -10`
2. `npx eslint src/pages/documents/dashboards/*.ts src/pages/documents/DocumentsAnalysePage.tsx 2>&1 | tail -10`
3. Visit `/documents/analyse`. KPI tiles render with non-zero values when pages exist.
4. Save layout change, hard reload, layout persists.
5. Smoke-test the four sibling analyse pages — still work.

**Open questions:** OQ-D2 (which timestamp drives "published-over-time"? `published_at`, `created_at`, or `updated_at`? — affects whether unpublished revisions show up in the trend).

---

### Task T3 · Analytics filter dimensions for documents

**Status:** 📋 not started

**Why this is independent:** Pure addition to T2's page. Adds chip dimensions
without touching the dataset compute.

**Files to touch:**
- `src/pages/documents/DocumentsAnalysePage.tsx` — add the `dimensions` array.
- `src/pages/documents/dashboards/useDocumentsDatasets.ts` — extend `buildSelectors` to consume the new dimensions.

**Dimensions:**
- **Space** (`enum`, in/is_not) — `loadOptions` from `useDocuments.spaces`.
- **Template** (`enum`, in/is_not) — `loadOptions` from `useDocuments.templates`.
- **Status** (`enum`, in/is_not) — `draft / published / archived`.
- **Retention** (`enum`, is) — `overdue / due_30d / due_60d / due_90d / future` (synthesised from `wiki_pages.next_review_at`).
- **Eier** (`enum`, in) — `loadOptions` from organization members; matches `wiki_pages.owner_user_id`.
- **Periode** (`date_range`, between/after/before) — applies to the chosen timestamp from OQ-D2.

**Reference precedent:** Commit `94eabeb` (learning T4 dimensions) — same six-dimension shape.

**Acceptance criteria:**
- [ ] All six dimensions appear in "+ Filter" picker.
- [ ] Adding a chip narrows every widget consistently.
- [ ] "Retention: overdue" lists only pages whose `next_review_at < now()`.
- [ ] Chip state persists in `dashboard_layouts.filters`.

**Verification steps:**
1. Open `/documents/analyse`, click "+ Filter", confirm all six dimensions surface.
2. Add `Status = published`, confirm KPI counts shift to published-only.
3. Reload — chip is still there.

**Open questions:** none.

---

### Task T4 · Drill-down on documents donut/bar widgets

**Status:** 📋 not started

**Why this is independent:** Tag the existing widget templates with
`drillDimensionId`; add a `handleDrillDown` resolver on the page. No engine
changes (3.2.2 is generic).

**Files to touch:**
- `src/pages/documents/dashboards/documentsDashboardScope.ts` — set `drillDimensionId` on the status donut, space donut/bar, template bar, retention bar.
- `src/pages/documents/DocumentsAnalysePage.tsx` — `handleDrillDown` translates label → option id (status uses static lookup; space/template/retention use the page's loaded data).

**Reference precedent:** Commit `a37b18d` (3.2.2 drill-down on click).

**Acceptance criteria:**
- [ ] Clicking a status slice adds a `Status = X` chip; clicking again removes it.
- [ ] Clicking a space slice adds a `Space = Y` chip.
- [ ] Re-clicking the same slice toggles the chip off.
- [ ] Module-specific dimensions resolve correctly.

**Verification steps:**
1. On `/documents/analyse`, click "Publisert" slice on the status donut → chip appears, every widget narrows.
2. Click again → chip is removed.

**Open questions:** none.

---

🛑 **Checkpoint after Phase A** (PLAYBOOK §6) — get sign-off before Phase B.

Phase A is the natural ship surface: Documents now reads like its peers in the
main menu, has a working analyse page with chooser + CSV + drill-down, and
re-uses the existing engine end-to-end. No DB changes have happened yet.

---

### Task T5 · `nav_pinned` on document_org_templates

**Status:** 📋 not started

**Why this is independent:** Schema-only migration; behaviour change only when
T6 reads the column.

**Files to touch:**
- `supabase/migrations/<next>_documents_nav_pinned.sql` — `alter table public.document_org_templates add column if not exists nav_pinned boolean not null default false;` plus a partial index for the sidebar query.
- `src/hooks/useDocuments.tsx` — extend `DocumentTemplate` type with `navPinned: boolean`; map it in the loader; expose a `setNavPinned(id, pinned)` mutation.
- `src/types/documents.ts` — type addition.

**Reference precedent:** Migration `archive/20260811120200_survey_org_templates_and_provision.sql` — same `nav_pinned boolean default false` + partial index pattern.

**Acceptance criteria:**
- [ ] Migration runs idempotently on a fresh DB.
- [ ] `setNavPinned(id, true)` flips the column; the row reflects the change after a refresh.
- [ ] Existing rows default to `false`.

**Verification steps:**
1. `psql ... -f supabase/migrations/<next>_documents_nav_pinned.sql` — runs cleanly twice.
2. `select count(*) from document_org_templates where nav_pinned = true;` returns 0 immediately after the migration.
3. Open the templates settings page; toggle a template; refresh; toggle persists.

**Open questions:** OQ-D3 (does the existing admin UI already have a place for this toggle, or do we need a new "Pin to sidebar" control? Likely new).

---

### Task T6 · `useDocumentNav` hook + sidebar pinned-templates render

**Status:** 📋 not started

**Why this is independent:** Pure consumer of T5's column; no DB writes here.

**Files to touch:**
- `src/hooks/useDocumentNav.ts` (NEW) — mirrors `modules/survey/useSurveyNav.ts`. Selects `document_org_templates` rows where `nav_pinned = true and is_active = true and deleted_at is null` joined with `document_system_templates`. Returns `{ items, categories }` where categories = `wiki_spaces` containing pinned templates.
- `src/components/layout/AticsShell.tsx` — feed `useDocumentNav` into `documentsGroup.modules[0].subs`. Pinned templates render below the fixed Analyse + Innstillinger children, grouped by space (using the existing `kind: 'header'` SubItem pattern).

**Reference precedent:** AticsShell.tsx surveyGroup builder + commit `9e9726b`.

**Acceptance criteria:**
- [ ] Pinning a template in admin makes it appear in the sidebar within one reload.
- [ ] Templates group by space header in the sidebar.
- [ ] Single-space mode (only one space has pins) skips the header rows for visual cleanliness — same as `surveyPinnedSubs`.
- [ ] Permission gate (`DOCUMENTS_NAV_PERMS`) keeps view-only roles able to see pinned templates.

**Verification steps:**
1. In admin, pin two templates from two different spaces. Reload `/`.
2. Sidebar shows two space headers, each with the pinned template under it.
3. Unpin one — that entry disappears on next reload.

**Open questions:** none.

---

### Task T7 · Provision bundle migration (recovery)

**Status:** 📋 not started

**Why this is independent:** Pure migration; no app code changes.

**Files to touch:**
- `supabase/migrations/<next>_documents_provision_bundle.sql` — mirror of `20260828120031_survey_provision_bundle.sql`. Two steps:
  1. Re-run `provision_documents_baseline_for_org` for every active (org, ?) — but documents has no per-org "pack" concept. Fall back to: re-mirror `document_system_templates` rows where `is_system = true and is_active = true` into `document_org_templates` for every org, idempotent via the existing `(organization_id, system_template_id)` UNIQUE.
  2. Force-pin pristine rows (`updated_at <= created_at + interval '1 second'`) where `nav_pinned = false`.

**Reference precedent:** Migration `20260828120031_survey_provision_bundle.sql`.

**Acceptance criteria:**
- [ ] Migration runs idempotently. Re-running on an already-provisioned DB is a no-op.
- [ ] Orgs that previously had zero `document_org_templates` rows get them after this migration.
- [ ] Admin-touched rows (where `updated_at > created_at + 1s`) keep their `nav_pinned` choice.

**Verification steps:**
1. On a test DB with the old state: `select count(*) from document_org_templates where organization_id = '<test-org>'` returns 0.
2. Apply migration; same query returns the system catalog row count.
3. `select count(*) from document_org_templates where nav_pinned = true;` is non-zero.
4. Run the migration again; no row counts change.

**Open questions:** OQ-D4 (does `provision_documents_baseline_for_org` exist already, or does T7 create it? If it doesn't exist, the bundle creates the function alongside the backfill).

---

🛑 **Checkpoint after Phase B** (PLAYBOOK §6) — sign-off before Phase C.

---

### Task T8 · `metadata_schema` on document_org_templates + `metadata` on wiki_pages

**Status:** 📋 not started

**Why this is independent:** Schema-only migration; behaviour only changes when
T9 reads the columns.

**Files to touch:**
- `supabase/migrations/<next>_documents_metadata_schema.sql` —
  - `alter table public.document_org_templates add column if not exists metadata_schema jsonb not null default '{"fields":[]}'::jsonb;`
  - `alter table public.wiki_pages add column if not exists metadata jsonb not null default '{}'::jsonb;`
- `src/types/documents.ts` — extend `DocumentTemplate` with `metadataSchema: TemplateMetadataSchema | null` (re-export from `modules/compliance/types`); extend `WikiPage` with `metadata: Record<string, unknown>`.
- `src/hooks/useDocuments.tsx` — map both columns; expose `setPageMetadata(pageId, metadata)`.

**Reference precedent:** Migration `20260828120030_learning_progress_orgcontext_snapshot.sql` (sections 2 + 3, same pattern).

**Acceptance criteria:**
- [ ] Both columns exist after migration.
- [ ] Default values are valid JSON (`{"fields":[]}` and `{}`).
- [ ] Migration is idempotent.

**Verification steps:**
1. `select column_name, data_type from information_schema.columns where table_name in ('document_org_templates','wiki_pages') and column_name in ('metadata_schema','metadata');`
2. `select metadata_schema from document_org_templates limit 1;` returns `{"fields":[]}`.
3. Re-run migration — no errors.

**Open questions:** OQ-D5 (default `metadata_schema` field set per template kind — should HMS-procedure templates default to `legal_basis` + `next_review_date`? Worth seeding via a follow-up if so).

---

### Task T9 · Schema-driven panel in DocumentEditorWorkbench

**Status:** 📋 not started

**Why this is independent:** UI-only; reads T8's columns.

**Files to touch:**
- `src/pages/documents/DocumentMetadataPanel.tsx` (NEW) — mirrors `LearningCompletionMetadataPanel`. Renders the schema-driven panel above the body. Free-form fields persist into `wiki_pages.metadata`.
- `src/components/documents/DocumentEditorWorkbench.tsx` — slot the new panel above the editor body when the page was created from a template that has a non-empty `metadata_schema`.

**Reference precedent:** `src/pages/learning/LearningCompletionMetadataPanel.tsx` (commit `9e9726b`).

**Acceptance criteria:**
- [ ] Pages created from a template with `metadata_schema.fields.length > 0` show the panel.
- [ ] Pages without a template, or with an empty schema, render the editor unchanged.
- [ ] Editing a free-form field persists into `wiki_pages.metadata` on blur.
- [ ] Built-in field kinds (`location`, `department`, `team`) display the value if set on the page; surface a "ikke valgt" placeholder otherwise. (Documents don't store FK columns, so these read from `wiki_pages.metadata` too.)

**Verification steps:**
1. Open a page created from a template with `metadata_schema = '{"fields":[{"key":"legal_basis","kind":"text","label":"Lovgrunnlag"}]}'`.
2. Confirm the field renders above the body.
3. Type a value, blur the input — `select metadata from wiki_pages where id = '<page-id>'` shows the saved value.

**Open questions:** OQ-D6 (does the existing `DocumentEditorWorkbench` already have a "header" slot we can compose into, or does T9 add one?).

---

### Task T10 · Admin authoring UI in DocumentTemplatesSettings

**Status:** 📋 not started

**Why this is independent:** Adds a panel on the existing admin page; reads/writes T8's column.

**Files to touch:**
- `src/pages/documents/DocumentMetadataSchemaEditor.tsx` (NEW) — mirrors `LearningMetadataSchemaEditor`. Inline editor (not slide panel) with field kind picker + add/remove/reorder controls.
- `src/pages/documents/DocumentTemplatesSettings.tsx` — slot the new editor into the per-template settings drawer / form.

**Reference precedent:** `src/pages/learning/LearningMetadataSchemaEditor.tsx` (commit `9e9726b`).

**Acceptance criteria:**
- [ ] Admin can add / rename / reorder / delete metadata fields per template.
- [ ] Save round-trips through `useDocuments.updateTemplate({ metadataSchema })`.
- [ ] Reload — the edited schema persists.

**Verification steps:**
1. Open the templates admin, pick a template, click "Hoveddata-felt".
2. Add a "Tekst" field with key `legal_basis`.
3. Save, reload, field is still there.
4. Open a page from this template — the field surfaces (T9 verification).

**Open questions:** none.

---

🛑 **Checkpoint after Phase C** — Documents has full architectural parity with
its peers. Phase D items below land opportunistically.

---

### Task T11 · Comparison-mode datasets

**Status:** 📋 not started

**Why this is independent:** Pure additive datasets + flagging on existing
KPI / line widgets. Mirrors `learning_kpi_summary_prev` /
`learning_completions_over_time_prev`.

**Files to touch:**
- `src/pages/documents/dashboards/useDocumentsDatasets.ts` — compute `documents_kpi_summary_prev` (yoy YTD published count) and `documents_published_over_time_prev` (months 23..12 ago).
- `src/pages/documents/dashboards/documentsDashboardScope.ts` — add `comparisonDatasetKey` + `comparisonValuePath` to the YTD KPI; `comparisonPointsPath` to the published-over-time line.

**Reference precedent:** Commit `ae618e9` (3.2.1 comparison mode on learning + compliance).

**Acceptance criteria:**
- [ ] YTD-published KPI shows ▲/▼ delta vs same period last year.
- [ ] Published-over-time line renders a dashed comparison series.
- [ ] CSV export of the KPI carries both values.

---

## 6 · Datasets the documents scope publishes

| Key | Shape | Bucket logic |
|---|---|---|
| `documents_kpi_summary` | `kpi-record` | `{ totalPages, published, pendingReview, retentionOverdue, accessRequestsOpen }` |
| `documents_status_distribution` | `segments` | `{ Kladd, Publisert, Arkivert }` |
| `documents_space_distribution` | `segments` | per `wiki_spaces.name` |
| `documents_top_templates` | `segments` | top 8 templates by page count |
| `documents_retention_buckets` | `segments` | `{ Overdue, Innen 30d, 30–60d, 60–90d, 90d+ }` |
| `documents_published_over_time` | `series` | last 12 months by `published_at` (or chosen ts per OQ-D2) |
| `documents_kpi_summary_prev` | `kpi-record` | `{ ytdPublished }` for the equivalent window last year (T11) |
| `documents_published_over_time_prev` | `series` | months 23..12 ago (T11) |

---

## 7 · Acceptance criteria for the *whole* port

After T1-T10 ship:
- [ ] Sidebar shows Dokumenter as its own group with FileText icon, alongside Sjekklister / Undersøkelser / Oppgaver / Læring.
- [ ] `/documents/analyse` is the canonical analytics surface, with chooser + CSV + drill-down + filter chips.
- [ ] Pinned templates surface in the sidebar.
- [ ] Schema-driven panel works end-to-end (admin authors, learner sees, value persists).
- [ ] Provision bundle recovers orgs with empty `document_org_templates`.
- [ ] No regressions on the four sibling analyse pages.
- [ ] `ROADMAP.md` gets a documents row flipping items to ✅.

T11 (comparison mode) ships when convenient — not in the parity-port scope.

---

## 8 · Migration sequence (suggested timestamps)

```
<ts+0> documents_nav_pinned.sql                (T5)
<ts+1> documents_provision_bundle.sql          (T7)
<ts+2> documents_metadata_schema.sql           (T8)
```

All three are additive `add column if not exists` + idempotent backfill — safe
to apply in sequence to a deployed DB.

---

## 9 · Open questions

| ID | Question | Default if no answer |
|---|---|---|
| OQ-D1 | Sidebar label: "Dokumenter" or "Wiki, prosedyrer & maler"? | Keep "Dokumenter" as the group label; full label as tooltip. |
| OQ-D2 | Which timestamp drives `published_over_time`? `published_at`, `created_at`, or `updated_at`? | `published_at` (matches the user-facing event). |
| OQ-D3 | Is there an existing "Pin to sidebar" control on the template admin, or does T6 add one? | Add one — single toggle next to "Aktiv". |
| OQ-D4 | Does `provision_documents_baseline_for_org()` already exist? | Assume no; T7 creates it. |
| OQ-D5 | Default seeded `metadata_schema` per template kind? | Defer; ship empty default, layer presets later. |
| OQ-D6 | Header slot in DocumentEditorWorkbench — exists, or does T9 add it? | Inspect first; add a `headerSlot` prop if absent. |
| OQ-D7 | Should documents use the dashboard accent flip when a `?pack=` is in the URL (mirroring compliance), or just one fixed scope accent? | Fixed `#0f766e`. Spaces are not packs; pack-flip would be misleading. |

Resolve before flipping spec status to `📋 ready`.

---

## 10 · Senior architect review checklist (PLAYBOOK §7)

- [ ] **Reference precedent linked** for every task. ✅
- [ ] **Vertical slices verified** — each task touches DB → types → hook → UI → discovery in one go. ✅ (T5 + T8 are migration-only because their consumer tasks T6 + T9 follow as the next slice.)
- [ ] **Dependency graph is a DAG** — no cycles. ✅ (see §4)
- [ ] **Acceptance criteria are observable**, not implementation-coloured. ✅
- [ ] **Open questions enumerated** at the top of the spec. ✅ (§9)
- [ ] **Migrations are reversible or idempotent.** ✅ (all three are `add column if not exists` + idempotent backfills)
- [ ] **The module-specific spec runs without reading the playbook again.** ✅ (mapping table + capability map duplicated; PLAYBOOK only needed for the senior-review meta-rules)
- [ ] **The playbook stays generic.** ✅ (D-1 / D-2 / D-3 are documents-specific extensions, kept here)

Once OQs §9 are resolved, flip status from `📋 ready to execute` → `🚧 in flight` and start at T1.
