# Roadmap

Living catalogue of every feature discussed in the recent compliance / surveys / analytics work — what's shipped, what's in flight, what's deferred and why. Status snapshot reflects HEAD of `main`.

Legend: ✅ shipped · 🚧 in flight · 📋 planned · ⏸ explicitly deferred (with reason)

---

## 1. Compliance Checklists

The first module reshaped around the "template-as-first-class" model.

| # | Status | Item | Notes |
|---|---|---|---|
| 1.1 | ✅ | Neutral `/compliance/checklists` hub | Tile grid by pack with template tiles. No silent fallback to `packs[0]`. |
| 1.2 | ✅ | Per-template page mode (`?template=…`) | Title, breadcrumb, KPI labels, and execution list reflect the template. |
| 1.3 | ✅ | Per-template KPI counts | `reloadAggregates` accepts a `templateId` filter; race-free deps via stable string ids. |
| 1.4 | ✅ | Stay-on-template after sign | Sign navigates to `?template=…&pack=…`; "Tilbake" mirrors. |
| 1.5 | ✅ | Amendable execution metadata after sign | Title, summary, attendees, scheduled, assigned editable post-sign; sign trigger relaxed to allow specific columns; `attendees text[]` column. |
| 1.6 | ✅ | Sidebar — Settings + Analyse fixed children | Under "Sjekklister", before pinned templates. |
| 1.7 | ✅ | Categories — DB + admin CRUD | `compliance_checklist_categories` table; org+pack scoped; admin "Kategorier" tab. |
| 1.8 | ✅ | Categories — discovery surfaces | Hub tiles grouped by category; sidebar groups have folder icon + chevron toggle; auto-open on active match. |
| 1.9 | ✅ | Self-contained provision bundle | One-file SQL (`20260828120020`) so half-applied environments can converge. |
| 1.10 | 📋 | Per-category icon picker in admin | Today every category uses `FolderTree`. Add an icon column + dropdown in the Kategorier editor. ~half day. |
| 1.11 | 📋 | Drag-to-reorder categories | Today admin sets `position` numerically. Replace with HTML5 drag handle (same pattern as the dashboard editor). ~half day. |
| 1.12 | 📋 | "Save as private layout" for analytics | `dashboard_layouts.owner_user_id` is already in the schema; UI to save/load per-user copies missing. |
| 1.13 | ✅ | Execution org-context (location / department / team) + participants | Migration `20260828120024`; typed FK columns + `metadata jsonb` for free-form. Sign trigger relaxed to allow these post-sign. |
| 1.14 | ✅ | Template `metadata_schema` (per-template field declarations) | Templates declare which fields apply (`location`, `department`, `team`, `participants`, `text`, `number`, `select`); execution editor renders accordingly. |
| 1.15 | ✅ | Schema-driven ExecutionMetadataPanel | Per-template fields surface alongside universal fields. Free-form attendees kept for non-system / external participants. |
| 1.16 | ✅ | Analytics filters: Lokasjon, Avdeling, Deltaker | Plus `checklist_executions_by_location` / `_by_department` datasets and donut/bar widgets in the catalog. |
| 1.17 | 📋 | Asset / object dimension | When the org introduces an "asset" model (machines, vehicles, premises items), wire a `metadata_schema` `kind: 'asset'` against an `assets` table — same shape as location. |

---

## 2. Surveys — parity port

Mirror the entire checklist reshape on `/survey`. Architecture is in place; the work is mostly mechanical rewrite of the same pieces against `useSurvey`.

| # | Status | Item | Notes |
|---|---|---|---|
| 2.1 | ✅ | Neutral hub + per-template reframing | Earlier commit `e2db7d4` — done. |
| 2.2 | ✅ | Stay-on-template after submit | Same commit. |
| 2.3 | ✅ | `surveys.catalog_id` link column | Migration `20260828120018`. |
| 2.4 | ✅ | Amendable metadata via SurveyMetadataPanel (post-close edits) | T6 — `74f24eb`. |
| 2.5 | ✅ | Survey analytics page | T4 — `4c1bbc4`. Honest gap: response-rate KPIs are 0 placeholder until response_count lands on the row or a server-side aggregate ships. |
| 2.6 | ✅ | Survey categories | T1 — `9db20ec`. Structured `survey_template_categories` table; per-OQ-1 attaches to `survey_org_templates`. |
| 2.7 | ✅ | Sidebar — Analyse + Innstillinger fixed children + collapsible category groups | T2+T3 — `1d4492a`. |
| 2.8 | ✅ | Survey scope dimensions | T7 — adds Pakke / Mal / Status / Kategori / Lokasjon / Avdeling / Deltaker / Anonymitet / Periode. |
| 2.9 | ✅ | Admin authoring UI for `metadata_schema` on survey_org_templates | `25c6acb`. New "Hoveddata" column on `SurveyMalerOpsCard` opens a slide panel with category dropdown + field editor + recommended-preset button per pack. |
| 2.10 | ✅ | Response-count + response-rate aggregates | `surveys.response_count` + `surveys.invitation_count` cached columns maintained by AFTER INSERT/DELETE triggers (migration `20260828120028`). KPI tiles + responses-over-time line now reflect real data. |

**Suggested order of work for survey port:** 2.5 (analytics — biggest visible gain) → 2.6 (categories — lots of leverage) → 2.7 (sidebar) → 2.4 (metadata edits — low traffic).

**Survey port executed:** all items 2.1–2.10 done. See `specs/survey-parity.md` for the original plan.

---

## 4 · Tasks (Oppgaver) — parity port (planned)

Materially smaller than survey because tasks have different bones (jsonb store, source-type as categorisation, no template concept). See `specs/tasks-parity.md` for the executable plan.

| # | Status | Item | Notes |
|---|---|---|---|
| 4.1 | 📋 | `/tasks/management/analyse` page using ModuleAnalyticsDashboard | Tasks T1 in the spec. |
| 4.2 | 📋 | Filter dimensions: status, module, source, priority, assignee, due-window, department-via-employee-join | Tasks T2. |
| 4.3 | 📋 | Sidebar fixed Settings + Analyse children under "Oppgaver" | Tasks T3. |
| 4.4 | ⏸ | Categories — explicitly skipped | `sourceType` enum already segments tasks; a parallel category table would shadow the enum. |
| 4.5 | ⏸ | Org-context FKs / metadata_schema — explicitly skipped | Tasks live in jsonb; no normalised row to ALTER. |

**Estimated effort:** ~1 day (no DB; reuses the dashboard engine).

---

## 5 · E-learning — parity port (planned)

Most parity-friendly of the three remaining modules. See `specs/elearning-parity.md`.

| # | Status | Item | Notes |
|---|---|---|---|
| 5.1 | 📋 | `learning_categories` table + admin tab | Learning T1. Default seeds: HMS-grunnopplæring, Brann, Førstehjelp, Verneombud, Onboarding, Eksterne kurs. |
| 5.2 | 📋 | Categories on LearningCoursesList + sidebar | Learning T2. |
| 5.3 | 📋 | Sidebar fixed Settings + Analyse children under "Læring" | Learning T3. |
| 5.4 | 📋 | `/learning/analyse` page + scope registration | Learning T4. |
| 5.5 | 📋 | Snapshot org-context columns on `learning_course_progress` | Learning T5. Immutable snapshot at completion (preserves audit trail across employee transfers). |
| 5.6 | 📋 | Course `metadata_schema` + dynamic completion panel | Learning T6. Default fields: external_cert_id, external_hours, practical_test_score, provider. |
| 5.7 | 📋 | Analytics dimensions including certification-expiry | Learning T7. The genuinely-new dimension specific to e-learning. |
| 5.8 | ⏸ | `kind: 'heatmap'` widget engine extension | Learning E-1. Standalone, lands when convenient; users × courses matrix benefits everywhere. |

**Estimated effort:** ~2 days for the port; heatmap widget +1 day if/when it lands.

---

## 3. Analytics Dashboard Engine

Reusable runtime that any module registers a "scope" with and consumes via `ModuleAnalyticsDashboard`.

### 3.1 Foundation — ✅ shipped

| # | Status | Item |
|---|---|---|
| 3.1.1 | ✅ | `ModuleAnalyticsDashboard` runtime |
| 3.1.2 | ✅ | `dashboardRegistry` with `defaultLayout` + `widgetCatalog` + `datasets` + `dimensions` |
| 3.1.3 | ✅ | `dashboard_layouts` table (RLS, org+scope+slug+owner) — migration `20260828120023` |
| 3.1.4 | ✅ | `useDashboardLayout` (load / save / reset / per-user fallthrough) |
| 3.1.5 | ✅ | 12-col responsive grid + `colSpan` + `rowBreak` |
| 3.1.6 | ✅ | Widget kinds: `kpi`, `bar`, `donut`, `line`, `table` |
| 3.1.7 | ✅ | Open `ReportDatasetKey` to free string |
| 3.1.8 | ✅ | Scope datasets metadata (`DatasetMeta`) |
| 3.1.9 | ✅ | Scope dimensions metadata (`DashboardDimension`) |
| 3.1.10 | ✅ | Filter chip bar (`DashboardFilterBar`) — chips persisted on `dashboard_layouts.filters` |
| 3.1.11 | ✅ | Drag-and-drop reorder in Edit Layout |
| 3.1.12 | ✅ | Live preview in Widget editor |
| 3.1.13 | ✅ | Lossless kind switching via `_archive` slot |
| 3.1.14 | ✅ | "..." popover menu (Edit / Duplicate / Remove) |
| 3.1.15 | ✅ | Soft skeleton empty states |

### 3.2 High-impact next steps — 📋 planned

| # | Item | Why |
|---|---|---|
| 3.2.1 | **Comparison mode** ("this period vs last period" delta on KPI) | Single most impactful add-on for management reporting. KPI tile gains a delta + sparkline; line widget can render two series side-by-side. |
| 3.2.2 | **Drill-down on click** | Clicking a donut slice / bar segment pre-filters the dashboard to that slice (or opens the source list). Needs a per-widget `onSliceClick` policy in the registry. |
| 3.2.3 | **Save / load named dashboards** | Schema already supports it via `slug` + `owner_user_id`. UI: chooser dropdown next to the page title, "Save as", "Save as private copy", rename, delete. |
| 3.2.4 | **Per-user private layouts** | `owner_user_id` column exists; UI for "make this my private view" missing. |
| 3.2.5 | **Drag-to-resize** | Today widgets resize via the editor's colSpan dropdown. Adds a corner handle for direct manipulation. Requires careful interaction with the rowBreak hint. |
| 3.2.6 | **Auto subtitle from filters** | Synthesise the "Last 12 months · Grouped by Pack" line from active filters + dataset shape. Right now subtitle is free text the admin types. |
| 3.2.7 | **Dataset-shape-aware "Add Widget"** | Catalog already declares dataset shapes; picker could group by what kinds the data supports and offer "kpi or table" choices on add. Needs `compatibleKinds: ReportModuleKind[]` on each catalog entry. |

### 3.3 Cross-module — ⏸ deferred

| # | Item | Why deferred |
|---|---|---|
| 3.3.1 | **Composite scopes** ("HMS Overview" mixing checklist + survey + avvik on one dashboard) | The registry is per-scope; we need a *composite* scope model that can pull datasets from multiple registered scopes, plus filter dimensions that apply across them. Worth designing only after a second module (survey) is registered so the abstraction has two real consumers. |
| 3.3.2 | **Cross-scope filters** | A "Period" filter applied at composite level should fan out into each scope's `applyFilters`. Same dependency. |

### 3.4 Outputs — 📋 planned

| # | Item | Notes |
|---|---|---|
| 3.4.1 | **CSV export per widget** | Add a CSV download to the "..." menu. Tables map directly; bar/donut export the underlying segment table; KPI exports the value + filter context. |
| 3.4.2 | **PDF export of the whole dashboard** | Print-friendly stylesheet, use a server-side render or `html2canvas`. Lower priority — PDF is heavy and people generally screenshot. |
| 3.4.3 | **Scheduled email reports** | `report_runs` table from the older custom-reports stack already exists in archive. Wire a cron sender that re-renders a saved layout into HTML and emails it. Out of scope until 3.2.1–3.2.4 land. |
| 3.4.4 | **Public share link** | Hash-token URL that exposes a read-only render of a single dashboard layout. RLS implications need careful design. |

### 3.5 Engineering quality — 📋 planned

| # | Item | Notes |
|---|---|---|
| 3.5.1 | **Dataset compute as a hook** | Today the page builds `datasets` and re-computes on filter change. As the dataset count grows, move per-dataset compute into selectors a hook can compose, with a single shared filter-application function. |
| 3.5.2 | **Drop reliance on `crypto.randomUUID` polyfill in pages** | Centralise id minting in `dashboardRegistry.instantiateWidget` and a sibling `freshFilterId` so pages don't reimplement. |
| 3.5.3 | **Storybook coverage for every widget kind** | Currently only end-to-end via `/compliance/checklists/analyse`. Add a stories file that exercises each kind × empty/short/long data so design regressions surface fast. |
| 3.5.4 | **Server-side aggregates for big orgs** | `useChecklistModule.reloadAggregates` runs four count queries; with 50 widgets this becomes the bottleneck. Move to a single `compliance_checklist_aggregates` view (or RPC) that returns every metric the registered scope needs. |

---

## 4. Cross-cutting platform improvements

| # | Status | Item | Notes |
|---|---|---|---|
| 4.1 | 📋 | Real drag-and-drop library | Today the Edit Layout panel uses native HTML5 drag-and-drop. For multi-column or grouped reordering (and accessibility), bring in `@dnd-kit/core`. Defer until we actually hit the limitation. |
| 4.2 | 📋 | Surface "saved view" chooser in module headers | Once 3.2.3 lands, every analyse page gets a dropdown next to the title like the reference designs ("Recruitment Overview ▼"). |
| 4.3 | 📋 | Audit log for dashboard edits | `dashboard_layouts.version` bumps on every save but we don't expose history. Useful for "who broke the dashboard?" forensics. Mirrors `compliance_template_versions` shape. |
| 4.4 | 📋 | Light/dark accent themes | `accent` is already a prop. Wire it to the org's `compliance_pack` colour palette so AML and ISO dashboards visually differ. |
| 4.5 | 📋 | Mobile dashboard pass | The 12-col grid collapses cleanly to single column at `<lg` but the editor and filter-chip popovers haven't been tested on touch. |

---

## Suggested order of work

If picking up cold, do these in this order — each builds on the previous and exposes any abstraction problems early:

1. **Survey analytics page (2.5)** — second consumer of the engine, biggest source of architectural pressure.
2. **Survey categories (2.6)** — replicates the checklist taxonomy work; cheap once 2.5 is in.
3. **Comparison mode (3.2.1)** — biggest UX value-add for management reporting.
4. **Save / load named dashboards (3.2.3) + chooser (4.2)** — unlocks "Vernerunder fokus", "Onboarding KPI" etc. without forking the page.
5. **Drill-down (3.2.2)** — once chips + named dashboards work, drill-down is just chip pre-population.
6. **Composite scopes (3.3.1)** — last, because the abstraction needs two healthy real consumers.

Items not in this list can land opportunistically — they're either too small to plan around (3.5.x polish) or too speculative without more user data (3.4.x outputs).
