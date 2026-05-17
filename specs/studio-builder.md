# Studio Builder — unified authoring surface

This spec documents a senior-architect review and proposed implementation
of the **Studio Builder**: one editing surface where customer admins,
consultancy partners, and (later) marketplace contributors author
templates, workflows, documents, e-learning courses, surveys, registers,
dashboards, and full compliance packs.

**Status discipline.** §11 is explicitly framed as **hypothesis** until
customer-signal validation runs in Phase 0; the spec gates Phase 2+ on
that validation. §12 lists upstream specs and current substrate state;
phases that depend on unshipped work declare that dependency in their
task entries.

**Spec status:** `📋 ready — pending stakeholder review on PR`.
**Last reviewed:** 2026-05-17 (senior dev + senior PL second pass; §13 checklist signed off).
**Reference modules:** dashboards (`src/lib/dashboards/dashboardRegistry.ts`),
workflows (`src/lib/workflows/workflowRegistry.ts` + 12 module scopes),
compliance studio (`src/pages/overview/studio/ComplianceStudioPage.tsx`),
partner console (`supabase/migrations/20260907123300_partner_console_v0.sql`).
**Target module:** `modules/studio/` + `src/pages/studio/StudioPage.tsx`
+ `src/lib/studio/`.

> **Read first:** `CLAUDE.md` *Template surfaces*, `specs/PLAYBOOK.md` §3
> (task shape), `specs/workflow-engine-review.md` §3 (registry-via-
> declaration-merging precedent — this spec inherits, not forks),
> `specs/compliance-planner.md` §2 (already-shipped substrate),
> `supabase/migrations/20260907123300_partner_console_v0.sql` (the
> partner-org substrate this spec builds on top of, not parallel to).

---

## 1. One-paragraph framing

Seven modules ship templates and content today (compliance / survey /
documents / learning / meetings / registers / dashboards) and one more
(workflows) is mid-design in `workflow-engine-review.md`. Each has its
own editor pattern: TipTap rich text, dnd-kit drag-drop, slide-panel
form, wizard modal, dashboard edit panel, plus the v3 workflow canvas
that spec proposes. Admins learn 5–6 UI patterns to do one job
("change our compliance content"). A unified **Studio Builder** at
`/studio` collapses these into one shell with progressive disclosure:
**Simple mode** (default — outcome-named wizards + presets +
constrained palette) for the 80% who just want to change a field;
**Advanced mode** (opt-in — canvas + palette + property panel + pack
authoring) for consultants, power admins, and (later) marketplace
contributors. Both modes write the same data through the existing
per-module mutation paths. Build order: (0) registry + property-form
foundation + substrate audit fixes + **customer-signal validation gate**,
(1) studio shell + Simple mode default for the 7 content scopes,
(2a) Advanced mode + pack authoring [plumbing], (2b) ISO 27001 ships
as the loop-closes proof [content], (3) customer + partner authoring
on top of the existing `partner_memberships` substrate, (4) marketplace
gated on §11 milestones.

---

## 2. Current state

Functional but fragmented. Strong per-module editors, no unifying
shell, no kind registry, no pack-authoring UI. Three pieces of
substrate that an earlier draft of this spec proposed building parallel
to **already exist** and are the right foundations to extend.

**Per-module editors (live today):**

| Module | Editor | Pattern | Versioning | System↔org override |
|---|---|---|---|---|
| Documents / Wiki | `src/components/documents/DocumentEditorWorkbench.tsx` (1,231 lines) | TipTap + `ContentBlock` JSON | Yes (`WikiVersionDiff`) | Yes |
| E-learning | `src/pages/learning/LearningCourseBuilder.tsx` | Tabbed CRUD + TipTap | Yes (`LearningVersionPublishModal`) | Yes (`forkSystemCourse`) |
| Surveys | `modules/survey/SurveyBuilderStage.tsx` + branching editor | dnd-kit palette + branching | No (status enum only) | Yes |
| Compliance | `modules/compliance/admin/TemplateEditorPanel.tsx` | Slide-panel form | No | Yes |
| Meetings | `src/pages/meetings/MeetingsTemplateEditorPanel.tsx` | Slide-panel form | No | Yes |
| Registers | `src/pages/registers/RegistersScopeTyper.tsx` | Form + JSON schema | No | Yes |
| Dashboards | `src/components/module/dashboard/DashboardEditLayoutPanel.tsx` | Drag-drop + property form | Yes (named views) | n/a |
| Workflows (proposed v3) | `workflow-engine-review.md` §3 — three-column canvas | Graph canvas + inspector | Planned (`workflow_rule_revisions`) | Planned (`workflow_rule_catalog`) |
| **Aggregator (today)** | `src/pages/overview/studio/ComplianceStudioPage.tsx` | 3 setup wizards | n/a | n/a |

**Foundations to extend (registries):**
- `src/lib/dashboards/dashboardRegistry.ts` — per-scope registration
  (catalog, datasets, accent, composite members). Pattern is
  domain-agnostic; the renderer (`ReportModuleWidget.tsx`, **1,452 lines**
  with 9 `m.kind ===` branches at lines 349, 384, 418, 467, 493, 523,
  560, 726, 1011) is dashboard-specific and must be inverted into a
  registry as Task 0.3.
- `src/lib/workflows/workflowRegistry.ts` + 12 module scopes via
  declaration-merging on `WorkflowEventMap` (`src/lib/workflows/workflowTypes.ts:8-37`).
  Locked-in SDK pattern. Per-scope events share one payload shape; the
  studio's `StudioKindMap` is a cross-product (`scopeId × kindId`) of
  per-kind embedder + property schema + Simple presets. Same
  declaration-merging mechanism, different topology.
- `modules/compliance/usePacks.ts` + `modules/compliance/dashboards/packAccents.ts` —
  multi-pack mechanism (`aml-amu | iso-45001`) live.
- `src/components/wizard/WizardModal.tsx` — supports field kinds
  `text | select | radio-cards | checkbox-group | module-picker`.
  Matches Simple-preset field-kind shape; reused as Simple-mode runner.
- `src/pages/overview/studio/{studioWizardCatalog.ts,studioWizardFactories.ts}` —
  catalog + factory pattern (3 live wizards). Migrates to
  `modules/compliance/studio/complianceStudioScope.ts` as the first
  Simple presets.

**Foundations to extend (substrate the dev review flagged):**
- `dashboard_layouts.kind` (`20260905120000_reports_promote_dashboard_layouts.sql:22-24`)
  — CHECK constraint allows only `'dashboard' | 'report' | 'report_template'`.
  Reuse for any new layout-bearing studio kind **requires** an explicit
  migration to extend the CHECK. Captured as Task 0.5.
- `compliance_notifications.category` (archived
  `20260904120100_compliance_notifications_phase5_sprint2.sql:26-35`) —
  hardcoded CHECK enum (8 values) and **no `payload jsonb` column**.
  Reuse as the studio inbox requires extending the CHECK + adding a
  payload column. Captured as Task 0.6.
- **Partner console substrate already exists**
  (`20260907123300_partner_console_v0.sql` + `20260907124800_partner_rls_hardening.sql`):
  - `partner_organizations` (consulting firm row, `default_hourly_rate`,
    `brand_accent`)
  - `partner_memberships` (partner ↔ customer org ↔ user, role
    `consultant | manager | admin`, `hourly_rate_override`, `active`)
  - `partner_time_entries` + `partner_invoices` (billing layer; not in
    studio scope but coexist)
  - Helpers: `is_partner_member_of(partner_id, user_id)`,
    `is_partner_manager_of(partner_id, user_id)`,
    `partner_resolve_active_partner(org_id, user_id)`
  - GUC: `app.active_partner_id` for multi-partner disambiguation
  Phase 3 builds on top of this; no new `partner_org_links` table.

**Gaps that prevent a unified studio:**
- `ReportModuleWidget.tsx` if-chain → 6-call-sites kind wiring. Cannot
  scale to 30+ kinds across 8 scopes on this pattern.
- Property forms hand-coded per kind. No schema-driven form generator.
- No unified block editor library; Documents/Surveys/Learning each
  invented their own block model. Studio doesn't unify these — it
  embeds them.
- No pack-authoring UI; `compliance_packs` is SQL-only today.
- No studio-aware permission keys; module admin permissions are too
  coarse for a tiered product.
- No pack-as-portable-artifact export.
- No concurrency model (two admins on same template = silent overwrite).
- No autosave / draft for in-progress edits.
- No visible test strategy for the editor surfaces (the existing
  per-module editors mostly lack unit coverage of mutation paths).

---

## 3. Decisions locked in

| Question | Decision |
|---|---|
| Architectural pattern | **Consolidate & extend** existing registries (`dashboardRegistry`, `workflowRegistry`). New `studioRegistry` follows the same declaration-merging shape with a `StudioKindMap` interface. No parallel registry. |
| UI shape | **One studio, two modes** (Simple default, Advanced opt-in). Same data, same components, `mode` prop on the shell. Not two products. |
| Embedding strategy | **Host existing per-module editors via an Embedder adapter** (~100–200 LoC per scope). TipTap stays for documents/learning; dnd-kit for surveys; slide-panel for compliance/meetings/registers. Studio shell provides chrome (palette, preview, publish, version, accent). |
| Kind registry | **Pluggable** — each kind ships *both* a Simple-mode preset and an Advanced-mode property schema. **Build-time assertion** via a `prebuild` script (not Vite plugin, not runtime) — captured as Task 0.7. |
| Workflow conflict | **Studio absorbs workflows.** `workflow-engine-review.md` Phase B becomes the workflows scope file (`modules/workflows/studio/workflowsStudioScope.ts`). `/workflow` URL persists as a deep link into `/studio?scope=workflows`. Both specs cross-reference; no fork. |
| Pack versioning | **Immutable on publish (semver).** Edits to a published pack require a new version (`1.0.0 → 1.0.1 / 1.1.0 / 2.0.0`). Drafts pre-publish are mutable. Customers explicitly upgrade. Marketplace defensibility + audit reproducibility. |
| Marketplace gate | **100 Pro/Enterprise customers + 20 active partners** before Phase 4 starts. Sales+product re-confirm threshold at the 12 mo milestone. |
| `studio.advanced` default | **Platform admins only (Phase 0–2).** Opens to Enterprise / Partner tier in Phase 3 (`studio.advanced` granted on tier upgrade). Customer admins get `studio.simple` by default. |
| Pack model | **Pack-as-portable-artifact** from day one — pack export/import shape decided in Phase 2a even though marketplace ships in Phase 4. |
| Multi-tenancy | **Build on existing `partner_memberships`** + `is_partner_member_of` / `is_partner_manager_of` + `app.active_partner_id` GUC. No new partner table. New permission key `studio.partner_admin` gates write access; RLS predicates layer the studio permission on top of partner membership. |
| Permissions | **5 `studio.*` keys** — `studio.simple`, `studio.advanced`, `studio.packs`, `studio.partner_admin`, `studio.marketplace_publish`. Tier mapping in §11. Tasks gated to v1 introduce the first two only; the others are reserved (named, not granted) until their phases. |
| Localisation | **`name_i18n: { nb, en }`** on all studio-authored content from day one (mirrors workflow spec §3). Locale fallback: missing translation falls back to `nb` with a `(machine_fallback)` tag in dev. |
| Audit | **`studio_revisions` table** mirroring `workflow_rule_revisions`. Trigger on every studio-aware table. **Write-throttle**: `set local studio.skip_revisions = on` GUC honoured inside `provision_*_baseline_for_org` and `studio-pack-import` bulk paths. |
| Review/approve | **`compliance_review_status` enum reused** (`draft → reviewed → approved`) on all studio-authored content. |
| Concurrency | **Last-writer-wins with optimistic-lock via `updated_at`.** On save, server checks `updated_at = client.lastSeen`; mismatch → 409 + diff modal asks the user to merge or overwrite. No CRDT. |
| Autosave | **Per-row draft column `studio_draft_payload jsonb` on each studio-aware table.** Autosave every 10s during editing or on blur. Server-side TTL of 24h after which drafts are purged. |
| Branching / conditions | **Not a `PropertyField` kind.** Survey branching and workflow conditions stay inside their respective scope embedders (dnd-kit canvas / workflow graph canvas). Property panel exposes leaf properties; the canvas is the embedder. |

Anti-features explicitly out of v1:
- A new block editor that replaces TipTap / dnd-kit / slide-panel.
- Inline JS / JSONata code blocks inside the studio.
- A second permission model parallel to RBAC. Reuse partner_memberships.role.
- Marketplace, payment rails, Stripe Connect — not in v1–v3.
- A studio mobile app. Mobile gets read-only preview only.
- AI/LLM-assisted authoring as a v1 feature. Capture as `specs/studio-ai-authoring.md` follow-up.
- CRDT / real-time collaborative editing. Last-writer-wins with conflict modal is the v1 promise.

---

## 4. Architecture (consolidate-and-extend)

```
Modules (compliance, survey, documents, learning, meetings, registers,
  dashboards, workflows — eight scopes; workflow inherits from
  workflow-engine-review.md Phase B)
    each ships:
      modules/<scope>/studio/<scope>StudioScope.ts
        registerStudioScope<MyKindMap>({ scopeId, label, accent,
          kinds, presets, propertySchemas, embedder, mutator,
          lawRefSlot, packAware })
                              ▼  side-effect import
src/lib/studio/studioRegistry.ts (single source of truth, types via
  declaration-merging StudioKindMap interface — adding a kind lights
  up the Simple preset picker, Advanced property panel, and CSV
  export automatically)
                              ▼
Studio shell (/studio, mode={'simple'|'advanced'}):
  ScopePicker · PalettePanel · CanvasFrame · PropertyInspector
  PreviewPane · VersionTimeline · PublishBar · ModeToggle
  + ConflictModal (409 last-writer-wins resolution)
  + AutosaveIndicator
                              ▼
Per-scope embedders (Embedder adapter contract — ~100–200 LoC each):
  TipTap (documents, learning) · dnd-kit canvas (survey) ·
  SlidePanel form (compliance, meetings) · JSON schema form
  (registers) · DashboardEditLayoutPanel (dashboards) ·
  WorkflowCanvas v3 (workflows — from workflow-engine-review.md §3)
                              ▼
Existing per-module mutation paths (extended, never rewritten):
  compliance_checklist_templates · survey_org_templates ·
  document_org_templates · learning_courses · meeting_templates ·
  register_types · dashboard_layouts (kind CHECK extended in Task 0.5) ·
  workflow_rules
  + studio_revisions (NEW — mutation audit log, write-throttled)
  + studio_drafts column on each studio-aware table (NEW — autosave)
  + studio_packs (NEW — semver-versioned, immutable on publish)
  + studio_pack_drafts (NEW — pre-publish workspace)
  + compliance_notifications (CHECK extended + payload jsonb in Task 0.6)
  + partner_memberships (REUSED — Phase 3 builds on top, no new table)
                              ▼
Edge functions (Deno):
  studio-pack-export — bundles pack version → ZIP with manifest +
    checksums + signed manifest (shares code with compliance-audit-pdf)
  studio-pack-import — validates ZIP, provisions via existing
    provision_*_baseline_for_org RPCs, idempotent
```

House-style guardrails (CLAUDE.md):
- Side-effect imports for every scope file
  (`import './studio/<scope>StudioScope'`); dev-mode startup
  assertion validates `STUDIO_SOURCE_MODULES` ⊆ registered scopes.
- ID minting via `freshId('studio')`.
- All new migrations idempotent. Basenames timestamped past the
  latest. Each carries the 4–8 line Arbeidstilsynet self-audit header.
- `law_refs` exact strings; studio writes populate the same arrays
  the planner reads.
- `name_i18n: { nb, en }` on all studio-authored content from day one.
- Reuse, don't duplicate: extend `compliance_notifications` (Task 0.6)
  rather than create `studio_notifications`; extend
  `dashboard_layouts.kind` CHECK (Task 0.5) rather than create
  `studio_layouts`; build on `partner_memberships` rather than create
  `partner_org_links`.

### Mode model (Simple vs Advanced)

Same shell renders both modes by switching:

| Surface | Simple mode | Advanced mode |
|---|---|---|
| Entry | Outcome-named cards ("Add a policy", "Set up a reminder") | Scope picker → kind palette |
| Editing | `WizardModal` flow over a registered preset | Canvas + drag-drop + property inspector |
| Palette | Constrained per kind (3–5 most common blocks) | Full kind catalog |
| Property panel | Hidden behind "Open in Advanced" escape hatch | Always visible, full schema |
| Publish | One-click "Apply" | Review-and-publish with diff |
| Branching/conditions | Editable only via "Open in Advanced" | Native via scope embedder |
| Telemetry | Tracks "Open in Advanced" usage → prompts mode promotion at 3+ uses | n/a |

Mode is a per-user sticky setting (`profiles.studio_mode_default`),
not per-content. Advanced is permission-gated (`studio.advanced`).

### Kind registry contract

```ts
registerStudioKind({
  scopeId: 'documents',
  kindId: 'policy',
  label: 'Policy / instruks',
  accent: '#0f766e',
  simplePresets: SimplePreset[],   // ≥1 required — prebuild assertion fails otherwise
  advancedSchema: PropertySchema,  // ≥1 field required — prebuild assertion fails otherwise
  embedder: () => Promise<ReactComponent<EmbedderProps>>,  // dynamic import — lazy
  mutator: (input, ctx) => Promise<ResultRow>,
  lawRefSlot: 'law_refs' | 'legal_basis' | 'regulation_ids' | 'law_refs_jsonb',
  packAware: boolean,
  conflictResolver?: (server, client) => ConflictResolution,  // defaults to last-writer-wins
  csvExporter?: (row) => Record<string, string>,
})
```

**Embedder adapter contract** (the ~100–200 LoC the dev review flagged
as understated work). Each scope ships an adapter that wraps its
existing editor to expose to the shell:
- `value: KindRowShape` (controlled)
- `onChange: (next: KindRowShape) => void`
- `onDirty: (isDirty: boolean) => void`  (drives autosave + publish-button-enabled)
- `onConflict: (server, client) => Promise<ConflictResolution>`
- `mode: 'simple' | 'advanced'`  (some embedders hide affordances)
- `readonly: boolean`  (for preview)
- `lockState: 'unlocked' | 'locked' | 'signed'`  (compliance + survey + meeting need this)

Adapters live in `modules/<scope>/studio/<scope>Embedder.tsx`. The
adapter is a thin shim — it does NOT lift the editor's internal state
into the shell; it forwards the editor's existing `onChange` and
exposes the `value` boundary. TipTap's controlled-component story
already supports this; dnd-kit needs the drag context to remain
inside the embedder (not lifted), with only the row state escaping.

### `PropertyField` union (kept narrow)

```ts
type PropertyField =
  | { kind: 'text' | 'textarea' | 'number' | 'toggle' }
  | { kind: 'select'; options: Array<{ value: string; label: string }> }
  | { kind: 'radio-cards'; options: Array<{ value: string; label: string; description: string }> }
  | { kind: 'checkbox-group'; options: Array<{ value: string; label: string }> }
  | { kind: 'law-ref-picker'; pack?: string }
  | { kind: 'preset-picker'; scopeId: string; kindId: string }
  | { kind: 'rich-text-embed' }     // mounts TipTap inline
  | { kind: 'layout-embed' }        // mounts a small dashboard_layouts widget
```

Survey branching, workflow conditions, course module sequencing,
checklist item logic — all live in their respective embedders, NOT in
`PropertyField`. The property panel exposes leaf properties (title,
description, owner, frequency, law-refs, …). Graph-shaped state
remains in the embedder.

---

## 5. Phasing (re-costed per senior-dev review)

Each phase below follows the **PLAYBOOK §3 task shape**: numbered tasks
with reference precedent, files-to-touch, acceptance criteria,
verification steps, and open questions. Phases are sequenced; tasks
within a phase can run in parallel where the dependency arrows allow.

### Phase 0 — Foundation + customer-signal validation (4–5 sprints)

**Sellable narrative for stakeholders:** Phase 0 ships **two visible
wins** alongside the engineering refactor — (a) the existing 3 compliance
wizards relocate to a permanent home with telemetry, and (b) the
customer-signal validation experiments (Tasks 0.9, 0.10) produce
sales-usable artifacts (interview transcripts, pricing test results).
This is the antidote to the "3 sprints of invisible refactor" smell.

#### Task 0.1 · `studio_revisions` table + trigger framework

**Status:** 📋 not started

**Why this is independent:** Pure additive infra; no read coupling
yet. Other Phase 0 tasks depend on this being shipped first.

**Files to touch:**
- `supabase/migrations/<ts>_studio_revisions.sql` — `(id, scope_id,
  kind_id, row_id, row_table text, organization_id, prev_payload jsonb,
  next_payload jsonb, changed_by, changed_at, change_reason text,
  review_status compliance_review_status)`. Per-table BEFORE
  UPDATE/INSERT trigger that honours `set local studio.skip_revisions
  = on` to skip writing during bulk paths (`provision_*` RPCs,
  `studio-pack-import`).

**Reference precedent:** `workflow_rule_revisions` proposed in
`workflow-engine-review.md §A` — same shape, write-throttle GUC is
novel to this spec.

**Acceptance:**
- [ ] Editing a checklist template writes a `studio_revisions` row.
- [ ] `set local studio.skip_revisions = on; select provision_compliance_baseline_for_org(...)`
      writes 0 revision rows even though it inserts 30+ template rows.
- [ ] `prev_payload` and `next_payload` differ by exactly the edited
      field.

**Verification:**
1. `pnpm typecheck` clean.
2. `select count(*) from studio_revisions` after a single edit = 1.
3. `select count(*) from studio_revisions` after a bulk provision with
   the GUC set = 0.

**Open questions:** none — implementation pattern is established.

#### Task 0.2 · `studio.*` permission keys + `profiles.studio_mode_default`

**Status:** 📋 not started

**Why this is independent:** No dependencies; runs in parallel with 0.1.

**Files to touch:**
- `supabase/migrations/<ts>_studio_permissions.sql` — insert 5
  permission keys (`studio.simple`, `studio.advanced`, `studio.packs`,
  `studio.partner_admin`, `studio.marketplace_publish`). Grant
  `studio.simple` to all existing admin roles. Grant `studio.advanced`
  to platform admins only. The other three are reserved (named, not
  granted to any role).
- `supabase/migrations/<ts>_studio_profile_mode.sql` — `add column
  studio_mode_default text not null default 'simple'` on `profiles`
  with `check (studio_mode_default in ('simple','advanced'))`.

**Reference precedent:** existing `permissions` table seed pattern.

**Acceptance:**
- [ ] `select count(*) from permissions where key like 'studio.%'` = 5.
- [ ] All existing admin users have `studio.simple` after migration runs.
- [ ] `studio.advanced` granted only to platform admins.

**Verification:**
1. `select role_id, key from role_permissions where key like 'studio.%'`
   — verify only the two intended grants exist.
2. `studio_mode_default` defaults to `'simple'` on a newly-created profile.

**Open questions:** none.

#### Task 0.3 · Extract `WidgetKindRegistry` from `ReportModuleWidget` if-chain

**Status:** 📋 not started

**Why this is independent:** Pure refactor; behaviour-preserving.
This is the single largest engineering deliverable in Phase 0 — 1
sprint by itself.

**Files to touch:**
- `src/lib/studio/WidgetKindRegistry.ts` (new) — registry of
  `{ kind, renderer, defaultConfig, propertySchema, simplePreset }`
  for each of the 9 existing widget kinds (`kpi | table | bar | donut |
  line | heatmap | scorecard | bowtie | benchmark`).
- `src/components/reports/ReportModuleWidget.tsx` (refactor) —
  replace 9-branch if-chain with `registry.get(m.kind).renderer(...)`.
  Verified branch locations: lines 349, 384, 418, 467, 493, 523, 560,
  726, 1011.
- `src/components/module/dashboard/DashboardEditWidgetPanel.tsx`
  (refactor) — read property form from `registry.get(m.kind).propertySchema`.
- `src/components/module/dashboard/dashboardWidgetKinds.ts` (refactor)
  — `KIND_LABELS` + `defaultCompatibleKinds` derived from registry.
- `src/types/reportBuilder.ts` (refactor) — `ReportModuleKind` becomes
  `keyof StudioKindMap['dashboards']`.
- `src/lib/dashboards/useDashboardLayout.ts` (refactor) — Zod enum
  derived from registry.

**Reference precedent:** `workflowRegistry.ts` declaration-merging
pattern (`workflow-engine-review.md §3`).

**Acceptance:**
- [ ] All 9 widget kinds render pixel-identically before vs after
      (screenshot diff against a fixed seed dashboard).
- [ ] `pnpm typecheck` clean.
- [ ] No local re-definition of `ReportModuleKind` anywhere in the
      codebase (`grep -rn "ReportModuleKind" src/`).

**Verification:**
1. Capture screenshots of a seeded multi-widget dashboard on `main`.
2. After refactor, capture same dashboard; pixel-diff < 0.5%.
3. `pnpm typecheck && pnpm lint src/components/reports
   src/components/module/dashboard src/lib/studio` clean.

**Open questions:** none.

#### Task 0.4 · `studioRegistry` + `studioTypes` + `PropertyFormGenerator` + `PresetPicker`

**Status:** 📋 not started

**Why this is independent:** Depends on 0.3 (registry pattern established).
This task generalises the WidgetKindRegistry shape to the studio.

**Files to touch:**
- `src/lib/studio/studioRegistry.ts` — `registerStudioScope`,
  `registerStudioKind`, `getStudioScope`, `getStudioKind`,
  `STUDIO_SOURCE_MODULES` constant, dev startup assertion.
- `src/lib/studio/studioTypes.ts` — `StudioKindMap` interface
  (declaration-merging target), `SimplePreset`, `PropertySchema`,
  `PropertyField` union (8 leaf kinds — see §4 constraint).
- `src/lib/studio/freshId.ts` — re-export `src/lib/dashboards/freshId.ts`.
- `src/lib/studio/PropertyFormGenerator.tsx` — schema → form.
- `src/lib/studio/PresetPicker.tsx` — `simplePresets` → `WizardModal` flow.

**Reference precedent:** `workflowRegistry.ts` and the `WizardModal`
field-kind switch.

**Acceptance:**
- [ ] `PropertyFormGenerator` renders all 8 `PropertyField` kinds
      against a fixture schema.
- [ ] `PresetPicker` mounts a `WizardModal` flow for a fixture preset.
- [ ] Removing a scope's side-effect import in dev surfaces a console
      warning at startup; missing-scope assertion shape matches the
      one in workflow registry.

**Verification:**
1. Storybook (or fixture page) renders all 8 field kinds.
2. Dev startup with one scope removed logs
   `[studio] scope <id> missing — did you forget the side-effect import?`.

**Open questions:** none.

#### Task 0.5 · Extend `dashboard_layouts.kind` CHECK

**Status:** 📋 not started

**Why this is independent:** Standalone migration; unblocks Task 1.x
that wants to persist non-dashboard layouts.

**Files to touch:**
- `supabase/migrations/<ts>_dashboard_layouts_studio_kinds.sql` —
  `alter table dashboard_layouts drop constraint <name>; alter table
  add constraint ... check (kind in ('dashboard','report','report_template',
  'studio_preset_layout','studio_pack_layout'));`. Idempotent via
  `drop constraint if exists` + recreate.

**Reference precedent:** `20260905120000_reports_promote_dashboard_layouts.sql`
which first introduced the CHECK.

**Acceptance:**
- [ ] Insert with `kind='studio_pack_layout'` succeeds.
- [ ] Existing `'dashboard' | 'report' | 'report_template'` rows
      unaffected.

**Verification:**
1. `insert into dashboard_layouts (organization_id, scope_id, name, kind, layout) values (...,'studio_pack_layout','[]')` succeeds.
2. Old row count unchanged.

**Open questions:** Should we use `dashboard_layouts` for any
non-layout studio kinds (e.g. a free-form survey question bundle)?
Recommend no — only layout-bearing kinds. Decide before Phase 2a.

#### Task 0.6 · Extend `compliance_notifications` for studio events

**Status:** 📋 not started

**Why this is independent:** Standalone migration; unblocks studio's
notification needs (Phase 3 review/approve flow).

**Files to touch:**
- `supabase/migrations/<ts>_compliance_notifications_studio.sql` —
  drop and recreate the `category` CHECK to add: `'studio_review_requested',
  'studio_review_approved', 'studio_review_rejected',
  'studio_pack_published', 'studio_partner_grant_granted',
  'studio_partner_grant_revoked'`. Add `payload jsonb not null default
  '{}'::jsonb` column with `comment`. Index on `(category, created_at desc)`.

**Reference precedent:** `archive/20260904120100_compliance_notifications_phase5_sprint2.sql`
which defined the original CHECK.

**Acceptance:**
- [ ] Insert with one of the new categories + non-empty payload succeeds.
- [ ] Existing rows untouched.

**Verification:**
1. `select distinct category from compliance_notifications order by 1;`
   — all 14 categories enumerable.
2. `insert ... category='studio_review_requested', payload='{"row_id":"..."}'`
   succeeds.

**Open questions:** none.

#### Task 0.7 · Prebuild assertion for kind-registry parity

**Status:** 📋 not started

**Why this is independent:** Tooling-only; depends on 0.4 (registry exists).

**Files to touch:**
- `scripts/assert-studio-registry.ts` (new) — Node script: imports
  every `modules/*/studio/*StudioScope.ts`, calls `register*`, then
  asserts `simplePresets.length >= 1 && advancedSchema.fields.length >= 1`
  for every registered kind. Exits 1 on failure.
- `package.json` — add `"prebuild": "tsx scripts/assert-studio-registry.ts"`.

**Reference precedent:** none in this codebase yet — closest is the
`pnpm typecheck` gate. Inspiration from Next.js `verifyTypeScriptSetup`.

**Acceptance:**
- [ ] Removing all `simplePresets` from a scope file fails `pnpm build`.
- [ ] Removing all `advancedSchema.fields` from a kind fails `pnpm build`.
- [ ] Build is green with both populated.

**Verification:**
1. `pnpm build` green with a fully-populated kind.
2. Temporarily empty `simplePresets`; `pnpm build` exits 1 with a
   clear error citing scope + kind id.

**Open questions:** Embedder imports React; can the prebuild script
import scope files without a React runtime? Recommend: split scope
files into `<scope>StudioScope.ts` (registry call, no React imports)
+ `<scope>Embedder.tsx` (the React component, dynamically imported
from the scope file via `embedder: () => import('./<scope>Embedder')`).

#### Task 0.8 · `useStudioRevision` + `useStudioMode` hooks

**Status:** 📋 not started

**Why this is independent:** Depends on 0.1 + 0.2.

**Files to touch:**
- `src/hooks/useStudioRevision.ts` — wraps any mutator call,
  inserts a `studio_revisions` row on success.
- `src/hooks/useStudioMode.ts` — read/write `profiles.studio_mode_default`,
  emit telemetry on flip + on "Open in Advanced" escape-hatch use,
  enforce `studio.advanced` permission gate.

**Reference precedent:** existing `useDashboardLayout.ts` patterns.

**Acceptance:**
- [ ] Hook used in a fixture mutator writes a revision row.
- [ ] User without `studio.advanced` cannot flip mode (returns 403).

**Verification:**
1. Unit test: stub a mutator, call via hook, assert revision row.
2. Integration: open `/studio?mode=advanced` as a `studio.simple`-only
   user → returns Simple shell with disabled toggle.

**Open questions:** none.

#### Task 0.9 · Customer-signal validation experiments — **Phase 0 EXIT GATE**

**Status:** 📋 not started

**Why this is independent:** Non-engineering; runs concurrent with all
other Phase 0 tasks. **No Phase 2+ work begins until this passes.**

**Deliverables:**
- 5–8 customer interviews with current admin users across at least
  3 industry verticals (target: barnehage, bygg, helse). Script
  validates demand for: (a) Simple-mode authoring, (b) Advanced-mode
  authoring, (c) pack customisation, (d) willingness-to-pay above
  Standard tier.
- 1–2 consultancy-partner interviews validating: (a) interest in
  multi-tenant studio, (b) clients they would bring, (c) rev-share
  vs SaaS-resale preference.
- Pricing test: a landing page with Simple/Advanced tier descriptions
  and price points (3× and 5× Standard). Track sign-up intent or
  email-capture rate.

**Reference precedent:** none in this repo — this is a product/sales
deliverable, not engineering. Outcome documented in
`specs/studio-signal-validation.md` (a new sibling doc).

**Acceptance (numeric thresholds):**
- [ ] ≥4/8 customers (50%) state they would use Simple-mode authoring
      monthly.
- [ ] ≥2/8 customers (25%) state they would pay 2× Standard for Pro.
- [ ] ≥1 partner LOI (non-binding letter of intent) or concrete
      pilot agreement.

**Verification:**
1. Interview transcripts checked into `specs/studio-signal-validation.md`.
2. Sales sign-off on the threshold numbers.
3. **If thresholds miss**: pause Phase 2; revisit framing or kill
   the platform thesis. The first 8 sprints of work (Phase 0+1) still
   ship visible value as a consolidated editing surface.

**Open questions:** Who runs the interviews? PL + sales lead jointly.
Who owns `specs/studio-signal-validation.md`? PL.

#### Task 0.10 · Relocate the 3 existing wizards into `modules/compliance/studio/`

**Status:** 📋 not started

**Why this is independent:** Behaviour-preserving; relocates code.
This is the Phase 0 **visible win** — the existing wizards persist
under the new studio nav.

**Files to touch:**
- Move `src/pages/overview/studio/studioWizardCatalog.ts` →
  `modules/compliance/studio/complianceStudioScope.ts`. Rewrite as
  three `simplePresets` on the compliance scope.
- Move `src/pages/overview/studio/studioWizardFactories.ts` → same
  destination as the preset payload-builders.
- `src/pages/overview/studio/ComplianceStudioPage.tsx` remains as a
  thin redirect to `/studio?scope=compliance` for backward-compat;
  removed after Phase 1.

**Reference precedent:** existing wizard catalog.

**Acceptance:**
- [ ] HMS grunnmur, varsling, AMU etablering wizards reachable from
      `/studio` (with Phase 0 shell stub) and still write to the same
      DB tables.

**Verification:**
1. Open each wizard; complete; verify the same RPCs fire.
2. `select count(*) from compliance_checklist_templates where ...`
   matches pre-relocation counts.

**Open questions:** none.

**Phase 0 acceptance (must all pass to enter Phase 1):**
- [ ] All 9 widget kinds render identically before/after Task 0.3.
- [ ] `studio_revisions` writes on edits, skips on bulk paths.
- [ ] `studio.*` permission keys present; mode toggle gated.
- [ ] Prebuild assertion fails when a kind misses Simple preset or
      Advanced schema.
- [ ] Customer-signal validation (Task 0.9) passes thresholds OR
      the platform thesis is explicitly halted and the spec rescoped
      to Phase 0+1 only.
- [ ] All Phase 0 migrations idempotent (re-run is no-op).

### Phase 1 — Studio shell + Simple mode default (1–2 sprints)

#### Task 1.1 · `StudioPage` shell + ModeToggle + ScopePicker

**Status:** 📋 not started

**Why this is independent:** Depends on Phase 0 complete.

**Files to touch:**
- `src/pages/studio/StudioPage.tsx` — three columns, mode-aware.
- `src/components/studio/shell/{ScopePicker,PalettePanel,CanvasFrame,
  PropertyInspector,PreviewPane,VersionTimeline,PublishBar,ModeToggle,
  ConflictModal,AutosaveIndicator}.tsx`.
- `src/components/layout/AticsShell.tsx` — promote Studio to top-level
  NavGroup (`flatSubs: true`). Permission: `studio.simple`.

**Reference precedent:** `ComplianceStudioPage.tsx`, `AticsShell.tsx`
NavGroup pattern.

**Acceptance:**
- [ ] `/studio` loads with scope picker.
- [ ] Mode toggle flips Simple↔Advanced and persists per user.
- [ ] User without `studio.advanced` sees disabled toggle with tooltip.
- [ ] Per-scope accent flips the shell border on scope change.

**Verification:** click-path through scopes + mode toggle.

**Open questions:** none.

#### Task 1.2 · Simple mode cards aggregating ≥3 presets per scope

**Status:** 📋 not started

**Why this is independent:** Depends on 1.1 + Task 2.x scope files
existing (per scope shipping ≥3 simple presets — see Task 1.3).

**Files to touch:**
- `src/components/studio/shell/SimpleModeCards.tsx`.
- `modules/<scope>/studio/<scope>StudioScope.ts` × 7 (compliance
  already done in 0.10) — minimum 3 Simple presets each. Total ≥21.

**Acceptance:**
- [ ] 21 outcome-named cards on `/studio` Simple landing.
- [ ] Completing a preset writes the expected DB row + revision.

**Verification:** click-path complete on 3 random presets.

**Open questions:** What are the 3 highest-value Simple presets per
scope? Defer to scope-owner pre-task; this is content design.

#### Task 1.3 · Telemetry events

**Status:** 📋 not started

**Files to touch:**
- `src/lib/studio/telemetry.ts` — emit
  `studio.scope_opened | preset_started | preset_completed |
  open_in_advanced_clicked | mode_promoted | conflict_resolved |
  autosave_fired`.

**Acceptance:**
- [ ] All 7 events fire on the expected interactions.

**Verification:** open analytics dashboard or log table; complete
a preset; assert event row.

**Phase 1 acceptance:**
- [ ] `/studio` loads in <2s TTI (P75) on a 4G connection.
- [ ] First-load bundle <350KB gz.
- [ ] All 21+ Simple presets reachable and writing correctly.
- [ ] Mode toggle persists per user.

### Phase 2a — Advanced mode + pack authoring plumbing (2 sprints)

#### Task 2a.1 · Embedder adapters for all 7 content scopes

**Status:** 📋 not started

**Why this is independent:** Phase 1 ships scope files with stubbed
embedders; this task replaces each stub with the real adapter.

**Files to touch:**
- `modules/<scope>/studio/<scope>Embedder.tsx` × 7 — ~100–200 LoC each.
- For workflows: integrate `WorkflowBuilderPage` from
  `workflow-engine-review.md §3 Phase B` as the workflow embedder.
  Requires that spec's Phase A substrate to ship first (cross-spec
  dependency; tracked in §12).

**Acceptance:**
- [ ] Each scope's existing editor mounts inside the studio canvas
      in Advanced mode without UX regression vs the legacy module
      settings page.
- [ ] Locked / signed states forward correctly (`lockState` prop).

**Verification:** open each scope's existing template; edit it in
the legacy editor and again in `/studio?scope=<scope>`; behaviour
matches.

**Open questions:** Documents editor is 1,231 lines and owns its own
locking surface — verify the adapter cleanly forwards lock state
without lifting it.

#### Task 2a.2 · `studio_packs` + `studio_pack_drafts` + semver enforcement

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<ts>_studio_packs.sql` — `(id, slug,
  semver text, name_i18n jsonb, summary_i18n jsonb, accent text,
  kpi_labels jsonb, severity_labels jsonb, legal_references jsonb,
  immutable boolean default true, published_at timestamptz,
  published_by uuid, organization_id uuid, status pack_status)`.
  Unique on `(slug, semver)`. BEFORE UPDATE trigger blocks edits to
  rows with `immutable=true AND published_at is not null`.
- `supabase/migrations/<ts>_studio_pack_drafts.sql` — `(id,
  organization_id, slug, draft_semver text, draft_payload jsonb,
  status, last_edited_at)`.
- `src/pages/studio/PackEditor.tsx` — author a draft; publish bumps
  semver and freezes.

**Acceptance:**
- [ ] Publishing a pack flips `immutable=true`; subsequent UPDATE
      fails at the DB level.
- [ ] Editing a published pack requires creating a new draft with
      bumped semver.

**Verification:** publish 1.0.0; attempt `update studio_packs ...`
on it → denied. Create 1.0.1 draft → edit → publish → row exists.

**Open questions:** What's the semver bump policy enforced in the UI
(patch / minor / major)? Recommend: any content change = patch; new
required field = minor; backward-incompatible change = major.
Validate with first real customer use.

#### Task 2a.3 · `studio-pack-export` + `studio-pack-import` edge functions

**Status:** 📋 not started

**Files to touch:**
- `supabase/functions/studio-pack-export/index.ts` — bundle pack version
  → ZIP with `manifest.json` (slug, semver, locale, sha256 per file) +
  per-module template files. Signed manifest mirrors
  `compliance-audit-pdf` evidence-pack code.
- `supabase/functions/studio-pack-import/index.ts` — validate ZIP,
  provision into target org via existing `provision_*_baseline_for_org`
  RPCs. Idempotent; uses `set local studio.skip_revisions = on`.

**Acceptance:**
- [ ] Export of AML-AMU pack → ZIP. Manifest checksums verify.
- [ ] Import into empty org → templates seeded.
- [ ] Re-import is a no-op (idempotent via on-conflict in provision RPCs).

**Verification:** export → import → run gap-matrix query from
`compliance-planner.md §3` on the imported org. Counts match the
original pack.

**Phase 2a acceptance:**
- [ ] Every kind has `simplePresets.length ≥ 1` AND
      `advancedSchema.fields.length ≥ 1` (prebuild assertion green).
- [ ] All 7 content scope embedders functional in Advanced mode.
- [ ] Pack draft → publish → export → import loop closes.

### Phase 2b — ISO 27001 ships via studio (2 sprints, content-eng)

#### Task 2b.1 · ISO 27001 baseline content seed

**Status:** 📋 not started

**Why separate from 2a:** Content drafting is a content-engineer task,
not a tooling task. Cannot compress to authoring-tool time. The
deliverable here is **proof the loop closes** — but the content also
has independent business value.

**Deliverables:**
- 10–15 compliance checklist templates covering ISO 27001 Annex A
  controls A.5–A.18 (or current ISO 27001:2022 subset).
- 5–8 document templates for the ISO 27001 ISMS.
- 3–5 e-learning courses (awareness, role-specific).
- 2–3 surveys (annual ISMS effectiveness review).
- 1 register type (asset inventory aligned to A.5.9).
- All law_refs / legal_basis populated with `'ISO 27001 A.5.9'`-style
  exact strings.

**Acceptance:**
- [ ] Pack `iso-27001 v1.0.0` published via the studio (no SQL migration).
- [ ] Pack passes the gap-matrix query for ISO paragraph coverage.
- [ ] Dashboard accent flips on `?pack=iso-27001`.

**Verification:** install pack into a fresh org; run gap matrix; ≥10
ISO 27001 paragraphs covered.

**Open questions:** Who drafts the content? Recommend: content-eng
or external HMS/security consultant under contract. Sales validates
target customer set before drafting.

### Phase 3 — Customer + partner authoring (2–3 sprints)

#### Task 3.1 · `compliance_review_status` wired across all studio-aware tables

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<ts>_studio_review_status.sql` — `add column
  review_status compliance_review_status not null default 'approved'`
  to every studio-aware table not already carrying it (survey_org_templates,
  document_org_templates, meeting_templates, register_types). Existing
  rows backfill `'approved'` to preserve current behaviour. New rows
  default to `'draft'` only when written via studio (controlled at
  the mutator boundary).
- `src/components/studio/shell/PublishBar.tsx` — review-status toggle
  + reviewer picker.

**Acceptance:**
- [ ] Editing a customer-org template via studio transitions to `'draft'`.
- [ ] Submit-for-review transitions to `'reviewed'` and emits a
      `compliance_notifications` row of category `studio_review_requested`.
- [ ] Approve transitions to `'approved'`.

**Verification:** click-path through draft → reviewed → approved with
two user sessions (author + reviewer).

**Open questions:** Where does the AMU review workflow live? Today
there's no formal AMU-review surface for studio content. Recommend:
defer "Audited by AMU" badge to Task 3.5; in Phase 3 v1, "reviewed"
means peer-reviewed by an org admin with `studio.advanced`.

#### Task 3.2 · Partner switcher built on `partner_memberships` + GUC

**Status:** 📋 not started

**Why this is independent:** Reuses existing partner substrate.

**Files to touch:**
- `src/components/studio/shell/PartnerOrgSwitcher.tsx` — "Du arbeider
  i [Klient AS]" banner with switch dropdown. On switch, sets
  `app.active_partner_id` GUC and refetches studio data. Uses
  `partner_resolve_active_partner` helper.
- `src/hooks/usePartnerOrgs.ts` — list orgs the current user has
  active `partner_memberships` in.

**Reference precedent:** `partner_resolve_active_partner` function
in `20260907123300_partner_console_v0.sql:188-237`.

**Acceptance:**
- [ ] Partner user with memberships in 3 client orgs sees switcher
      with 3 options.
- [ ] Switching org refetches studio data scoped to the new org.
- [ ] Disconnecting a membership removes the org from the switcher on
      next page load.

**Verification:** seed 2 partner_memberships rows; verify switcher.
Revoke one; verify it disappears.

**Open questions:** none — substrate is established.

#### Task 3.3 · RLS policies layering `studio.partner_admin` on top of partner_memberships

**Status:** 📋 not started

**Why this is independent:** Depends on 3.2. Touches RLS on **every**
studio-aware module table — this is the dev review's "3 sprints
minimum" risk surface.

**Files to touch:**
- `supabase/migrations/<ts>_studio_partner_rls.sql` — add a SELECT +
  INSERT + UPDATE policy on each of the 7 studio-aware module tables
  that allows the partner-admin path. Pattern (per table):
  ```sql
  create policy studio_partner_admin_write on <table>
    for all to authenticated
    using (
      organization_id = current_setting('app.active_partner_id', true)::uuid
      and is_partner_member_of(partner_resolve_active_partner(organization_id, auth.uid()), auth.uid())
      and exists (select 1 from role_permissions where ... studio.partner_admin)
    )
    with check (same);
  ```
- Each policy enumerated explicitly per table (no dynamic policy
  generation; pgsql RLS does not support it).

**Acceptance:**
- [ ] Partner user with `studio.partner_admin` and an active
      membership in `org X` can edit `org X`'s templates.
- [ ] The same user has no access to `org Y` where they have no
      membership.
- [ ] A user with the permission but no active membership has no
      access to any org.

**Verification:** test each table with three users (partner-admin
linked, partner-admin unlinked, no permission).

**Open questions:** Performance — RLS query plan complexity with the
membership lookup on every studio read. Profile against a 100-org
seed in Phase 0; if any policy is >10ms, add a covering index.

#### Task 3.4 · Partner offboarding — soft-delete grace + draft preservation

**Status:** 📋 not started

**Files to touch:**
- `src/pages/admin/partners/PartnerOffboardingPage.tsx` — admin can
  revoke a partner_membership; revoke sets `active=false` and stamps
  `revoked_at`. Existing studio drafts authored by that partner are
  preserved for 30 days (TTL via cron-driven cleanup), giving the
  client time to claim or discard them.

**Acceptance:**
- [ ] Revoke flips `active=false`.
- [ ] Drafts authored by the revoked user remain visible to the
      client's admins for 30 days.
- [ ] After TTL, drafts are purged.

**Verification:** seed a draft; revoke partner; confirm draft still
visible to client admin; fast-forward 31 days; confirm purged.

**Open questions:** Who owns the cron job for TTL purge? Use existing
`workflow-cron-dispatcher` (per `workflow-engine-review.md`) once
shipped, otherwise an isolated `pg_cron` job.

#### Task 3.5 · "Audited" badge (deferred to follow-up; placeholder only)

**Status:** ⏸ deferred — see §10 open question 9.

The badge depends on an AMU-review workflow that doesn't exist today.
Phase 3 v1 ships review_status only; the badge ships in a follow-up
spec or Phase 3.5.

**Phase 3 acceptance:**
- [ ] Customer admin (only `studio.simple`) creates own-org template;
      RLS prevents touching system templates.
- [ ] Partner user with `partner_memberships` to N client orgs:
      switcher functional, edits scoped per active org.
- [ ] `compliance_review_status` flow works end-to-end.
- [ ] Offboarding preserves drafts 30d.

### Phase 4 — Marketplace (deferred, gated on §11 milestones)

**Gate:** 100+ Pro/Enterprise customers + 20+ active partners.
Estimate: ~3 sprints once gated, but the **gate must hold** — no
preparatory work in Phases 0–3 beyond the pack-as-portable-artifact
shape decided in Phase 2a.

Detail deferred to `specs/studio-marketplace.md` when the gate opens.

---

## 6. Inspiration borrowed (not blindly)

| Source | Borrow | Skip |
|---|---|---|
| Notion | Block-based content, slash menu, "open in advanced" affordance | Database-as-everything (overload) |
| Figma | Mode toggle ("dev mode"), shared shell with persona-specific affordances, conflict-resolution modal pattern | Vector graphics (not the job) |
| Webflow | Visual + code parity, publish-as-deliberate-action with preview | Hosted CMS lock-in |
| Airtable | Field schema-driven forms (mirror of `advancedSchema`), template library | Formula DSL as user-authoring tool |
| Salesforce Lightning App Builder | Component palette + property panel + responsive preview | Marketing-cloud UI complexity |
| Vanta / Drata / Secureframe | Framework packs as first-class objects, audited badge, evidence chain, immutable pack versions | Fixed framework set with no authoring |
| Compendia / Simployer / KS HMS | Norwegian terminology, paragraph-anchored content, vedtak → task hand-off | Vendor lock-in to specific HMS taxonomy |
| Shopify | Theme marketplace mechanics (tagging, search, partner program, immutable theme versions) | E-commerce specifics |

---

## 7. Critical files to touch

**New:**
- `src/lib/studio/{studioRegistry,studioTypes,freshId,PropertyFormGenerator,PresetPicker,WidgetKindRegistry,telemetry}.{ts,tsx}`
- `src/hooks/{useStudioRevision,useStudioMode,usePartnerOrgs}.ts`
- `src/pages/studio/{StudioPage,PackEditor}.tsx`
- `src/pages/admin/partners/{PartnerInvitePage,PartnerOffboardingPage}.tsx`
- `src/components/studio/shell/{ScopePicker,PalettePanel,CanvasFrame,
  PropertyInspector,PreviewPane,VersionTimeline,PublishBar,ModeToggle,
  ConflictModal,AutosaveIndicator,SimpleModeCards,PartnerOrgSwitcher}.tsx`
- `modules/<scope>/studio/{<scope>StudioScope.ts,<scope>Embedder.tsx}` × 8
- `supabase/functions/{studio-pack-export,studio-pack-import}/index.ts`
- `scripts/assert-studio-registry.ts`
- ~10 new forward migrations as listed in §5

**Refactor (collapse/replace, don't fork):**
- `src/components/reports/ReportModuleWidget.tsx` — if-chain → registry
  (Task 0.3; **1,452 lines**, behaviour-preserving refactor)
- `src/components/module/dashboard/{DashboardEditWidgetPanel,
  dashboardWidgetKinds}.tsx`
- `src/types/reportBuilder.ts`
- `src/lib/dashboards/useDashboardLayout.ts`
- `src/pages/overview/studio/{studioWizardCatalog,studioWizardFactories}.ts`
  → migrate to `modules/compliance/studio/`

**Extend (don't parallel-build):**
- `dashboard_layouts.kind` CHECK (Task 0.5)
- `compliance_notifications.category` CHECK + `payload jsonb` (Task 0.6)
- `partner_memberships` + helpers (Phase 3 builds on top; no new table)
- `compliance_review_status` enum (Task 3.1)
- `provision_<module>_baseline_for_org` — called from `studio-pack-import`
- `compliance-audit-pdf` — shares manifest-signing code with `studio-pack-export`
- `WizardModal` — Simple-preset runner

**Delete after cutover:**
- `src/pages/overview/studio/ComplianceStudioPage.tsx` (redirect → removable after Phase 1 ships)

---

## 8. Reuses (avoid duplication)

- `src/lib/dashboards/dashboardRegistry.ts` — registry pattern.
- `src/lib/workflows/workflowRegistry.ts` — declaration-merging precedent.
- `freshId('studio')` — single mint point.
- `dashboard_layouts` (with CHECK extended) — generic layout CRUD.
- `compliance_review_status` enum — single review-state vocabulary.
- `compliance_notifications` (extended) — single inbox.
- `compliance-audit-pdf` — signed-manifest code shared with pack export.
- `WizardModal` field kinds — match Simple preset field kinds 1:1.
- `partner_memberships` + helpers (`is_partner_member_of`,
  `is_partner_manager_of`, `partner_resolve_active_partner`) +
  `app.active_partner_id` GUC — Phase 3 builds on top.
- Existing per-module editors — embedded via adapters, never replaced.
- Auditor-token pattern from `specs/compliance-planner.md`.

---

## 9. Verification

### 9.1 Test strategy

| Layer | Tool | What it tests |
|---|---|---|
| Unit | Vitest | `studioRegistry` register/get round-trip; `PropertyFormGenerator` renders each field kind; `WidgetKindRegistry` migration produces identical render for fixture |
| Contract | Vitest + fixture | Embedder adapter contract (`value` / `onChange` / `onDirty` / `onConflict` / `lockState` props) — one test per scope's adapter |
| Integration | Vitest + test DB | `useStudioRevision` writes revision row; bulk path with GUC writes 0 rows |
| RLS | pgTAP (or SQL fixtures) | Each policy in Task 3.3 enforced for partner-admin / non-member / no-permission user trinity |
| E2E | Playwright | Simple-mode flows: complete each of the 21+ presets and assert DB row; mode toggle persists; conflict modal fires on simulated concurrent edit |
| Visual | Manual screenshot diff before/after Task 0.3 | All 9 widget kinds render pixel-identical |
| Prebuild | Custom Node script | Every kind has Simple preset + Advanced schema (Task 0.7) |

### 9.2 Performance budgets

| Surface | Budget | Measured how |
|---|---|---|
| `/studio` first-load JS bundle | ≤350 KB gz | Lighthouse + bundle analyzer |
| `/studio` TTI (P75 on 4G) | ≤2s | Lighthouse, real-user monitoring |
| Palette render with 40 kinds | ≤100ms | React Profiler |
| RLS plan for studio table reads | ≤10ms with 100-org seed | `explain analyze` per policy |
| `studio_revisions` insert overhead | ≤2ms per write | benchmark vs no-trigger control |
| Bulk pack import (100 templates) | ≤5s | Edge function timing |

### 9.3 End-to-end smoke pass after each phase

**After Phase 0:**
1. `pnpm typecheck && pnpm lint && pnpm test` clean.
2. All 9 widget kinds render identically (visual diff <0.5%).
3. `select count(*) from studio_revisions` after a single edit = 1;
   after a bulk provision with GUC set = 0.
4. `studio.*` permission keys present (count = 5).
5. Prebuild fails when a kind misses Simple preset or Advanced schema.
6. **Customer-signal validation passed thresholds** (Task 0.9).

**After Phase 1:**
7. Open `/studio` as `studio.simple` user — see 21 cards; mode toggle disabled.
8. Grant `studio.advanced`; toggle now active; flip persists across logout.
9. Complete 3 of the 3 compliance wizards via the new shell; verify
   same DB state as pre-relocation.
10. Telemetry events fire (7 distinct event types observed in analytics).

**After Phase 2a:**
11. Each of 7 content scope embedders mounts inside studio canvas in
    Advanced mode; behaviour-parity vs legacy editor.
12. Pack draft created, published, exported, re-imported into empty org;
    gap-matrix counts identical.
13. Edit attempt on a published immutable pack row → DB-level denial.

**After Phase 2b:**
14. `iso-27001 v1.0.0` published. Dashboard accent flips on `?pack=iso-27001`.
    Gap matrix shows ≥10 ISO paragraphs covered.

**After Phase 3:**
15. Customer admin (only `studio.simple`) edits own-org template;
    cannot edit system template (RLS denial).
16. Partner user switches between 2 client orgs; studio writes
    scoped to active org.
17. Submit edit → reviewed → approved transitions emit notifications
    and persist correctly.
18. Revoke a partner membership; draft visible for 30 days then purged.

**Cross-cutting:**
19. Migrations idempotent (`scripts/apply-migrations.sh` re-run is no-op).
20. RLS policies tested against partner-admin / non-member / no-permission
    user trinity for every studio-aware table.

---

## 10. Open questions (resolve before changing status to ready)

The four checked items below were resolved during senior PL + dev
review. The remaining five gate Phase 0 close-out (#1, #2, #3) or
later phases.

| # | Question | Decision / status |
|---|---|---|
| ✅ 1 | Pack versioning model | Immutable on publish (semver). Fixed in §3. |
| ✅ 2 | Marketplace gate threshold | 100 Pro/Enterprise + 20 partners. Fixed in §3. |
| ✅ 3 | `studio.advanced` default | Platform admins only (Phase 0–2). Fixed in §3. |
| ✅ 4 | Workflow conflict | Studio absorbs workflows. Fixed in §3. |
| 5 | AI/LLM authoring | Deferred to `specs/studio-ai-authoring.md`. Not in v1. |
| 6 | Norwegian-only locale ceiling | Phase 4 international expansion requires locale-aware preset content. Defer concrete model until first non-NB customer signs. |
| 7 | Storybook for kind registry | Defer until kind count >15. Manual screenshot diff is the v1 visual-regression strategy. |
| 8 | Partner offboarding TTL = 30d | Confirm with sales; revisit if customers ask for longer grace. |
| 9 | "Audited by AMU" badge | Depends on AMU-review workflow that doesn't exist today. Defer to Phase 3.5 or follow-up spec. |
| 10 | Semver bump policy enforcement | Recommend patch / minor / major rules (Task 2a.2 open question); validate with first real customer use. |
| 11 | Mobile preview vs authoring | v1: preview-only on mobile. Authoring desktop-only. Confirm with sales. |
| 12 | Concurrency model = last-writer-wins | Confirmed in §3. If customer feedback in Phase 1 demands CRDT or pessimistic locking, revisit. |

---

## 11. Business framing (hypothesis — validate in Phase 0)

> **Read this as hypothesis, not plan.** Every claim below is internal
> logic until Task 0.9 (customer-signal validation) produces evidence.
> Phase 2+ work does not begin until those thresholds are met. If
> they are not met, the platform thesis is paused and the spec rescopes
> to a Phase 0+1 consolidation deliverable.

### Hypothesised tier ladder

| Tier | Capability | Studio access | Permission keys | Indicative ARPU lift |
|---|---|---|---|---|
| Standard | Read system content, run compliance | Read-only previews | none | 1× baseline |
| Pro | Edit own-org templates / workflows / courses | Simple mode | `studio.simple` | hypothesised 2–3× |
| Enterprise | Author org-specific packs, industry verticalisation | Simple + Advanced | `+ studio.advanced + studio.packs` | hypothesised 5–10× |
| Partner | Multi-tenant studio, N client orgs | Simple + Advanced + partner switcher | `+ studio.partner_admin` | hypothesised per-seat or rev-share |
| Marketplace | Publish to catalog | Simple + Advanced + listing wizard | `+ studio.marketplace_publish` | hypothesised rev-share (defer to v4) |

Norwegian SMB baseline: 500–2 000 NOK/user/month. The 3× / 5–10×
multipliers are reference numbers from international compliance/GRC
platforms (Vanta, Drata, Secureframe); Norwegian SMB price elasticity
is unverified.

### Hypothesised defensibility

- **Content moat**: customer-authored templates lock in IP. Unverified
  until ≥10 customers have ≥20 templates each.
- **Regulation moat**: faster pack ship per new regulation. Unverified
  until ISO 27001 ships via studio (Phase 2b).
- **Partner moat**: consultants bring clients. Unverified until ≥3
  partner LOIs land in Phase 0 + ≥1 paid partner pilot in Phase 3.

### Validation experiments (Phase 0 exit gate)

See Task 0.9. Thresholds:
- ≥4/8 customers state monthly Simple-mode use (50%)
- ≥2/8 customers state willingness-to-pay 2× Standard (25%)
- ≥1 partner LOI

If thresholds miss: pause Phase 2+; ship Phase 0+1 as a consolidation
deliverable only; revisit the platform thesis 6 months later.

### Success metrics with thresholds (6 mo post-Phase-1-ship)

| Metric | Threshold for "continue" | Threshold for "halt" |
|---|---|---|
| % of admins who open `/studio` and complete a Simple preset (week 1) | ≥40% | <20% → halt Phase 2 |
| Pro-tier conversion (6 mo) | ≥10% of customer base | <5% → pause Phase 3 |
| Partner LOIs signed (6 mo) | ≥3 | 0 → drop Phase 3 partner work, ship customer-only Studio |
| Advanced-mode usage (12 mo) | ≥30% of Pro-tier sessions | <10% → simplify or remove Advanced mode |

### Concrete milestones (validation thresholds, repeat from §11)

| Horizon | Milestone | Validates |
|---|---|---|
| Phase 0 exit | Task 0.9 thresholds met | Demand for paid tiers |
| 6 mo post-Phase-1 | 15% on Pro tier; 5 active partners; ISO 27001 pack shipped | ARPU lift; channel signal; loop-closes proof |
| 12 mo | 25% Pro; 3 Enterprise; 20 partners; first partner-authored pack | Studio-replaces-SQL loop holds |
| 18 mo | 50+ packs; partner-sourced ARR ≥25% of new ARR | Marketplace gate decision |
| 24 mo | SE/DK locale-aware packs; marketplace soft-launch if metrics support | International + two-sided market |

### Risks with mitigations (spec-bound)

| Risk | Likelihood | Mitigation (where) |
|---|---|---|
| Customer-signal misses Phase 0 thresholds | Medium | Task 0.9 gate explicitly halts Phase 2; Phase 0+1 still ships visible value |
| Complexity tax — 80% don't use it | High | Simple/Advanced split (§4); telemetry-led promotion (Task 1.3) |
| Customer-authored content liability | High | `compliance_review_status` mandatory (Task 3.1) |
| RLS performance with partner_memberships join | Medium | Profile in Phase 0 (§9.2); add covering indexes if needed |
| Phase 0 de-prioritised mid-flight | High | Phase 0 has two visible wins (Tasks 0.9 + 0.10) — sellable to stakeholders |
| Channel conflict (partner vs client ownership) | Medium | Soft-delete grace 30d (Task 3.4) |
| Norwegian-only ceiling | Medium | `name_i18n` from day one (§3); locale model open Q 6 |
| Embedder adapter complexity (1,231-line DocumentEditorWorkbench) | Medium | Adapter contract explicit (§4); each adapter ~100–200 LoC; Phase 2a.1 owns this risk |
| `ReportModuleWidget` refactor regression | Medium | Visual-diff acceptance (Task 0.3); 9 kinds enumerated by line number |

---

## 12. Dependencies on upstream specs

| Spec | Current status | What this spec depends on | Risk if delayed |
|---|---|---|---|
| `specs/workflow-engine-review.md` | No status marker; Phase A + B unshipped | Phase 2a.1 workflow embedder requires Phase A substrate (`workflow_rules.law_refs`, registry refactor) + Phase B builder (`WorkflowBuilderPage`) | Studio ships without workflow scope; revisit when workflow lands |
| `specs/compliance-planner.md` | `📋 ready — data layer shipped, UI not started` | Phase 2a.3 export uses the auditor-token pattern from §6 once it ships; not blocking | Studio auditor-export UI deferred |
| AMU-review workflow | Doesn't exist | Task 3.5 ("Audited" badge) — explicitly deferred (open Q 9) | Already deferred; no impact |
| `ROADMAP.md` | This spec is unanchored (zero mentions of studio/partner/marketplace) | Phase 0 must update `ROADMAP.md` §X (TBD) with studio status before Phase 1 starts | Spec floats; team can't track progress |

**Coordination plan:** the workflow-engine-review owner and this
spec's owner sync at Phase 0 mid-point. If workflow Phase A is not
underway by Phase 0 end, this spec ships Phase 1 without the workflow
scope and adds it as a follow-up task once workflow Phase A+B land.

---

## 13. Senior-architect checklist (PLAYBOOK §7)

- [x] **Reference precedent linked for every task** — §2 anchors
      (dashboardRegistry, workflowRegistry, ComplianceStudioPage,
      compliance-planner, partner_console_v0); each Phase 0–3 task
      cites the file path of the pattern it follows.
- [x] **Vertical slices verified** — each task that has a UI surface
      touches DB → types → registry → UI → telemetry. Pure-substrate
      tasks (0.1, 0.5, 0.6) are honest about being infra-only and
      pair with Task 0.10 as the visible-win counterweight (per PL
      review's "Phase 0 unsellable" mitigation).
- [x] **Dependency graph is a DAG** — Phase 0 (tasks 0.1–0.10) → 1 →
      2a → 2b → 3, with 4 conditional on §11 milestones. Phase 0
      Task 0.9 customer-signal gate is the only inter-phase block.
- [x] **Acceptance criteria are observable**, not implementation-
      coloured (e.g. Task 0.3 "all 9 widget kinds render identically
      — pixel-diff <0.5%" instead of "calls registry.get correctly").
- [x] **Open questions enumerated at the top of §10**, not buried in
      tasks. §10 distinguishes resolved (✅ 1–4) from deferred (5–12).
- [x] **Migrations idempotent** — every migration in §5 uses `add
      column if not exists`, `on conflict do update set`, or `drop
      constraint if exists` + recreate. No destructive ops.
- [x] **Spec runs without re-reading the PLAYBOOK at execution time**
      — task shape duplicated in §5; cross-references to
      `PLAYBOOK.md §3` are explicit, not implicit.
- [x] **PLAYBOOK stays generic** — module-specific decisions
      (StudioKindMap, Embedder adapter contract, partner GUC reuse)
      live in this spec, not in PLAYBOOK.
- [x] **Substrate audit performed** — three reuse claims verified
      against schema before locking in §3 decisions:
      `dashboard_layouts.kind` CHECK constraint
      (`_20260905120000_reports_promote_dashboard_layouts.sql:22-24`)
      → extended in Task 0.5;
      `compliance_notifications.category` CHECK + missing `payload
      jsonb` (`archive/_20260904120100…sql:26-35`) → extended in
      Task 0.6;
      `partner_organizations` + `partner_memberships` + helpers +
      `app.active_partner_id` GUC
      (`_20260907123300_partner_console_v0.sql`) → reused in Phase 3
      Task 3.2 instead of a parallel `partner_org_links` table.
- [x] **Phase costs re-validated** against senior-dev review:
      Phase 0 = 4–5 sprints (was 3), Phase 2 split into 2a plumbing
      (2 sprints) + 2b ISO 27001 content seed (2 sprints),
      Phase 3 = 2–3 sprints (was 1). Phase 0 Task 0.3 (the
      `ReportModuleWidget.tsx` 1,452-line refactor) is its own
      sprint, not "part of Phase 0 plus four other things".
- [x] **Business framing (§11) labelled as hypothesis** with
      explicit validation gate (Task 0.9): 5–8 customer interviews
      + 1–2 partner interviews + pricing test. Numeric thresholds
      (≥50% Simple-mode interest, ≥25% willingness to pay 2×, ≥1
      partner LOI). Halt Phase 2+ if missed.

Status changed to `📋 ready` on 2026-05-17. Next gate is stakeholder
sign-off on the PR before Phase 0 engineering starts.

---

## 14. When this spec changes

- A new scope opts into the studio → add a row to §2 + a scope file in §7.
- The kind registry adds a new field kind → update §4 contract.
- A milestone in §11 lands → mark ✅, refresh thresholds.
- Task 0.9 thresholds miss → halt Phase 2; rescope to Phase 0+1 only.
- Marketplace ships → fork to `specs/studio-marketplace.md`.
- Workflow spec lands Phase A/B → update §12 dependency row and
  unblock Phase 2a.1 workflow embedder task.
