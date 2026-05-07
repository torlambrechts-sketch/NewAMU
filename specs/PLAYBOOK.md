# Module Parity Playbook

A reusable recipe for bringing one module up to architectural parity with
another (the "reference module"). Started life as the survey-port-of-the-
checklist-work but is intentionally generic — the same playbook applies to
tasks, e-learning, and any future module that needs to inherit the
discovery / categorisation / metadata / analytics architecture.

This file is the **process spec**: it defines the slicing principle, the
task shape, and the verification gates. Concrete module work lives in
sibling files like `survey-parity.md`, `tasks-parity.md`,
`elearning-parity.md` — each of which references this playbook by section.

---

## 1 · Goals

After running a parity port to completion, the target module exposes:

1. **Three-mode URL routing** — `hub` (no params), `pack` (`?pack=`), `template` (`?template=`).
2. **Per-template KPI counts** that don't bounce between renders.
3. **Stay-on-template after submit** — sign / publish / close navigates back to the template's list.
4. **Editable instance metadata after lock** — title / summary / participants / etc. amendable post-sign without invalidating any integrity check.
5. **Org-context** — typed FK columns on every instance for `location`, `department`, `team`, `participants`. Free-form `metadata jsonb` for template-specific extras.
6. **Template-driven `metadata_schema`** — each template declares which fields its instances expose; the editor reads it and renders accordingly.
7. **Categories** — admin-curated grouping per pack, with hub-tile sections and collapsible sidebar groups.
8. **Settings + Analyse children** under the module's sidebar entry.
9. **`/<module>/analyse`** page using `ModuleAnalyticsDashboard` runtime + a registered `dashboardRegistry` scope. Filter chips for the universal dimensions (pack, template, status, date) plus org-context (location, department, participant).

The reference implementation is **compliance checklists** as of `main` after commit `2f24241`. Read that diff and the corresponding `ROADMAP.md` items 1.1 → 1.16 before starting any port.

---

## 2 · Slicing principle

**Vertical slices, not horizontal layers.** Each task ships one user-visible capability end-to-end:

```
DB migration → Types → Zod schema → Hook → UI components → Discovery surfaces (hub/sidebar) → TS + lint → Commit
```

Never commit "all migrations, then all types, then all UI". A half-finished horizontal layer leaks into other tasks; a half-finished vertical slice is shippable on its own.

Each slice is one to three commits. If a slice grows past three commits, it should have been split.

---

## 3 · Standard task shape

Every task in a module spec **must** have these sections in this order:

```markdown
### Task N · <one-line user-visible goal>

**Status:** 📋 not started · 🚧 in progress · ✅ done

**Why this is independent:** <which other tasks does it depend on; why it's
a clean vertical slice>

**Files to touch:**
- `path/to/migration` — migration name + concrete columns/tables
- `path/to/types.ts` — fields added
- `path/to/schema.ts` — zod additions
- `path/to/use<Module>.ts` — mutations / load extensions
- `path/to/<Component>.tsx` — UI changes
- `path/to/<route>.tsx` — wiring

**Reference precedent:** <link to the equivalent commit / file in the reference module so the implementer can pattern-match>

**Acceptance criteria** (must all be true to ship):
- [ ] <observable user behaviour 1>
- [ ] <observable user behaviour 2>
- [ ] TS clean: `npx tsc -b` exits 0
- [ ] Lint clean on touched files
- [ ] Migration is idempotent (re-running on a fully-applied DB is a no-op)

**Verification steps** (exact commands or click paths):
1. `npx tsc -b 2>&1 | tail -10` — must be empty
2. `npx eslint <touched files> 2>&1 | tail -10` — no errors
3. Click path: open `/<route>`, do X, assert Y is visible
4. DB sanity: `select count(*) from <table> where ...` returns expected number

**Open questions:** <call out any decision the implementer needs the
human to make. Don't bury these.>
```

If you can't write all five sections for a task, the task isn't ready — break it down further or escalate.

---

## 4 · Capability inventory

The full set a parity port covers. Number them — each module spec maps these to concrete tasks.

| # | Capability | Reference commit (checklist) | Notes |
|---|---|---|---|
| C-1 | Categories table + RLS + admin CRUD | `a6c8d66` | New per-(org, pack) table; replaces any free-text `category` column. |
| C-2 | Categories — discovery surfaces (hub + sidebar) | `4b318d2` + `f5641db` | Hub tiles grouped; sidebar uses `kind: 'header'` SubItem with collapse. |
| C-3 | Sidebar Settings + Analyse fixed children | `87fdf89` | Two fixed `flatSubs` ahead of pinned templates. |
| C-4 | Module-level Analyse page + registry | `75f785e` + `6f18308` + `d84384c` + `67d7421` | Uses `ModuleAnalyticsDashboard` + `dashboardRegistry`; persisted layouts; filter chips; drag/drop; live preview. |
| C-5 | Editable instance metadata post-sign | `87fdf89` (panel) + `20260828120021` (trigger) | Trigger relaxed to allow non-canonical columns to amend after lock. |
| C-6 | Org-context FKs on instances | `0bb3a64` (`20260828120024`) | `location_id`, `department_id`, `team_id`, `participant_member_ids`, `metadata jsonb`. |
| C-7 | Template `metadata_schema` | `0bb3a64` | jsonb on templates declaring per-template field set. |
| C-8 | Schema-driven instance metadata UI | `7fd7f71` | Panel reads `template.metadata_schema` and renders the matching controls. |
| C-9 | Analytics dimensions for org-context | `2f24241` | Lokasjon / Avdeling / Deltaker filter chips + by-location/by-department datasets. |

A module spec marks each row with the slice it belongs to.

---

## 5 · Dependency graph

```
C-1 (Categories DB + admin)
   └─ C-2 (Categories discovery surfaces)
        └─ C-3 (Sidebar fixed children — also depends on C-4 for the Analyse link)

C-4 (Analyse page + registry) — independent of C-1/2/3 but benefits if they're done first

C-6 (Org-context FKs) — independent
   ├─ C-7 (Template metadata_schema) — depends on C-6's columns existing
   │    └─ C-8 (Schema-driven UI) — depends on C-7
   └─ C-9 (Analytics dimensions) — depends on C-6 and C-4

C-5 (Editable metadata post-lock) — depends on C-6 (uses the same trigger relaxation)
```

**Recommended order** (shortest critical path):

```
1. C-1 + C-2          (categories: DB + admin + discovery)  ──┐
2. C-3                (sidebar polish)                        │ → ship checkpoint
3. C-4                (analyse page + registry)               │
4. C-6                (org-context FKs)                       │
5. C-5 + C-7 + C-8    (metadata-schema UX + post-lock edit)   │
6. C-9                (analytics filters by org-context)      ┘
```

Steps 1+2 unlock the hub and sidebar visually; ship checkpoint is the right place to ask the user for sign-off before the more invasive DB changes in 4-6.

---

## 6 · Checkpoints

Between phases, the implementer **must** stop and post a checkpoint comment to the PR/conversation:

```
🛑 Checkpoint after Phase N
- Status of every task in this phase (✅ / 🚧 / 📋)
- Migrations applied (yes/no, on which envs)
- Verification artefacts: screenshots / TS output / lint output
- Open questions that emerged during the work
- Suggested go/no-go for next phase
```

The implementer doesn't proceed to phase N+1 until the human signs off. This is non-negotiable for migrations and for changes that affect multiple modules at once.

---

## 7 · Senior architect review checklist

Before marking the spec "ready to execute", the architect runs through:

- [ ] **Reference precedent linked** for every task. No "implement it the same way" hand-waves.
- [ ] **Vertical slices verified** — no task touches only one layer (DB-only or UI-only is a smell).
- [ ] **Dependency graph is a DAG** — no cycles.
- [ ] **Acceptance criteria are observable**, not implementation-coloured. "Saved layout persists across reload" not "calls saveLayout twice".
- [ ] **Open questions enumerated** at the top of the spec, not buried inside tasks.
- [ ] **Migrations are reversible or idempotent.** Adding columns is fine; renaming columns or destructive backfills need extra care + a rollback note.
- [ ] **The module-specific spec runs without reading the playbook again** — i.e. it duplicates anything it relies on, or links exact section numbers.
- [ ] **The playbook stays generic** — module-specific decisions belong in the module's spec, not here.

If any item fails, the spec is `🚧 draft`, not `📋 ready`.

---

## 8 · House style

- **Norwegian (nb)** for user-facing strings; English for code, types, comments, and commit messages.
- **No new markdown files** outside `/specs/` unless explicitly asked. The spec is the doc.
- **Side-effect imports** for scope registration (`import './dashboards/<module>DashboardScope'`).
- **Component file headers** describe *why* the file exists in 3-6 lines, not what it does.
- **`crypto.randomUUID` polyfill** should live in one spot — borrow from `dashboardRegistry.instantiateWidget`.

---

## 9 · When this playbook needs to change

Update this file when:

- A new capability ships in any module that should propagate to others (add a row to §4).
- The reference module commit history rebases / migrations get squashed (update §4 references).
- A module spec discovers a sequencing constraint not captured in §5 (update the dependency graph).

Don't update this file with module-specific detail. Survey only? → goes in `survey-parity.md`.

---

## 10 · How to use this playbook

1. Read this whole file once.
2. Open the module-specific spec (e.g. `survey-parity.md`).
3. Verify the spec's senior-architect checklist (§7) is signed off.
4. Execute one slice at a time, using the standard task shape (§3).
5. Post a checkpoint at the end of every phase (§6).
6. When done, update the module's row in `ROADMAP.md` from 📋 to ✅.
