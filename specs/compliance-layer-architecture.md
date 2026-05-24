# Compliance Layer — 3-Tier Architecture (Rules → Internal Controls → Execution)

**Status:** ✅ Phase 1 shipped — substrate + module + auto-binding + ~30 system controls.
**Owner:** Compliance platform team.
**Last reviewed:** 2026-05-24.

> Read this first: `CLAUDE.md` *Template surfaces* + `specs/compliance-planner.md`
> (the gap-and-audit planner consumes the new layer). The decisions in
> §1 are locked in by the AskUserQuestion round of 2026-05-24 — don't
> re-litigate; raise a follow-up spec instead.

---

## 1 · Problem statement

NewAMU ships 8 capability modules (compliance/checklist, survey, documents,
meetings, learning, registers, tasks, alerts) and 9 baseline regulations
(`regulations` table). Every template surface carries `law_refs[]` as
exact strings (`'AML § 3-1'`, `'ISO 45001:2018 § 9.2'`, `'GDPR Art. 33'`).
The workflow engine tags rules with `law_refs[]` + `frameworks[]`. The
compliance-planner (ROADMAP §5) can render a paragraph × module gap
matrix from this raw substrate.

What's missing is a first-class entity for **what the company actually
does** to satisfy a paragraph. Today:

```
regulation  →  compliance_requirements (pack-scoped)  →  templates (law_refs[])  →  executions
```

A real-world control like "Årlig ledelses-gjennomgang" satisfies
AML § 7-2(2)f + IK-f § 5 nr. 8 + ISO 9001 § 9.3 + ISO 14001 § 9.3 +
ISO 27001 § 9.3 + ISO 45001 § 9.3 simultaneously. The schema forces six
duplicated `compliance_requirements` rows (one per `pack`) and pretends
the work-product (the AMU årsrapport meeting + the årsgjennomgang
document + the management-review checklist execution) is template-pack-
bound. Cross-framework reuse is unrepresentable.

A single decoupling layer between rules and execution fixes this. ISO
27001 § 9.3 and IK-f § 5 nr. 8 are *separate clauses*, but they are
both satisfied by *the same internal control*, evidenced by *the same
artefact*.

---

## 2 · The three tiers

### Tier 1 · Rules (canonical, system-managed)

Two layers, additive over the existing `regulations` + `compliance_requirements`:

| Layer | Table | Role | Ownership |
|---|---|---|---|
| Framework | `regulations` (existing) | Top-level law/standard ('aml', 'iso-45001', 'gdpr') | Per-org, `is_system=true` for baseline (9 frameworks) |
| Clause | `regulation_clauses` (new) | Paragraph-level item ('aml-3-1', 'iso-45001-9-3') with hierarchy via `parent_clause_id` | Per-org, `is_system=true` for baseline |
| Pack clause | `compliance_requirements` (existing — kept; gains `clause_id` FK) | Pack-scoped denormalisation used by checklist templates today | Per-org or system; backwards-compatible |

`regulation_clauses` uses the same composite-PK pattern as `regulations`
(`primary key (organization_id, id)` where `id` is the slug). A
`regulation_id_must_match_org()`-style trigger asserts same-org
coherence with `regulations`. RLS mirrors `regulations`.

The `code` column stores the exact display string from `law_refs[]`
entries (`'AML § 3-1'`, `'IK-f § 5 nr. 7'`, `'GDPR Art. 33'`) so the
gap planner's exact-string matching keeps working. The 9 system
regulations seed ~120 baseline clauses covering all chapters of AML, all
ISO 9001/14001/27001/45001 clauses 4–10, IK-f § 5 nr. 1–8, GDPR Arts.
5/6/9/13–21/25/28/30/32/33/34/35/37, LDL § 26 + § 26a, Åpenhetsloven
§ 4 + § 5, and Brann- og eksplosjonsvernloven § 5–16.

**`compliance_requirements` migration** is additive only: `alter table
add column if not exists clause_id text`, plus a one-shot UPDATE that
backfills `clause_id` from `code` ↔ `regulation_clauses.code`. No rows
move; no destructive change.

### Tier 2 · Internal Controls (per-org logic)

Five new tables, all RLS-scoped to `organization_id = current_org_id()`.

#### `internal_controls`

What the company commits to doing. Each row is a *named* control.

| Column | Purpose |
|---|---|
| `id` uuid | PK |
| `organization_id` uuid | RLS scope |
| `slug` text | unique per org |
| `name` / `name_i18n` jsonb | display |
| `purpose` text / `purpose_i18n` jsonb | what risk this control mitigates |
| `control_family` enum | `preventive` / `detective` / `corrective` / `directive` |
| `frequency_hint` text | `arlig` / `halvarlig` / `kvartalsvis` / `manedlig` / `ukentlig` / `ad_hoc` (mirrors existing `cadence_hint`) |
| `owner_role` text | functional-role slug (e.g. `hms_leder`) |
| `owner_user_id` uuid | optional named owner |
| `status` enum | `draft` / `active` / `retired` |
| `is_system` bool | platform-shipped baseline vs org-defined |
| `is_active` bool | soft-disable |
| `nav_pinned` bool | sidebar pin |
| `metadata` jsonb | per-org extras |
| `deleted_at` timestamptz | soft-delete |

#### `internal_control_clauses`

Junction `(control_id, clause_id)`. One control satisfies many clauses —
this is the cross-framework reuse mechanism. `coverage_level` enum
distinguishes `primary` (the control's main purpose) from
`supporting` / `partial` (control contributes but doesn't fully cover).
Same-org coherence trigger asserts both rows belong to the org (system
clauses always allowed).

#### `internal_control_bindings`

Declarative spec: *which module artefact counts as proof*. Polymorphic
via `source_kind` enum.

| Column | Purpose |
|---|---|
| `control_id` | parent control |
| `source_kind` | `compliance_execution` / `survey_response` / `document_acknowledgement` / `learning_completion` / `task_completion` / `meeting_protocol` / `register_record` / `manual_evidence` |
| `source_template_table` | which template table this binds to (e.g. `compliance_checklist_templates`, `meeting_system_templates`) |
| `source_template_id` text | id of the specific template (text — different tables use different id types) |
| `source_template_slug` text | denormalised for diagnostics |
| `requirement_kind` enum | `latest_within_cadence` / `count_within_period` / `exists` / `signed` |
| `cadence_hint` text | override the control's default (e.g. monthly fire drill on a quarterly control) |
| `lead_time_days` int | days before due to flag as `due_soon` |
| `is_required` bool | a required binding must be satisfied for the control to count as "on track" |
| `notes` text | admin-facing rationale |

A `BEFORE INSERT` trigger validates that `source_template_id` exists in
`source_template_table` and belongs to the same org (or is a system row).

#### `internal_control_executions`

Append-only proof ledger. One row per *occurrence* (e.g. one row per
signed checklist execution that matched a binding).

| Column | Purpose |
|---|---|
| `id` uuid | PK |
| `control_id` | which control |
| `binding_id` | which binding produced this row (nullable for manual entries) |
| `source_kind`, `source_table`, `source_id` | back-pointer to artefact |
| `occurred_at` | when the underlying event happened |
| `period_label` | optional human label ("Q2 2026") |
| `summary` | denormalised display string |
| `evidence_url` | optional manual link |
| `signed_by`, `signed_at`, `sha256_checksum` | provenance |
| `payload` jsonb | per-source-kind extras |
| `created_at`, `created_by` | audit |

Unique partial index on `(control_id, source_table, source_id)` prevents
duplicate inserts when an event re-fires. `BEFORE UPDATE/DELETE` trigger
denies mutation unconditionally — append-only.

#### `internal_control_status_v` (view)

Computed per control: last execution timestamp, next due date, status
label (`on_track` / `due_soon` / `overdue` / `never_executed`), gap
clause codes (clauses whose controls have not been executed within
cadence). Drives the controls list, hub, and KPI widget.

### Tier 3 · Execution (existing modules — read-only)

A `compliance_evidence_v` view unions seven module execution tables
into a single canonical shape:

```sql
(organization_id, occurred_at, source_kind, source_table, source_id,
 title, law_refs text[], signed_at)
```

Drives:
1. "Bevisjournal" tab on a control detail page.
2. "Last 12 months of evidence for clause X" feed (compliance planner §5.4).
3. Phase-2 read paths that don't depend on bindings.

RLS inherits from base tables (every branch already enforces
`organization_id = current_org_id()`).

### Auto-binding (Phase 1)

Seven `AFTER`-triggers on module sign events call a single SECURITY
DEFINER resolver `_compliance_layer_record_execution(...)` that finds
every binding matching `(source_kind, source_template_id)` for the org
and inserts an `internal_control_executions` row per match. Idempotent
via the unique partial index.

| Module | Trigger source | source_kind |
|---|---|---|
| Compliance checklist | `compliance_checklist_executions` AFTER UPDATE OF `signed_at` | `compliance_execution` |
| Meeting | `meeting_protocol_exports` AFTER INSERT | `meeting_protocol` |
| Document | `wiki_compliance_receipts` AFTER INSERT | `document_acknowledgement` |
| Learning | `learning_course_progress` AFTER UPDATE OF `completed_at` | `learning_completion` |
| Task | `task_items` AFTER UPDATE OF `status` (to 'done') | `task_completion` |
| Register | `register_records` AFTER INSERT | `register_record` |
| Survey | `surveys` AFTER UPDATE OF `closed_at` *and* `survey_campaigns` AFTER UPDATE OF `status` (to 'closed') | `survey_response` |

Triggers are guarded with `to_regclass(...) is not null` so a missing
optional table no-ops cleanly. Recursion-safe (the resolver only writes
to `internal_control_executions`, which has no triggers of its own).

---

## 3 · Files added

### Migrations (`supabase/migrations/`)

| Basename | Purpose |
|---|---|
| `20260926120000_compliance_layer_regulation_clauses.sql` | Tier 1: clauses + backfill `compliance_requirements.clause_id` |
| `20260926120100_compliance_layer_internal_controls.sql` | Tier 2: `internal_controls` + enums + RLS |
| `20260926120200_compliance_layer_clause_junction.sql` | Tier 2: control ↔ clause + same-org trigger |
| `20260926120300_compliance_layer_bindings.sql` | Tier 2: binding spec + template-existence trigger |
| `20260926120400_compliance_layer_executions.sql` | Tier 2: executions ledger + immutability + 7 auto-bind triggers |
| `20260926120500_compliance_layer_evidence_view.sql` | Tier 3: `compliance_evidence_v` |
| `20260926120600_compliance_layer_provision_and_seed.sql` | `provision_internal_controls_baseline_for_org` + ~30 system controls |

### Module (`modules/compliance-layer/`)

```
modules/compliance-layer/
├── index.ts
├── types.ts                              re-exports from src/types/complianceLayer.ts
├── schema.ts                             Zod parsers (parseRows pattern)
├── useInternalControls.ts                CRUD on internal_controls
├── useControlClauses.ts                  junction load + assign/unassign
├── useControlBindings.ts                 binding spec CRUD
├── useControlEvidence.ts                 executions read + status view
├── useComplianceLayerNav.ts              sidebar pin support
├── ControlsHubLanding.tsx                tile grid grouped by status
├── ControlsListPage.tsx                  full table with filters
├── ControlDetailPage.tsx                 tabs (Oversikt/Lovkrav/Bindinger/Bevisjournal/Innstillinger)
├── ControlEditorPanel.tsx                slide-panel create/edit
├── admin/
│   ├── BindingEditorPanel.tsx
│   ├── ClauseMappingPanel.tsx
│   └── KontrollerInnstillingerPage.tsx
├── dashboards/
│   ├── complianceLayerScope.ts           9th registered dashboard scope, accent #b45309 (amber-700)
│   └── useComplianceLayerDatasets.ts
└── ComplianceLayerAnalysePage.tsx
```

### Types (`src/types/complianceLayer.ts`)

Single file mirroring DB columns. Enums and row types for all 5 tables +
the view. No `any` — strict `as const` enums.

### Additive wiring

- `src/lib/permissionKeys.ts` — append `module.view.compliance_layer` + `compliance_layer.manage`.
- `src/components/layout/AticsShell.tsx` — insert `controlsGroup` NavGroup between Sjekklister and Undersøkelser.
- `src/App.tsx` — five new routes under `/controls` plus one `/auditor/controls/:token` scaffold.
- `ROADMAP.md` — §11 row pointing here.

---

## 4 · Decisions locked in

| Q | Decision | Rationale |
|---|---|---|
| Migration aggressiveness | **Additive** — keep `compliance_requirements`, add `clause_id` FK | Zero regression risk. 5+ provision functions and the existing junction `compliance_template_requirements` keep working unchanged. |
| Auto-binding timing | **Phase 1** — DB triggers from day one | Live evidence from the moment a control is bound; users don't need to discover a "Refresh evidence" button. |
| Route | **`/controls`** top-level NavGroup | Controls span all modules. Nesting under `/compliance/checklists` would read as "extra checklist admin", which it isn't. |
| Seed scope | **~30 controls** — full AML + IK-f + ISO 45001 + GDPR + LDL + Åpenhetsloven + brann | Production-ready baseline an org can use immediately. Each control demonstrates cross-pack reuse (1–6 clauses per control). |

---

## 5 · Patterns reused

| Need | Reference | Where reused |
|---|---|---|
| Composite PK + per-org row with `is_system` baseline | `regulations` (`_120035`) | `regulation_clauses` |
| Same-org coherence trigger | `regulation_id_must_match_org()` (`_120036`) | `regulation_clauses` ↔ `regulations`; `internal_control_clauses` ↔ both |
| Provision fn + new-org trigger + backfill | `provision_documents_baseline_for_org` (`_120033`) | `provision_internal_controls_baseline_for_org` |
| Polymorphic source pattern | `task_project_evidence.kind/external_ref_table/external_ref_id` (`_120001`) | `internal_control_bindings` + `internal_control_executions` |
| Append-only ledger w/ BEFORE-UPDATE deny | `meeting_protocol_exports` (`_120001`) | `internal_control_executions` |
| `freshId(prefix)` mint | `src/lib/dashboards/freshId.ts` | All client-side id mints in the new module |
| `registerDashboardScope` + side-effect import | `dashboardRegistry.ts` | `complianceLayerScope.ts` |
| `flatSubs: true` sidebar nav | `useComplianceNav` + AticsShell compliance section | `useComplianceLayerNav` + new `controlsGroup` |
| RLS pattern (org scope + role check) | `compliance_requirements` (`_120100`) | All new tables |
| Self-audit header convention | PR #175 commits | Every new migration |
| Token-auth read-only auditor route | `survey_invitation_tokens` + `meetings_external_redeem_token` | `/auditor/controls/:token` scaffold |
| `parseRows` resilience | `modules/compliance/schema.ts` | `modules/compliance-layer/schema.ts` |

---

## 6 · Verification

After all migrations + code land:

1. `scripts/apply-migrations.sh` against a fresh local Supabase succeeds and is idempotent on rerun.
2. `pnpm typecheck` clean.
3. Visit `/controls` as an authenticated org admin → tile grid renders ~30 system controls grouped by `status_label`.
4. Click "Årlig ledelses-gjennomgang" → detail page shows ≥6 regulation clauses across ISO 9001/14001/27001/45001 + AML § 7-2(2)f + IK-f § 5 nr. 8.
5. As an admin, sign a `compliance_checklist_executions` row whose template is bound to a control → row appears under "Bevisjournal" without manual intervention. Re-signing the same row does not insert a duplicate.
6. `/controls/analyse` renders the 9th dashboard scope with the seven datasets.
7. Open compliance-planner gap matrix — every paragraph that any baseline control covers now has matching control names alongside the existing module counts.
8. Apply migrations against a remote project with one existing org → backfill loop seeds baseline controls/bindings without errors; no regression on compliance/checklist sign + meeting protocol sign + learning completion smoke tests.
9. Generate auditor token for `/auditor/controls/:token`, open in incognito → read-only control list visible; no write paths.
10. Confirm: no `cryptoUuid()` polyfill; side-effect import `import './dashboards/complianceLayerScope'` present; migration basenames globally unique across both folders.

---

## 7 · Out of scope (Phase 2)

- Compliance-planner gap-matrix UI update (paragraph × *control* axis surfacing).
- Auditor view full PDF export (already covered generically by `compliance-audit-pdf`).
- `modules/compliance-layer/workflows/` scope file (when unified workflow builder lands per `specs/workflow-engine-review.md`).
- Bidirectional sync between `compliance_plan_items.status` and `internal_control_executions` cadence (today one-way; planner consumes the new layer read-only).
- Cross-org benchmarking ("how does our management-review cadence compare to peer orgs?").

---

## 8 · Deliverables checklist

- [x] §1 Problem statement
- [x] §2 Tier definitions
- [x] §3 Files added
- [x] §4 Decisions
- [x] §5 Patterns reused
- [x] §6 Verification plan
- [x] M1 — `_120000_compliance_layer_regulation_clauses.sql`
- [x] M2 — `_120100_compliance_layer_internal_controls.sql`
- [x] M3 — `_120200_compliance_layer_clause_junction.sql`
- [x] M4 — `_120300_compliance_layer_bindings.sql`
- [x] M5 — `_120400_compliance_layer_executions.sql`
- [x] M6 — `_120500_compliance_layer_evidence_view.sql`
- [x] M7 — `_120600_compliance_layer_provision_and_seed.sql`
- [x] T1 — `src/types/complianceLayer.ts`
- [x] X1 — `modules/compliance-layer/index.ts`
- [x] X2 — `modules/compliance-layer/types.ts`
- [x] X3 — `modules/compliance-layer/schema.ts`
- [x] X4 — `modules/compliance-layer/useInternalControls.ts`
- [x] X5 — `modules/compliance-layer/useControlClauses.ts`
- [x] X6 — `modules/compliance-layer/useControlBindings.ts`
- [x] X7 — `modules/compliance-layer/useControlEvidence.ts`
- [x] X8 — `modules/compliance-layer/useComplianceLayerNav.ts`
- [x] X9 — `modules/compliance-layer/ControlsHubLanding.tsx`
- [x] X10 — `modules/compliance-layer/ControlsListPage.tsx`
- [x] X11 — `modules/compliance-layer/ControlDetailPage.tsx`
- [x] X12 — `modules/compliance-layer/ControlEditorPanel.tsx`
- [x] X13 — `modules/compliance-layer/admin/BindingEditorPanel.tsx`
- [x] X14 — `modules/compliance-layer/admin/ClauseMappingPanel.tsx`
- [x] X15 — `modules/compliance-layer/admin/KontrollerInnstillingerPage.tsx`
- [x] X16 — `modules/compliance-layer/dashboards/complianceLayerScope.ts`
- [x] X17 — `modules/compliance-layer/dashboards/useComplianceLayerDatasets.ts`
- [x] X18 — `modules/compliance-layer/ComplianceLayerAnalysePage.tsx`
- [x] W1 — `src/lib/permissionKeys.ts` additions
- [x] W2 — `src/components/layout/AticsShell.tsx` additions
- [x] W3 — `src/App.tsx` route additions
- [x] W4 — `ROADMAP.md` §11 row
