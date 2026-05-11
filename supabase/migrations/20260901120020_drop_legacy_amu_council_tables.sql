-- Drop legacy AMU + Working Council tables.
--
-- Why
--   The new `modules/meetings` module supersedes the AMU-specific
--   council/meetings data shape. Phase F2 deleted the application code
--   that read these tables; this migration removes the tables themselves
--   along with their triggers, indexes, policies, and helper functions.
--
--   Survey-specific AMU sign-off (survey_amu_reviews, survey_amu_review_*
--   functions) STAYS — that table powers the survey module's AMU review
--   feature, which is a separate concern from this meetings module.
--
-- Cleanup scope
--   - AMU meetings + agenda + decisions + attendance + annual reports
--   - AMU committees + members + topic proposals
--   - AMU election candidates, voters, votes, elections themselves
--   - Council board, elections, meetings, compliance items
--   - Associated triggers, indexes, RLS policies (dropped via CASCADE)
--   - Helper functions specific to these tables
--   - role_permissions rows for module.view.council, amu.manage,
--     amu.chair, amu_election.manage so role surfaces stop offering
--     the keys
--   - workflow_event_subscriptions targeting `amu` or `amu_election`
--     source modules (data only — schema preserved)
--
-- Self-audit (Arbeidstilsynet POV)
--   - AML § 7-2 obligations are now satisfied by the new `meetings`
--     table + `meeting_system_templates` seed (template
--     `amu-arsrapport-q4` carries the § 7-2 (6) annual-report
--     obligation).
--   - AML § 6-3 verneombud-valg is reserved as a placeholder under
--     survey_template_catalog id `amu-valg-system` (seeded in
--     20260901120010_survey_elections_placeholder.sql). Eligibility
--     gating + sealed ballots are restrisiko, tracked in the deferred
--     spec.
--
-- Forward-only: this migration is destructive. The legacy archive
-- migrations remain in `supabase/migrations/archive/` for historical
-- reference but no longer create live tables once this runs.

-- ── AMU meetings + decision pipeline ──────────────────────────────────────

drop table if exists public.amu_decisions cascade;
drop table if exists public.amu_attendance cascade;
drop table if exists public.amu_agenda_items cascade;
drop table if exists public.amu_topic_proposals cascade;
drop table if exists public.amu_default_agenda_items cascade;
drop table if exists public.amu_participants cascade;
drop table if exists public.amu_meetings cascade;
drop table if exists public.amu_annual_reports cascade;
drop table if exists public.amu_members cascade;
drop table if exists public.amu_committees cascade;

-- ── AMU elections ─────────────────────────────────────────────────────────

drop table if exists public.amu_election_votes cascade;
drop table if exists public.amu_election_voters cascade;
drop table if exists public.amu_election_candidates cascade;
drop table if exists public.amu_elections cascade;

-- ── Working Council tables ────────────────────────────────────────────────

drop table if exists public.council_compliance_items cascade;
drop table if exists public.council_meetings cascade;
drop table if exists public.council_elections cascade;
drop table if exists public.council_board_members cascade;

-- ── Helper functions ──────────────────────────────────────────────────────
-- Most policies/triggers are gone after CASCADE; explicitly drop the
-- helpers that lived outside the tables.

drop function if exists public.amu_meeting_is_signed(uuid) cascade;
drop function if exists public.amu_privacy_whistleblowing_stats() cascade;
drop function if exists public.amu_privacy_sick_leave_stats() cascade;
drop function if exists public.amu_draft_annual_report(uuid, int) cascade;
drop function if exists public.amu_generate_auto_agenda(uuid) cascade;
drop function if exists public.cast_amu_vote(uuid, uuid) cascade;
drop function if exists public.get_amu_election_vote_totals(uuid) cascade;
drop function if exists public.trg_amu_elections_workflow_on_status() cascade;
drop function if exists public.trg_amu_meetings_workflow() cascade;
drop function if exists public.council_ensure_org_defaults() cascade;

-- ── role_permissions cleanup ──────────────────────────────────────────────
-- The TypeScript PermissionKey union no longer lists these. Drop the rows
-- so the role-management UI doesn't display orphaned keys. (Schema for
-- role_permissions is untouched — only data rows referencing the removed
-- keys are deleted.)

do $$
begin
  if to_regclass('public.role_permissions') is not null then
    delete from public.role_permissions
    where permission_key in ('module.view.council', 'amu.manage', 'amu.chair', 'amu_election.manage');
  end if;
end $$;

-- ── workflow event subscriptions cleanup ──────────────────────────────────
-- Drop org-level workflow rules that targeted the deleted source modules
-- so they don't sit as dead rows in workflow_event_subscriptions.

do $$
begin
  if to_regclass('public.workflow_event_subscriptions') is not null then
    delete from public.workflow_event_subscriptions
    where source_module in ('amu', 'amu_election');
  end if;
  if to_regclass('public.workflow_rules') is not null then
    delete from public.workflow_rules
    where module in ('amu', 'amu_election');
  end if;
end $$;

-- ── org_module_payloads cleanup ───────────────────────────────────────────
-- The 'amu_election' + 'amu_settings' module payload keys were dropped
-- from the TypeScript union (orgModulePayload.ts). Clean up data rows.

do $$
begin
  if to_regclass('public.org_module_payloads') is not null then
    delete from public.org_module_payloads
    where module_key in ('amu_election', 'amu_settings');
  end if;
end $$;
