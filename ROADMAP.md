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
| 1.10 | 📋 | Per-category icon picker in admin | Today every category uses `FolderTree`. Needs `icon text` column added to compliance_checklist_categories / survey_template_categories / learning_categories (wiki_spaces already has it), nav-hook reads, sidebar resolver from icon-name → Lucide component, and icon-picker UI on each admin page. Defer until we have a half-day window — multi-touch. |
| 1.11 | ✅ | Drag-to-reorder categories | New shared `CategoryReorderList<T>` (`src/components/categories/CategoryReorderList.tsx`) with HTML5 grip handle on `sm+` and up/down arrow buttons on `<sm` for touch — same pattern as the 4.5 mobile pass. Wired on the three category admin surfaces (`KategorierTab.tsx` × compliance, `SurveyKategorierTab.tsx`, `LearningKategorierSection.tsx`); each maps the new id order to `(idx + 1) * 10` positions and runs the diff through the existing `updateCategory({ id, position })` hook. The numeric "Posisjon" input in each editor panel stays as a fallback. |
| 1.12 | ✅ | "Save as private layout" for analytics | Shipped in 3.2.3/3.2.4 — `DashboardChooser` carries "Lagre som privat kopi" action; saved private rows appear under "Mine private visninger" in the dropdown. `useDashboardLayout.saveAs({ isPrivate: true })` writes `owner_user_id = me`. |
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

## 4 · Tasks (Oppgaver) — parity port

Executed: see `specs/tasks-parity.md` and commit `6bd167e`.

| # | Status | Item | Notes |
|---|---|---|---|
| 4.1 | ✅ | `/tasks/management/analyse` page using ModuleAnalyticsDashboard | Tasks T1. |
| 4.2 | ✅ | Filter dimensions: status, module, source, priority, assignee, due-window, department-via-employee-join | Tasks T2. |
| 4.3 | ✅ | Sidebar Analyse entry under Oppgavestyring | Tasks T3. |
| 4.4 | ⏸ | Categories — explicitly skipped | `sourceType` enum already segments tasks; a parallel category table would shadow the enum. |
| 4.5 | ⏸ | Org-context FKs / metadata_schema — explicitly skipped | Tasks live in jsonb; no normalised row to ALTER. |

---

## 5 · E-learning — parity port

Executed: see `specs/elearning-parity.md`.

| # | Status | Item | Notes |
|---|---|---|---|
| 5.1 | ✅ | `learning_categories` table + admin tab | Learning T1 — `9a6b3d7`. Default seeds: HMS-grunnopplæring, Brann, Førstehjelp, Verneombud, Onboarding, Eksterne kurs. |
| 5.2 | ✅ | Categories on LearningCoursesList | Learning T2 — `351c8fb`. List groups courses by category with section headings + count chips. |
| 5.3 | ✅ | Sidebar Analyse entry under "Kurs, læringsløp & sertifiseringer" | Learning T3 — `351c8fb`. |
| 5.4 | ✅ | `/learning/analyse` page + scope registration | Learning T4 — `94eabeb`. Six filter dimensions including the e-learning-unique Utløp (certification expiry) chip. |
| 5.5 | ✅ | Snapshot org-context columns on `learning_course_progress` | Learning T5 — `b970e4c`. Trigger snapshots user's org_member row at the completed_at transition; idempotent. |
| 5.6 | ✅ | Course `metadata_schema` + dynamic completion panel | Learning T6 — DB columns + types in `b970e4c`; UI now ships in `LearningCompletionMetadataPanel` (player) + `LearningMetadataSchemaEditor` (course builder, Sertifisering tab). Free-form fields persist into `learning_course_progress.metadata`; built-in kinds (location/department/team) read the trigger-snapshot. |
| 5.7 | ✅ | Analytics dimensions including certification-expiry | Wired in T4 (Utløp chip uses Course.recertificationMonths + Certificate.issuedAt). |
| 5.8 | ✅ | `kind: 'heatmap'` widget engine extension | Learning E-1. New `ReportModuleHeatmap` kind in `src/types/reportBuilder.ts`, inline-SVG renderer in `ReportModuleWidget.tsx`, dataset key `learning_completions_by_user_heatmap`, catalog entry `heatmap-user-completions` (Brukere × kurs — fullføring). Generic — any scope can register a heatmap dataset. |
| 5.9 | ✅ | Promote E-læring to top-level menu group | Sidebar group `id: 'laring'` injected next to Sjekklister + Undersøkelser; legacy entry removed from "Gamle moduler". `LEARNING_NAV_PERMS` mirrors the broad permAny pattern. |

---

## 6 · Documents (Wiki, prosedyrer & maler) — parity port

Executed: see `specs/documents-parity.md`.

| # | Status | Item | Notes |
|---|---|---|---|
| 6.1 | ✅ | Promote to top-level NavGroup | T1 — Sidebar group `id: 'dokumenter'` (FileText icon) injected between Undersøkelser and Oppgaver. `DOCUMENTS_NAV_PERMS` gates a flatSubs list with fixed Analyse + Innstillinger plus existing Oversikt / Samsvar / Dokumentmaler / Årsgjennomgang. |
| 6.2 | ✅ | `/documents/analyse` page + scope | T2 — Fifth consumer of `ModuleAnalyticsDashboard`. Accent `#0f766e` (deep teal). Six datasets, eleven catalog widgets covering KPI / status / space / retention / templates / over-time. |
| 6.3 | ✅ | Filter dimensions | T3 — Six dimensions: Plass / Mal / Status / Retention / Eier / Periode. Retention buckets compute from `wiki_pages.next_revision_due_at`. |
| 6.4 | ✅ | Drill-down on click | T4 — Status / Plass / Mal / Retention donut + bar widgets are clickable; chip toggles on re-click. |
| 6.5 | ✅ | `nav_pinned` column on `document_org_templates` | T5 — Migration `20260828120032`; `OrgCustomTemplate.navPinned` + `setOrgTemplateNavPinned` mutation. |
| 6.6 | ✅ | `useDocumentNav` + sidebar pinned-templates render | T6 — Pinned templates surface below the fixed sub-list, grouped by category (single-category mode skips headers). |
| 6.7 | ✅ | Provision bundle migration | T7 — `provision_documents_baseline_for_org` ensures every (org, system template) pair has an explicit `document_org_template_settings` row; trigger on `organizations` insert + backfill loop. |
| 6.8 | ✅ | `metadata_schema` on templates + `metadata` on `wiki_pages` | T8 — Migration `20260828120034`; both jsonb columns default to valid literals. Type re-exports from `modules/compliance/types`. |
| 6.9 | ✅ | Schema-driven panel in DocumentEditorWorkbench | T9 — `DocumentMetadataPanel` renders above the body when the page's `metadata.__template_id` resolves to a template with a non-empty schema. Free-form values persist via `setPageMetadata`. |
| 6.10 | ✅ | Admin authoring UI | T10 — Sidebar pin toggle + inline `LearningMetadataSchemaEditor` (module-agnostic) in the customPanelTpl slide-out of `DocumentTemplatesSettings`. |
| 6.11 | ✅ | Comparison-mode datasets | T11 — `documents_kpi_summary_prev` (yoy YTD published) + `documents_published_over_time_prev` (months 23..12 ago). YTD KPI gains a delta chip + sparkline; line widget gains the dashed comparison series. |

---

## 7 · Two-level taxonomy — cross-module overhaul

Executed: see `specs/category-architecture.md`.

| # | Status | Item | Notes |
|---|---|---|---|
| 7.1 | ✅ | Phase A · DB foundation | T1 + T2 + T3. Regulations table + seeds (9 baseline regulations: AML / IK-f / ISO 9001/14001/45001 / Åpenhetsloven / GDPR / Likestillingsloven / NS-EN ISO 19011), `regulation_id` column on the four per-org category tables (compliance / survey / learning / wiki_spaces), deterministic backfill per the OQ-A2 map, same-org coherence trigger, plus `regulationForSource.ts` mapping TaskSourceType + TaskModule → regulation. No UX change — pure foundation. |
| 7.2 | ✅ | Phase B · Top bar + sidebar shape | T4 (RegulationFilterContext + multi-select RegulationFilterMenu — toggles persist to localStorage + URL `?regulations=`; OQ-A3 "Vis alle / Skjul alle" shortcuts) → T5 (regulation filter threaded into compliance/survey/documents nav builders via `regulationId` on category rows; nav-shell deps updated) → T6 (legacy `/tasks` Tasks entry removed from "Gamle moduler"; dead `tasksSubs` definition deleted). RegulationFilterProvider mounted in `App.tsx` so the same active set drives every analyse page later in T8. |
| 7.3 | ✅ | Phase C · Alle X pages + filter fan-out | T8 — regulation filter pre-filters rows on every analyse page (compliance via template→category→regulation, survey via catalog→category→regulation, documents via space.regulationId, tasks via `regulationForSource(sourceType)`, learning via course→category→regulation). T7 — new generic `ModuleAlleListPage<RowT>` shell with search + chip filter strip (status / date-range / module-specific enums per OQ-A6's page-local state) + category-grouped table + active-regulation pre-filter. Five thin instantiations (`ChecklistsAllePage` / `SurveyAllePage` / `DocumentsAllePage` / `TasksAllePage` / `LearningAllePage`); five new routes (`/<module>/{alle \| management/alle}`); "Alle X" entry inserted right below Analyse on each top-level NavGroup. |

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
| 3.1.6 | ✅ | Widget kinds: `kpi`, `bar`, `donut`, `line`, `table`, `heatmap` |
| 3.1.7 | ✅ | Open `ReportDatasetKey` to free string |
| 3.1.8 | ✅ | Scope datasets metadata (`DatasetMeta`) |
| 3.1.9 | ✅ | Scope dimensions metadata (`DashboardDimension`) |
| 3.1.10 | ✅ | Filter chip bar (`DashboardFilterBar`) — chips persisted on `dashboard_layouts.filters` |
| 3.1.11 | ✅ | Drag-and-drop reorder in Edit Layout |
| 3.1.12 | ✅ | Live preview in Widget editor |
| 3.1.13 | ✅ | Lossless kind switching via `_archive` slot |
| 3.1.14 | ✅ | "..." popover menu (Edit / Duplicate / Remove) |
| 3.1.15 | ✅ | Soft skeleton empty states |

### 3.2 High-impact next steps

| # | Status | Item | Notes |
|---|---|---|---|
| 3.2.1 | ✅ | **Comparison mode** ("this period vs last period" delta on KPI) | KPI tile gains an optional delta chip (▲/▼ %, colour driven by `comparisonGoal`) + an inline sparkline; line widget renders an optional dashed comparison series sharing the y-scale. Generic plumbing on the registry — wired on learning ("Fullført i år" + "Fullføringer over tid") and compliance ("Signert i år", "Kritiske funn", both over-time lines) so the comparison spans modules. |
| 3.2.2 | ✅ | **Drill-down on click** | `ReportModuleDonut` / `ReportModuleBar` gain optional `drillDimensionId`. The runtime emits a `DrillDownEvent { module, segmentLabel, dimensionId }` and pages translate the label → option id (page knows the natural lookup). Toggling: re-clicking removes the chip. Tagged widgets ship for compliance (status/severity/pack/template/location/department) and learning (status/category/course/department). |
| 3.2.3 | ✅ | **Save / load named dashboards** | `useDashboardLayout` now exposes `available` / `selectLayout` / `saveAs` / `renameActive` / `deleteActive` / `markActiveDefault`. New `DashboardChooser` renders inline with the page title via the new `titleChooser` slot on `ModuleAnalyticsDashboard`. Wired on all four analyse pages (compliance, survey, tasks, learning). |
| 3.2.4 | ✅ | **Per-user private layouts** | `saveAs({ isPrivate: true })` writes `owner_user_id = me`; the chooser groups them under "Mine private visninger". The query `or` filter shows shared rows + the current user's private rows. |
| 3.2.5 | ✅ | **Drag-to-resize** | `ReportModuleWidget` gains an SE drag handle (visible on hover/focus) that snaps to the four `colSpan` values (sm/md/lg/full) by mapping pointer-x against the 12-col grid width (gap-4 = 16 px). Clicking without dragging cycles to the next size. Wired on all six analyse pages (compliance, survey, tasks, learning, documents, hms-overview) — handler maps to `dashboard.saveLayout(layout.map(x => x.id === w.id ? { ...x, colSpan } : x))`. Below `lg` the grid collapses, so the handle falls back to click-cycle only. `rowBreak` is preserved across resizes. |
| 3.2.6 | ✅ | **Auto subtitle from filters** | New `summariseFilters({ filters, dimensions })` helper renders an italic context line under the analyse-page title (e.g. "Avdeling: 2 · Status: Signert · Periode: 1. jan – 31. des"). `ModuleAnalyticsDashboard` composes it under the page-supplied description; falls through to the description when no filters are active. Reads chip values + dimension labels — no extra plumbing per page. |
| 3.2.7 | ✅ | **Dataset-shape-aware "Add Widget"** | `WidgetCatalogEntry.compatibleKinds?: ReportModuleKind[]` shipped on the registry. Picker gains a "Datakilde" filter dropdown (kpi-record / segments / series / rows) and per-entry kind selector when `compatibleKinds.length > 1`. Falls back to `defaultCompatibleKinds(template.kind)` when an entry doesn't declare its own. |

### 3.3 Cross-module

| # | Status | Item | Notes |
|---|---|---|---|
| 3.3.1 | ✅ | **Composite scopes** | `DashboardScope.compositeMembers?: string[]` declares the member scopes a composite pulls from. New `hms_overview` composite registered in `src/pages/overview/dashboards/hmsOverviewScope.ts`; new `/overview/hms` page (`HmsOverviewPage`) imports each member's `useXxxDatasets` hook, merges the four dataset maps (keys are scope-namespaced so collisions are impossible), and renders one dashboard. Layout/filters persist via the existing `dashboard_layouts` table — composites are just registered scopes. |
| 3.3.2 | ✅ | **Cross-scope filters** | The same `dashboard.filters` array is passed to every member scope's hook. Each hook picks up the chips it understands and ignores the rest, so a single "department" or date-range chip narrows compliance + survey + tasks + learning consistently. The composite page exposes only the dimensions that have meaningful effect across multiple scopes; per-module dimensions stay on the module's own analyse page. |

### 3.4 Outputs

| # | Status | Item | Notes |
|---|---|---|---|
| 3.4.1 | ✅ | **CSV export per widget** | New `src/lib/reports/widgetCsv.ts` serialises any `ReportModule` + `datasets` into a CSV payload (per-kind: KPI = value+comparison; table/bar/donut = labelled rows; line = X/Y; heatmap = 2-D matrix). `DashboardWidgetMenu` exposes "Eksporter CSV"; wired on all four analyse pages with UTF-8 BOM so Excel renders æøå. |
| 3.4.2 | 📋 | **PDF export of the whole dashboard** | Print-friendly stylesheet, use a server-side render or `html2canvas`. Lower priority — PDF is heavy and people generally screenshot. |
| 3.4.3 | 📋 | **Scheduled email reports** | `report_runs` table from the older custom-reports stack already exists in archive. Wire a cron sender that re-renders a saved layout into HTML and emails it. Out of scope until 3.2.1–3.2.4 land. |
| 3.4.4 | 📋 | **Public share link** | Hash-token URL that exposes a read-only render of a single dashboard layout. RLS implications need careful design. |

### 3.5 Engineering quality

| # | Status | Item | Notes |
|---|---|---|---|
| 3.5.1 | ✅ | **Dataset compute as a hook** | All four scopes graduated — `useLearningDatasets`, `useChecklistDatasets`, `useSurveyDatasets`, `useTasksDatasets` live next to their respective scope registrations. ~900 LOC moved out of analyse pages into testable callable hooks. Composite scopes (3.3.1) can now compose them directly. |
| 3.5.2 | ✅ | **Centralise id minting** | New `src/lib/dashboards/freshId.ts` is the single source of truth. `instantiateWidget` and `makeFilter` both go through it; the four per-page `cryptoUuid` copies are gone. |
| 3.5.3 | 📋 | **Storybook coverage for every widget kind** | Currently only end-to-end via `/compliance/checklists/analyse`. Add a stories file that exercises each kind × empty/short/long data so design regressions surface fast. |
| 3.5.4 | 📋 | **Server-side aggregates for big orgs** | `useChecklistModule.reloadAggregates` runs four count queries; with 50 widgets this becomes the bottleneck. Move to a single `compliance_checklist_aggregates` view (or RPC) that returns every metric the registered scope needs. |

---

## 4. Cross-cutting platform improvements

| # | Status | Item | Notes |
|---|---|---|---|
| 4.1 | 📋 | Real drag-and-drop library | Today the Edit Layout panel uses native HTML5 drag-and-drop. For multi-column or grouped reordering (and accessibility), bring in `@dnd-kit/core`. Defer until we actually hit the limitation. |
| 4.2 | ✅ | Surface "saved view" chooser in module headers | Shipped as part of 3.2.3 — every analyse page gets a `DashboardChooser` dropdown inline with the title. |
| 4.3 | 📋 | Audit log for dashboard edits | `dashboard_layouts.version` bumps on every save but we don't expose history. Useful for "who broke the dashboard?" forensics. Mirrors `compliance_template_versions` shape. |
| 4.4 | ✅ | Per-scope + per-pack accent | `DashboardScope.accent` is now a registry field; each scope picks its own palette (compliance brand green / survey purple / tasks amber / learning teal). `ChecklistsAnalysePage` flips to a pack-specific accent (`PACK_ACCENTS` in `modules/compliance/dashboards/packAccents.ts`) when `?pack=aml-amu` vs `?pack=iso-45001` is active. |
| 4.5 | ✅ | Mobile dashboard pass | Three touch-affecting fixes: (a) `DashboardWidgetMenu`, `DashboardFilterBar` (both popovers) and `DashboardChooser` outside-click listeners switched from `mousedown` → `pointerdown` so taps dismiss the popover on iOS / Android (mousedown does not fire on touch). (b) `DashboardEditLayoutPanel` adds up/down arrow buttons next to each widget row, visible on `<sm` only — HTML5 drag-and-drop doesn't fire on touch, the arrows give the same one-slot reorder primitive. The grip handle stays for desktop. (c) The new resize handle (3.2.5) was already gated to `lg:flex` since the 12-col grid is desktop-only. |
| 4.6 | 🚧 | V1 + V3 dashboard layout (Klarert design kit) | First cut shipped on `ChecklistsAnalysePage`. New `editMode` prop on `ModuleAnalyticsDashboard` flips the runtime between the V1 read-mode (clean grid, default) and V3 canvas-mode (always-on edit chrome on every widget + a docked 280px right-rail widget library that replaces the modal `DashboardAddWidgetPanel`). New `DashboardWidgetLibraryRail` component mirrors the design kit's `WidgetLibraryRail.jsx` — same catalog, search, shape filter, kind selector. Inline X-to-remove on every widget when `editMode` is on; resize handle is always visible (no longer hover-gated). Below xl the rail hides itself and the page falls back to the SlidePanel "+Legg til widget". To roll out: same wiring on the other 5 analyse pages once the pattern settles. |

---

## 5. Compliance gap-and-audit planner *(placeholder)*

Picks up where the AML template baseline (PR #175) leaves off. The seed migrations close the *content* gap; the next module is the *planning surface* on top of that content — so an org and an auditor can see "where are we, what's the plan, when does it land?"

| # | Status | Item | Notes |
|---|---|---|---|
| 5.1 | 📋 | Gap view per regulation | Read-only matrix: rows = paragraph (drives off `compliance_checklist_templates.law_refs[]`, `survey_template_catalog.law_refs[]`, `register_types.aml_paragraphs[]`, `document_system_templates.legal_basis[]`, `learning_*.law_refs`); columns = artifact type. Cell shows ✅ in place / ⚠ partial / ❌ missing, with hover detail. The data is already in the schema after `_120043` — this is a UI/aggregation pass. |
| 5.2 | 📋 | Plan & timeline (Gantt-ish) | For each ⚠ / ❌ cell, attach a planned closure: owner, start, due, milestone, status. Persisted in a new `compliance_plan_items` table (org-scoped, FK to law_ref string). Visualised as a tasks/Gantt feed grouped by chapter. Ties into Tasks-modulen so the same row is also a `Task`. |
| 5.3 | 📋 | Auditor view | Read-only, shareable URL (signed token, 30-day expiry). Shows §-by-§ status + active plan items + last-completed evidence (last execution / last review). Lets en revisor følge framdriften uten at vi gir dem full innlogging. Mirror of `survey_invitation_tokens` token pattern. |
| 5.4 | 📋 | Evidence ledger per § | "Hva har vi gjort siste 12 mnd. på § 2A?" — tidslinje av executions, surveys gjennomført, dokumenter signert/acknowledged, læringskurs gjennomført, register-records lagt til. Kommer nær gratis så snart 5.1 er på plass; 5.4 er bare "samme query, sortert kronologisk." |
| 5.5 | 📋 | KPIs for ledelsen | Topp-linje for AMU: % AML-dekning, åpne pålegg fra `aml_18_tilsynssaker`, ARP-redegjørelse-status, antall §-er uten plan. Et widget i `hms_overview`-composite scope. |
| 5.6 | ⏸ | Multi-rammeverks-mapping (ISO 45001, GDPR, åpenhetsloven) | Samme planner-struktur, men `regulation_id` + `paragraph` istedet for hardkodet AML. Avvent til 5.1–5.4 har én komplett bruker — for tidlig å abstrahere. |

**Status:** Full handover-spec ligger i [`specs/compliance-planner.md`](specs/compliance-planner.md) — inkluderer data-inventar (eksakt SQL-union over alle fem template-flater), schema for `compliance_plan_items`, fil-for-fil deliverables per item, mønstre å speile, og en one-shot-prompt for neste sesjon. Innholdet er seedet (PR #175). Neste sesjon kan starte direkte fra spec'en.

---

## 8 · Meetings (Møter) — new module

Template-driven meeting engine that supersedes `CouncilModule.tsx` meeting CRUD and generalises AMU / bedriftsutvalg / verneombud / drøfting / ISO 9001+27001+45001+14001 / GDPR meetings as a single set of system templates. Full spec in [`specs/meetings-parity.md`](specs/meetings-parity.md).

| # | Status | Item | Notes |
|---|---|---|---|
| 8.1 | ✅ | Phase A · DB schema + provision fn | Migration `20260901120000_meetings_module_core.sql` — 10 tables, RLS (incl. confidentiality_level enforcement), BEFORE-UPDATE lock trigger, `provision_meetings_baseline_for_org` + on-org-insert trigger. |
| 8.2 | ✅ | Phase A · Seed system templates | Migration `20260901120001_meetings_seed_system_templates.sql` — 19 system templates (AML §6/§7/§8/§15, IK-f §5, Hovedavtalen §9-3, Likestillingsloven §26/§26a, ISO 9001/27001/45001/14001 §9.3, GDPR art. 26/30/32/35). |
| 8.3 | ✅ | Phase B · Module skeleton | `modules/meetings/{types.ts, useMeetings.ts, index.ts, meetingsLabels.ts, useMeetingsNav.ts, MeetingsHubView.tsx, meetingsLegalReferences.ts, useMeetingDataBindings.ts}` + `dashboards/{meetingsDashboardScope, useMeetingsDatasets}`. |
| 8.4 | ✅ | Phase C · UI shell | Hub view (root-tab orchestrator) + detail view (Informasjon / Agenda / Deltakere / Vedtak / Protokoll tabs — H6 retrofit on canonical primitives) + admin (Maler + Kategorier + custom template editor SlidePanel) + analyse + export-til-PDF route. |
| 8.5 | ✅ | Phase D · Analyse page + scope | `meetingsDashboardScope` (cyan #0891b2), 11 datasets incl. invitation-compliance + law_ref coverage + decision register over time. |
| 8.6 | ✅ | Phase E · Sidebar + routes + perms | `meetingsGroup` between Dokumenter and Register. `MEETINGS_NAV_PERMS` + `module.view.meetings` + `meetings.manage` + `meetings.manage_confidential`. PR #238 added route-gate fallback for `module.view.dashboard` / `isAdmin`. |
| 8.7 | ✅ | Phase F · Legacy cleanup | AMU + Council surface deleted in PR #237. AMU election re-homed as `amu-valg-system` placeholder under `survey_template_catalog` (full eligibility/sealing impl deferred). |
| 8.8 | ✅ | H0 · Lovdata verification | Live-fetched verification log at `specs/meetings-lovdata-verification.md`. Confirmed § 26a biennial, AML § 7-1 30-ansatte, § 7-2 (2) bokstaver verbatim. Drops bogus forskrift § 3-2 / § 3-4 citations. |
| 8.9 | ✅ | H1-H5 · Content fixes | 8 citation corrections, 8 topic additions (§ 18-9, § 7-2 (2) a/c/d/f, § 8-2, § 15-2, § 2A-3/-4), mandatory-flag honesty pass on MUS/allmote/personalmote, ISO 9001/45001/14001 + GDPR DPIA/ROPA completeness, attendee enum extension (tillitsvalgt + hovedverneombud), biennial lønnskartlegging cadence. |
| 8.10 | ✅ | H6 · Custom template editor | `MeetingsTemplateEditorPanel` (FormModal-based) wired in admin Maler tab with name + slug + framework + cadence + category + duration + lead days + confidentiality + min-employees + law refs + roles + agenda repeater. |
| 8.11 | ✅ | H7-H8 · Schema additions | `default_confidentiality_level` column (drøfting/varsling/MUS → restricted) + `minimum_employee_count` column (AMU 30, bedriftsutvalg 100, lønnskartlegging 50) + hub tile warning badges. |
| 8.12 | ✅ | H9 · Møteforberedelse-pakke | `dataBinding` schema + `useMeetingDataBindings` resolver hook + agenda callout with "Bruk forberedelse" copy. 6 productive resolvers (sick_leave_stats, incidents, vernerunde_findings, open_ros_high, training_completion, headcount_and_amu_composition) + actionable manual-prep messages for the remaining 5 sources. |
| 8.13 | ✅ | H10 · Optimised AMU årsmøte | New `amu-arsmote-arsrapport` template covering all § 7-2 (2) bokstaver a-f as discrete items, full bindings, tillitsvalgt + hovedverneombud roles. Legacy `amu-arsrapport-q4` marked `is_active = false`. |
| 8.14 | ✅ | H11 · Vedtaksregister | Open decisions auto-spawn `task_items` rows; implemented/dropped decisions close the linked task. Prior open decisions surface as carry-over banner on Agenda tab. |
| 8.15 | ✅ | H12 · Audit Export-pakke | Print-friendly `/meetings/:id/eksport` route. No new dependency — browser Skriv ut → Lagre som PDF. |
| 8.16 | 🟡 | Reviewer-gated · Hovedavtalen § 9-3 | Paywalled. `bedriftsutvalg` template's `minimum_employee_count=100` + missing ny-teknologi/personalpolitikk topics gated on reviewer confirming against current LO-NHO text. Log §6 in `specs/meetings-lovdata-verification.md`. |
| 8.17 | 🟡 | Reviewer-gated · ISO 27001:2022 § 9.3.2 | Paywalled. Current `iso-27001-isms-gjennomgang` template still has Phase A's wrong sub-letter labels; H3 explicitly deferred. Log §7. |
| 8.18 | ✅ | DB-side workflow event emission | Migration `20260901120050_meetings_workflow_event_emission.sql` — 4 triggers (`meetings` insert/update + `meeting_decisions` insert/update) emit `module_meetings_meeting_created/scheduled/cancelled/protocol_signed/decision_recorded/decision_implemented` via `workflow_dispatch_db_event`. 2 `modules` rows seeded. |
| 8.19 | ✅ | AMU konstitueringsmøte template | Migration `20260901120051_meetings_amu_konstitueringsmote.sql` — post-valg template (10 agenda items, 7 attendee roles incl. tillitsvalgt + hovedverneombud, AML §§ 7-1/7-2/7-4/6-5 + Forskrift § 3-13). Closes the chain from `amu-valg-system` survey placeholder. |
| 8.20 | ⏸ | AMU election full implementation | `amu-valg-system` placeholder remains in `survey_template_catalog`. Eligibility gating + double-envelope ballots + result sealing unimplemented — tracked as a separate `modules/elections/` follow-up spec; konstitueringsmøte (8.19) lands first so the post-valg meeting is ready when elections ship. |
| 8.21 | ⏸ | Server-side PDF + checksum | `/meetings/:id/eksport` uses browser print-to-PDF (no dependency). Server-side PDF rendering with SHA-256 checksum + immutable storage URL stamping is a follow-up — needed only if Arbeidstilsynet inspection demands tamper-evident exports beyond the protocol-lock + signature trail. |
| 8.22 | ⏸ | Test framework — meetings hooks | No vitest/jest/playwright installed in repo (`grep` of `package.json` confirmed). Adding `vitest` + sanity tests for `useMeetingDataBindings` resolver + `useMeetings.setAgendaMinutes` upsert path needs a dedicated PR (touches `package.json`, `tsconfig.test.json`, CI). |
| 8.23 | 🧹 | Orphan branch cleanup (GitHub UI) | 7 remote branches surviving merged PRs `#237`/`#238`/`#239`/`#240`/`#241`/`#242` + closeout-stretch return HTTP 403 to `git push --delete` from the harness proxy. Cleanup deferred to repo owner via GitHub web UI. |
| 8.24 | ✅ | Auto-fill agenda + Datapakke + builder | Migrations `20260902120000_meetings_autofill_agenda.sql` + `20260902120001_meetings_template_binding_backfill.sql`. (a) `meetings` gains `reporting_period_start/end/label`; locked at protocol_signed_at. (b) `meeting_agenda_items` gains `is_manual`, `duration_minutes`, `presenter_member_id`; new BEFORE-CHANGE trigger freezes structure post-sign. (c) New `meeting_agenda_attachments` junction → `wiki_pages`. (d) `dataBinding` backfilled on 15 active templates across AML, ISO 9001/14001/45001/27001, GDPR, Hovedavtalen, Likestillingsloven. (e) `useMeetingDataBindings` made period-aware; 4 new resolvers (`survey_results`, `compliance_checklist_status`, `whistleblowing_anonymized`, `open_decisions`). (f) `useMeetings` gains 10 methods (agenda builder + period + snapshot writers + attachments). (g) New `DatapakkeTab` between Informasjon and Agenda, renders `ReportModuleWidget` cards per binding. (h) `CreateMeetingSlidePanel` ships smart period suggestion from `cadenceHint`. (i) `MeetingsDetailView` agenda gets reorder + add/remove + edit panel + per-item "Oppdater data". Inspired by Sherpany Meeting Spaces + BoardWise. |
| 8.25 | ✅ | Auto-fill SAMMENDRAG + framework signal scanner | Migrations `20260903120000_meetings_template_enrichment.sql` (durations + allmote/personalmote bindings) + `20260903120001_meeting_protocol_exports.sql` (immutable audit table with sha256). (a) New `MeetingsDetailView` `useEffect` writes `binding_snapshot` + seeds empty `minutes_summary` with resolver output on first meeting open — the chair now sees module data already typed into Sammendrag, no buttons. (b) `lib/frameworkSignals.ts` declares per-framework relevant data sources + severity scoring. (c) Resolver exposes `extraSignalsBySource` map of framework-relevant signals NOT bound to template items. (d) Datapakke tab renders BOTH template bindings AND extra framework signals as widget grid — works for all 9 frameworks. (e) `SuggestedTopicsCard` at top of Agenda tab surfaces detected signals with warn/critical severity that have no agenda item; one-click "Legg til" materializes them with binding pre-filled. (f) 19 templates gain per-item `defaultDurationMinutes`; `allmote` + `personalmote` gain `headcount_and_amu_composition` binding so all-hands and dept meetings show real numbers. (g) `definition_snapshot.framework` now stamped at creation so the signal scanner doesn't need to re-look-up the template. |

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
