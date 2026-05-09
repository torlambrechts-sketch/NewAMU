# Compliance gap-and-audit planner

> **Read this first:** `CLAUDE.md` *Template surfaces* section (per-module
> table schemas + law-ref columns + provisioning conventions). Then
> `ROADMAP.md §5` for the item list this spec promotes. Then
> `specs/registers-engine.md §1–4` (closest reference for a multi-input
> module that aggregates across packs).

**Reference modules:** compliance (`modules/compliance/`), tasks
(`modules/tasks/`), survey (`modules/survey/`), `hms_overview` composite
scope (`src/pages/internal-control/HMSOverviewPage.tsx`).
**Target module:** new `modules/compliance-planner/` +
`src/pages/compliance/PlannerPage.tsx`.
**Spec status:** `📋 ready — data layer shipped, UI not started`.
**Last reviewed:** 2026-05-09 (session that shipped PR #175 + #177 + #178).

---

## 1 · One-paragraph framing

The five existing modules (compliance / survey / documents / registers /
learning) each carry their own templates and their own `law_refs` array
(see `CLAUDE.md` *Template surfaces*). After PR #175 shipped 30+ AML
templates and `_120043` indexed every law-ref column, the *content* gap
is closed — but no surface lets an org or auditor see "for AML § 9-2,
which artefacts cover this paragraph, what's the closure plan, when does
it land?" This planner is that surface. Build order: (1) read-only gap
matrix, (2) plan items + Tasks bridge, (3) auditor view (signed token),
(4) evidence ledger per §, (5) ledelses-KPI widget. Items 1 and 4 are
mostly aggregation queries on existing data; item 2 introduces one new
table; item 3 is a token-auth flow mirroring `survey_invitation_tokens`.

---

## 2 · What's already shipped (don't re-build)

| Surface | Where | Notes |
|---|---|---|
| `law_refs text[]` GIN index per template surface | `_120043_aml_template_law_refs.sql` | All five modules' template tables can be filtered by paragraph string. |
| 30+ AML templates with populated `law_refs[]` | `_120044`–`_120054` | Every § from kap. 2A, 3, 5, 8, 9, 10, 12, 13, 14, 14A, 15, 16, 18 has at least one artefact. |
| `aml_18_tilsynssaker` register type | `_120053` | 19 felter for sporing av tilsyn / pålegg / frister / klage. Planner reads `outcome` + `deadline` + `closure_at`. |
| Provision functions per module | `provision_compliance_baseline_for_org`, `provision_survey_baseline_for_org`, `provision_documents_baseline_for_org`, `provision_registers_baseline_for_org` | Idempotent. Triggered on `organizations` insert + backfilled. |
| Self-audit headers in seed migrations | PR #175 commits | Reviewer-visible "pålegg-grunner addressed + restrisiko deferred" — useful seed for auditor view copy. |

---

## 3 · Data inventory — exact reads

The gap matrix (5.1) is one query per module, unioned. Field names
verified against the migrations as of `acbe684`.

```sql
-- AML paragraphs, deduplicated, with per-module artefact counts.
with paragraphs as (
  select unnest(array[
    'AML § 2-1','AML § 2-3','AML § 2A-1','AML § 2A-2','AML § 2A-3',
    'AML § 2A-4','AML § 2A-5','AML § 2A-7','AML § 3-1','AML § 3-2',
    'AML § 3-3','AML § 3-4','AML § 3-5','AML § 4-1','AML § 4-2','AML § 4-3',
    'AML § 4-5','AML § 4-6','AML § 5-1','AML § 5-2','AML § 5-3',
    'AML § 6-1','AML § 6-2','AML § 6-3','AML § 6-5','AML § 7-1','AML § 7-2','AML § 7-4',
    'AML § 8-1','AML § 8-2','AML § 8-3','AML § 9-1','AML § 9-2','AML § 9-3',
    'AML § 10-4','AML § 10-6','AML § 10-7','AML § 10-8','AML § 10-10','AML § 10-11','AML § 10-12',
    'AML § 12-1','AML § 12-2','AML § 12-3','AML § 12-4','AML § 12-5','AML § 12-6',
    'AML § 12-9','AML § 12-10','AML § 12-11','AML § 12-12','AML § 12-15',
    'AML § 13-1','AML § 13-2','AML § 13-7',
    'AML § 14-2','AML § 14-5','AML § 14-6','AML § 14-9','AML § 14-12','AML § 14-12a','AML § 14-12c',
    'AML § 14A-1','AML § 14A-2','AML § 14A-3',
    'AML § 15-1','AML § 15-3','AML § 15-4','AML § 15-6','AML § 15-7','AML § 15-15',
    'AML § 16-1','AML § 16-2','AML § 16-3','AML § 16-4','AML § 16-5',
    'AML § 18-1','AML § 18-6','AML § 18-7','AML § 18-8','AML § 18-10'
  ]) as paragraph
)
select
  p.paragraph,
  (select count(*) from compliance_checklist_templates t
   where t.organization_id = $org_id and t.is_active and p.paragraph = any(t.law_refs)) as checklists,
  (select count(*) from survey_template_catalog t
   where t.is_system and p.paragraph = any(t.law_refs)) as surveys,
  (select count(*) from document_system_templates t
   where p.paragraph = any(t.legal_basis)) as documents,
  (select count(*) from register_types t
   where t.is_active and p.paragraph = any(t.aml_paragraphs)) as registers,
  (select count(*) from learning_courses t
   where t.organization_id = $org_id
     and exists (select 1 from jsonb_array_elements_text(coalesce(t.law_refs,'[]'::jsonb)) e
                 where e.value = p.paragraph)) as courses
from paragraphs p
order by paragraph;
```

For 5.4 (evidence ledger per §) the same five tables join to their
*execution* tables: `compliance_checklist_executions` (filter by template),
`survey_responses` + `survey_distributions` (filter by survey →
template), `wiki_acknowledgements` (filter by document), `register_records`
(filter by type), `learning_progress` (filter by course). Each yields
`(occurred_at, kind, summary, ref_url)` and unioned descending by date.

---

## 4 · Deliverables

### 5.1 — Gap matrix view (read-only)

**File targets:**
- `src/pages/compliance/PlannerPage.tsx` — top-level page at `/compliance/planner`
- `src/hooks/usePlannerGapMatrix.ts` — single hook running the union query above; returns `Array<{ paragraph, perModule: {checklists, surveys, documents, registers, courses}, hasAny }>`
- `modules/compliance-planner/components/GapMatrix.tsx` — renders the matrix; rows = paragraph, columns = module, cell = count badge. Click a cell → navigates to that module's analyse page with `?law_ref=AML § 9-2` filter chip pre-applied.
- Sidebar entry: under existing **Sjekklister** NavGroup, add `Planner` as a fixed flatSub (after Analyse / Innstillinger). Permission: `compliance.view`.

**Acceptance:**
- Matrix renders for all 80 AML paragraphs in §3 above.
- Empty cells (count = 0) visually distinct from filled cells.
- Click-through to module analyse pages preserves `?law_ref=` chip.
- Total render < 100ms with the seeded baseline (single query, < 5KB payload).

### 5.2 — Plan & timeline

**New table** (idempotent migration, basename after the latest in `supabase/migrations/`):

```sql
create table if not exists public.compliance_plan_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  law_ref         text not null,                    -- 'AML § 9-2' string match
  title           text not null,
  description     text,
  owner_user_id   uuid references auth.users (id) on delete set null,
  status          text not null default 'planned',  -- 'planned' | 'in_progress' | 'blocked' | 'done'
  start_at        date,
  due_at          date,
  milestone       text,
  task_id         uuid references public.tasks (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists compliance_plan_items_org_idx
  on public.compliance_plan_items (organization_id, status, due_at);
create index if not exists compliance_plan_items_law_ref_idx
  on public.compliance_plan_items (organization_id, law_ref);
```

RLS: same shape as `compliance_checklist_templates` — `current_org_id()`
on select; admin or `compliance.manage` on write.

**File targets:**
- `_120055_compliance_plan_items.sql` (or whatever the next basename is — check `ls supabase/migrations/ | sort | tail -1`)
- `modules/compliance-planner/components/PlanInspector.tsx` — slide panel opened from a gap-matrix cell. Lists existing plan items for that paragraph; "+ Legg til tiltak" creates one with `law_ref` pre-filled.
- `modules/compliance-planner/components/PlanTimeline.tsx` — Gantt-ish view grouped by AML chapter. Reuse `BarWidget` from the dashboard registry if a quick win; otherwise a small CSS-grid lane chart.
- **Tasks bridge:** when status flips to `in_progress` and `task_id` is null, auto-create a `tasks` row with `sourceType = 'compliance_plan'` and `sourceId = plan_item.id`. Mirror is one-way write (planner → tasks); status sync optional in v1.

**Acceptance:**
- Plan-item CRUD via slide panel.
- Timeline shows lanes per chapter (kap. 2A, 3, 5, …) with bars per item.
- Creating an `in_progress` item produces a Task that opens to the planner.
- Gap matrix cell shows "📋 N planlagt" pill when items exist.

### 5.3 — Auditor view (signed-token URL)

Mirror `survey_invitation_tokens` exactly:
- New table `compliance_auditor_tokens (token text primary key, organization_id, scope, created_by, created_at, expires_at, revoked_at)`. `scope` = `'aml'` initially.
- New unauth route `/auditor/:token` rendering a read-only version of the gap matrix + plan timeline + recent evidence ledger (see 5.4) for the resolved org. Token verified via RPC `compliance_auditor_token_verify(p_token)` returning `(organization_id uuid, scope text)` or null on expiry.
- Admin UI on the planner page: "Del med revisor" button → modal generates a token (default 30-day expiry) and shows the URL once; subsequent reveals require regenerate.
- **Layout:** mirror `pages/survey/respond/[token].tsx` shell — branding bar, no nav, no permission gates. Use `apenhetsloven`-style green for "i orden", amber for "påbegynt", red for "mangler" — keep it neutral, not the AML brand green.

**Acceptance:**
- Token URL renders for an unauthenticated browser.
- Expired tokens show a friendly 410 page.
- All paragraphs visible (read-only) with current status, plan items and last 3 evidence events per §.
- No write paths exposed.

### 5.4 — Evidence ledger per §

Single hook `useParagraphEvidence(law_ref, limit = 50)` running the
five-table union from §3. Used by:
- the gap-matrix slide panel (under plan items)
- the auditor view's per-§ detail
- a new `evidence_ledger` widget kind in the dashboard registry (reused
  in the `hms_overview` composite, see 5.5)

Each evidence row carries `{ occurredAt, kind, title, summary,
sourceUrl }`. `kind` enum mirrors module accents: `checklist_execution`,
`survey_response`, `document_acknowledgement`, `register_record`,
`course_completion`.

**Acceptance:**
- Latest 50 events per § appear in chronological order.
- Each row deep-links to the source artefact.
- Empty state copy: "Ingen aktivitet siste 12 mnd. — gjennomgang anbefalt."

### 5.5 — Ledelses-KPI widget in `hms_overview`

Add a new kind `compliance_kpi_strip` to the registry (six call sites
listed in `CLAUDE.md` *Dashboard engine*). Strip carries:
- % AML-dekning (paragraphs with ≥1 active artefact / total)
- Åpne pålegg (count from `register_records` of type `aml_18_tilsynssaker`
  where `outcome` in `('pålegg', 'tvangsmulkt', 'stansing')` and
  `closure_at is null`)
- ARP-redegjørelse-status (last `document_org_acknowledgements` for
  `tpl-arp-redegjorelse`)
- §-er uten plan (count of paragraphs in §3 list with 0 artefacts AND 0
  plan items)

Register it in `modules/compliance/dashboards/complianceDashboardScope.ts`
*and* in `modules/internal-control/dashboards/hmsOverviewDashboardScope.ts`
(composite member). Accent: existing brand green, no override.

**Acceptance:**
- Widget appears in default `hms_overview` layout.
- Each metric drills through to the planner page filtered to the
  relevant subset.
- Numbers match the gap matrix when planner page is open.

---

## 5 · Caveats from the seeding session

These didn't get verified end-to-end during PR #175 — start here if
something looks off:

1. **Document `block.kind` exhaustiveness.** Seeded blocks use only the
   kinds listed in `CLAUDE.md` *Template surfaces* — but the renderer
   `WikiDocumentRenderer.tsx` (or wherever `page_payload.blocks` is
   consumed) was not opened during seeding. If a paragraph cell expects
   to drill into a document and the page errors, check the renderer's
   exhaustive switch.
2. **Learning `modules[].kind` shape.** Seeded `c-40-timers-hms` etc.
   use inline JSON (`{kind: 'text', content: ...}` and
   `{kind: 'quiz', questions: [...]}`). The existing `c-aml-ledere`
   was generated by `scripts/generate-learning-system-migration.mjs`.
   If runtime expects `body` instead of `content`, or different quiz
   field names, a small renderer adjustment is the fix — not a re-seed.
3. **`register_categories.regulation_id`** is plain `text` (not FK)
   after PR #177; same-org coherence relies on
   `regulation_id_must_match_org()` trigger. Don't restore the FK.

---

## 6 · Patterns to mirror

| Need | Reference |
|---|---|
| Module page shell + sidebar registration | `src/pages/compliance/ChecklistsAnalysePage.tsx` + `useChecklistsNav` |
| Provision function + new-org trigger + backfill loop | `_120033_documents_provision_bundle.sql` |
| Slide-panel CRUD over a per-org table | `modules/survey/components/SurveyTemplateOverridePanel.tsx` |
| Token-authenticated public route | `src/pages/survey/respond/[token].tsx` + `survey_invitation_tokens` |
| New widget kind with all six call sites updated | Last commit that added one — `git log --diff-filter=A -- src/types/reportBuilder.ts` |
| Auto-create Task from another module | `modules/tasks/ingest/` (sourceType + sourceId pattern) |

---

## 7 · Open questions (resolve before coding)

1. **OQ-P1: Scope of auditor view.** Single `aml` scope only, or do we
   parameterise from day one (`aml | iso-45001 | gdpr | apenhetsloven`)?
   v1 ships AML — but `compliance_auditor_tokens.scope` is already
   parameterised in §4.5.3 above to avoid a v2 migration.
2. **OQ-P2: Plan-item ↔ Task bidirectional sync?** v1 spec is one-way
   (planner → tasks). If a leader closes the Task, should the plan item
   auto-flip to `done`? Probably yes; flag for the human before
   committing.
3. **OQ-P3: Multi-tenant auditor tokens.** A revisor with a
   conglomerate-scope might want one token for several orgs. v1 says no
   — one token, one org. Defer to a holding-company feature.
4. **OQ-P4: Print / PDF export of auditor view.** Roadmap §3.4.2 covers
   this generically. v1 of planner can leave it to browser print
   (`@media print` stylesheet); a real export waits.

---

## 8 · Suggested order of work

1. **5.1 Gap matrix** first — single query, single page, no new schema.
   Gives the human a visual of what the dataset looks like before
   committing to plan-items shape.
2. **5.4 Evidence ledger** next — same query shape as 5.1, just a union
   of execution tables. Renderer is a list, not a matrix. Doubles as
   the "what is missing" copy source for 5.3.
3. **5.5 KPI widget** — small, self-contained, surfaces the work-so-far
   in `hms_overview` so others can see the planner exists.
4. **5.2 Plan items** — add the table + slide panel + timeline once the
   read-only side has settled and field names are stable.
5. **5.3 Auditor view** — last, because everything before it is a
   prerequisite read.

---

## 9 · Definition of done for the sprint

- [ ] All 80 paragraphs from §3 visible on `/compliance/planner` for an
      authenticated org admin, with module counts matching DB state.
- [ ] At least one plan-item created end-to-end via the slide panel,
      visible in the timeline, mirrored as a `tasks` row.
- [ ] Auditor token generated, opened in incognito, all paragraphs
      visible without authentication, no write paths.
- [ ] `hms_overview` dashboard surfaces the four KPIs with drill-through.
- [ ] Evidence ledger shows ≥1 historical event for at least 10
      paragraphs (after manually executing some seeded checklists).
- [ ] Sjekkliste-, survey-, dokument-, register- og lærings-flatene har
      *ingen regresjoner* — planner is purely additive.

---

## 10 · One-shot prompt for the next session

> Work on `specs/compliance-planner.md` §5.1 first — the read-only gap
> matrix at `/compliance/planner`. Data is already in place after PR
> #175; the union query you need is in §3 of that spec. Don't re-read
> the seed migrations unless something doesn't add up — the spec
> enumerates everything the matrix needs. Start by writing
> `usePlannerGapMatrix.ts` (single hook, single Supabase query, return
> the shape declared in §4.5.1), then `GapMatrix.tsx` (renders rows ×
> columns with click-through), then `PlannerPage.tsx` (page shell +
> nav registration). Stop after 5.1 ships and ask the human to verify
> on a real org before moving to 5.2. Self-audit header convention from
> CLAUDE.md *Template surfaces* applies to any new migration.
