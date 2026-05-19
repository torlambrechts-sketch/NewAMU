# Endringslogg — cross-module rollout plan

Companion to `specs/endringslogg-spec.md`. The engine is live in
compliance_checklist (v1). This document plans the rollout to the
remaining 7 modules, the cross-cutting prep work needed before any
module-2 starts, and the retirement of one legacy log table along
the way.

Author: senior eng + PM. Status: 📋 ready for review.

---

## 1. Executive summary

**What**: Take the Endringslogg engine — `audit_events` schema,
`emit_audit_event` RPC, `<EntityTimeline>` panel, scope registry —
that ships in compliance and extend it to survey, tasks, documents,
meetings, alerts, learning, and (when scoped) registers.

**Why now**: Arbeidstilsynet, Datatilsynet, and downstream auditors
expect a uniform change-trail across *every* HMS artefact, not just
checklists. Each remaining module is a forensic blind spot — a real
risk for the company if a regulator asks "who closed varsel #42
without a committee vote?" and the system can't answer. The engine
proved itself in v1 — the cost of generalising it is mostly
mechanical now.

**What success looks like**: When the rollout is complete, every
detail / "room" page in the product carries an Endringslogg panel
showing the full Norwegian-prose change history for that record.
A reviewer who never touched the system can walk a varslingssak,
a møteprotokoll, or a tildelt-oppgave from creation to closure
using the panel alone. The `audit_events_recon` view shows ~0 daily
gap per table for ≥14 consecutive days.

**Wall-clock estimate**:
- 1 senior eng, sequential: **4 working weeks** (≈ 20 days incl.
  cross-cutting prep)
- 2 senior eng, parallel where safe: **2.5–3 weeks**
- Includes Norwegian PM proofing of action verbs + summaries per
  module.

---

## 2. Sequencing rationale (why this order)

Order is **risk-graduated**, not effort-graduated. We deliberately
ship the highest-stakes privileged-event module (alerts) *after* the
engine has been battle-tested on a stack of lower-stakes modules. If
the `privileged=true` blur path is broken, finding out via survey
or learning is annoying. Finding out via alerts is a varsling leak.

| Wave | Modules | Why |
|---|---|---|
| **Prep (W0)** | Cross-cutting backlog drains | See §3. Without these every module rollout fights the same gaps. |
| **W1** | Survey | Closest shape to compliance — mirror the integration pattern, prove the engine survives a second consumer, shake out anything wrong with the scope registry. Low blast radius. |
| **W2** | Meetings | Exercises `privileged=true` for the first time (drøftelsesmøter, varslingsutvalg confidentiality) on a module where the worst-case is internal embarrassment, not statutory exposure. Forcing function for the privileged blur to actually work end-to-end. |
| **W3** | Tasks + Documents (parallel) | Tasks is the simplest mutation surface left; documents has the legal-basis privilege class but no §2A risk. Different team members can own each. |
| **W4** | Alerts | Now the engine has 4 production consumers. Privileged blur has been proven on meetings. We can ship the highest-risk module with high confidence. |
| **W5** | Learning + Registers (parallel) | Learning is low-stakes (certification dates). Registers needs its own parity spec authored first; effort estimate carries a wider range. |
| **W6 cleanup** | Retire `task_activity_log`; close P3 backlog; pilot-org sign-off | After 14 days of `audit_events_recon` showing zero gap, deprecate the legacy log. Pilot org delivers a written sign-off to product. |

---

## 3. W0 — Cross-cutting prerequisites

Without these, **every** module rollout pays the same tax. Land them
once before W1 starts.

### 3.1 Engine gaps (P3 deliverables from `endringslogg-spec.md §10`)

| Item | Why it blocks rollout | Owner | Est |
|---|---|---|---|
| **`DiffListChange` renderer** | Survey responses + alerts attachments + meetings attendee diffs are *all* list_change shaped. Today they fall through to a placeholder. | Eng | 0.5d |
| **Tablet drawer overlay** (768–1279px) | At desktop ≥1280 the right-rail works. Below that, the panel stacks under the content — fine on a checklist where mutation density is low, awful on a meeting agenda. | Eng + Design | 1d |
| **Filter chips** (actor + action) | A meeting can produce 50+ events in one session. Without filters the panel is unscannable. The i18n strings already exist; only the UI is missing. | Eng | 0.5d |
| **Backfill admin button** | Every existing org has zero history on day-1 of any module rollout. An admin-triggered "rekonstruér siste 30 dager" button projects `hse_audit_log` rows into `audit_events` so live executions don't open with an empty panel. Flag as `backfilled=true`. | Eng + DB | 1d |
| **`AuditScope.resolveActor` actually consumed** | Today the registry is presence-only (runtime warning if missing). Several modules need module-specific actor resolution (alerts: anonymous reporter; meetings: external token viewer). Land the resolver now or every module re-invents it. | Eng | 0.5d |

### 3.2 Action enum extension

Each module introduces verbs the v1 enum doesn't carry. **One**
migration extends the `audit_events.action` CHECK constraint with all
of them at once; per-module migrations stay focused on wiring.

```
besvart       — survey (response submitted)
publisert     — documents, learning, survey (draft → live transition)
protokollert  — meetings (protokoll signed)
votert        — meetings (vote cast)
innkalt       — meetings (invitation sent)
mottatt       — alerts (case created by external reporter)
fullført      — learning (course completion)
attestert     — already exists; reused for cert issuance
slettet_kommentar — comment delete (currently mis-mapped to 'endret')
```

Add the corresponding `endringslogg.chips.*` keys and tone-map
entries in `entityTimelineActionTone.ts`. One PR; ~half a day.

### 3.3 Privileged-data review (data classification)

Before alerts ships, product + legal review every field that should
trigger `privileged=true` on each module's events. Output: a
per-module table that mutation code reads, e.g. for meetings:

```ts
const PRIVILEGED_AGENDA_KINDS = new Set([
  'drøfting', 'varsling', 'mus', 'pgop',
])
function isPrivileged(meeting, change): boolean { … }
```

The review is small (afternoon) but **must precede** alerts in W4.

### 3.4 Lint rule for emitter discipline

R1 mitigation from spec §11. An ESLint custom rule that flags any
`.from('<auditable-table>').update()` or `.insert()` not followed by
an `emitAuditEvent` call in the same function. The auditable-table
list ships per module (each `<module>AuditScope.ts` registers it).
~0.5d work; saves hours per future module.

**Total W0**: ~5 working days. One senior eng.

---

## 4. Per-module rollout brief

Each module follows the same **definition-of-done** in §6. The
section below names the per-module specifics: room entity, mutation
hooks to wire, action verbs used, privilege classification, design
nuances, deferrals, and estimated effort.

### 4.1 Survey

| Field | Value |
|---|---|
| **Room entity** | `survey_response_session` (per `submitSurveyResponse.ts`). One row per (campaign × respondent). |
| **Room page** | `modules/survey/SurveyDetailView.tsx` for the admin view. For the respondent flow (`SurveyRespondPage.tsx`) we do **not** dock the timeline — the timeline shows the admin who configured the campaign, not the respondent. |
| **Mutation hooks** | `useSurvey.ts`: `createCampaign`, `publishCampaign`, `closeCampaign`, `updateCampaignMetadata`, `submitSurveyResponse` (server-side via edge function — emitter must run there, not in the client). |
| **Action verbs used** | `opprettet`, `publisert`, `lukket`, `endret`, `besvart`. Anonymous responses fire as `actor.role='system'` with `actor.name='Anonym respondent'`. |
| **Privileged?** | Only when k-anonymity floor is breached *before* aggregation — extremely rare. Default to non-privileged for v1. |
| **Existing log** | None. Co-exist with nothing. |
| **Design nuances** | `besvart` events are high-volume (one per respondent). Show a **count** ("23 nye svar siden i går") at the top of any day-group with > 10 `besvart` events instead of listing each. Spec deferral: collapsing logic belongs to P7 bulk-event work but **must** ship for survey at v2 since this is the dominant event class. |
| **Deferrals** | Anonymous PII-flagged answers — defer to alerts wave (different privacy classification). |
| **Effort** | 2 days. |

### 4.2 Meetings

| Field | Value |
|---|---|
| **Room entity** | `meeting` (`meetings` table, per migration `_20260904120000_meetings_amu_consolidate`). |
| **Room page** | `modules/meetings/MeetingDetailView.tsx`. Already a tabbed layout (Informasjon / Agenda / Deltakere / Vedtak / Protokoll / Datapakke); add the timeline as an inline right-rail at the page level, **not** inside any tab. |
| **Mutation hooks** | `useMeetings.ts`. Wire ≈12 mutations: `createMeeting`, `updateMeetingMetadata`, `setAgendaItem` (with `agenda_item_id` as the entity, room=meeting), `addAttendee` / `removeAttendee`, `setRsvpStatus`, `setDecision`, `castVote`, `signProtocol` (uses `signert`), `sendInvitations` (uses `innkalt`), `sendDigest` (uses `delt`), `setAgendaConflictOfInterest`, GDPR redaction (uses `endret` with `privileged=true`). |
| **Action verbs used** | `opprettet`, `endret`, `innkalt`, `votert`, `protokollert`, `signert`, `delt`, `lukket`, `arkivert`, `kommentert`. |
| **Privileged?** | **Yes — major test case.** Any agenda item with `confidentiality_level in ('drøfting', 'varsling', 'mus')` → vote events, decision events, dissent text, attendee changes all carry `privileged=true`. The blur path **must** be visually verified before W4 alerts ships. |
| **Existing log** | `workflow_dispatch_db_event` (event-stream, different concept). Co-exist — keep that for workflow triggers, add `audit_events` for human-readable history. |
| **Design nuances** | `votert` events show vote *direction* (for/against/blank) in the diff. For privileged meetings, the diff is masked; only the *fact* a vote happened is visible to non-privileged readers. External-token viewer (`MeetingExternalViewerPage.tsx`) — when the public link is used, log as `actor.role='ekstern'` with `external_label` from the token. |
| **Deferrals** | Live-session realtime sync events (`recoverLiveSession`) — those happen too fast for a human log; emit only a single "live-økt holdt" event at session end. |
| **Effort** | 3 days. |

### 4.3 Tasks

| Field | Value |
|---|---|
| **Room entity** | `task` (per `tasks` migration suite). |
| **Room page** | `modules/tasks/TaskDetailPanel.tsx` — note this is rendered as an inline panel inside `TasksManagementPage`, not a dedicated route. Dock the timeline as a **sibling tab** ("Endringslogg") on the existing tabs row, not as a side-rail, to avoid double-rail. |
| **Mutation hooks** | Mostly inline supabase calls (no `useTasksModule.ts` central hook). Refactor opportunity: extract the mutation surface into `useTaskMutations.ts` before wiring the emitter. **This refactor is the gate.** Without it, the emitter calls are scattered across 6 components and the lint rule (W0) can't trust the pattern. |
| **Action verbs used** | `opprettet`, `endret`, `tildelt`, `omfordelt`, `kommentert`, `lukket`, `lastet_opp_vedlegg`, `eskalert`. |
| **Privileged?** | Confidential tasks (gated by `tasks.view_confidential` per `permissionKeys.ts`) → `privileged=true`. The events still log; non-privileged readers see the chip + actor + action only. |
| **Existing log** | **`task_activity_log` already lives**, already renders in `TaskActivityFeed`. Plan: run both for 14 days, verify parity via `audit_events_recon`, then deprecate `task_activity_log`. The `TaskActivityFeed` component switches to read from `audit_events_read` in a follow-up commit. |
| **Design nuances** | The inline-panel layout of `TaskDetailPanel` is tight (often <700px wide). Use the **tab** dock pattern, not the side-rail. This is the one module where the tablet-drawer fallback kicks in even at desktop widths. |
| **Deferrals** | CAPA flow state transitions (7-step machine) — log only state changes that the user *can see* in the UI, not the internal transitions the engine fires. |
| **Effort** | 2 days incl. the refactor + 1 day for parity-and-deprecate of `task_activity_log` = 3 days total. |

### 4.4 Documents

| Field | Value |
|---|---|
| **Room entity** | `wiki_page` (or `document` — check naming with team; spec uses both). |
| **Room page** | `modules/documents/WikiSpaceView.tsx` / `WikiPageEditRedirect.tsx`. The wiki editor surface is dense — dock as a slide-out drawer triggered by a header button, not always-on rail. |
| **Mutation hooks** | Scattered like tasks. Refactor pass needed first: extract into `useDocumentsMutations.ts`. Mutations: `createPage`, `updatePage` (body — fires `text_block` diff), `publishPage`, `unpublishPage`, `setPageMetadata`, `setRetention`, `softDeletePage`, `restorePage`, template fork ops. |
| **Action verbs used** | `opprettet`, `endret`, `publisert`, `arkivert`, `versjon_bumpet`, `attestert` (legal review). |
| **Privileged?** | Pages with `legal_basis` containing AML §§ 2A, 14-G, 15-1 → `privileged=true` on body diffs (HR-sensitive content lives in those clauses). Page metadata stays visible. |
| **Existing log** | `wiki_audit_ledger` may exist (verify via Supabase introspection). If yes: co-exist + deprecate plan mirroring tasks. If no: greenfield. `DocumentActivityTimeline.tsx` already renders the ledger; switch its data source to `audit_events_read` in the same PR. |
| **Design nuances** | Text-block diffs on long pages will dominate the panel. Use the long-value truncation (`viewFull` modal) from W0 backlog. Without it, a single page rewrite blows the panel out. |
| **Deferrals** | Page-level "lest av" tracking — not an audit event, that's a read-receipt feature; out of scope. |
| **Effort** | 3 days. |

### 4.5 Alerts (varsling)

| Field | Value |
|---|---|
| **Room entity** | `alert_case` (per `_20260911120000_alerts_module_core.sql`). |
| **Room page** | `modules/alerts/AlertsDetailView.tsx` (committee surface). The **public** submit/status pages (`PublicAlertSubmitPage`, `PublicAlertStatusPage`) do **not** dock the timeline — external reporters must not see internal handling history. Their `mottatt` event fires server-side from the public API. |
| **Mutation hooks** | `useAlerts.ts`. ≈11 mutations: `createCase`, `addNote`, `setStatus`, `setSeverity`, `setAssignedCommittee`, `setCategory`, `setOrgContext`, `closeCase`, `upsertOrgTemplateSetting`, `uploadAttachment`, `deleteAttachment`. |
| **Action verbs used** | `mottatt` (new), `tildelt`, `omfordelt`, `endret`, `kommentert`, `eskalert`, `lukket`, `arkivert`, `lastet_opp_vedlegg`, `slettet_vedlegg`. |
| **Privileged?** | **Every event is privileged by default.** Defaulting to `privileged=true` for the whole module flips spec §13.3 assumption — only `alerts.committee_confidential` and `alerts.dpo` perm-holders see the diffs. The chip + actor + action stay visible so the trail itself is provable. Anonymous reporter identity is *never* in `actor_name`; instead `actor.name='Anonym varsler'` + `actor.role='ekstern'`. |
| **Existing log** | None. Greenfield. |
| **Design nuances** | "Skjul hendelser fra denne aktøren" filter (already in i18n) — useful for committee reviewers who want to hide system-emit noise. The **scroll-into-view on permalink** is critical here: DPO replies to a committee message via permalink. |
| **Deferrals** | Cross-org alerts (mother-org sees subsidiary's alerts) — that's a separate authorisation model; defer to a future P8. |
| **Effort** | 2 days **plus** product + legal sign-off review (~0.5d). Total 2.5 days. |

### 4.6 Learning

| Field | Value |
|---|---|
| **Room entity** | `learning_course_progress` (per-learner-per-course completion record). |
| **Room page** | `LearningPlayer.tsx` for the learner; `LearningCourseBuilder.tsx` for the author. Dock on the **builder** page — that's the admin surface where audit value lives. The player gets no panel. |
| **Mutation hooks** | Scattered. Same refactor playbook as tasks/documents. Mutations: course-fork, version-publish (`versjon_bumpet`), metadata-schema-edit, certification-issuance (`attestert`), recertification-window edit. |
| **Action verbs used** | `opprettet`, `endret`, `publisert`, `versjon_bumpet`, `fullført` (new), `attestert`, `arkivert`. |
| **Privileged?** | No. Certification dates are not sensitive; learning content is intended to be transparent. |
| **Existing log** | None. `LearningVersionHistoryTab` already renders version snapshots — that's a different concept (course content versioning). Keep both. |
| **Design nuances** | `fullført` events are high-volume but low-individual-value. Same collapse-by-day-count pattern as survey's `besvart`. |
| **Deferrals** | Per-learner-per-quiz attempt log — too noisy to surface; aggregate as a single `fullført` event when the course is completed. |
| **Effort** | 2 days. |

### 4.7 Registers

| Field | Value |
|---|---|
| **Pre-work** | No parity spec exists. **Author `specs/registers-parity.md` first.** Mirror the PLAYBOOK process. ~2 days. |
| **Room entity** | TBD — per-register-type record. Some register types are append-only (injury log), others are mutable (action plan). |
| **Mutation hooks** | TBD — depends on registers parity port. |
| **Action verbs used** | `opprettet`, `endret`, `lukket`, `arkivert`. Specific register types may need new verbs (e.g. `meldt_til_arbeidstilsynet` for the §5-2 injury report flow) — slot via the W0 action-enum extension if needed. |
| **Privileged?** | **Yes — injury logs are AML §2A.** Same default-true approach as alerts. |
| **Existing log** | None. |
| **Deferrals** | Auto-meldinger to Arbeidstilsynet — those are workflow_dispatch events, different concept. |
| **Effort** | 2–4 days post-spec-authoring; **wider range than other modules** because the parity port is greenfield. Schedule loosely. |

---

## 5. Resourcing model

| Pattern | Wall time | When to use |
|---|---|---|
| **Solo senior eng** | 4 working weeks | Default. Lower coordination cost. PM + design can pipeline behind. |
| **Two seniors in parallel** | 2.5–3 weeks | When the calendar matters. Split: one owns alerts + meetings (the privileged-data work); the other owns tasks + documents + learning. Survey is W1 sequential (only one engine consumer at a time the first time). |
| **One eng + one PM proofing per week** | 4 weeks; PM gates each module's Norwegian copy | Norwegian-native PM **must** review action verbs + summary presets per module before that module ships. Estimated half-day PM time per module. |

**Bottleneck**: the privileged-data review (§3.3). It must be done
*before* alerts but can run in parallel with W1+W2. Block the
calendar early.

---

## 6. Definition of Done — per module

Every module ships only when **all** of the following are green:

- [ ] Scope file at `<module>/audit/<module>AuditScope.ts`, imported as a side-effect from the room page.
- [ ] All mutation hooks emit via `emitAuditEvent` with correct `entityKind`, `entityId`, `roomEntityKind`, `roomEntityId`. Lint rule passes.
- [ ] Norwegian summary presets defined in `summaryTemplates.ts` and PM-proofed.
- [ ] `<EntityTimeline>` docked in the room page, accent set, scope-warning silent.
- [ ] Privileged-data review (§3.3) entry exists for this module and is honoured by the emitter calls.
- [ ] All `chips.*` i18n keys exist for actions this module uses; storybook fixture page (under platform-admin) includes one synthetic event per action verb.
- [ ] Full project `tsc -b` + `eslint .` green; no new restricted-syntax overrides without a comment.
- [ ] Vite build green.
- [ ] Manual smoke: create record → mutate 3 distinct fields → observe 3 events live within 1s each.
- [ ] `audit_events_recon` SQL: for the new module's table(s), `gap = 0` for 7 consecutive days post-deploy. Captured in a screenshot or pasted into the PR description.
- [ ] Existing-org backfill button confirmed to project last 30 days into `audit_events` for the new entity types.
- [ ] CLAUDE.md "Easy to get wrong" entry updated with module-specific gotcha (if any).

---

## 7. Definition of Done — *v1 retirement*

The cross-module rollout is **complete** when:

1. All 6 modules (survey, meetings, tasks, documents, alerts, learning) ship under §6. Registers tracked separately.
2. `task_activity_log` is read-only; `TaskActivityFeed` reads from `audit_events_read`. PR #N drops the column-level INSERT trigger after 14 days of `audit_events_recon` ≈ 0.
3. The pilot org runs a 1-week end-to-end exercise: a fake compliance check, survey campaign, meeting with vote, varsling case (test data), document edit. Verneombud writes a one-paragraph sign-off describing what they could / couldn't reconstruct from the panels alone.
4. The privileged-data review (§3.3) is published as a non-engineering doc that legal can refer to.
5. P3 / P4 backlog items are closed or explicitly punted to v2 with rationale.

Failing any of (1)–(4) is *not* a v1 ship. (5) is documentation-debt
and can ship as a follow-up.

---

## 8. Cross-cutting risk register (rollout-specific)

Distinct from the engine risks in `endringslogg-spec.md §11`. These
apply because we're now talking *6 module rollouts* instead of one.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **R-A: Norwegian copy drift across modules** | High (different engineers writing presets) | Med (inconsistent voice; reviewers complain) | One PM owns the `summaryTemplates.ts` preset library, reviews every PR adding a preset, maintains a one-page style guide ("oppdaterte" vs "endret"; when to quote vs unquote subject). |
| **R-B: Privileged-data classification mistake** | Med | **High** (HR data leaks to non-DPO reader) | §3.3 review **gates** alerts. Every privileged decision is made *outside* the engineer's PR, reviewed by product + legal. Lint rule (§3.4) hard-fails if `privileged: true` is passed without a `// classified: <reviewer-name>` comment within 3 lines. |
| **R-C: Mutation refactor regressions in tasks/documents/learning** | Med | Med | The mutation-hook refactor (extracting `useXxxMutations.ts`) is a code change with no behaviour change. Each refactor PR is gated by: (a) green build + lint, (b) screenshot diff comparing room page before/after at desktop, (c) one round of human regression on the live demo. The audit-emit PR follows separately so the refactor itself is bisectable. |
| **R-D: Recon job not actually run in production** | Med | High (silent gap goes undetected) | Recon SQL becomes a cron-triggered workflow (use `workflow_dispatch_db_event` substrate that already exists), result posted to a dedicated #endringslogg-helse Slack channel. PR adding the cron is part of W0. |
| **R-E: Backfill creates Norwegian-grammar-wrong rows** | High (backfilled summary is best-effort) | Low (reviewers know to expect it) | Backfilled rows render with a "(rekonstruert)" suffix in the UI and `backfilled=true` flag in the table. Filter chip "Skjul rekonstruerte" lets reviewers hide them. Spec §13.2 honored. |
| **R-F: Pilot org overwhelmed with day-1 noise on first module ship** | Med | Med | Wave 1 (survey) deploys to **one** pilot org first, not all tenants. After 1 week of clean recon + verneombud feedback, fan out. Same staged rollout for alerts. |
| **R-G: Existing audit infrastructure (task_activity_log, wiki_audit_ledger) keeps writing during co-exist phase | Low | Low (cost: double-writes, slight DB load) | Document as expected; recon view ignores the legacy tables. After deprecation PR, drop the dual-write. Single migration when ready. |
| **R-H: A module's mutation surface is bigger than estimated** | Med | Med (slips the wave) | Each module starts with a 2-hour spike: map mutations, name verbs, define presets, sketch privileged classification. Outcome is a one-page module brief PR-ed *before* the implementation PR. If the spike doubles the estimate, the wave gets re-planned that week. |
| **R-I: Anonymous reporter PII leaks via summary_nb** | Low (alerts wave only) | **Critical** | `actor.name='Anonym varsler'` is *hard-coded* server-side in `emit_audit_event` when the case's `reporter_is_anonymous = true`. Client cannot override. Tested in a unit test in the alerts wave PR — non-negotiable. |

---

## 9. Post-rollout — v2 backlog

The following items are **out of scope** for the cross-module
rollout but live as backlog so they don't lose context:

- **P4 — deactivated user strikethrough** (spec §6 case 3): land alongside W3 documents (the module most likely to surface stale authors).
- **P6 — external-token actor wiring**: shipped partially in alerts (anonymous reporter). Full Arbeidstilsynet auditor-token integration lands when the auditor-token migration ships separately.
- **P7 — bulk action collapsing**: needed by survey + learning before they go truly multi-thousand-event. Real value at scale; defer until pilot org pushes through that volume.
- **P7 — failed-action red rail**: needed by alerts (rejected escalations) + meetings (rejected RSVPs that the engine couldn't process). Designed during alerts wave, implemented in v2.
- **Filters UI** (already in i18n): chip-based filter row above the panel. Defer to first user complaint; the keyboard nav and day grouping cover most navigation needs.

---

## 10. Open questions before W0 starts

1. **Tasks refactor cost vs. value**: Is the `useTaskMutations.ts` refactor in scope, or do we accept the lint-rule complexity to scan inline mutations? *Default*: refactor; lint rules on scattered call sites are flaky.
2. **`task_activity_log` deprecation lane**: Drop the table outright or keep it as an archive read-source? *Default*: keep the table; drop only the INSERT trigger.
3. **Registers parity spec**: Owned by whom? *Default*: one of the two seniors who will implement the module — same writer as the implementer keeps drift low.
4. **Anonymous-actor rendering colour**: Spec §2 says ekstern actors get the red swatch. Anonymous varslere are technically ekstern but we may want a separate neutral grey-with-mask icon to differentiate. *Default*: ship with `ekstern` red for v1; revisit if pilot feedback says it reads wrong.
5. **Recon job alert threshold**: At what daily gap count does the cron Slack-ping? *Default*: any `gap > 5` per table per day. Tune from telemetry.
6. **PM proofing cadence**: One PM gates every preset in one PR, or per-module quick-review? *Default*: per-module so PRs don't queue.

---

## 11. Single-page checklist for the engineer picking up a module

When wave N starts, this is the working punch list:

- [ ] Pull `claude/plan-endringslogg-feature-ZZOGi` (or main once merged); confirm W0 prerequisites are in.
- [ ] 2-hour spike: read this doc's §4 entry for the module + the module's parity spec (`specs/<module>-parity.md`). Open the module's room page + central hook in split view. Map mutations to verbs in a scratch file.
- [ ] Open a draft PR with a one-page brief in the description: room, mutations, verbs, privilege classification, expected event volume per typical record. Tag PM for proofing.
- [ ] Ship the scope file + side-effect import + `summaryTemplates.ts` additions in a first commit. CI green.
- [ ] Refactor mutation surface into `useXxxMutations.ts` if needed (separate commit).
- [ ] Wire `emitAuditEvent` calls (separate commit, one per logical mutation group).
- [ ] Dock `<EntityTimeline>` in the room page (separate commit).
- [ ] Add a storybook fixture for the module under `/platform-admin/endringslogg-demo` or a per-module variant.
- [ ] Privileged-data classification commit + test (where applicable).
- [ ] Manual smoke: create→mutate→observe live; screenshot in PR.
- [ ] Recon SQL: paste output for the new table(s) into PR description.
- [ ] Request PM proof + (if privileged) legal review.
- [ ] Merge, deploy to pilot org, observe 24h. Fan out.
