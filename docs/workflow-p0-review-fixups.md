# Workflow P0 review fix-ups

Audit trail for the senior-staff review of branch
`claude/audit-workflow-engine-dyqOI`. All fix-up migrations carry a
4–8 line Arbeidstilsynet self-audit header and are idempotent. Edge
function edits are TypeScript-clean.

## Status table

| Finding | What was wrong | Fix migration / file | Status |
|---|---|---|---|
| B-1 | `resolve_workflow_notification_recipients` called legacy `user_has_permission` (admin-bypass) instead of the strict variant — undid the entire purpose of `_120200_workflow_confidentiality_strict`. | `supabase/migrations/20260907121100_workflow_notification_strict_recipients.sql` | Fixed |
| B-2 | Alerts module workflow-emission triggers never installed on fresh DB — `_120400` (Sep 7) ran before `_20260911120000_alerts_module_core` so `to_regclass('public.alert_cases')` was NULL. | `supabase/migrations/20260911120050_alerts_workflow_triggers_install.sql` | Fixed |
| B-3 | Activation guard had two bypass paths: (1) trigger fired on `update of is_active, actions_json` only, so edits to `condition_json`/trigger fields skipped re-approval; (2) early-return on `old.is_active=true` skipped snapshot match for active-rule edits. | `supabase/migrations/20260907121200_workflow_activation_guard_hardening.sql` | Fixed |
| B-4 | Retention purger did INSERT-then-separate-DELETE — failure between leaves orphans. Archive tables had no PK because `LIKE INCLUDING DEFAULTS INCLUDING CONSTRAINTS` does not copy PK. | `supabase/migrations/20260907121300_workflow_retention_atomic_purge.sql` | Fixed |
| C-1 | Category-CHECK rebuild in `_120250` runs in a `do $$` block (single transaction) — no actual insert window. | Documented in `_121100` header; no separate migration. | Closed (documented) |
| C-2 | `workflow_cron_tick` did not filter soft-deleted orgs. | `supabase/migrations/20260907121400_workflow_cron_org_filter.sql` (adds `organizations.deleted_at` since none existed). | Fixed |
| C-4 | `workflow_schedule_reminders` silently fell back to `now()` when anchor missing — defeated the whole point of T-N reminders. | Same migration `_121400` re-issues the function with a hard-fail + failed-run log. | Fixed |
| C-5 | Documents publish trigger used a `title = label` heuristic to look up `legal_basis` from `document_system_templates`. Brittle + wrong-matches across titles. | `supabase/migrations/20260907121500_documents_legal_basis_cleanup.sql` — drops the heuristic, adds `wiki_pages.template_id` for future id-join. | Fixed |
| C-6 | `gov-outbox-worker` lacked handler arms for `manual_arbeidstilsynet_submission` and `manual_ldo_export`. | `supabase/functions/gov-outbox-worker/index.ts` — both arms route to `flagAwaitingHuman()`. | Fixed |
| C-7 | `alerts_text_fingerprint` used plain sha256 — rainbow-table attacker can confirm specific texts. | `supabase/migrations/20260907121600_alerts_fingerprint_hmac.sql` — per-org HMAC key table, new `(uuid, text)` signature, trigger re-issued. | Fixed |
| C-8 | Archive tables had a redundant `for all using (false)` policy that masked the SELECT policy on some PG versions; archive PK missing. | Folded into B-4 fix `_121300`. | Fixed |
| C-9 | Evidence chain selected head by `rule_id = p_rule_id`, so all system-rule (`rule_id IS NULL`) evidence aliased into one chain across unrelated rules. | `supabase/migrations/20260907121700_workflow_evidence_chain_partition.sql` — adds `chain_key`, backfills, rewrites `workflow_record_evidence` to chain by it. | Fixed |

## TODOs punted

- **Historical alerts re-emission**: orgs that submitted alerts BEFORE
  `_20260911120050` on a fresh DB never emitted any workflow events.
  Backfill is not automated; manual `workflow_dispatch_db_event` call if
  needed.
- **Fingerprint key rotation**: rotating an org's HMAC key invalidates
  all historical fingerprints. A `key_version` column + lazy re-hash is
  deferred to a follow-up.
- **Legacy evidence chains**: rows backfilled to `chain_key =
  'system:legacy'` share one bucket per org. Auditing them individually
  is out of scope.
- **Template-id backfill** for `wiki_pages.template_id`: column is
  nullable + advisory; populating from `document_org_template_settings`
  requires picking the "right" template per page (same problem the
  cleanup sidesteps).
