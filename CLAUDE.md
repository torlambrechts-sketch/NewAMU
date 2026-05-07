# Claude Code primer — NewAMU

This file is the project-level system prompt for Claude Code. Keep it terse —
it loads every session. Point to authoritative docs; don't duplicate them.

## Source of truth

| Need | Look here |
|---|---|
| Module parity ports (process spec) | `specs/PLAYBOOK.md` |
| Per-module port plans + status | `specs/<module>-parity.md` (`survey`, `tasks`, `elearning`, `documents`) |
| Roadmap status across the whole product | `ROADMAP.md` |
| Public documents for designers / PMs | `*.md` at repo root (DESIGN_SYSTEM, MODULE_SPEC, etc.) — these are *output*, not process |
| Migrations to apply on a fresh DB | `supabase/migrations/` (top level + `archive/`, both run; sorted by basename — see `scripts/apply-migrations.sh`) |

When asked to plan a new module port, **copy the latest parity spec** as a
starting point and run the senior-architect checklist in `PLAYBOOK.md §7`
before changing status to `📋 ready`.

## Dashboard engine

Reusable runtime any module registers a "scope" with. After eight modules
adopted it (compliance / survey / tasks / learning / documents + the
`hms_overview` composite), the architecture has stabilised.

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
HMS-oversikt → Sjekklister → Undersøkelser → Dokumenter → Oppgaver → Læring
```

Conventions when promoting a module:

- Define `<MODULE>_NAV_PERMS: PermissionKey[]` (broad permAny pattern — view
  roles must still see the menu)
- Group has fixed `Analyse` + `Innstillinger` subs first, then dynamic
  pinned templates from a `useXxxNav` hook (compliance/survey/documents)
- Remove the legacy entry from `gamleModulerModules` to avoid duplicate links

## Accent palette (per-scope, registered)

| Scope | Accent | Notes |
|---|---|---|
| `compliance_checklist` | `#1a3d32` | Brand green — flips per `?pack=` (see `modules/compliance/dashboards/packAccents.ts`: AML green vs ISO blue `#1e40af`) |
| `survey` | `#7c3aed` | Megaphone purple |
| `tasks` | `#c2410c` | Kanban amber |
| `learning` | `#0e7490` | Teal |
| `documents` | `#0f766e` | Deep teal — distinct from learning in the composite |
| `hms_overview` | `#4338ca` | Indigo — reads as "different layer" from each member |

Pages resolve the accent via `getDashboardScope(scopeId)?.accent` and pass
it to `ModuleAnalyticsDashboard`. Compliance overrides with `packAccentFor`
based on the URL.

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
