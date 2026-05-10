-- task_items workflow DB triggers
-- Closes gap: task_items had no workflow_dispatch_db_event() hooks, so workflow
-- rules with source_module='tasks' could never fire from DB-level changes.
--
-- Events added: ON_TASK_CREATED, ON_TASK_STATUS_CHANGED, ON_TASK_OVERDUE_MARKED,
--               ON_TASK_SIGNED
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 (2) e — iverksette tiltak ved avvik og
--   lære av hendelser. Automated routing of task sign-off events ensures
--   traceability and timely escalation without manual monitoring.
--   Restrisiko deferred: ON_TASK_COMMENT_ADDED (requires separate comments table).

-- ── ON_TASK_CREATED ───────────────────────────────────────────────────────────

create or replace function public.trg_task_items_workflow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'tasks', 'ON_TASK_CREATED', to_jsonb(NEW)
  );
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_created_tg on public.task_items;
create trigger task_items_workflow_created_tg
  after insert on public.task_items
  for each row execute function public.trg_task_items_workflow_created();

-- ── ON_TASK_STATUS_CHANGED ────────────────────────────────────────────────────
-- Guard: only fires when status actually changes (avoids spurious updates).

create or replace function public.trg_task_items_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_STATUS_CHANGED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_status_tg on public.task_items;
create trigger task_items_workflow_status_tg
  after update of status on public.task_items
  for each row execute function public.trg_task_items_workflow_status();

-- ── ON_TASK_OVERDUE_MARKED ────────────────────────────────────────────────────
-- Fires when due_date transitions to a past value (overdue marker set externally,
-- or when a scheduled job stamps overdue status).

create or replace function public.trg_task_items_workflow_overdue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'overdue' and (OLD.status is distinct from 'overdue') then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_OVERDUE_MARKED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_overdue_tg on public.task_items;
create trigger task_items_workflow_overdue_tg
  after update of status on public.task_items
  for each row execute function public.trg_task_items_workflow_overdue();

-- ── ON_TASK_SIGNED ────────────────────────────────────────────────────────────
-- Fires when assignee_signed_at is first set (transition from NULL → value).

create or replace function public.trg_task_items_workflow_signed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.assignee_signed_at is not null and OLD.assignee_signed_at is null then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_SIGNED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_signed_tg on public.task_items;
create trigger task_items_workflow_signed_tg
  after update of assignee_signed_at on public.task_items
  for each row execute function public.trg_task_items_workflow_signed();
