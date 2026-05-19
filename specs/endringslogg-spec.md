# Endringslogg — engineering spec

Cross-cutting audit timeline. Reusable across every "room" (per-entry
detail view) in compliance / survey / tasks / documents / meetings /
learning / registers. Ships first on the compliance checklist
execution page; rolls out to siblings after the engine stabilises.

Owner: TBD. Spec author: senior eng + PM collab.
Status: 🛠 P1 + P2 implemented (compliance checklist scope).

---

## 1. Executive summary

**What**: A right-rail `<EntityTimeline>` panel that renders the full
change history for a single entity (execution / survey / task / doc /
meeting / course / register row). Each event row matches the visual
+ data spec the design handover provided (5W + diff, Norwegian
copy, action chips, semantic diff renderers, accessibility).

**Why now**: Arbeidstilsynet expects a provable change-history trail
on every HMS-relevant artefact. We already log raw CDC into
`hse_audit_log`, but it's unrenderable by humans (raw JSONB diffs,
no actor role, no semantic verb). Without a UI, the trail is
audit-proof in theory and audit-unusable in practice.

**Scope of v1**: compliance checklist executions (the "room" for a
single checklist run). One module, one entity kind, six action verbs,
two diff shapes, side-panel docked into `ChecklistExecutionPage`.

**Out of scope for v1**: external-token actor, privileged-event blur,
bulk-action collapsing, mobile bottom-sheet, full-text search of the
log. All planned for v2/v3 — slotted into §10 phasing.

**Reuse posture**: build a generic engine that mirrors the dashboard
engine pattern (scope registry + per-module hook), so module 2..N
ships in days, not weeks. Same idea as
`src/lib/dashboards/dashboardRegistry.ts` — a module registers an
`AuditScope`, the runtime takes care of the rest.

---

## 2. Architecture — the two-layer pattern

```
┌────────────────────────────────────────────────────────────┐
│ UI:   <EntityTimeline scopeId="compliance_checklist"        │
│                       entityId={executionId} />              │
│   ↓ reads AuditEvent[] shape (spec §1)                       │
└────────────────────────────────────────────────────────────┘
           ↑ projection: scope-registered summariser
┌────────────────────────────────────────────────────────────┐
│ Read API: audit_events table (new) — semantic events        │
│   (one row per mutation, action verb, actor, summary_nb,    │
│    pre-computed diff JSONB)                                 │
└────────────────────────────────────────────────────────────┘
           ↑ written by emitter helper at mutation sites
┌────────────────────────────────────────────────────────────┐
│ Forensic floor: hse_audit_log (existing) — raw CDC,         │
│   immutable, populated by DB triggers. Not read by UI.      │
│   Kept for Arbeidstilsynet bevisbunt + dispute recovery.    │
└────────────────────────────────────────────────────────────┘
```

**Why two layers, not one**:

- `hse_audit_log` is *paranoid* — DB-trigger driven, can't be skipped
  by buggy mutation code, immutable, RLS-locked. It is the legal
  record. But it logs every column change indistinctly: a
  `compliance_checklist_executions.updated_at` bump and a
  `compliance_checklist_executions.status='signed'` transition both
  arrive as the same row shape. The UI cannot tell them apart.
- `audit_events` is *semantic* — written explicitly by mutation code
  with intent (action verb, pre-rendered Norwegian summary, the
  fields the user actually changed). It's the layer the UI reads.
- They are written in lockstep: every mutation that emits an
  `audit_event` also writes a CDC row (already does, via trigger).
  If `audit_events` is ever lost or corrupted, the forensic floor is
  untouched — we can re-project from `hse_audit_log` after the fact.

**Why not a view over `hse_audit_log`**:

- Semantic verbs (`signert`, `eskalert`, `attestert`) can't be
  inferred from raw column changes alone — `status='signed'` could
  be either a manual sign-off or a cron promotion. Intent must be
  written at the mutation site.
- `summary_nb` requires Norwegian grammar (case, prepositions, verb
  agreement). Cheaper and safer to render once at write time than to
  render on every read.
- The pre-computed `diff` shape (`single_field`/`multi_field`/
  `list_change`/`text_block`) is a UX decision, not a DB decision.
  Encoding it at the mutation site lets each module choose the
  right diff shape per action (e.g. `Beskrivelse` change → `text_block`,
  status change → `single_field`).

**Acceptable cost**: a write-amplification of 1× (one mutation = one
`audit_events` row + one trigger row in `hse_audit_log`). At ~10
mutations/day per active checklist, this is rounding error.

---

## 3. Reuse map — what we copy vs build

| Need | Reuse from | New |
|---|---|---|
| Append-only forensic CDC | `hse_audit_log` (`archive/20260619210000`) | — |
| Trigger function `hse_audit_trigger()` | already attached to compliance tables | extend to any new module that joins later |
| RLS pattern (`organization_id = current_org_id()`, perm gate) | `hse_audit_log` policies | mirror for `audit_events` |
| Append-only enforcement (`revoke update, delete`) | `hse_audit_log` | mirror |
| UI shell — icon + actor + timestamp card | `DocumentActivityTimeline.tsx` (`/src/components/documents/`) | rewrite to match design spec (action chip, RAG dots, expander, two-card diff) |
| Tab label "Endringslogg" | `nb.json` `workflow.tabs.revisions` | extract to `endringslogg.title` for reuse |
| Scope-registry pattern | `src/lib/dashboards/dashboardRegistry.ts` | mirror as `auditRegistry.ts` |
| ID minting | `src/lib/dashboards/freshId.ts` | reuse — `freshId('audit')` for client-side optimistic rows; server uses `gen_random_uuid()` |
| Permission framework | `src/lib/permissionKeys.ts` | add `audit.read`, `audit.read.privileged` |
| Norwegian copy catalog | `src/lib/i18n/locales/nb.json` | add `endringslogg.*` namespace |
| Side-panel docking | `ModulePageShell` (used by `ChecklistExecutionPage`) | new `sidePanel` prop OR new `<EntityTimelineDrawer>` overlay |
| Status RAG chip | **not found** — spec assumes from parent brief | build `<StatusChip variant="rag" />` (also useful elsewhere) |
| Word-level text diff | **not found** | use `diff` npm package (battle-tested, ~10kb) — alternative `diff-match-patch` if rendering perf is an issue |

**Reuse estimate**: ~55%. The CDC trail, RLS pattern, scope-registry
pattern, i18n, and id-minting all already exist. The new build is
the `audit_events` table, the emitter helper, the `EntityTimeline`
component family, and the RAG chip.

---

## 4. Schema

### 4.1 New table — `audit_events`

```sql
create table public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at     timestamptz not null default now(),

  -- Actor (denormalised — actor profile may be deactivated later)
  actor_user_id   uuid references auth.users(id) on delete set null,
  actor_name      text not null,                  -- 'Kari Nordmann' or 'Årshjul-runner'
  actor_initials  text not null,                  -- 'KN' — server-derived
  actor_role      text not null check (actor_role in (
                    'verneombud','amu_medlem','leder','hms_radgiver',
                    'ansatt','system','ekstern'
                  )),
  actor_is_external boolean not null default false,
  actor_external_label text,                      -- 'Tilsyn 2026-05-12' for ekstern badge tooltip

  -- Action
  action          text not null,                  -- 'opprettet','endret','lukket', ... (spec §3 enum)
  entity_kind     text not null,                  -- 'compliance_checklist_execution','compliance_checklist_response', ...
  entity_id       uuid not null,
  scope_id        text not null,                  -- 'compliance_checklist' — matches registry key
  location        text,                           -- 'Avdeling Oslo / Lager 2' — denormalised; null if N/A

  -- Pre-rendered for the UI
  summary_nb      text not null,                  -- spec §2: "Kari Nordmann lukket sjekkpunktet"
  diff            jsonb,                          -- spec §1 Diff union; null for actions without value change

  -- Forensic anchor
  hse_audit_log_id uuid references public.hse_audit_log(id) on delete set null,
                                                  -- optional join back to the CDC row; null if no DB mutation paired

  -- Privilege gate (spec §6 — privileged event blur)
  privileged      boolean not null default false  -- true → blur diff for users without 'audit.read.privileged'
);

create index audit_events_entity_idx
  on public.audit_events (entity_kind, entity_id, occurred_at desc);

create index audit_events_org_scope_idx
  on public.audit_events (organization_id, scope_id, occurred_at desc);

create index audit_events_actor_idx
  on public.audit_events (actor_user_id, occurred_at desc);
```

RLS (mirrors `hse_audit_log`):

- `select`: org member + `audit.read`
- `insert`: org member with `with check (organization_id = current_org_id())`
- `update`, `delete`: revoked

Privileged-event read gate is a row policy:

```sql
create policy audit_events_select_unprivileged
  on public.audit_events for select to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('audit.read')
    and (
      not privileged
      or public.user_has_permission('audit.read.privileged')
    )
  );
```

Users without privileged access see the row (so the audit trail
itself is provable) but the client SDK returns `diff: null` and
`summary_nb` is replaced with `'Privilegert hendelse — kontakt admin'`.
Implement via a `before-select` view that masks `diff` when the user
lacks the perm — simpler than two policies racing.

### 4.2 No schema change to `hse_audit_log`

Already exists, already attached to all compliance tables via
`hse_audit_trigger`. No-op for v1. When a new module joins, we
attach the trigger to its tables in that module's migration —
mirrors what `_20260619210000_hse_immutable_audit_log.sql` already
does for `inspection_findings` etc.

### 4.3 Migration plan

One new forward migration:
`supabase/migrations/20260919120000_audit_events.sql`

- `create table public.audit_events ...`
- Indexes
- RLS policies (revoke update/delete to enforce append-only)
- `grant select, insert on public.audit_events to authenticated`
- Add `audit.read` + `audit.read.privileged` to `permission_definitions`
- Grant `audit.read` to `admin` role + extend `seed_default_roles_for_org`
- Backfill: no — v1 starts logging fresh. Optional v1.5 backfill
  script projects `hse_audit_log` rows from the last 30 days into
  `audit_events` (best-effort summary; flagged `actor_role='system'`,
  `backfilled=true`).

Timestamp constraint: must sort after the latest in either folder.
Current ceiling: `20260915120600_internkontroll_auditor_tokens.sql`.
Pick `20260919120000_*` (4-day buffer).

---

## 5. Module integration — the `AuditScope` registry

Mirrors `dashboardRegistry.ts`. A module-side file declares which
entity kinds it owns, the canonical action set per entity, and a
**summariser** that turns mutation context into the
`(action, summary_nb, diff)` triple.

```ts
// src/lib/audit/auditRegistry.ts
export type AuditScope = {
  scopeId: string                    // 'compliance_checklist'
  label: string                      // 'Sjekkliste' (used in filter chips)
  entityKinds: string[]              // ['compliance_checklist_execution', ...]
  resolveActor: (userId: string | null) => Promise<AuditActor>
  resolveEntityContext: (kind: string, id: string) => Promise<{
    location: string | null
  }>
}

export function registerAuditScope(scope: AuditScope): void
export function getAuditScope(scopeId: string): AuditScope | undefined
```

Each module declares its scope file as a side-effect import (same
pattern as dashboards):

```ts
// src/modules/compliance/audit/complianceChecklistAuditScope.ts
import { registerAuditScope } from '@/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'compliance_checklist',
  label: 'Sjekkliste',
  entityKinds: [
    'compliance_checklist_execution',
    'compliance_checklist_response',
    'compliance_checklist_comment',
  ],
  resolveActor: /* fetch profile + derive initials + role */,
  resolveEntityContext: /* return location_id → "Avdeling Oslo / Lager 2" */,
})
```

The host page imports this file as a side effect (mirroring
dashboards) so registration runs once at module entry.

### 5.1 The emitter helper

```ts
// src/lib/audit/emitAuditEvent.ts
export async function emitAuditEvent(input: {
  scopeId: string
  entityKind: string
  entityId: string
  action: AuditAction
  actorUserId: string | null
  diff?: Diff | null
  privileged?: boolean
  // For system / ekstern overrides:
  actorOverride?: Partial<AuditActor>
  // Summary template — server-side renders Norwegian:
  summaryTemplate: SummaryTemplate
}): Promise<void>
```

`summaryTemplate` is one of:

- `{ kind: 'preset', preset: 'lukket', subject?: string }`
  → renders "<Actor> lukket <subject ?? entity>"
- `{ kind: 'literal', nb: string }`
  → uses string verbatim (escape hatch for tricky grammar)

The helper is called from inside each mutation in
`useChecklistModule.ts`. It writes to `audit_events` via a Supabase
RPC (`emit_audit_event`) so the client never composes the row
itself — server enforces the action enum + role derivation +
initials computation.

### 5.2 Wiring into checklist mutations (v1 surface)

From `useChecklistModule.ts` (13 mutation sites, see survey in
research notes), v1 wires the **6 highest-signal verbs** first:

| Mutation | Action | Diff shape |
|---|---|---|
| `createExecution` | `opprettet` | `multi_field` (initial title + status + scheduled_for) |
| `signExecution` | `signert` | `single_field` (status: active → signed) |
| `archiveExecution` | `arkivert` | `single_field` (archived_at: null → ISO) |
| `updateExecutionMetadata` (title / summary / assigned / scheduled / location / participants / metadata) | `endret` | `multi_field` (only changed fields) |
| `saveResponse` (status, value, severity, finding) | `endret` | `single_field` or `multi_field` |
| `addComment` / `updateComment` / `deleteComment` | `kommentert` | `null` (use comment body in expanded card) |

Deferred to v2:

- `uploadResponseAttachment` → `lastet_opp_vedlegg`
- `removeResponseAttachment` → `slettet_vedlegg`
- `createTemplate` / `updateTemplate` / `softDeleteTemplate` → template-scope events (different scope — admin-side, not in execution room)

---

## 6. UI components

### 6.1 New components (path → role)

```
src/components/audit/
  EntityTimeline.tsx              // top-level list, day grouping, scroll virtualisation
  EntityTimelineRow.tsx           // single event row, collapsed + expanded
  EntityTimelineActionChip.tsx    // §3 chip variants
  EntityTimelineActor.tsx         // 28px avatar + role swatch + system/ekstern glyph
  diff/
    DiffSingleField.tsx           // §4.1 — two cards side-by-side
    DiffMultiField.tsx            // §4.2 — stacked field-pairs, "Vis N flere"
    DiffListChange.tsx            // §4.3 — added/removed lists
    DiffTextBlock.tsx             // §4.4 — word-level diff
    DiffNullCard.tsx              // §4.5 — single context card (comment/upload/signature)
    semanticValue.tsx             // §5 — render by semantic
src/components/ui/
  StatusChip.tsx                  // (new) — RAG variant the spec depends on
src/lib/audit/
  auditRegistry.ts                // scope registry
  emitAuditEvent.ts               // mutation-site helper
  useEntityTimeline.ts            // hook: fetch + paginate + day-group
  diffShape.ts                    // shared types from spec §1
  permalink.ts                    // copy-permalink ("Kopier permalink") action
```

### 6.2 Side-panel docking

`ChecklistExecutionPage` uses `ModulePageShell`. v1 approach: add a
`sidePanel?: ReactNode` prop to `ModulePageShell`; the checklist
page passes `<EntityTimeline scopeId="compliance_checklist"
entityId={executionId} />`.

Layout: right-rail at ≥1280px (sticks at 360px wide); collapses to
a slide-out drawer (right edge, full height) at 768–1279px; bottom
sheet at <768px (mobile spec). All three modes share the same
`EntityTimeline` component — only the container differs.

### 6.3 Empty / loading / error states

- **Loading**: skeleton rows (5 placeholders).
- **Empty**: "Ingen hendelser ennå. Endringer logges automatisk."
- **Error**: "Klarte ikke laste endringslogg. Prøv igjen." + retry
- **No permission**: "Du har ikke tilgang til å se endringsloggen."
  (still render the panel chrome so the layout doesn't shift —
  matches design pattern from `wiki_audit_ledger`)

---

## 7. Permissions

Two new keys in `src/lib/permissionKeys.ts`:

- `'audit.read'` — see the panel and event rows for entities in the
  org. Granted to: `admin` (default), `verneombud`, `amu_medlem`,
  `hms_radgiver`. **Not** granted to `member` / `ansatt` by default
  (configurable per-org).
- `'audit.read.privileged'` — see diff content of events flagged
  `privileged=true` (HR-sensitive, varsling). Granted to: `admin`
  only by default.

DB seed: add both keys to `permission_definitions` + the `admin`
row in `seed_default_roles_for_org`. Existing orgs backfilled via
the same migration (loop over `organizations`).

---

## 8. i18n

New namespace in `src/lib/i18n/locales/nb.json`:

```json
"endringslogg": {
  "title": "Endringslogg",
  "tab": "Endringslogg",
  "emptyState": "Ingen hendelser ennå. Endringer logges automatisk.",
  "loadError": "Klarte ikke laste endringsloggen. Prøv igjen.",
  "noAccess": "Du har ikke tilgang til å se endringsloggen.",
  "privilegedRedaction": "Privilegert hendelse — kontakt admin for tilgang.",
  "filterByActor": "Filtrer på aktør",
  "filterByAction": "Filtrer på handling",
  "showMore": "Vis {{count}} flere endringer",
  "viewFullChange": "Vis hele endringen",
  "viewFull": "Vis hele",
  "copyPermalink": "Kopier permalink",
  "exportEvent": "Eksporter denne hendelsen",
  "hideActor": "Skjul hendelser fra denne aktøren",
  "relativeJustNow": "akkurat nå",
  "relativeMinutes": "for {{n}} minutter siden",
  "relativeHours": "for {{n}} timer siden",
  "relativeDays": "for {{n}} dager siden",
  "noValue": "(ingen verdi)",
  "unchanged": "(uendret)",
  "userDeactivated": "Brukeren er deaktivert",
  "chips": {
    "opprettet": "OPPRETTET",
    "endret": "ENDRET",
    "lukket": "LUKKET",
    "gjenapnet": "GJENÅPNET",
    "tildelt": "TILDELT",
    "omfordelt": "OMFORDELT",
    "kommentert": "KOMMENTERT",
    "signert": "SIGNERT",
    "attestert": "ATTESTERT",
    "godkjent": "GODKJENT",
    "avvist": "AVVIST",
    "lastet_opp_vedlegg": "VEDLEGG",
    "slettet_vedlegg": "SLETTET",
    "versjon_bumpet": "NY VERSJON",
    "eskalert": "ESKALERT",
    "eksportert": "EKSPORTERT",
    "delt": "DELT",
    "arkivert": "ARKIVERT"
  }
}
```

Existing `workflow.tabs.revisions: "Endringslogg"` stays — it
labels the workflow-rules-specific revisions tab, which is a
different surface from the cross-cutting timeline.

---

## 9. Accessibility & quality bars

Direct lifts from spec §8, codified as acceptance criteria:

- Timeline is `<ol aria-label="Endringslogg">`, each row a `<li>`.
- Every chip carries `aria-label` matching its Norwegian label.
- Colour never sole signal — every RAG state has an icon, every
  diff line has `+/−` glyph.
- `aria-expanded` on row.
- SR reading order: actor → verb → field → before → "endret til"
  → after → timestamp.
- 2px focus ring `#4338ca` offset 2px on every interactive element.
- `prefers-reduced-motion` honoured (no chevron rotation animation).
- Keyboard: `Enter`/`Space` toggles, `↑/↓` moves focus, `Esc`
  collapses. Trap focus inside drawer/sheet variants.
- Lighthouse a11y target: 100 on `/compliance/checklists/:id`.

---

## 10. Phasing

| Phase | Scope | Duration | Exit criteria |
|---|---|---|---|
| **P1 — Foundation** | New `audit_events` table + migration + RLS + perms. `auditRegistry` + `emitAuditEvent` helper + `useEntityTimeline` hook. Storybook fixtures from spec §7 sample events. | 2 days | Migration applies cleanly on fresh DB; helper unit-tested; storybook renders all 6 sample events. |
| **P2 — Checklist v1** | Wire 6 mutations in `useChecklistModule.ts` to emitter. Build `EntityTimeline` + 3 of 5 diff renderers (single_field, multi_field, null). Dock into `ChecklistExecutionPage` (desktop side-rail only). Build `StatusChip` RAG variant. | 3 days | A new checklist execution shows live events for create / edit / sign / comment. Reviewer can replay the audit story from the panel alone. |
| **P3 — UX polish** | `list_change` + `text_block` diff renderers. Drawer (tablet) + bottom sheet (mobile). Filters (actor / action). Copy-permalink. Day grouping headers. Relative timestamp w/ tooltip. | 2 days | All 6 sample events render on all 3 viewports. a11y bar (§9) green. |
| **P4 — Edge cases** | `(uendret)` no-op rows. Deactivated-user strikethrough. System actor friendly labels. Reduced-motion respected. | 1 day | Edge-case fixtures from spec §6 render correctly. |
| **P5 — Roll-out** | Add `AuditScope` files for survey, tasks, documents, meetings. Wire each module's mutation surface to the emitter. Dock the timeline into each module's room page. | 1 day per module (≈4 days total) | Every module's room shows its own scoped timeline; storybook fixtures green per scope. |
| **P6 — Privileged & external** | `privileged=true` blur policy + redacted-row UI. External-token actor support (Arbeidstilsynet, ekstern revisor) — wire `delegation`/`auditor_tokens` to populate `actor_external_label`. | 2 days | Privileged-flagged event reveals chip+actor+action only to non-privileged readers; full diff to privileged readers. |
| **P7 — Bulk & advanced** | Bulk-action collapsing (1 click → 14 closed). Failed-action red-rail + warning glyph. Backfill script for the last 30 days from `hse_audit_log`. Full-text search filter. | 2 days | Bulk close of 14 findings renders as a single collapsible event with "Vis 9 til". |

**Total v1 (P1–P4)**: ~8 working days = ~2 sprint-weeks.
**Total cross-module rollout (P1–P5)**: ~12 working days.
**Full feature (P1–P7)**: ~16 working days.

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mutation code forgets to call emitter → silent audit gap | High in v1, drops over time | High | (a) Lint rule that flags `.from('compliance_checklist_*').update()` / `.insert()` not followed by an `emitAuditEvent` call in the same function. (b) Every release, run a recon SQL that diffs `hse_audit_log` rows (paranoid floor) vs `audit_events` rows (semantic layer); a delta over a threshold blocks deploy. (c) Document it loudly in `CLAUDE.md` under *Things that are easy to get wrong*. |
| Norwegian grammar bugs from string templating | Medium | Low (cosmetic) | Force `summary_nb` to be **pre-rendered server-side** via the RPC, never composed client-side. Use full sentences from `summaryTemplate.preset`, not glued fragments. Norwegian-speaking PM proofs every preset before merge. |
| Privacy leak — diff exposes data the actor wasn't supposed to see | Low | High | (a) `privileged` flag set explicitly per-mutation, never inferred. (b) Default to `privileged=true` for any mutation touching varsling, HR-compliance, or AML-sensitive fields — opt-out per case, not opt-in. (c) Diff rendering is server-redacted via the read-view, not client-redacted, so the redacted payload never leaves the DB. |
| Write amplification at high mutation rate | Low | Medium | Indexed on `(entity_kind, entity_id, occurred_at desc)` — cheap reads. Insert is a single row with no FK to user-side data; latency well under 5ms in dev. Monitor `audit_events` row growth; partition by `occurred_at` quarterly once table exceeds 50M rows. |
| `hse_audit_log` and `audit_events` drift (one written, other not) | Medium | Low (forensic floor still works) | Same recon job as the silent-gap mitigation. The two tables don't *have* to stay synced row-for-row — `audit_events` may have entries with no CDC row (e.g. `eksportert`, `delt` which don't mutate the entity itself). |
| `StatusChip` RAG variant rolled out inconsistently across modules | Medium | Low | Build it once in `src/components/ui/StatusChip.tsx` with a strict prop type (`status: 'open'|'in_progress'|'overdue'|'closed'|'rejected'|'approved'`). Make every module that ships a timeline import from this file. Stencil it into the parent design brief so the design system tracks it. |
| Scope registry imports forgotten → scope unknown at runtime (same bug as dashboards) | Medium | Medium | Codify the side-effect import in the host page's first line, with a `// register audit scope` comment. Add a runtime warning when `<EntityTimeline scopeId="…" />` is rendered for an unregistered scope. |
| Spec drift — design changes after we ship v1 | Medium | Low | Treat the design handover as the spec. Reviewers diff against it on every PR. Update this file (§1, §2) when the spec changes. |
| FK to `hse_audit_log_id` is `on delete set null` — what if archive folder cleans it up? | Low | Low | `hse_audit_log` is append-only by RLS — it cannot be cleaned up by users. If we ever introduce a retention sweeper, it must update `audit_events.hse_audit_log_id = null` first, not rely on cascade. Documented in column comment. |

---

## 12. File-by-file inventory (v1 + roll-out)

**New (v1)**:

- `supabase/migrations/20260919120000_audit_events.sql`
- `src/lib/audit/auditRegistry.ts`
- `src/lib/audit/emitAuditEvent.ts`
- `src/lib/audit/useEntityTimeline.ts`
- `src/lib/audit/diffShape.ts`
- `src/lib/audit/permalink.ts`
- `src/lib/audit/summaryTemplates.ts` (preset → Norwegian sentence map)
- `src/components/audit/EntityTimeline.tsx`
- `src/components/audit/EntityTimelineRow.tsx`
- `src/components/audit/EntityTimelineActionChip.tsx`
- `src/components/audit/EntityTimelineActor.tsx`
- `src/components/audit/diff/DiffSingleField.tsx`
- `src/components/audit/diff/DiffMultiField.tsx`
- `src/components/audit/diff/DiffNullCard.tsx`
- `src/components/audit/diff/semanticValue.tsx`
- `src/components/ui/StatusChip.tsx`
- `src/modules/compliance/audit/complianceChecklistAuditScope.ts`

**Modified (v1)**:

- `src/lib/permissionKeys.ts` — add `audit.read`, `audit.read.privileged`
- `src/lib/i18n/locales/nb.json` — add `endringslogg.*` namespace
- `src/components/layout/ModulePageShell.tsx` — add `sidePanel?: ReactNode` prop
- `modules/compliance/ChecklistExecutionPage.tsx` — import scope file as side-effect, pass `<EntityTimeline>` into shell
- `modules/compliance/useChecklistModule.ts` — wire 6 mutations to `emitAuditEvent`
- `CLAUDE.md` — add "Endringslogg / audit events" subsection under *Things that are easy to get wrong* (paragraph on emitter discipline)

**New (P3)**:

- `src/components/audit/diff/DiffListChange.tsx`
- `src/components/audit/diff/DiffTextBlock.tsx`
- `src/components/audit/EntityTimelineDrawer.tsx` (mobile/tablet container)
- `src/components/audit/EntityTimelineFilters.tsx`

**New per module (P5)**:

- `src/modules/<scope>/audit/<scope>AuditScope.ts`
- Mutation-site changes in each module's `use*Module.ts` hook

---

## 13. Decisions (resolved)

Approved by the reviewer 2026-05-19. All seven open questions
collapsed to the defaults proposed in §13 of the original draft.

1. **Two layers, not one.** `hse_audit_log` stays as the immutable
   forensic floor. `audit_events` is the semantic layer the UI
   reads. Drift is monitored by a recon SQL, not prevented by
   coupling.
2. **Fresh start in v1.** No automatic backfill. An admin-triggered
   "rekonstruér siste 30 dager" button lands in P5; backfilled rows
   carry a `backfilled=true` flag (added then) so the UI can render
   "(rekonstruert)" on those events.
3. **Default-true `audit.read`** for admin, verneombud, amu_medlem,
   hms_radgiver. Member / ansatt opt-in per org. `audit.read.privileged`
   admin-only by default; per-org admins can grant to a named
   HMS-rådgiver.
4. **Right-overlay on tablet.** Translucent backdrop, no layout
   shift on the underlying content. Desktop ≥1280px keeps the
   inline side-rail.
5. **First save = `kommentert` event.** Later edits to the same
   comment fire `endret` with a `text_block` diff on the body.
   Implementation note: P1 only ships `kommentert`; `endret` on
   comments slips to P3 alongside the `text_block` renderer.
6. **External-token actor deferred to P6.** v1 logs the event but
   the actor row degrades to `actor_role='system'` if it fires
   before P6 wiring lands.
7. **Storybook gates P1, live wiring gates P2.** P1 is shipped
   when the 6 sample events from spec §7 render in the demo page;
   P2 is shipped when a fresh checklist execution shows the same
   event types from real mutations.

---

## 14. Acceptance criteria — v1 (P1 + P2)

A reviewer (verneombud or HMS-rådgiver) should be able to:

- [ ] Open any compliance checklist execution.
- [ ] See the Endringslogg panel docked to the right at desktop
      widths, populated within 500ms of page load.
- [ ] Read the full story of the execution — created, edited,
      reassigned, signed — from the panel alone, in Norwegian,
      without consulting any other surface.
- [ ] Expand a row to see exactly which field changed and from what
      to what, with R.A.G. colours on status values.
- [ ] Identify whether each action was a real user, a system runner,
      or an external auditor (when wired up in P6).
- [ ] Copy a permalink to a specific event from the row context menu.
- [ ] Read every interaction with keyboard alone, with audible
      screen-reader output that follows §9.
- [ ] Confirm via SQL that every mutation in
      `useChecklistModule.ts` (v1 set) emitted both an
      `audit_events` row and an `hse_audit_log` row, with
      `hse_audit_log_id` linking them.

If all eight pass, ship v1 and start P5.
