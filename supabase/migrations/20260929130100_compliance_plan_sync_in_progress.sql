-- Bidirectional CAPA sync from task_items → compliance_plan_items.
--
-- Phase 3 of the Tasks-module alignment for internkontroll. The
-- existing trigger (`task_items_sync_compliance_plan_done`, from
-- 20260915120500) only mirrored the close transition: when a bridge
-- task moved to `closed` / `done` / `effectiveness_verified`, the
-- source plan-item was flipped to `done`.
--
-- That left a gap: when the doer started a task ('open' →
-- 'in_progress' etc.) the internkontroll dashboard still showed the
-- plan-item as 'planned' until someone manually flipped it. Plan-item
-- status is what the auditor sees on the §-anchored page, so divergence
-- between "I'm working on this" (task) and "Nothing's happened yet"
-- (plan) is the wrong narrative.
--
-- This migration extends the sync to map every CAPA transition back
-- to a plan-item status:
--
--   task.status                          → plan.status
--   ─────────────────────────────────────  ──────────────
--   open                                 → planned (default)
--   in_progress / root_cause_identified  → in_progress
--   action_defined / action_implemented  → in_progress
--   effectiveness_pending                → blocked
--   effectiveness_verified / closed      → done
--   done (legacy)                        → done
--   cancelled                            → blocked (left explicit so
--                                          users see "stopped" vs "done")
--
-- Cycle safety:
--   The plan→task client write only flips status on first creation
--   (it never re-writes after that). To be defensive against future
--   bidirectional client logic, we guard the trigger with
--   pg_trigger_depth() > 0 to skip when fired indirectly. That way a
--   future plan→task trigger can't ping-pong.
--
-- Self-revisjon (Arbeidstilsynet POV):
--   - AML § 3-1 (2) e + IK-f § 5 nr. 7: skriftlig oppfølging.
--     Plan-item status now reflects reality without manual sync.
--   - Restrisiko: cancellation maps to 'blocked' rather than a new
--     plan status. Adding a 'cancelled' to the plan check constraint
--     is a v2 schema change; the 4-state model stays in v1.

set local search_path = public, pg_catalog;

create or replace function public.task_items_sync_compliance_plan()
returns trigger
language plpgsql
as $$
declare
  v_target_plan_status text;
begin
  -- Skip when this trigger is firing inside another trigger's call
  -- stack — defends against future bidirectional client logic.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Only operate when the task is the CAPA twin of a plan-item.
  if new.source_type is distinct from 'compliance_plan' then
    return new;
  end if;
  if new.source_id is null then
    return new;
  end if;

  -- Status didn't actually change → nothing to sync.
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- CAPA → plan mapping table. Unknown / legacy values fall through
  -- to NULL which means "don't change" (defensive default).
  v_target_plan_status := case new.status
    when 'open' then 'planned'
    when 'todo' then 'planned'
    when 'in_progress' then 'in_progress'
    when 'root_cause_identified' then 'in_progress'
    when 'action_defined' then 'in_progress'
    when 'action_implemented' then 'in_progress'
    when 'effectiveness_pending' then 'blocked'
    when 'effectiveness_verified' then 'done'
    when 'closed' then 'done'
    when 'done' then 'done'
    when 'cancelled' then 'blocked'
    else null
  end;

  if v_target_plan_status is null then
    return new;
  end if;

  -- Only write when the target differs and the row is live.
  update public.compliance_plan_items
  set status = v_target_plan_status,
      updated_at = now()
  where id = new.source_id
    and organization_id = new.organization_id  -- defence-in-depth
    and status is distinct from v_target_plan_status
    and deleted_at is null;

  return new;
end;
$$;

-- Replace the old close-only trigger with the broader one. We drop both
-- the trigger and the legacy function in one transaction so there's no
-- moment where the bridge is unwatched.
drop trigger if exists task_items_sync_compliance_plan_done_tg on public.task_items;
drop function if exists public.task_items_sync_compliance_plan_done();

drop trigger if exists task_items_sync_compliance_plan_tg on public.task_items;
create trigger task_items_sync_compliance_plan_tg
  after update of status on public.task_items
  for each row execute function public.task_items_sync_compliance_plan();

comment on function public.task_items_sync_compliance_plan is
  'Mirror CAPA state from bridge task_items onto the source compliance_plan_items. Replaces task_items_sync_compliance_plan_done (close-only). Guarded by pg_trigger_depth to prevent cycles.';
