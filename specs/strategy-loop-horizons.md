# Strategy loop — implementation handoff (Horizons 1–3)

Hand-off spec for implementing the prioritized plan in
`STRATEGY_PRODUCT_REVIEW.md`. Written for a Claude Code agent (or any
engineer) starting fresh in this repo. Read this whole file, then
`CLAUDE.md`, then the review doc, before writing code.

**Mission in one sentence:** wire the loop *strategy → tasks → meetings →
people* and surface it on the front page, in three horizons, shipping each
work item as an independently revertible unit.

---

## 0. Ground rules (non-negotiable, from CLAUDE.md)

1. **Migrations** live in `supabase/migrations/` (top level, not `archive/`).
   Basenames must be globally unique across BOTH folders and sort after the
   current latest (`20261025120000_planning_okr_and_recurring_tasks.sql`).
   Use `202611xxxxxxxx_*` onward. Always idempotent:
   `create table if not exists`, `add column if not exists`,
   `on conflict ... do update/nothing`. No destructive ops in forward
   migrations. Comment jsonb columns with their field shape. Header comment
   (4–8 lines): which gap is closed + self-audit (what's addressed vs
   restrisiko).
2. **Norwegian (bokmål)** for all user-facing strings. English for code,
   types, comments, commit messages.
3. **Never** copy `crypto.randomUUID` polyfills — use
   `freshId(prefix)` from `src/lib/dashboards/freshId.ts`.
4. New dashboard widget kinds require updating six call sites (see CLAUDE.md
   "Dashboard engine") — avoid new kinds unless a horizon item demands it.
5. Single-column FKs to `public.regulations` don't bind (composite PK). Use
   `text` + the `regulation_id_must_match_org()` trigger pattern if needed.
6. Component file headers: 3–6 lines on *why* the file exists.
7. Verification gate for every work item:
   `npx tsc -b && npm run lint && npm run build` must pass. There is no test
   suite — the build IS the gate; do not skip it.
8. Commits: one work item per commit, message explains the *why*, body lists
   moving pieces. Do not bundle horizons.
9. RLS on every new table. Copy the pattern from
   `20261025120000_planning_okr_and_recurring_tasks.sql` (select: org
   members; write: admin or creator).

## 1. Verified facts — do NOT rediscover these wrong

These were verified against the schema on 2026-06-11. Trust them; re-verify
only if a migration newer than `20261025120000` touches them.

- **`task_items` ALREADY has `assignee_user_id uuid` and `owner_user_id uuid`
  FK columns** (→ `auth.users`, see
  `archive/20260829120001_task_module_complete.sql:288`), alongside
  denormalized `assignee_name` / `owner_name` text. The bug is that the UI
  (`modules/tasks/TaskCreateForm.tsx`, `PlanningCreateTaskModal.tsx`) writes
  only the name strings, and `MittArbeidInnboksPage.tsx:~91` matches by
  `t.assigneeName === myName`. **H1.1 is a wiring job, not a schema job.**
- **`meeting_action_items` ALREADY has `task_id uuid` and `task_module text`
  columns** (no FK — comment says tasks used to live in jsonb), plus
  `responsible_member_id` → `organization_members` and `status in
  ('open','in_progress','done','dropped')`. H2.3 reuses these columns and
  adds the FK-less link discipline + sync triggers.
- OKR schema (all in `20261025120000_...`): `okr_plans`, `okr_objectives`
  (`progress numeric 0–1`, `health`), `okr_key_results` (`current_value`,
  `target`, `unit`, `confidence`, `invert`), `okr_raci`, `okr_task_links`
  (unique KR+task, cross-org validation trigger
  `okr_task_links_validate_cross_org()`).
- Recurrence RPCs exist: `generate_recurring_task_next(p_completed_task_id)`,
  `update_recurring_task_interval(...)`, `stop_recurring_task(p_task_id)`.
- Provisioning: `provision_okr_baseline_for_org(...)` seeds the boilerplate
  plan on first `/planlegging` load.
- Invites: `create_invitation(...)` / `accept_invitation(p_token)` RPCs in
  `archive/20260402120000_rbac_invites.sql`. UI:
  `src/pages/admin/klarert/SecUsers.tsx` (single email → link copied to
  clipboard; **no email is sent**), `src/pages/InviteAcceptPage.tsx`.
- Outbox for external deliveries: `gov_notifications_outbox`
  (`20260905121900_...`). Content-free payload discipline applies (see
  alerts notes in CLAUDE.md) — never put case/task bodies in payloads.
- Meetings roster: canonical = `meeting_attendees` (NOT
  `meetings.participant_member_ids`). Never select
  `meeting_external_invitees.secure_token`; use the `_safe` view.
- Hooks that own state: `src/hooks/usePlanningOkr.ts` (optimistic mutation
  pattern `optimisticPlanMutation`, rollback on error),
  `src/hooks/usePlanningTasks.ts`, `modules/tasks/useTaskItemsData.ts`.
- Front page: `src/pages/WelcomeDashboardPage.tsx` routed at `/app`
  (index route inside `AticsShell`, `src/App.tsx` ~line 408).
- Build: `npx tsc -b && vite build && node scripts/prerender-marketing.mjs`
  (`npm run build`). Marketing pages are prerendered — landing-page changes
  must survive the prerender step.

---

## 2. HORIZON 1 — Foundations

Ship order: H1.1 → H1.2 → (H1.3 ∥ H1.4). H1.1 and H1.2 unblock most of
Horizon 2; do them first and do them well.

### H1.1 Member picker — stop writing free-text assignees

**Goal:** every surface that sets a task assignee/owner writes
`assignee_user_id`/`owner_user_id` (keeping `*_name` as denormalized display
text), and every "my work" query filters on the uuid, not the name.

**No schema change needed** except a backfill migration.

Steps:

1. **Shared component** `src/components/people/MemberPicker.tsx`:
   searchable select over org members. Source the list the same way
   `fetchAssignableUsers` in `modules/tasks/TaskCreateForm.tsx` does today
   (factor that fetch into a hook `src/hooks/useOrgMembers.ts` and reuse).
   Value = `{ userId, displayName }`. Allow a free-text fallback entry
   (some orgs track people without logins — see OnboardingWizard directory
   rows) which sets only `*_name` and leaves `*_user_id` null, with a
   visible "uten brukerkonto" hint.
2. **Adopt it** in: `modules/tasks/TaskCreateForm.tsx`,
   `modules/tasks/TaskDetailPanel.tsx` (edit mode),
   `src/pages/planning/PlanningCreateTaskModal.tsx`, subtask assignee in
   `TaskSubtaskList`/`useSubtaskCounts` flow. On select, write both uuid and
   name.
3. **Fix consumers:** `src/pages/mitt-arbeid/MittArbeidInnboksPage.tsx`
   filter becomes `t.assignee_user_id === session.user.id` with name-match
   as legacy fallback (`?? t.assigneeName === myName` ONLY where
   `assignee_user_id is null`). Same for any owner-based filters in
   `usePlanningTasks.ts` / `useTaskItemsData.ts`.
4. **Backfill migration** `202611xxxxxxxx_task_assignee_uuid_backfill.sql`:
   set `assignee_user_id`/`owner_user_id` where null by joining
   `organization_members`/profiles on exact display-name match *within the
   same organization_id*. Header must state the restrisiko: ambiguous or
   unmatched names stay text-only.
5. **Replace `OWNER_OPTIONS`** hardcoded list
   (`src/pages/planning/planningConstants.ts:128-137`) with `useOrgMembers`
   in `PlanningStrategiSection` (RACI person labels) — keep the hardcoded
   list ONLY as empty-org fallback.

**Acceptance:** create a task from tasks module and from planning module →
row has both uuid + name; rename your profile display name → task still
appears in your inbox; build green.

**Pitfalls:** `TaskItemRow` mapper in `useTaskItemsData.ts` currently omits
several columns — add `assignee_user_id`/`owner_user_id` to the select AND
the row type. Don't break `task_subtasks.assignee_user_id` which already
exists.

### H1.2 Automatic KR progress rollup

**Goal:** when a linked task closes, the KR's progress moves — without
destroying manual control.

Design decision (made — don't relitigate): **count-based auto mode with
manual override**, expressed as a new column, not magic mutation of
`current_value`.

1. **Migration** `202611xxxxxxxx_okr_kr_auto_progress.sql`:
   - `alter table okr_key_results add column if not exists progress_mode
     text not null default 'manual' check (progress_mode in
     ('manual','task_rollup'));`
   - View or stable function `okr_kr_task_progress(kr_id)` returning
     `(linked_count int, closed_count int)` from `okr_task_links` joined to
     `task_items` (`status in ('closed')`; treat `cancelled` as unlinked —
     exclude from both counts).
   - Trigger on `task_items` after update of `status` (and on
     `okr_task_links` insert/delete): for affected KRs **with
     `progress_mode = 'task_rollup'`**, set
     `current_value = round(target * closed/linked)` (respect `invert` —
     if invert, count open instead). Guard `linked = 0` → leave untouched.
   - Header self-audit: manual mode untouched; rollup is count-based, not
     weighted (restrisiko: one big task counts like one small task).
2. **Frontend:** in `OKREditDialogs.tsx` KR form add a
   "Fremdrift"-mode toggle (`Manuell` / `Beregnes fra oppgaver`). In
   `PlanningStrategiSection.tsx` / `OKRDashboard.tsx`, when mode is rollup,
   render the narrative line under the bar: `«3 av 5 koblede oppgaver
   fullført»` (data from the progress function — extend the plan fetch in
   `usePlanningOkr.ts` to include per-KR link counts in one query, no N+1).
3. Disable manual `current_value` input when mode = rollup (show computed
   value read-only).

**Acceptance:** link 2 tasks to a rollup-mode KR, close 1 → KR shows 50%
of target and the narrative line; switch to manual → editing works again.

### H1.3 Email verification + real invite delivery

1. **Verification:** in `src/pages/AuthPage.tsx` signup flow
   (~lines 139–172), after `signUp`, branch on
   `data.user && !data.user.email_confirmed_at` → render a "Bekreft
   e-posten din" panel with a resend button
   (`supabase.auth.resend({ type: 'signup', email })`). Gate
   `postLoginRedirectPath()` on a confirmed session. Add the resend path to
   the login error case `email_not_confirmed` in `src/lib/authErrors.ts`.
   (Supabase project must have "Confirm email" enabled — note this in the PR
   description as an ops step; do not assume you can toggle it from code.)
2. **Invite delivery:** extend the invite flow so creating an invitation
   also enqueues an email:
   - Migration: `create_invitation` wrapper or new RPC
     `create_invitation_and_notify(...)` that inserts a row into
     `gov_notifications_outbox` with kind `'invite_email'` and a
     **content-free payload**: `{invitation_id}` only. The dispatcher (an
     edge function or the existing outbox consumer — check
     `supabase/functions/` and `src/pages/admin/GovOutboxPage.tsx` for the
     current consumer before inventing one) resolves email + link
     server-side.
   - If no outbox consumer exists for email yet, implement the minimal edge
     function `send-invite-email` and document the required SMTP/Resend env
     vars in the PR body. Do not hardcode secrets.
3. **Pending invites UI** in `SecUsers.tsx`: table of open invitations
   (email, created, expires, status) with actions *kopier lenke* /
   *send på nytt* / *trekk tilbake* (revoke = expire the token via RPC).
   Also: show the invite link on screen after creation (today it's
   clipboard-only — `SecUsers.tsx:~73-100`).

**Acceptance:** invite → row appears in pending list + outbox row enqueued;
resend re-enqueues; revoked token rejected by `accept_invitation`.

### H1.4 Home-page attention layer

**Goal:** `/app` answers "what needs my attention" in 5 seconds, covering
strategy + meetings + compliance, not just tasks.

1. New component `src/pages/dashboard/AttentionStrip.tsx` rendered in
   `WelcomeDashboardPage.tsx` ABOVE the task cards: 4 compact KPI cards —
   - **Strategi**: OKR plan health (count of KRs by confidence; worst-first
     accent) → links `/planlegging?section=strategi`. Data: lightweight
     select over `okr_key_results` for current org (don't mount the full
     `usePlanningOkr`; write a small `useOkrHealthSummary` hook).
   - **Mine oppgaver**: open + overdue (data already in
     `useWorkspaceDashboardData`) → `/tasks/management`.
   - **Neste møte**: next meeting from the existing AMU-card query —
     promote from sidebar to strip; keep the sidebar card removed (no
     duplication).
   - **Etterlevelse**: nearest compliance deadline / overdue cadence task
     count (reuse the recurring-task query from
     `PlanningOversiktSection` filters).
2. Style with existing tokens — use `<Badge>` variants, no new hex
   constants, no `text-[10px]` (review doc flagged both).
3. While in the file: remove the dead "Workspace > Hjem" breadcrumb, add
   `role="img"` + `aria-label` to the donut chart.

**Acceptance:** strip renders with real data for a seeded org; each card
navigates; empty org shows zero-states with a CTA per card, not blanks.

---

## 3. HORIZON 2 — The integration loop

Dependencies: H2.1 needs H1.2. H2.2 needs H2.1. H2.3 and H2.6 need H1.1.
H2.4 extends H1.3. H2.5 is independent.

### H2.1 OKR check-in workflow

**Schema** (`202611xxxxxxxx_okr_checkins.sql`):

```sql
create table if not exists public.okr_checkins (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key_result_id   uuid not null references public.okr_key_results(id) on delete cascade,
  value           numeric,            -- KR value at check-in
  confidence      numeric,            -- 0..1 snapshot
  note            text,               -- short narrative, nb
  meeting_id      uuid,               -- set when recorded from a meeting (H2.2); no FK (module boundary), validated by trigger
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
```

RLS: select org members, insert org members (anyone can check in on a KR
they can see), no update/delete (append-only history — that's the audit
value).

**Behavior:**
- Writing a check-in also updates `okr_key_results.current_value` +
  `confidence` (RPC `okr_record_checkin(p_kr_id, p_value, p_confidence,
  p_note, p_meeting_id default null)` doing both atomically). Rollup-mode
  KRs (H1.2): check-in records confidence + note only; value comes from
  rollup.
- **Cadence:** add a library item to the kadens flow — simplest correct
  path: seed a recurring `task_items` row "OKR-innsjekk" (14-day interval,
  reusing existing recurrence machinery) via a new entry in
  `src/pages/planning/cadenceLibrary.ts` (category `governance`,
  origin `Egen`, recommended). Do NOT build a separate scheduler.
- **UI:** "Sjekk inn"-button per KR row in `OKRDashboard` → small dialog
  (value, confidence select on_track/at_risk/off_track mapped to numbers as
  in `PlanningStrategiSection.tsx:54-71`, note). Sparkline of last 8
  check-in confidence values per KR (inline SVG, no chart lib — match the
  existing hand-rolled chart style). "Sist innsjekket for X dager siden"
  staleness hint when > 21 days.

### H2.2 Strategy in meetings & 1:1s

The meetings module knows nothing about OKRs today (verified: zero refs).
Keep coupling thin and one-directional: meetings *read* OKR state and
*write* check-ins through `okr_record_checkin`.

1. **Agenda block:** meeting template definitions hold
   `definition.agendaItems[]` (see CLAUDE.md template-surfaces table —
   `meeting_system_templates` + locales). Add an agenda item *type*
   `okr_review` (extend the agenda-item shape where it is typed — find it
   via `grep -rn "agendaItems" src/ modules/` and follow
   `MeetingsTemplateEditorPanel.tsx`). Rendering in `MeetingLivePage.tsx`:
   an `okr_review` item shows the org plan's objectives → KRs with health
   badges + last check-in, each row expandable to the H2.1 check-in form
   (passing `meeting_id`).
2. **Seed migration:** add an "OKR-gjennomgang" agenda item to the relevant
   system meeting templates (AMU monthly + a 1:1 template if one exists;
   if no 1:1 template exists, seed one: `medarbeidersamtale-1-1` with
   agenda: siden sist / OKR-gjennomgang / blokkeringer / neste steg).
   Follow the meetings seed conventions exactly (idempotent upsert,
   locales table, header self-audit).
3. **Back-link:** on the KR detail/edit panel, list check-ins with a
   "fra møte" chip linking to the meeting when `meeting_id` is set.

**Acceptance:** create meeting from template with OKR block → live page
shows real KR health → record a check-in → it appears in planning history
with the meeting chip.

### H2.3 Meeting action items → tasks sync

Use the existing `meeting_action_items.task_id` / `task_module` columns.

1. **RPC** `meetings_action_item_to_task(p_action_item_id)`: creates a
   `task_items` row (template_kind `'oppgave'`, title = description, due =
   due_date, `source_type = 'meeting'`, `source_id = meeting_id`,
   assignee resolved from `responsible_member_id` →
   member's `user_id` + display name), writes `task_id` +
   `task_module = 'tasks'` back on the action item. Idempotent: if
   `task_id` already set, return it.
2. **Sync triggers** (one migration): task closed/cancelled → action item
   `done`/`dropped`; action item marked done in the meeting UI → if linked
   task open, close it (status `closed`, activity-feed entry "Lukket fra
   møte"). Guard against ping-pong with a `pg_trigger_depth() = 1` check
   or an explicit skip flag.
3. **UI:** in the meeting detail/live action-item list: per-item
   "Opprett oppgave"-button + a meeting-close prompt "Opprett oppgaver for
   N åpne aksjonspunkter?" (bulk). In `TaskDetailPanel`, when
   `source_type = 'meeting'`, show a "Fra møte"-chip linking to the meeting.

### H2.4 Bulk invites

Extends H1.3. In `SecUsers.tsx`: "Inviter flere"-modal with a textarea
(paste emails, split on whitespace/comma/semicolon) and CSV upload
(first column or `email` header; parse client-side, no new dependency if
avoidable). Validate, dedupe against members + pending invites, preview
table (ok / already member / invalid), then loop `create_invitation_and_notify`.
Plus: in the onboarding wizard people-step (`OnboardingWizard.tsx:~478-580`),
an "Inviter alle med e-post"-checkbox that enqueues invites for directory
entries that have an email.

### H2.5 Due-date reminders & digest

1. Per-user pref on the existing notification preferences surface
   (`ProfilePage.tsx` notification section): `oppgavevarsler:
   daglig / ukentlig / av` + toggle "varsle 3 dager før frist".
2. **Scheduled job** (Supabase cron / edge function — match however
   the recurring-task generation or outbox dispatch is scheduled today;
   check `supabase/functions/` first): scan `task_items` for
   (a) due in 3 days, (b) newly overdue, owned/assigned per H1.1 uuid;
   enqueue **content-free** outbox rows `{user_id, kind:'task_digest',
   task_ids:[...]}`; dispatcher composes the email.
3. Never email users whose pref is `av`; default `ukentlig`.

### H2.6 Workload view

1. `modules/tasks/dashboards/useTasksDatasets.ts`: add dataset
   `tasks_by_assignee` (open + overdue count per assignee uuid, display
   name resolved via members). Register a default `bar` or `table` widget
   "Belastning per person" in `tasksDashboardScope.ts` (existing kinds
   only — no new widget kind).
2. Planning page: on each KR card (`OKRDashboard`), show the H1.2 link
   counts as a chip `«3 åpne · 1 forfalt»` → clicking applies the existing
   OKR filter in `PlanningOversiktSection` (`?section=oversikt` + filter
   param).

---

## 4. HORIZON 3 — Scale, trust & polish

Less prescriptive; follow the patterns established above. Per item: read the
referenced surface first, keep PRs small.

| Item | Instruction sketch |
|---|---|
| **H3.1 Plan snapshots** | Table `okr_plan_snapshots(id, organization_id, plan_id, snapshot jsonb, reason text, created_by, created_at)`; jsonb = full plan tree (document shape in column comment). Write on: plan status change, quarterly cadence task, and manual "Ta øyeblikksbilde". Wire the disabled `historikk` tab in `src/pages/cadence/CadencePage.tsx:32-33` AND a "Historikk" view in planning: timeline list + read-only render of a snapshot through `OKRDashboard` (it already supports non-editable mode). |
| **H3.2 Alignment tree** | `alter table okr_plans add column if not exists parent_plan_id uuid references okr_plans(id) on delete set null` + same-org check trigger + cycle guard (walk parents, max depth 5). UI: plan switcher in `PlanningStrategiSection` hero + indent tree view. Child-plan objectives can reference a parent objective (`supports_objective_id`) for the cascade line "støtter: <parent mål>". |
| **H3.3 Roles → permissions** | Bridge table `functional_role_permission_grants(functional_role_key, permission_key)` seeded for verneombud→`alerts.verneombud` etc. (full mapping: read `src/lib/permissionKeys.ts` + `FunctionalRolesAdminPanel.tsx` catalog). Trigger on `org_functional_role_assignments` insert/delete/expiry grants/revokes. Show resulting permissions in the admin panel ("Denne rollen gir: …"). Replace the free-text `ROLE_OPTIONS` employee role on `OrganisationPage.tsx` with a typed enum column (`add column if not exists role_key text check (...)`, keep old text column as legacy display). |
| **H3.4 OAuth** | Supabase Google + Microsoft providers; add provider buttons on `AuthPage.tsx`; map `user_metadata.full_name`; PR body documents the redirect-URL + provider-secret ops steps. Domain-match auto-join is OUT of scope (security review needed first). |
| **H3.5 Pricing/ROI + demo** | Rewrite `src/pages/marketing/sections/PricingSection.tsx` copy around outcomes (timer spart, revisjonsklar dokumentasjon); verify `/login?demo=1` — `grep demo src/pages/AuthPage.tsx`; if unhandled, either implement (sign into a seeded demo org read-only) or change the CTA to `/signup`. Remember: `npm run build` runs the marketing prerender — check its output. |
| **H3.6 Mobile & a11y** | Touch support for the kanban drag (note: `@dnd-kit` is already a dependency — migrate `TaskProjectBoard.tsx` HTML5 DnD to dnd-kit rather than hand-rolling touch events). Multi-select checkboxes + footer bulk bar (fullfør / omfordel / arkiver) in `TasksAllePage` list view. Consolidate marketing hex constants into `src/pages/marketing/theme.ts`. Either implement the `gantt` view in `TasksAllePage.tsx` (type exists at ~line 66, render missing) or remove the mode. |
| **H3.7 Cadence library → DB** | Table `cadence_library_items` (org_id null = system) seeded from `src/pages/planning/cadenceLibrary.ts`; admin CRUD for org items; `PlanningKadensSection` reads DB. Then DELETE the unused parallel wizard `src/pages/cadence/wizard/` + `useCadenceWizardState.ts` (verify nothing imports it first). |
| **H3.8 Pagination + GDPR export** | Server-side pagination or windowed fetch in `useTaskItemsData` (keyset on `created_at`); keep analytics datasets on a capped aggregate query. GDPR: "Last ned mine data"-button on `ProfilePage` calling an RPC that returns the user's profile + memberships + assigned tasks as JSON (content-free logging). |

---

## 5. Workflow & definition of done

- Branch per CLAUDE.md default workflow unless told otherwise by the
  session's harness instructions (those win).
- One horizon item = one commit (or a small stack); migrations and their
  frontend land together so the build never references missing columns.
- Per item, the PR/commit body must state: gap closed, schema touched,
  restrisiko (what's deliberately deferred).
- Done = `npx tsc -b && npm run lint && npm run build` green + acceptance
  criteria of the item demonstrably met (describe how you verified — a
  seeded org walkthrough is acceptable; there is no test suite).
- When DB behavior matters (triggers, RPCs), include a `-- usage:` comment
  block at the top of the migration showing the intended call.

## 6. One-shot prompt (paste to the implementing agent)

> Read `specs/strategy-loop-horizons.md`, `STRATEGY_PRODUCT_REVIEW.md`, and
> `CLAUDE.md` in the NewAMU repo. Implement Horizon 1 in order
> (H1.1 → H1.2 → H1.3 → H1.4), one commit per item, following every ground
> rule in §0 and the verified facts in §1 of the spec — in particular:
> `task_items.assignee_user_id` already exists (H1.1 is wiring + backfill,
> not new schema), and all new tables need idempotent migrations with RLS
> and a self-audit header. After each item run
> `npx tsc -b && npm run lint && npm run build` and fix everything before
> moving on. When Horizon 1 is complete and green, stop and report:
> what shipped, how each acceptance criterion was verified, and any
> restrisiko deferred — then await go-ahead for Horizon 2.
