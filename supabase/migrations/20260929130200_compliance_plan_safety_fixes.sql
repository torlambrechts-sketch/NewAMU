-- Two safety fixes for the internkontroll ↔ Tasks alignment work.
--
-- 1. Cross-org FK guard on compliance_plan_items.project_id
--
-- The Phase-2 migration (20260929130000) added a plain FK to
-- task_projects without checking that both rows live in the same org.
-- An RLS-respecting client read can't see another org's project, but
-- the write path doesn't enforce the cross-tenant boundary — a buggy
-- or malicious request could store a foreign project_id on its own
-- plan-item. This mirrors the precedent set by
-- `regulation_id_must_match_org()` and `internal_pack_id_must_match_org()`.
--
-- 2. Plan → task closure sync
--
-- The Phase-3 trigger only mirrors task → plan. Closing a tiltak from
-- the §-anchored auditor view (`compliance_plan_items.status = 'done'`)
-- left the bridge task stranded in whatever state it was in — typically
-- `in_progress`, which means the doer's queue still shows the work as
-- open. We add a one-directional trigger plan → task that closes the
-- bridge task when the plan-item closes.
--
-- Cycle safety:
--   The same pg_trigger_depth() > 1 guard from Phase 3 prevents the
--   task → plan trigger from being re-fired in response to our plan →
--   task write. Together both triggers form an idempotent loop:
--     plan.done → task.closed (via this trigger, depth=1)
--     task.closed → plan.done (via Phase 3 trigger, depth=2, guarded)
--
-- We also map the reverse: plan.cancelled isn't a valid state on plan
-- today, so the trigger only fires for status='done'. Future v2 schema
-- extension can broaden this.
--
-- Self-revisjon (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 7 + AML § 3-1 (2) e: skriftlig oppfølging.
--     Closure now propagates end-to-end without manual intervention.
--   - Cross-tenant data integrity is foundational for tilsyn confidence —
--     a project_id pointing across orgs would be an audit-trail break.

set local search_path = public, pg_catalog;

-- ── 1. Cross-org FK guard ────────────────────────────────────────────────

create or replace function public.project_id_must_match_org()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.task_projects
    where id = new.project_id
      and organization_id = new.organization_id
      and deleted_at is null
  ) then
    raise exception 'project_id % does not exist or is in a different organization than the plan-item (org %)',
      new.project_id, new.organization_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_plan_items_project_id_org_check_tg
  on public.compliance_plan_items;
create trigger compliance_plan_items_project_id_org_check_tg
  before insert or update of project_id, organization_id
  on public.compliance_plan_items
  for each row execute function public.project_id_must_match_org();

comment on function public.project_id_must_match_org is
  'Defence-in-depth: refuses INSERT/UPDATE on compliance_plan_items when project_id references a task_projects row in a different organization. RLS prevents reads across orgs; this trigger prevents writes from creating dangling cross-tenant references.';

-- ── 2. Plan → task closure sync ──────────────────────────────────────────

create or replace function public.compliance_plan_items_sync_task_closure()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Only fire when the plan-item actually transitions to 'done'.
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status <> 'done' then
    return new;
  end if;
  if new.task_id is null then
    return new;
  end if;

  -- Close the bridge task. We aim for 'effectiveness_verified' (the
  -- last gateable state) rather than 'closed' directly because the
  -- existing CAPA closure gate (trg_task_avvik_closure_gate_fn) enforces
  -- the lifecycle for avvik-flagged tasks. effectiveness_verified is
  -- always reachable as long as the task itself isn't already closed.
  update public.task_items
  set status = 'effectiveness_verified',
      closed_at = now()
  where id = new.task_id
    and organization_id = new.organization_id  -- defence-in-depth
    and status not in ('closed', 'effectiveness_verified', 'cancelled')
    and deleted_at is null;

  return new;
end;
$$;

drop trigger if exists compliance_plan_items_sync_task_closure_tg
  on public.compliance_plan_items;
create trigger compliance_plan_items_sync_task_closure_tg
  after update of status on public.compliance_plan_items
  for each row execute function public.compliance_plan_items_sync_task_closure();

comment on function public.compliance_plan_items_sync_task_closure is
  'Mirror plan → task closure: when a compliance_plan_items row flips to status=done, the bridge task_items row is advanced to effectiveness_verified so the doer queue does not show stale open work. Cycle-safe via pg_trigger_depth().';
