-- Bi-directional Tasks bridge for compliance_plan_items.
--
-- Phase 3 wired one-way: when a plan item flips to 'in_progress' and
-- has no task_id, the client creates a task_items row with
-- source_type='compliance_plan', source_id=<plan_item.id>. Review
-- flagged that closing the bridge task should reflect back to the
-- plan item — otherwise leaders close work in Oppgavestyring but the
-- internkontroll dashboard still reports it as backlog.
--
-- This migration adds an AFTER UPDATE trigger on public.task_items
-- that, whenever a row's status flips to 'done' and the row is tagged
-- source_type='compliance_plan', updates the matching
-- compliance_plan_items row to status='done'. The trigger is
-- one-shot: it only fires on the transition (old.status != new.status
-- AND new.status = 'done'), so manually re-setting a task to 'done'
-- doesn't re-trigger.
--
-- The reverse direction (plan_item 'done' → task 'done') stays
-- client-side in useCompliancePlanItems for now — DB triggers in both
-- directions risk cycles.
--
-- Self-revisjon: dashboard "Tiltak per status" donut nå reflekterer
-- reell virkelighet uansett hvor brukeren klikker «fullført» — IK-f
-- § 5 nr. 7 (operativt lukket-spor) er konsistent på tvers av flatene.

set local search_path = public, pg_catalog;

create or replace function public.task_items_sync_compliance_plan_done()
returns trigger
language plpgsql
as $$
begin
  -- Tasks complete in the modern CAPA lifecycle by transitioning to
  -- 'closed'; the legacy 'done' value is still accepted for
  -- backward-compat (see RUN_IN_SQL_EDITOR.sql task_items_status_check).
  -- Mirror either onto the plan item.
  if new.status is distinct from old.status
     and new.status in ('closed', 'done', 'effectiveness_verified')
     and new.source_type = 'compliance_plan'
     and new.source_id is not null
  then
    update public.compliance_plan_items
    set status = 'done',
        updated_at = now()
    where id = new.source_id
      and organization_id = new.organization_id  -- defence-in-depth
      and status != 'done'
      and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists task_items_sync_compliance_plan_done_tg on public.task_items;
create trigger task_items_sync_compliance_plan_done_tg
  after update of status on public.task_items
  for each row execute function public.task_items_sync_compliance_plan_done();

comment on function public.task_items_sync_compliance_plan_done is
  'Bi-directional Tasks bridge for the internkontroll plan items. When a task tagged source_type=''compliance_plan'' flips to ''done'', mirror that closure back onto the source compliance_plan_items row. One-way trigger; the plan→task direction stays client-side to avoid cycles.';
