# Workflow engine — deep review & redesign

This spec documents a senior-architect review of the current workflow modules
and the planned consolidate-and-extend refresh. It is the architecture
hand-over for the next sprint(s) and the source of truth for the unified
builder, predefined library, evidence engine, and Norwegian regulator
integrations.

The current state assessment in §1 is the same picture as
`/WORKFLOW_ANALYSIS.md` at the repo root — that file lists the day-to-day
operational pain; this spec is the plan that closes those gaps.

---

## 1. Current state

Working but fragmented. Strong DB engine, frayed UI, missing the audit
substrate that turns the engine into a compliance backbone.

**Schema (lives in `supabase/migrations/archive/`):**
- `workflow_rules` — rule definition (per-org, `actions_json`, `condition_json`,
  `is_active`, `source_module`, `trigger_on`, `priority`).
- `workflow_runs` — execution log (status `completed | skipped | failed`,
  `detail jsonb` truncated to 8000 chars in the legacy path).
- `workflow_steps` — multi-step rule definition; alternate-shape from
  `actions_json`; not exposed in current UI.
- `workflow_action_queue` — async delivery queue. **Column drift:**
  `_20260618150000` defined `(step_type, config_json, context_json, …)`;
  `_20260829120011` recreated it as `(action_type, payload, …)`. The two
  writers fill different columns. Must be reconciled before anything else.
- XOR branches via `actions_json: { mode: 'xor_branches', branches: [...] }`
  (see `src/lib/workflowFlowTypes.ts`).
- `schedule_cron` column exists on `workflow_rules` but no pg_cron wiring.

**Triggers across modules (48 events / 12 scopes):**

| Scope | Events | Notes |
|---|---|---|
| Inspection | 7 (round_created, round_activated, round_signed, finding_critical/high/medium/low) | Vernerunde, AML §6-2 |
| ROS | 3 (ON_ROS_CREATED, ON_ROS_CRITICAL_RISK, ON_ROS_APPROVED) | IK-f §5 nr. 6 |
| Action plan | 3 (ON_MEASURE_CREATED/RESOLVED/OVERDUE) | IK-f §5 nr. 7 |
| Internal control | 1 (ON_ANNUAL_REVIEW_SIGNED) | IK-f §5 |
| Vernerunder | 6 (CREATED, PLANNED, COMPLETED, STATUS_CHANGED, FINDING_REGISTERED, FINDING_UPDATED) | AML §6-2 |
| Meetings | 3 (SCHEDULED, SIGNED, DECISION_LOGGED) | AML §7-2 / §6-2 / §15-1, IK-f §5 nr. 8, ISO 9.3 |
| Documents | 7 (PUBLISHED, REVISION_DUE/OVERDUE, ACK_COMPLETE, ACCESS_REQUESTED, ANNUAL_REVIEW_STARTED/COMPLETED) | Documents primitive |
| Survey | 5 (PUBLISHED, CLOSED, RESPONSE_SUBMITTED, ALL_INVITATIONS_COMPLETED, RESPONSE_RATE_THRESHOLD) | Template-driven |
| Compliance checklist | 5 (response_finding_critical/high/medium/low, execution_signed) | AML §3-1 |
| Tasks | 4 (CREATED, STATUS_CHANGED, OVERDUE_MARKED, SIGNED) | Inbox aggregator |
| Learning | 3 (COURSE_STARTED, COURSE_COMPLETED, CERTIFICATE_ISSUED) | IK-f §5 nr. 2, AML §3-2 |
| Registers | 2 (RECORD_CREATED, RECORD_UPDATED) | Regulation register |

Per-scope events are emitted by module-specific DB migrations calling
`workflow_dispatch_db_event(org_id, trigger_name, payload)`.

**Action types (10):** `create_task`, `create_task_item`, `create_deviation`,
`create_ros_draft`, `add_amu_agenda_item`, `request_signature`, `wait_delay`,
`send_email`, `send_notification`, `call_webhook`, `log_only`.

**UI (the fragmentation):**
- `WorkflowFlowBuilder.tsx` (~610 LOC) — DAG editor on `/workflow`.
- `WorkflowRulesTab.tsx` (~787 LOC) — accordion editor embedded in **8**
  module settings pages with its own local `WorkflowRule` / `WorkflowStep`
  types.
- `ModuleTemplateWorkflowRulesEditor.tsx` — per-template JSON rules editor.
- `WorkflowEditorV2.tsx` — third variant; partly built.
- Three incompatible `WorkflowRule` type islands; raw JSON textarea fields
  surface in production UI.

**Gaps that prevent the engine from being a compliance backbone:**
- No cross-module overview; rules scattered across 8 settings pages.
- No `law_refs[]` on `workflow_rules` — invisible to the gap-and-audit
  planner (ROADMAP §5).
- No rule-mutation audit log.
- No immutability on `workflow_runs` (an admin can rewrite history).
- No evidence-pack export by law-ref / date range.
- Zero hooks to any Norwegian regulator (Arbeidstilsynet, Datatilsynet,
  NAV, LDO, Altinn).
- `pg_cron` not wired against `workflow_rules.schedule_cron`.
- Recursion protection is a boolean (`app.workflow_skip`) — cannot detect
  fan-out cycles across modules.
- `send_notification` doesn't share inbox with `compliance_notifications`.
- `workflow_seed_compliance_templates` uses `on conflict do nothing` —
  silent drift; can't fix a bug in a baseline rule after rollout.

---

## 2. Decisions locked in

| Question | Decision |
|---|---|
| Engine strategy | **Consolidate & extend** existing tables. No v2 schema. |
| Government reporting | **Full integration now** — Altinn 3 + Maskinporten, Arbeidstilsynet RegInc (alvorlig skade — AML § 5-2 24h), Datatilsynet personvernbrudd (GDPR Art. 33 72h), NAV via DSOP, LDO = evidence-export only (no API exists). |
| Phase-1 scope | Unified builder + dry-run, predefined library, evidence engine, scheduled & branching triggers — sequenced below. |
| SDK | **Registry-style** mirroring `src/lib/dashboards/dashboardRegistry.ts`, strongly typed via declaration-merging `WorkflowEventMap`. |

Anti-features explicitly out of v1:
- Arbitrary JS / JSONata code nodes (security risk).
- Outbound HTTP from Postgres via `pg_net` (always queue + edge).
- User-supplied cron < 5 min frequency.
- Per-rule custom SQL.
- Mobile builder (mobile gets read-only history + approval).
- Plugin marketplace.

---

## 3. Architecture (consolidate-and-extend)

```
Modules (compliance, survey, tasks, documents, meetings, learning,
  register, inspection, ros, action_plan, vernerunder, internal_control)
    each ships:
      modules/<scope>/workflows/<scope>WorkflowScope.ts
        registerWorkflowScope<MyEventMap>({ scopeId, label, accent,
          events, actions, conditionFields, presets, lawRefs })
                              ▼  side-effect import
src/lib/workflows/workflowRegistry.ts (single source of truth, types
  via declaration-merging WorkflowEventMap interface — adding an event
  lights up the unified builder automatically)
                              ▼
Unified builder (/workflow?builder=v3 → default after migration)
  WorkflowCanvas  · LibraryPanel  · DryRunPanel
  RunHistoryPanel · EvidenceExport · AuditorView
                              ▼
Existing Postgres engine (extended, never rewritten):
  workflow_rules + law_refs[] + confidentiality_level + i18n
  workflow_runs (immutable, checksum-chained)
  workflow_steps (unchanged) · workflow_action_queue (drift fixed)
  workflow_rule_catalog (NEW — system templates, per CLAUDE.md
    template-surface convention)
  workflow_rule_revisions (NEW — mutation audit log)
  workflow_run_evidence (NEW — Merkle-chain checksums)
  workflow_approvals (NEW — pauses queue rows)
  schedule_cron already on workflow_rules — wire pg_cron against it
  org_integrations (EXTENDED kind enum: altinn, regint, datatilsynet, nav)
                              ▼
Edge functions (Deno):
  workflow-queue-worker (existing, idempotency_key added)
  workflow-cron-dispatcher (NEW — drives off pg_cron + schedule_cron)
  gov-altinn-submit · gov-arbeidstilsynet-rapport
  gov-datatilsynet-breach · gov-nav-sykefravar
  compliance-audit-pdf (EXTENDED with workflow-evidence-pack mode —
    no parallel function)
```

House-style guardrails (CLAUDE.md):
- Side-effect imports for every scope file; add a dev-mode startup
  assertion that every key in `WORKFLOW_SOURCE_MODULES` is registered.
- ID minting via `freshId('wf')` — replace
  `crypto.randomUUID().slice(0,8)` in `src/lib/workflowFlowTypes.ts`.
- All new migrations idempotent (`add column if not exists`,
  `on conflict ... do update set` for system rows). Basenames timestamped
  past the latest in either folder. Each migration carries the 4–8 line
  Arbeidstilsynet self-audit header (`_120011` is the template).
- `law_refs` format: exact strings, `'AML § 5-2'`, `'GDPR Art. 33'`,
  `'IK-f § 5 nr. 7'`. Gap planner does exact-string matching.
- `name_i18n: { nb, en }` on rules/templates from day one — gov messages
  need verbatim Norwegian; English fallback for screen readers.
- Reuse, don't duplicate: `compliance_notifications` for
  `send_notification`, `compliance-audit-pdf` for evidence packs,
  `org_integrations` for creds, `workflow_rules.schedule_cron` for cron.

---

## 4. Phasing (sequenced for least rework)

### Phase A — Substrate (must ship first)

Why first: every later phase sits on top. Fixing the column drift, adding
`law_refs`, catalog table, evidence chain, cron, and mutation audit log
unlocks the rest without rework.

Migrations (new forward migrations only — never destructive):
1. `<ts>_workflow_action_queue_reconcile.sql` — `add column if not exists`
   for both column-name dialects (`step_type/config_json/context_json` AND
   `action_type/payload`); add column comment explaining which writer
   fills which.
2. `<ts>_workflow_rules_law_refs.sql` — add `law_refs text[] not null
   default '{}'`, `frameworks text[]`, `confidentiality_level
   compliance_confidentiality not null default 'standard'`,
   `name_i18n jsonb`, `description_i18n jsonb`, `idempotency_template text`.
3. `<ts>_workflow_rule_catalog.sql` — new `workflow_rule_catalog` (system
   templates, `org_id NULL`) mirroring `survey_template_catalog` /
   `document_system_templates`. Bug-fixes apply via "Apply baseline
   updates" surface, not silent drift.
4. `<ts>_workflow_rule_revisions.sql` — `(id, rule_id, prev_definition
   jsonb, prev_actions jsonb, prev_condition jsonb, changed_by, changed_at,
   change_reason text)`. Trigger on `workflow_rules` update writes a row.
5. `<ts>_workflow_run_evidence.sql` — `(id, run_id, organization_id,
   artefact_kind, storage_path, sha256_checksum, prev_checksum, signed_at,
   signed_by, law_refs text[])`. BEFORE UPDATE/DELETE trigger denies
   mutation unconditionally. Insert via `security definer` writer. RLS:
   org-scoped select + extra `workflows.view_confidential` predicate when
   parent run is confidential.
6. `<ts>_workflow_runs_audit_hardening.sql` — add `input_snapshot jsonb`,
   `output_snapshot jsonb`, `input_checksum text`, `dry_run boolean
   default false`, `actor_id uuid`, `confidentiality_level`. BEFORE UPDATE
   denies updates after `created_at + 30 days`. Replace truncating
   `left(..., 8000)` writes with full snapshot capture (PII handled by
   confidentiality RLS).
7. `<ts>_workflow_cron_dispatch.sql` — `pg_cron` job (gated on
   `pg_extension where extname='pg_cron'`, like
   `_wiki_retention_framework.sql`) polls `workflow_rules` where
   `schedule_cron is not null` and `now() >= next_run_at`, dispatching
   `workflow_dispatch_db_event(org_id, 'CRON_TICK:<rule_id>', payload)`.
8. `<ts>_workflow_approvals.sql` — `(id, run_id, rule_id, organization_id,
   queue_id, requested_at, approver_role, approver_user_id, status,
   decided_at, decision_note, escalate_after interval, escalated_at)`.
   Queue row status `awaiting_approval`; resume on `approved`, branch on
   `rejected`.
9. `<ts>_workflow_recursion_depth.sql` — replace
   `set_config('app.workflow_skip','on')` with a depth counter
   (`app.workflow_depth`); cap at 5; log failures with depth.
10. `<ts>_workflow_permissions.sql` — split `workflows.manage` into:
    `workflows.compose` (edit), `workflows.activate` (toggle internal
    rules), `workflows.activate_external` (toggle gov-action rules),
    `workflows.view_confidential` (whistleblower/sick-leave runs).

Application-layer (Phase A):
- `src/types/workflow.ts` — collapse three rule types into one canonical
  `WorkflowRule`. Delete local types in `WorkflowRulesTab.tsx` and
  `WorkflowFlowBuilder.tsx`.
- `src/lib/workflows/workflowRegistry.ts` + `workflowTypes.ts` (new) —
  registry SDK. `WorkflowEventMap` interface uses declaration merging so
  each scope adds its events with proper typing.
- `src/lib/workflows/freshId.ts` — re-export `src/lib/dashboards/freshId.ts`.
- Migrate centralised data into per-scope files (12 modules):
  `modules/<scope>/workflows/<scope>WorkflowScope.ts`. Eliminates the
  static `workflowTriggerRegistry.ts`, `workflowConditionFields.ts`,
  `workflowInputPresets.ts`, `workflowActionDefaults.ts` as central
  registries.
- `src/hooks/useWorkflows.ts` — rename `seedComplianceTemplates()` to
  `seedWorkflowBaseline(pack?)`; route to new
  `provision_workflows_baseline_for_org`.

### Phase B — Unified builder + library (parallel to A)

Ship behind `?builder=v3` flag reading the same `workflow_rules` row. One
scope at a time defaults to v3; old editors stay live during cutover. The
flow compiler in `src/lib/workflowFlowTypes.ts` stays stable — both UIs
target it.

Files:
- `src/pages/workflow/WorkflowBuilderPage.tsx` — replaces the current
  `/workflow` page. Three columns: scope/event picker · canvas · inspector.
- `src/components/workflow/canvas/{Trigger,Condition,Action,Branch,Wait,Approval,OnError,Parallel}Node.tsx`.
- `src/components/workflow/library/LibraryPanel.tsx` — installable
  templates filtered by module + law-ref. Install →
  `provision_workflows_baseline_for_org(org, pack)`.
- `src/components/workflow/dryRun/DryRunPanel.tsx` — pick a real
  `workflow_runs` row (or paste payload), simulate with `dry_run=true`;
  show per-action what *would* happen, no side effects.
- `src/components/workflow/runs/RunHistoryPanel.tsx` — per-rule list,
  filter by status/date/payload search, expand to see snapshots.
  Confidentiality-aware.
- `src/components/workflow/audit/RevisionHistoryPanel.tsx` — diffs from
  `workflow_rule_revisions`.
- Delete `WorkflowRulesTab` instances from 8 module settings pages once
  v3 is the default; replace with a deep link "Se og rediger
  automatiseringer" into the unified builder pre-filtered by scope.
- `src/components/layout/AticsShell.tsx` — promote Workflow to a
  top-level `NavGroup` with `flatSubs: true`: Analyse · Bibliotek ·
  Innstillinger · Auditor-eksport.

#### Predefined library — 40–60 audit-ready templates

System catalog seed (per CLAUDE.md template-surface convention —
`on conflict (slug) do update set …`, header with Arbeidstilsynet
self-audit). Coverage targets:

| Scope | Templates | Examples |
|---|---|---|
| Compliance / Sjekklister | 8 | Critical deviation → AMU agenda; recurring deviation → ROS draft; checklist not executed → reminder + escalation; signed → archival |
| Survey | 5 | Negative cluster → ROS + AMU; AMU-valg closed → next-vote T-12mnd; low response → reminder cascade; whistleblower → confidential thread |
| Tasks | 4 | Critical overdue → escalation; finding on completion → ROS draft; AMU decision → owner tasks |
| Documents | 6 | Requires sign → email + 7/14d reminder; revision overdue → escalation; new version → ack reset; DPIA → Datatilsynet-vurderingsoppgave |
| Meetings | 5 | AMU decision → tasks + protokoll publish; vernerunde critical → ROS + Arbeidstilsynet vurdering; annual review signed → certificate |
| Learning | 4 | Course overdue → reminder + manager flag; cert expiring 60d → re-assignment; role-gap → assignment |
| Register | 3 | New regulatory requirement → owner task; risk change → ROS revision |
| Inspection / ROS / Action plan / Vernerunder | 10 | Standard HMS chains; escalation on critical findings |
| Cross-module compliance (gov) | 8 | GDPR breach → Datatilsynet 72h; serious injury → Arbeidstilsynet §5-2 24h; LDO discrimination → evidence-export; sick-leave threshold → NAV oppfølging |

Each carries `law_refs[]`, `frameworks[]`, `cadence_hint`, `pack`
(`aml-amu` / `iso-45001` / `gdpr`). Header comment names which
pålegg-grunn is addressed and what remains restrisiko.

### Phase C — Branching, scheduling, approvals

- `WorkflowAction` union extended: `wait_until`, `request_approval`,
  `escalate`, `parallel`, `on_error`, plus gov-action types (Phase E).
  Compiler in `workflowFlowTypes.ts` emits these from the canvas. Queue
  worker handles `awaiting_approval` and `awaiting_schedule`.
- pg_cron-driven scheduled rules use the existing
  `workflow_rules.schedule_cron`; dispatcher inserts into queue with
  `execute_after = next_run_at`. Cap min frequency at 5 min in the
  builder; lint user cron strings.
- Approval UX: builder lets you wire `approver_role` (HMS-leder,
  AMU-leder, daglig-leder) and `escalate_after`. Approver gets a
  `compliance_notifications` row with one-click approve/reject deep link
  that updates `workflow_approvals.status` and resumes the queue row.
- Error fallback: each action declares `on_error: WorkflowAction[]` in
  the canvas; compiler emits a sibling branch the queue worker executes
  on action failure.

### Phase D — Evidence engine + auditor view

Substrate exists from Phase A; this phase makes it useful.
- `compliance-audit-pdf` edge function extended with
  `mode: 'workflow-evidence-pack'` accepting `(org_id, date_from,
  date_to, law_refs[], frameworks[])`. Walks `workflow_runs` +
  `workflow_run_evidence`, generates `manifest.json` with Merkle root,
  signs with org cert (once Phase E live), delivers signed ZIP via
  Storage signed URL.
- `src/pages/workflow/EvidenceExportPage.tsx` — date/module/law-ref
  filters; one-click export.
- `src/pages/auditor/AuditorWorkflowsPage.tsx` — signed-token read-only
  view of runs + evidence + revision history. Reuses the auditor-token
  pattern from `specs/compliance-planner.md`. Auditors cannot see
  confidential run bodies; see counts + checksums for integrity proof.

### Phase E — Government integrations (gated, real)

`org_integrations.kind` enum extended (not a new table):
`altinn`, `regint`, `datatilsynet`, `nav`. Secrets in Supabase Vault per
the pattern in `specs/integrasjoner-bankid-restanser.md`. Each provider
has an onboarding wizard
(`src/pages/admin/integrations/<provider>Setup.tsx`).

Edge functions (Deno):
- `gov-altinn-submit` — Altinn 3 REST. Maskinporten flow: PKCS#8
  virksomhetssertifikat from Vault → JWT-bearer-grant → Altinn token.
  TT02 sandbox as default for any org with `status='test'`; verify
  per-skjema sandbox availability (not all skjema-eiere have one).
  Generic `altinn_send_melding` action body: `{ tjeneste, skjema,
  recipient_orgnr, body, attachments[] }`.
- `gov-arbeidstilsynet-rapport` — RegInc alvorlig-skade-melding
  (AML §5-2). Required: `melder_rolle`
  (arbeidsgiver/verneombud/lege), `arbeidsgiver_orgnr`,
  `hendelse_dato`, `skadetype`, `personskade_kategori`, fritekst.
  Digital signing with virksomhetssertifikat. 24h deadline: rule template
  ships with `wait_until + 24h` countdown + escalation to daglig-leder.
  Polls for `kvittering`; stores receipt PDF as `workflow_run_evidence`.
- `gov-datatilsynet-breach` — GDPR Art. 33 / § 26 form. **`aware_at`
  field separate from `occurred_at`** — 72h timer starts at *awareness*.
  Pre-72h reminders at T-48h, T-24h, T-2h. Signed manifest required.
  Edge function already partially scaffolded; extend.
- `gov-nav-sykefravar` — via Altinn DSOP, not direct NAV. Trigger on
  sick-leave threshold (8 weeks → dialogmøte 2 prep). Generic Altinn
  envelope underneath.
- **LDO** — no API exists. Action `varsel_ldo_export` builds a
  structured evidence pack + downloads for manual submission. UI must
  say so ("Denne handlingen genererer en rapport for manuell innsending").

Workflow actions registered under a `gov` scope (regulator badge in
builder, "⚖️ Statlig melding — juridisk konsekvens"):
- `rapporter_alvorlig_skade_arbeidstilsynet`
- `meld_personvernbrudd_datatilsynet`
- `varsel_ldo_export`
- `nav_sykefravar_oppfolging`
- `altinn_send_melding` (generic)

Permissions:
- Activating any rule with a gov action requires
  `workflows.activate_external` AND a second approver — enforced at
  rule-activation level via an RLS predicate plus a
  `workflow_rule_activations` audit row.
- Every gov-action run auto-mints `workflow_run_evidence` rows with
  `law_refs[]` populated for export bundling.

Idempotency: queue worker computes
`idempotency_key = sha256(org_id || rule_id || run_id || event_name)`
and the edge function dedupes against the regulator before posting.
Prevents double Arbeidstilsynet submissions on queue retry.

---

## 5. Inspiration borrowed (not blindly)

| Source | Borrow | Skip |
|---|---|---|
| Zapier | Multi-step paths, per-rule run history with search | Trigger marketplace |
| n8n | Visual DAG with explicit error paths | Inline JS code nodes (security) |
| Make | Router, aggregator (N events → 1 action), error handler | Iterator nested loops (UX complexity) |
| HubSpot | Continuous enrolment evaluation, goal-based exits, suppression lists | Marketing-funnel jargon |
| Salesforce Flow | Record-triggered (already have), invocable actions, scheduled paths | Process Builder dual surface |
| ServiceNow | Approvals + subflows | Full integration hub |
| Power Automate | Parallel branches, approval delegation/escalation, adaptive cards | Connector store |
| Drata / Vanta | Immutable run history with checksums, evidence-pack export, dry-run, role-based action authorisation, "rule last reviewed" metadata | Their fixed compliance frameworks |
| Compendia / Simployer / KS HMS-system | Law-ref versioning surfacing on templates, department-level rule delegation, vedtak → task hand-off (already implemented in meetings) | Vendor lock-in to specific HMS taxonomy |

---

## 6. Critical files to touch

**New:**
- `src/lib/workflows/workflowRegistry.ts`
- `src/lib/workflows/workflowTypes.ts`
- `src/lib/workflows/freshId.ts`
- `src/components/workflow/canvas/{TriggerNode,ConditionNode,ActionNode,BranchNode,WaitNode,ApprovalNode,OnErrorNode,ParallelNode}.tsx`
- `src/components/workflow/library/LibraryPanel.tsx`
- `src/components/workflow/dryRun/DryRunPanel.tsx`
- `src/components/workflow/runs/RunHistoryPanel.tsx`
- `src/components/workflow/audit/RevisionHistoryPanel.tsx`
- `src/pages/workflow/WorkflowBuilderPage.tsx`
- `src/pages/workflow/EvidenceExportPage.tsx`
- `src/pages/auditor/AuditorWorkflowsPage.tsx`
- `src/pages/admin/integrations/{Altinn,Arbeidstilsynet,Datatilsynet,Nav}Setup.tsx`
- `modules/<scope>/workflows/<scope>WorkflowScope.ts` × 12 (compliance,
  survey, tasks, documents, meetings, learning, register, inspection,
  ros, action_plan, vernerunder, internal_control) + 1 `gov` scope
- `supabase/functions/{workflow-cron-dispatcher,gov-altinn-submit,gov-arbeidstilsynet-rapport,gov-nav-sykefravar}/index.ts`
- ~10 new forward migrations as listed in Phase A

**Refactor (collapse/replace):**
- `src/types/workflow.ts` — canonical type
- `src/lib/workflowFlowTypes.ts` — use `freshId`, emit new action types
- `src/hooks/useWorkflows.ts` — extend; rename seed function
- `src/components/layout/AticsShell.tsx` — promote Workflow to top-level
- `src/pages/workflow/*.tsx` — replace; keep behind flag during cutover
- 8 module settings pages — remove `WorkflowRulesTab`, add deep link

**Extend (don't parallel-build):**
- `supabase/functions/compliance-audit-pdf` — add evidence-pack mode
- `supabase/functions/datatilsynet-breach-report` — extend with 72h
  timer + signed manifest
- `org_integrations` — extend kind enum
- `compliance_notifications` — the `send_notification` sink

**Delete after cutover:**
- `src/components/workflow/WorkflowRulesTab.tsx`
- `src/components/workflow/ModuleTemplateWorkflowRulesEditor.tsx`
- `src/components/workflow/WorkflowEditorV2.tsx`
- Static central registries replaced by per-scope files

---

## 7. Reuses (avoid duplication)

- `src/lib/dashboards/dashboardRegistry.ts` — registry pattern + side-
  effect import discipline.
- `freshId('wf')` — single mint point.
- `workflow_dispatch_db_event` + `workflow_on_org_module_payload_change`
  — dispatcher loop stays; we *add* inputs (cron, manual, gov-callback).
- `workflow_action_queue` — keep; generalise worker; add idempotency_key.
- `compliance_notifications` — single inbox; no parallel
  `workflow_notifications`.
- `compliance-audit-pdf` — extend with evidence-pack mode.
- `org_integrations` — extend kind; don't add `org_gov_integrations`.
- Existing `workflow_rules.schedule_cron` — wire pg_cron against it.
- Existing pg_cron pattern from `_wiki_retention_framework.sql`.
- Auditor-token pattern from `specs/compliance-planner.md`.

---

## 8. Verification

End-to-end smoke pass after each phase:
1. `pnpm dev`; visit `/workflow?builder=v3`. Single canvas renders;
   old `WorkflowRulesTab` instances replaced with deep link.
2. `pnpm typecheck` clean; canonical `WorkflowRule` type used
   everywhere (no local re-definitions).
3. Install a baseline template ("Kritisk avvik → AMU-sak"); run the
   `DryRunPanel` against a real recent `workflow_runs` payload. Confirm
   panel shows would-fire actions without execution; no `workflow_runs`
   row committed.
4. Activate the rule. Trigger a real critical finding in a sjekklist;
   verify run logged, evidence artefact created
   (`workflow_run_evidence` with non-null `sha256_checksum`), AMU
   agenda item inserted.
5. Cron trigger: create a rule with `schedule_cron = '0 8 * * 1'`;
   advance system time; confirm pg_cron dispatch + run record.
6. Approval: rule with `request_approval` action — verify queue row
   pauses (`status='awaiting_approval'`), approver receives
   `compliance_notifications` row, approval resumes the queue.
7. Evidence pack: export last 90 days filtered by
   `law_refs = '{AML § 5-2}'`; confirm ZIP manifest is signed and
   contains all matching runs + Merkle-chain checksums verify.
8. Government integration (TT02 sandbox): connect Altinn TT02 in
   `org_integrations`; fire `altinn_send_melding`; verify receipt
   saved as evidence, exposed in auditor view.
9. Regulator-action permission gate: try activating an Arbeidstilsynet
   rule without `workflows.activate_external` — denied. With the
   permission — second-approver flow triggered before
   `is_active = true`.
10. Recursion: deliberately wire A→task→B→AMU→C→task→A cycle; confirm
    depth counter caps at 5 and logs `WORKFLOW_DEPTH_EXCEEDED` in
    `workflow_runs.detail`.
11. Immutability: try to UPDATE a `workflow_runs` row >30 days old →
    denied. Try to UPDATE/DELETE any `workflow_run_evidence` row →
    denied unconditionally.
12. Migrations: `scripts/apply-migrations.sh` against a clean Supabase
    project succeeds; rerun is no-op (idempotent).
13. Confidentiality: a whistleblower-sourced run is invisible in
    `RunHistoryPanel` to a user without `workflows.view_confidential`;
    visible in counts + checksum to auditor view but body redacted.
14. Auditor token: open signed auditor URL — read-only access to runs
    + evidence + revisions; no write surface.

---

## 9. Open questions (defer; not blockers)

- BankID-on-mobile-for-business signing — does Maskinporten +
  virksomhetssertifikat suffice for all gov submissions, or do we need
  a separate BankID-for-ansatte signing module? Validate with Difi
  docs before Phase E.
- Does `pgsodium` ship in our Supabase plan tier? If not, fall back to
  KMS-via-edge-function for cert decryption.
- Per-skjema TT02 sandbox availability — manual audit per Altinn form
  needed before flipping to prod.
- Cap concurrent gov submissions per org/per minute to avoid regulator
  rate-limits? Default suggestion: 6/min.
