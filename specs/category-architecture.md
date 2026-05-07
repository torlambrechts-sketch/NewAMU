# Two-level categorization + multi-select pack chooser + cross-module IA cleanup

> **Read this first:** `CLAUDE.md` (engine + IA conventions) and
> `specs/PLAYBOOK.md`. This spec is **cross-module**: it touches
> compliance, survey, tasks, learning, documents, AticsShell, and the
> top-bar pack switcher.

**Owner of this spec:** human. **Spec status:** `📋 ready` (all OQs resolved — see §9).

---

## 1 · One-paragraph framing

Today every module has its own one-level taxonomy: compliance has *packs*,
surveys have *packs*, learning has *categories*, documents has *spaces*,
tasks uses the source-type enum. The user wants a unified two-level model
across every module: **regulation** at the top (Arbeidsmiljøloven /
Internkontrollforskriften / ISO 9001 / Åpenhetsloven / …), **category**
within the regulation (Leverandørkontroll / Arbeidsmiljøundersøkelser /
ROS / …). The top-bar pack switcher becomes a **multi-select toggle list**
of regulations the user wants visible; the side-nav lists the **categories**
within those regulations and expands to show the items inside; every module
gains an **"Alle X"** view (table of all submissions/items, sorted by
category, with action-board-style advanced filtering); the legacy "menu
references" under tasks and learning go away.

---

## 2 · Mapping table — current → target

| Concept today | Target | Notes |
|---|---|---|
| `compliance_packs` (`aml-amu`, `iso-45001`) | `regulations` | Pack becomes a Cat 2; the pack's underlying regulation becomes Cat 1. |
| `survey_packs` (`vendor`, `arbeidsmiljo`, `compliance`, `engagement`, `exit`) | `regulations` + categories | Same — vendor pack becomes Cat 2 of "Åpenhetsloven", arbeidsmiljo of "Arbeidsmiljøloven", …. |
| `learning_categories` (per-org) | category (Cat 2); add a `regulation_id` FK | Add the second dimension. |
| `wiki_spaces` (per-org) | category (Cat 2); add `regulation_id` | Same. |
| `compliance_checklist_categories` (per-org, per-pack) | already category (Cat 2); pack already implies regulation | Just expose the regulation join. |
| `tasks.sourceType` enum | category (Cat 2); regulation derived from source module | Resolved at compute time, no schema change. |
| `surveys.pack` column | category (Cat 2); regulation join | Same surface. |
| Top-bar `ShellCompliancePackSwitcher` (single-select) | new `RegulationFilterMenu` (multi-select toggles) | Persists the active set in localStorage + URL `?regulations=` param. |

---

## 3 · Capability map

| Cap | Decision | Rationale |
|---|---|---|
| **C-A Regulations table** | ✅ in scope | One per-org table (`regulations`) with seeded core values. Owned by `documents.manage` / org-admin. |
| **C-B Two-way join from existing categories** | ✅ in scope | Add `regulation_id` to `learning_categories`, `survey_template_categories`, `wiki_spaces`, `compliance_checklist_categories`. Backfill from a deterministic mapping. Tasks resolves via source module → regulation lookup at compute time. |
| **C-C Multi-select regulation toggles in top bar** | ✅ in scope | Replaces `ShellCompliancePackSwitcher`. Persists active set; emits a `RegulationFilterContext` consumed by every module's hub page + analyse page + nav builder. |
| **C-D Sidebar lists Cat 2 with expand/collapse for items** | ✅ in scope | Generic per-module pattern. Each `<module>Group` shows: `Analyse` → `Alle X` → categories (collapsible, items inside) → `Innstillinger`. Shared categorised-list builder in `src/components/layout/buildCategorisedSubs.ts`. |
| **C-E "Alle X" page per module** | ✅ in scope | New route per module; reuses the action-board filter UI. Table of all instances, advanced filtering. |
| **C-F Drop legacy menu references under tasks + learning** | ✅ in scope | Remove the "Gamle moduler" leftover entries that still reference these modules. |
| **C-G Analyse stays at module-group level (not per-category)** | ✅ in scope | Already true; documented to avoid regressions. |

---

## 4 · Dependency graph

```
T1 (DB: regulations table + seeds)
  └─ T2 (DB: regulation_id FK on the four per-org category tables + backfill)
       └─ T3 (Tasks regulation derivation — pure resolver, no schema)
            └─ T4 (RegulationFilterContext + multi-select RegulationFilterMenu)
                 └─ T5 (Sidebar: shared categorised-list builder; rewire all 5 modules)
                      └─ T6 (Drop legacy "Gamle moduler" leftovers for tasks + learning)
                           └─ T7 (Per-module "Alle X" page x5; uses action-board filter)
                                └─ T8 (RegulationFilterContext fans into per-page filter chips)
```

**Recommended order:** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8.

**Phase A (DB foundation, no UX change):** T1 + T2 + T3.
🛑 **Ship checkpoint** before touching any UI.

**Phase B (top bar + sidebar shape):** T4 + T5 + T6.
🛑 **Ship checkpoint** before adding the new pages.

**Phase C (Alle X pages):** T7 + T8.

---

## 5 · Tasks

### Task T1 · `regulations` table + seeds

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<next>_regulations_schema_and_seed.sql` —
  ```sql
  create table if not exists public.regulations (
    id           text primary key,
    organization_id uuid references public.organizations (id) on delete cascade,
    name         text not null,         -- "Arbeidsmiljøloven"
    short_name   text not null,         -- "AML"
    description  text not null default '',
    legal_authority text,               -- "Arbeidstilsynet" / "ISO" / …
    position     integer not null default 100,
    is_active    boolean not null default true,
    is_system    boolean not null default false,
    deleted_at   timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (organization_id, id)
  );
  ```
  Seed system regulations for every existing org via a `do $$ ... loop`:
  Arbeidsmiljøloven (AML), Internkontrollforskriften (IK-f), ISO 9001,
  ISO 14001, ISO 45001, Åpenhetsloven, Personopplysningsloven (GDPR),
  Likestillings- og diskrimineringsloven, NS-EN ISO 19011 (revisjon).
- `src/types/regulations.ts` (NEW) — `Regulation` type.

**Acceptance criteria:**
- [ ] Migration is idempotent (`add column if not exists`, `on conflict ... do nothing`).
- [ ] System regulations seeded for every existing org.
- [ ] New orgs get the same seed via a trigger on `organizations` insert (mirror `documents_provision_on_org_insert`).
- [ ] TS clean.

**Open questions:** OQ-A1 (regulation list — should we ship more than the
9 above? What about sector-specific add-ons?).

---

### Task T2 · `regulation_id` on existing category tables + backfill

**Status:** 📋 not started

**Files to touch:**
- `supabase/migrations/<next>_categories_link_regulations.sql` —
  ```sql
  alter table public.compliance_checklist_categories
    add column if not exists regulation_id text references public.regulations (id) on delete set null;
  alter table public.survey_template_categories
    add column if not exists regulation_id text references public.regulations (id) on delete set null;
  alter table public.learning_categories
    add column if not exists regulation_id text references public.regulations (id) on delete set null;
  alter table public.wiki_spaces
    add column if not exists regulation_id text references public.regulations (id) on delete set null;
  ```
  Plus a deterministic backfill: map existing categories/spaces by
  pack/slug to the matching regulation. Pack `aml-amu` → `aml`, `iso-45001` → `iso-45001`,
  vendor pack → `apenhetsloven`, etc. Document the mapping inline.
- Existing per-module hooks load the new column.

**Acceptance criteria:**
- [ ] Every category that has a pack or known mapping gets a `regulation_id`.
- [ ] Categories with no mapping stay null (admins assign manually later).
- [ ] Migration is idempotent and re-runnable.

**Open questions:** OQ-A2 (the backfill map — which pack maps to which
regulation? draft below, confirm).

| Pack/category source | Regulation |
|---|---|
| compliance pack `aml-amu` | AML |
| compliance pack `iso-45001` | ISO-45001 |
| survey pack `vendor` | Åpenhetsloven |
| survey pack `arbeidsmiljo` | AML |
| survey pack `compliance` | IK-f |
| survey pack `engagement` | (none — admin-assigned) |
| survey pack `exit` | (none — admin-assigned) |
| `wiki_spaces.category = 'hms_handbook'` | IK-f |
| `wiki_spaces.category = 'policy'` | (none) |
| `wiki_spaces.category = 'procedure'` | IK-f |
| learning categories `førstehjelp / brann` | AML |

---

### Task T3 · Tasks regulation derivation (resolver only)

**Status:** 📋 not started

**Files to touch:**
- `modules/tasks/dashboards/useTasksDatasets.ts` — extend `MODULE_OPTIONS`
  with a parallel `MODULE_TO_REGULATION_ID: Record<TaskModule, string | null>`.
- `src/lib/regulations/regulationForSource.ts` (NEW) — pure mapping from
  `TaskSourceType` → `regulation_id`.

No schema work; tasks live in jsonb. Just a stable lookup so the new
`RegulationFilterContext` can narrow the tasks list.

**Acceptance criteria:**
- [ ] Every existing `TaskModule` and `TaskSourceType` has a regulation row.
- [ ] Filter narrows tasks by mapping their source → regulation → membership in active set.

---

### Task T4 · `RegulationFilterContext` + multi-select toggle menu

**Status:** 📋 not started

**Files to touch:**
- `src/context/RegulationFilterContext.tsx` (NEW) — provider + hook;
  state shape `{ activeRegulationIds: Set<string>; toggle(id); set(ids) }`.
  Persists to localStorage + URL `?regulations=` (comma-separated).
  When the set is empty, treat as "show all" (don't lock the user out).
- `src/components/layout/RegulationFilterMenu.tsx` (NEW) — replaces
  `ShellCompliancePackSwitcher` in the top bar. Lists every active
  regulation in the current org with a toggle each. Multi-select; no
  "current pack" mode.
- `src/components/layout/AticsShell.tsx` — drop the ShellCompliancePackSwitcher
  import + render; replace with the new menu.

**Reference precedent:** `src/components/layout/ShellCompliancePackSwitcher.tsx` (current single-select implementation).

**Acceptance criteria:**
- [ ] User can toggle multiple regulations on/off.
- [ ] Active set persists across reload.
- [ ] Closing the menu doesn't lose state.
- [ ] All consumers of the old `useActivePack` migrate to the new context.

**Open questions:** OQ-A3 (do we want a "select all" / "select none"
shortcut in the menu?).

---

### Task T5 · Shared categorised-list builder for the sidebar

**Status:** 📋 not started

**Files to touch:**
- `src/components/layout/buildCategorisedSubs.ts` (NEW) — pure function:
  `buildCategorisedSubs({ analysisRoute, alleRoute, items, categoryNameById, categoryRegulationById, activeRegulationIds, settingsRoute }): SubItem[]`.
  Output shape:
  ```
  Analyse                          ← always
  Alle X                           ← always (T7 fills it)
  [category 1 header — collapsible]
    item a
    item b
  [category 2 header — collapsible]
    item c
  Innstillinger                    ← always
  ```
- `src/components/layout/AticsShell.tsx` — every module group consumes
  this builder. Compliance / survey / documents already group by
  category; learning + tasks gain headers.

**Acceptance criteria:**
- [ ] Headers expand/collapse on click; state lives where the existing
      `expandedHeaders` map already does.
- [ ] When `activeRegulationIds` is non-empty, only categories whose
      `regulation_id` is in the set render.
- [ ] Single-category mode still works (skips headers).
- [ ] Settings + Analyse never disappear regardless of regulation filter.

---

### Task T6 · Drop legacy menu references for tasks + learning

**Status:** 📋 not started

**Files to touch:**
- `src/components/layout/AticsShell.tsx` — remove the leftover
  `gamleModulerModules` entries that still reference tasks + learning
  (the modules are top-level NavGroups now; the duplicate links were
  parked there during the IA migration).

**Acceptance criteria:**
- [ ] No duplicate "Tasks" / "Læring" entries in "Gamle moduler".
- [ ] Existing routes still resolve.

---

### Task T7 · "Alle X" page per module + action-board filter

**Status:** 📋 not started

**Files to touch:**
- `src/components/module/ModuleAlleListPage.tsx` (NEW) — generic
  builder. Takes a row source, a column declaration, a filter set
  (mirrors `action-board`'s filter strip), and a category resolver.
- `src/pages/<module>/Alle<Module>Page.tsx` × 5 — thin instantiations.
  Routes:
  - `/compliance/checklists/alle`
  - `/survey/alle`
  - `/documents/alle`
  - `/tasks/management/alle`  (already partially exists — consolidate)
  - `/learning/alle`
- `src/App.tsx` — five new routes.

**Reference precedent:** `src/pages/ActionBoardPage.tsx` filter strip
under search.

**Acceptance criteria:**
- [ ] Every module has an "Alle X" entry directly below "Analyse" in
      the sidebar.
- [ ] Table sorts by category by default.
- [ ] Filter strip mirrors action-board (search, status chips,
      category chips, date-range, owner).
- [ ] Active regulation filter (from the top bar) narrows the table.

---

### Task T8 · Fan-out: regulation filter into per-page chips

**Status:** 📋 not started

**Files to touch:**
- Every `<Module>AnalysePage.tsx` — read `activeRegulationIds` from
  context; pass into the dataset hook as a synthetic chip
  `{ dimensionId: 'regulation', value: [...ids] }`.
- Each `useXxxDatasets.ts` hook — extend `buildSelectors` to consume
  `regulation` and resolve via the appropriate join (categories.regulation_id
  for surveys/documents/learning/compliance; sourceType→regulation for
  tasks).

**Acceptance criteria:**
- [ ] Toggling a regulation in the top bar narrows every analyse page.
- [ ] Toggling cleared → all data shown again.

---

## 6 · House style notes (per CLAUDE.md)

- Side-effect imports for any new module-side scope file
- New widget kind would mean updating six call sites — not relevant here, none introduced
- New columns are jsonb where shape varies; typed columns when stable
- Migrations idempotent, additive only

## 7 · Acceptance criteria for the *whole* port

After T1–T8 ship:
- [ ] Top bar shows a regulation multi-select that works across modules.
- [ ] Every module's sidebar shows Cat 2 categories (expandable) with
      Analyse + Alle X + Innstillinger anchors.
- [ ] Every module has an "Alle X" page with action-board-style filtering.
- [ ] Tasks + learning have no duplicate entries in "Gamle moduler".
- [ ] No regressions on the four sibling analyse pages or the HMS Overview composite.
- [ ] `ROADMAP.md` gains a § for category architecture.

## 8 · Migration sequence

```
<ts+0> regulations_schema_and_seed.sql        (T1)
<ts+1> categories_link_regulations.sql        (T2)
```

Both additive; safe on a deployed DB.

## 9 · Open questions — resolved

| ID | Question | Resolution |
|---|---|---|
| OQ-A1 | Final regulation list to seed? | **Ship the 9 in §T1** (AML, IK-f, ISO 9001/14001/45001, Åpenhetsloven, GDPR, Likestillingsloven, NS-EN ISO 19011). Admins add org-specific extras via Innstillinger. |
| OQ-A2 | Pack→regulation backfill map confirmed? | **Use the map in §T2 as proposed.** survey.engagement + survey.exit + most policy spaces stay null intentionally. |
| OQ-A3 | "Select all / none" shortcuts in the menu? | **Yes, both.** One-click reset; matches OQ-A4's "empty = show all" semantics. |
| OQ-A4 | When zero regulations are active, "show nothing" or "show all"? | **Show all.** Standard pattern; users discover the filter without getting locked out. |
| OQ-A5 | Are tasks the only module without a category column? | **Yes.** Source enum already segments tasks; regulation resolves via `regulationForSource.ts` (T3). No schema change. |
| OQ-A6 | Should the "Alle X" filter strip share state with `dashboard.filters`? | **No — page-local state.** Different surface, different mental model. Avoids surprising side-effects. |
