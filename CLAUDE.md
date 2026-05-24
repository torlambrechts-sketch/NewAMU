# Claude Code primer — NewAMU

This file is the project-level system prompt for Claude Code. Keep it terse —
it loads every session. Point to authoritative docs; don't duplicate them.

## Source of truth

| Need | Look here |
|---|---|
| Module parity ports (process spec) | `specs/PLAYBOOK.md` |
| Per-module port plans + status | `specs/<module>-parity.md` (`survey`, `tasks`, `elearning`, `documents`, `meetings`) |
| Roadmap status across the whole product | `ROADMAP.md` |
| Public documents for designers / PMs | `*.md` at repo root (DESIGN_SYSTEM, MODULE_SPEC, etc.) — these are *output*, not process |
| Migrations to apply on a fresh DB | `supabase/migrations/` (top level + `archive/`, both run; sorted by basename — see `scripts/apply-migrations.sh`) |
| Per-module template surfaces + seeding pattern | This file, *Template surfaces* below. Concrete examples in PR #175 (commits `f67c833` … `5d94df0`). |
| Compliance gap-and-audit planner (next sprint) | `specs/compliance-planner.md` — full handover spec with data inventory, deliverables, schema, and one-shot prompt. `ROADMAP.md` §5 has the status row. |

When asked to plan a new module port, **copy the latest parity spec** as a
starting point and run the senior-architect checklist in `PLAYBOOK.md §7`
before changing status to `📋 ready`.

## Dashboard engine

Reusable runtime any module registers a "scope" with. Eight scopes today
(compliance_checklist / survey / tasks / learning / documents / meetings /
registers + the `hms_overview` composite); the architecture has stabilised.

Layout per scope:

```
modules/<scope>/dashboards/                      (or src/pages/<scope>/dashboards/)
  <scope>DashboardScope.ts     // registerDashboardScope({ scopeId, label, defaultLayout, widgetCatalog, datasets, accent, compositeMembers? })
  use<Scope>Datasets.ts        // (filters, source data) → Record<datasetKey, unknown>

modules/<scope>/<Scope>AnalysePage.tsx           (or src/pages/<scope>/<Scope>AnalysePage.tsx)
  // Imports the scope file as a side effect, calls the datasets hook,
  // hands the result to <ModuleAnalyticsDashboard>.
```

Engine internals:

| File | Role |
|---|---|
| `src/lib/dashboards/dashboardRegistry.ts` | scope registry, `instantiateWidget`, `getDashboardScope` |
| `src/lib/dashboards/freshId.ts` | **single source of id minting** — never copy `crypto.randomUUID` polyfills |
| `src/lib/dashboards/useDashboardLayout.ts` | load/save/named-views/saveAs/rename/markDefault for `dashboard_layouts` |
| `src/lib/dashboards/dashboardFilters.ts` | filter chip primitives, `makeFilter` (uses `freshId`) |
| `src/components/module/ModuleAnalyticsDashboard.tsx` | runtime that renders a scope; takes layout + datasets + filters + drill-down |
| `src/components/reports/ReportModuleWidget.tsx` | renderer for every `ReportModuleKind`; emits `DrillDownEvent` for clickable widgets |
| `src/lib/reports/widgetCsv.ts` | per-kind CSV serialiser (3.4.1) |

Widget kinds today: `kpi` · `table` · `bar` · `donut` · `line` · `heatmap`.
Adding a kind means updating *six* call sites — the union in
`src/types/reportBuilder.ts`, the loose Zod schema in `useDashboardLayout.ts`,
the renderer in `ReportModuleWidget.tsx`, plus three exhaustive maps in
`src/components/module/dashboard/`: `KIND_LABELS`, `kindSwitch`, and
`defaultCompatibleKinds`. (TS will tell you when one is missing — don't
silence those errors.)

Composite scopes (`compositeMembers: string[]`) compose member scopes by
merging dataset maps. Keys are scope-namespaced (`learning_kpi_summary`,
`checklist_kpi_summary`, …) so no collisions are possible. The host page
imports each member's `useXxxDatasets` and passes the same `filters`
array to all of them — chips each scope understands narrow its data;
chips it doesn't are ignored.

## Information architecture

Sidebar lives in `src/components/layout/AticsShell.tsx`. Each capability
module that's gone through parity port appears as a top-level `NavGroup`
with `flatSubs: true`:

```
HMS-oversikt → Sjekklister → Undersøkelser → Dokumenter → Møter → Register → Oppgaver → Læring
```

Conventions when promoting a module:

- Define `<MODULE>_NAV_PERMS: PermissionKey[]` (broad permAny pattern — view
  roles must still see the menu)
- Group has fixed `Analyse` + `Innstillinger` subs first, then dynamic
  pinned templates from a `useXxxNav` hook (compliance/survey/documents)

The legacy "Gamle moduler" staging group and its modules (SJA, ROS,
vernerunder, inspection, internkontroll, HSE, organisasjonshelse, members,
HR-compliance, action-plan, avvik-legacy, aarshjul, risiko-sikkerhet,
workplace-reporting / varsling, action-board, rapportarkiv,
workspace/revisjonslogg, /modules/aarskontroll, /dashboard/classic,
/hrm/*) were removed. A new `alerts` (varsling) module is planned
separately. Migrations and DB tables for the deleted modules remain
in place; a follow-up PR may drop them once no integration reads them.

## Accent palette (per-scope, registered)

| Scope | Accent | Notes |
|---|---|---|
| `compliance_checklist` | `#1a3d32` | Brand green — flips per `?pack=` (see `modules/compliance/dashboards/packAccents.ts`: AML green vs ISO blue `#1e40af`) |
| `survey` | `#7c3aed` | Megaphone purple |
| `tasks` | `#c2410c` | Kanban amber |
| `learning` | `#0e7490` | Teal |
| `documents` | `#0f766e` | Deep teal — distinct from learning in the composite |
| `hms_overview` | `#4338ca` | Indigo — reads as "different layer" from each member |
| `meetings` | `#0891b2` | Cyan — distinct from learning teal (`#0e7490`) and documents deep teal (`#0f766e`) |
| `regelverk_coverage` | n/a | Regelverk-dekning oversiktsside (`src/pages/overview/regelverk/RegelverkCoveragePage.tsx`) |

Pages resolve the accent via `getDashboardScope(scopeId)?.accent` and pass
it to `ModuleAnalyticsDashboard`. Compliance overrides with `packAccentFor`
based on the URL.

## Template surfaces

Each template-shipping module stores its content in a different shape.
Before seeding new templates, copy the pattern from the most recent
seed migration for that module — don't invent a new one.

| Module | System table | Per-org table | Provision fn | Law-ref column |
|---|---|---|---|---|
| compliance | *(none — templates live per-org)* | `compliance_checklist_templates` | `provision_compliance_baseline_for_org(org, pack)` | `law_refs text[]` (template) + `definition.items[].law_ref` (per item) |
| survey | `survey_template_catalog` | `survey_org_templates` (override) | `provision_survey_baseline_for_org(org)` | `law_refs text[]` (catalog + override) + legacy `law_ref text` |
| documents | `document_system_templates` | `document_org_templates` (custom) + `document_org_template_settings` (toggle) | `provision_documents_baseline_for_org(org)` | `legal_basis text[]` |
| registers | `register_types` (org_id NULL = system) | `register_org_settings` (toggle) | `provision_registers_baseline_for_org(org)` | `regulation_ids text[]` (frameworks) + `aml_paragraphs text[]` (paragraphs) |
| learning | `learning_system_courses` + `learning_system_course_locales` | `learning_org_course_settings` (toggle/fork) → `learning_courses` | inline (no provision fn yet) | `law_refs jsonb` on `learning_courses` |
| meetings | `meeting_system_templates` + `meeting_system_templates_locales` | `meeting_org_templates` (custom) + `meeting_org_template_settings` (toggle/override/pin) | inline (no provision fn yet — seed migrations directly upsert system rows) | `law_refs text[]` (catalog) + `definition.agendaItems[].lawRef` (per item) + `definition.preparationChecklist[].lawRef` |

Conventions every seed migration follows:
- **Idempotent**: `on conflict (...) do update set …` for system rows;
  `on conflict (organization_id, slug) do update set …` for the
  per-org compliance pattern. Loop `for v_org_id in select id from organizations` to backfill existing tenants.
- **Header comment**: 4–8 lines explaining *which gap is closed*,
  *which §*, and the *self-audit* (Arbeidstilsynet POV — pålegg-grunner
  addressed + restrisiko deferred). PR #175 commits show the shape.
- **Law-ref string format**: `'AML § 4-3'`, `'AML § 2A-7 (5)'`,
  `'IK-f § 5 nr. 7'`, `'GDPR Art. 35'`,
  `'Likestillings- og diskrimineringsloven § 26'`. The dashboard
  drill-down + planner do exact-string matching against these arrays.
- **Compliance enums**: `compliance_pack` = `'aml-amu' | 'iso-45001'`;
  `compliance_review_status` = `'draft' | 'reviewed' | 'approved'`;
  `cadence_hint` is plain `text` (no check) — common values
  `'arlig'`, `'halvarlig'`, `'kvartalsvis'`, `'ad_hoc'`.
- **Document `page_payload` blocks**: `alert | heading | text | module |
  law_ref | acknowledgement_footer`. HTML inside `text.body` (incl.
  tables) is allowed. Module-block names: `live_org_chart`,
  `live_risk_feed`, `action_button`, `acknowledgement_footer`.
- **Learning module shape**: `{id, title, kind: 'text'|'quiz',
  estimatedMinutes, content?, questions?, lawRefs?, passingScore?}`.

The roadmap §5 (compliance gap-and-audit planner) is the next
consumer of this template-surface convention — it reads `law_refs[]`
across all five modules to produce the gap matrix.

## Module parity port — capability shorthand

When porting a module, run the C-1..C-9 inventory from `PLAYBOOK §4` and
mark each as ✅ in scope, ❌ skip, or ❌ N/A *with a one-line rationale*.
Cross-module patterns observed:

- **C-1 Categories** drops out when a natural taxonomy already exists
  (tasks → `sourceType` enum; documents → `wiki_spaces`).
- **C-5 / C-6** drop out for content modules without a sign event
  (documents).
- **`provision_<module>_baseline_for_org`** + recovery bundle migration
  are the standard pattern when a module has a per-org override layer
  (compliance / survey / documents). Mirror `20260828120031_survey_provision_bundle.sql`.

## Migrations

| Top level (`supabase/migrations/`) | `archive/` |
|---|---|
| Active development surface | Shipped, treated as read-only |

Both folders run; the applier sorts by basename. **Basenames must be
globally unique across the tree** — adding a new migration means picking
a timestamp after the latest in either folder. Always:

- `add column if not exists` / `create table if not exists` / `do $$ ... on conflict do nothing`
- No destructive ops in forward migrations — write a new forward migration instead
- Column comments on jsonb columns explain the field shape

Don't move shipped migrations between folders without checking the
applier still sees the same set of basenames (see commit `0358403` for
the cleanup recipe).

## House style

- **Norwegian (nb)** for user-facing strings; English for code, types,
  comments, commit messages.
- Component file headers: 3–6 lines explaining *why* the file exists,
  not what it does.
- Commits explain the *why*. Body lists the moving pieces but doesn't
  re-list every line. Trailer is the Claude session URL.
- Default workflow: commit on `main`, fast-forward
  `claude/redesign-compliance-architecture-8Uqgh` (or whatever the
  active feature branch is) to match, push both. Don't create commits
  on the feature branch separately.

## Things that are easy to get wrong

- New widget kind without updating all six call sites → TS tells you.
- New scope without the side-effect import (`import './dashboards/<scope>DashboardScope'`)
  → registration silently doesn't happen and the scope is unknown at runtime.
- Reading `customPanelTpl.navPinned` (or any per-org admin field) on a
  `PageTemplate` instead of the override row → compiles in dev, fails
  the production build (see commit `39aa826`).
- Per-page `cryptoUuid()` polyfill → use `freshId(prefix)` from the
  registry. The polyfill copies are a smell.
- Single-column FK to `public.regulations(id)` → `regulations` has a
  composite PK `(organization_id, id)` so a single-column FK won't
  bind (42830). Use plain `text` + the `regulation_id_must_match_org()`
  trigger from `_120036` (see `register_categories` in `_120041` and
  PR #177 for the exact recipe).
- Seeding compliance content without the *Arbeidstilsynet self-audit*
  header → reviewers can't tell which pålegg-grunn is addressed vs
  what's still restrisiko. The header pays for itself the first time
  someone asks "why does the template stop here?"
- `survey_template_catalog.law_ref` (singular text) is legacy —
  always set `law_refs text[]` too. `_120043` backfills the old rows
  but new seeds must populate both for the planner to find them.
- For meetings, the **canonical roster lives in `meeting_attendees`**
  after the `_120500` backfill — `meetings.participant_member_ids` is
  the *initial planned list* from creation time and stops updating
  when invites are added/removed in the panel. The new RLS write
  policies (`_120000`) check `meetings_user_can_manage(id)` which
  resolves the attendee roster (chair/secretary), not the legacy
  `participant_member_ids[]`. Always join through `meeting_attendees`
  when answering "is this user a participant".
- For meetings, **never display `meeting_external_invitees.secure_token`
  via base-table SELECT** — read-side UIs must use the
  `meeting_external_invitees_safe` view (added in `_120800`). The raw
  token is only returned at insert-time + via the
  `meetings_external_redeem_token` RPC. Direct column SELECT on
  `secure_token` was revoked from `authenticated` in `_120800`.
