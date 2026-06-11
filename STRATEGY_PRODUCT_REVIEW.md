# Strategy product review & improvement plan

Cross-functional review (entrepreneur / developer / UI designer) of the
strategy core and its supporting surfaces: planning/OKR, tasks, user
administration & signup, and the front pages. Goal: make the product deliver
on its vision — *a strategy application with deep integration into 1:1s,
meetings and employee performance* — and prioritize the work to get there.

Reviewed surfaces: `src/pages/planning/`, `src/components/okr/`,
`modules/tasks/`, `src/pages/AuthPage.tsx` / `OnboardingWizard.tsx` /
`OrganisationPage.tsx` / `src/pages/admin/klarert/SecUsers.tsx`,
`src/pages/marketing/`, `src/pages/WelcomeDashboardPage.tsx`.

---

## 1. The headline finding

**The pieces exist; the loop between them doesn't.** Strategy (OKR), tasks,
meetings and people administration are each individually solid, but the
connective tissue that makes a *strategy* product valuable is missing:

- Key-result progress is **manually maintained** — linking tasks to a KR
  (`okr_task_links`) has no effect on the KR's `current_value`. The seed
  migration itself flags this as restrisiko
  (`20261025120000_planning_okr_and_recurring_tasks.sql:34-37`).
- The meetings module has **zero references** to OKRs/objectives. There is no
  OKR check-in, no 1:1 agenda block, no way to review strategy in a meeting.
- Meeting action items (`meeting_action_items`) are a **parallel system** to
  tasks — closing one never creates or updates the other.
- Tasks identify assignees by **free-text name match**
  (`t.assigneeName === myName` in `MittArbeidInnboksPage.tsx:91`), so "my
  work", workload views, and any future 1:1/performance integration are built
  on sand.
- The logged-in home (`WelcomeDashboardPage.tsx`) is **purely task-centric** —
  strategy health, meeting cadence, and "what needs my attention" never
  appear, even though the landing page sells exactly that.

Everything below feeds this one conclusion: **close the loop
strategy → tasks → meetings → people, and surface it on the front page.**

---

## 2. Per-area findings

### 2.1 Strategy / planning (`/planlegging`)

**What works.** Persisted OKR model (`okr_plans` → `okr_objectives` →
`okr_key_results` + `okr_raci` + `okr_task_links`) with RLS, optimistic
mutations with rollback (`usePlanningOkr.ts`), a capable cadence wizard with
a ~70-item compliance task library, and three coherent tabs (Strategi,
Kadens, Oppgaver). Good MVP architecture; gaps are feature-level, not
structural.

**Top gaps (entrepreneur lens).**

| # | Gap | Why it matters |
|---|---|---|
| 1 | No automatic KR progress rollup from linked tasks | Linking tasks to KRs is the module's core promise; today it's decorative |
| 2 | No OKR check-in workflow (bi-weekly/monthly) | Strategy becomes a set-and-forget artifact; no rhythm keeps it alive |
| 3 | No plan history / snapshots | Auditors (Arbeidstilsynet) want proof goals were set, tracked, reviewed; edits overwrite silently |
| 4 | No meeting/1:1 integration | The product vision, unbuilt |
| 5 | Flat single plan — no alignment tree (company → team) | Cascading is what separates a strategy tool from a goal list |
| 6 | Confidence is a snapshot, no trend | "Been at-risk for 6 weeks" vs "just slipped" is the signal leaders need |

**UX issues (designer lens).** Auto-seeded boilerplate plan with no
greenfield option; no "what is an OKR" onboarding; KR progress bars carry no
narrative ("48% because 3 of 5 tasks closed"); cadence wizard opens on a
7×7 checkbox matrix with no recommended preset; two disabled placeholder
tabs (Årshjul, Historikk) on `/cadence`; hardcoded `OWNER_OPTIONS`
(`planningConstants.ts:128-137`) instead of real org members.

**Dev notes.** Two parallel cadence wizard implementations
(`src/pages/cadence/wizard/` vs `PlanningKadensSection.tsx`) — pick one.
`cadenceLibrary.ts` (~450 lines) should migrate to a DB table for org
customization. Confidence thresholds hardcoded in `PlanningStrategiSection.tsx:54-71`.

### 2.2 Tasks

**What works.** Rich model (`src/types/task.ts`): 7 template kinds, 9-state
CAPA lifecycle, subtasks, evidence, consultations, sign-offs, SLA, recurrence
via RPCs, PDCA/Kanban/list views, analytics on the shared dashboard engine.

**Top gaps.**

| # | Gap | Why it matters |
|---|---|---|
| 1 | Assignee/owner are free-text strings, not member FKs | Breaks inbox matching on rename/leave; blocks workload, delegation, 1:1 and performance features |
| 2 | No workload/capacity view (`estimatedHours`/`actualHours` exist in schema, never rendered) | "Who is over capacity" is table stakes for execution management |
| 3 | No due-date reminders/digest (only Arbeidstilsynet escalation) | Tasks silently rot; the system never nudges |
| 4 | Meeting action items not synced to tasks | Follow-up dies between systems |
| 5 | No KR rollup on planning page ("3 open tasks on this KR") | Strategy page can't show execution health |
| 6 | No bulk actions, no touch/mobile Kanban, Gantt view typed but unimplemented (`TasksAllePage.tsx:66`) | Daily-driver friction |

**Dev notes.** No pagination — all org tasks load client-side (scaling risk
at 1000+). Dual state in `TaskDetailPanel` (local `detail` + `item` prop).
Unused schema fields (`ownerRole`, `confidentialityLevel`, hours,
`requiresApproval` flow). Casts to `TaskItemStatus` without validation.

### 2.3 User administration, signup & registration

**What works.** Email/password auth, token-based invites
(`create_invitation` / `accept_invitation` RPCs), a thoughtful 7-step
onboarding wizard with Brønnøysund lookup, employee/unit/group CRUD on
`OrganisationPage`, functional-roles catalog, profile with notifications and
avatar.

**Top gaps.**

| # | Gap | Why it matters |
|---|---|---|
| 1 | Email verification not enforced (`AuthPage.tsx:139-172`); no resend | Unreachable users; broken org membership on typos |
| 2 | Invites are one-at-a-time, link copied to clipboard, **no email sent**, no pending-invite list, no resend | Onboarding 100 employees ≈ 100 manual rounds of copy-paste |
| 3 | No bulk import (CSV / paste emails); wizard "people" are directory rows, not auth users | Time-to-team-onboarded is the #1 activation metric and it's slow |
| 4 | Roles are free-text strings, decoupled from `PermissionKey`s; functional roles don't grant their permissions (e.g. verneombud ↛ `alerts.verneombud`) | Admin mistakes guaranteed; not auditable |
| 5 | No OAuth/SSO, no SCIM | Enterprise blocker |
| 6 | 6-char password minimum, no strength feedback; invite-accept email match unclear server-side; no GDPR self-service export | Trust & compliance optics for a compliance product |

See also `ORG_ACCESS_CONTROL_ANALYSIS.md` for the deeper RLS review — its
findings stand.

### 2.4 Front pages (marketing + logged-in home)

**What works.** Marketing site is well-structured (hero, 6 module sections,
pricing, CTA, SEO metadata); navigation IA in `AticsShell` is excellent; home
page has a real setup checklist, task summary, week calendar, notifications.

**Top gaps.**

| # | Gap | Why it matters |
|---|---|---|
| 1 | Promise/product mismatch: landing sells strategy+compliance+meetings; home shows only tasks | First-session disappointment kills activation |
| 2 | No "what needs my attention today" layer (compliance milestones, OKR health, overdue governance) | The home page should answer this in 5 seconds |
| 3 | No 1:1 / meeting-cadence presence in main content (AMU meeting is a sidebar afterthought) | The governance rhythm is the product's heartbeat |
| 4 | Pricing lists features, not outcomes/ROI | CFOs buy hours saved, not module counts |
| 5 | `/login?demo=1` CTA — demo flow unverified | A dead "try it" path is the most expensive dead link you can have |
| 6 | Design drift: hex constants duplicated across ~5 files, one-off conic-gradient donut, `text-[10px]`, status pills bypassing `<Badge>`, missing ARIA on the chart | Erodes the design system; a11y debt |

---

## 3. Prioritized action plan

Ordering principle: **first fix the foundations that everything else builds
on, then build the integration loop (the differentiator), then scale and
polish.** Effort is team-relative (S ≤ 2 days, M ≤ 1 week, L ≤ 3 weeks).

### Horizon 1 — Foundations (now, ~2 weeks)

| # | Action | Area | Effort | Rationale |
|---|---|---|---|---|
| 1.1 | **Member-FK assignee picker** — replace free-text assignee/owner with searchable org-member select; backfill by name match; keep display-name denormalized | Tasks | M | Unblocks inbox correctness, workload, delegation, 1:1 integration — the single highest-leverage fix |
| 1.2 | **Auto KR progress rollup** — DB trigger/aggregation: linked task closes → KR `current_value` advances (count-based default, manual override kept) | Strategy | M | Makes the existing task↔KR link real; instant perceived value |
| 1.3 | **Enforce email verification + send invite emails** — verification gate with resend; invite delivery via email service; pending-invites list with resend/revoke | Auth | M | Removes the two biggest activation leaks |
| 1.4 | **Home page "attention layer"** — KPI row above tasks: OKR health summary, compliance deadlines, next meeting, overdue count; link each to its module | Front | M | Closes the promise/product gap with data that already exists |

### Horizon 2 — The integration loop (weeks 3–8) — *the differentiator*

| # | Action | Area | Effort | Rationale |
|---|---|---|---|---|
| 2.1 | **OKR check-in workflow** — recurring check-in (reuse recurrence RPCs), per-KR update form (value + confidence + comment), `okr_confidence_history` table, trend sparklines | Strategy | L | Turns the plan from artifact into rhythm; feeds 2.2 |
| 2.2 | **Strategy in meetings & 1:1s** — "OKR review" agenda block in meeting templates pulling live KR health; KR updates recordable from the meeting; 1:1 template variant showing the report's objectives/tasks | Strategy+Meetings | L | This *is* the product vision; no competitor in the Norwegian HMS space has it |
| 2.3 | **Meeting action items → tasks sync** — on meeting close, offer/auto-create `task_items` from action items with two-way status link | Tasks+Meetings | M | Follow-up stops dying between systems |
| 2.4 | **Bulk invites** — paste-emails / CSV modal generating invites + sending emails; "invite all" from wizard directory entries | Auth | M | 10× faster team onboarding |
| 2.5 | **Due-date reminders & digest** — daily/weekly email digest, T-3 days and overdue nudges, per-user preference (UI already exists in ProfilePage) | Tasks | M | The system starts working for the user |
| 2.6 | **Workload view** — open tasks per member (now possible after 1.1), drill-down to person; surface on planning page per KR ("3 open, 1 overdue") | Tasks+Strategy | M | Execution health becomes visible where decisions are made |

### Horizon 3 — Scale, trust & polish (weeks 9+)

| # | Action | Area | Effort |
|---|---|---|---|
| 3.1 | Plan snapshots/history (`okr_plan_snapshots`) + the disabled "Historikk" tab; audit-grade "planned vs achieved" view | Strategy | M |
| 3.2 | Alignment tree: `parent_plan_id` on `okr_plans`, company→team cascade UI | Strategy | L |
| 3.3 | Typed roles bound to permissions (functional role assignment auto-grants/revokes its `PermissionKey`s) | Auth | M |
| 3.4 | OAuth (Google/Microsoft) sign-in; SCIM later if enterprise pipeline demands | Auth | M |
| 3.5 | Pricing page rewritten around outcomes/ROI; verify or fix `/login?demo=1` demo flow | Front | S |
| 3.6 | Mobile & a11y pass: touch Kanban, bulk actions, ARIA on charts, kill `text-[10px]`/inline hex (consolidate to `theme.ts`), reusable donut component | Tasks+Front | M |
| 3.7 | Cadence library → DB (org-customizable); delete the unused parallel wizard in `src/pages/cadence/wizard/` | Strategy | M |
| 3.8 | Task list pagination + GDPR self-service export | Tasks+Auth | M |

### Sequencing logic

- **1.1 before 2.3/2.6 and any 1:1 feature** — every people-centric feature
  needs a real member FK, not a name string.
- **1.2 before 2.1/2.2** — check-ins and meeting reviews are only credible
  when KR numbers move on their own.
- **2.1 before 2.2** — the meeting agenda block consumes check-in data.
- **1.3/2.4 are independent** of the strategy track and can run in parallel
  (different surface, different reviewer).

### Suggested success metrics

| Metric | Today | Target after H2 |
|---|---|---|
| Time from signup → 5 teammates active | manual, ~days | < 1 hour |
| % of KRs with auto-updating progress | 0 % | > 60 % |
| % of meetings with an OKR agenda item | 0 % | > 50 % of 1:1/AMU |
| Home-page answer to "what needs my attention" | tasks only | strategy + compliance + meetings |

---

## 4. Quick wins (can ship independently, ≤ 1 day each)

- Pending-invites list with copy-link button (`SecUsers.tsx`).
- Password strength meter + raise minimum (`AuthPage.tsx`, `ProfilePage.tsx`).
- "+ N flere" overdue indicator on the Tasks sidebar entry.
- ARIA label on the home-page donut; replace ad-hoc status pills with `<Badge>`.
- Remove the "Workspace > Hjem" breadcrumb (no `/workspace` route exists).
- Empty-org guidance on `OrganisationPage` insights tab.
