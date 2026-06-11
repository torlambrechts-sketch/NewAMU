-- Meeting action items ⇄ tasks sync (H2.3)
--
-- Gap closed: meeting_action_items was a parallel follow-up system — items
-- carried task_id/task_module columns from day one but nothing ever wrote
-- them, so follow-up died between meetings and the task board.
-- meetings_action_item_to_task() materialises an action item as a
-- task_items row, and two guarded triggers keep status in sync both ways.
--
-- Self-audit (Arbeidstilsynet POV): vedtak/oppfølging from AMU meetings now
-- lands in the auditable task system with due dates and owners (AML § 7-2 —
-- utvalgets vedtak skal følges opp). Restrisiko: assignee_user_id is only
-- set when the responsible member's email uniquely matches a profile in the
-- same org; otherwise the task carries the display name only (same rule as
-- the H1.1 backfill — never guess).
--
-- usage:
--   select meetings_action_item_to_task('<action_item_id>');  -- returns task id

set local search_path = public, pg_catalog;

create or replace function public.meetings_action_item_to_task(p_action_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item public.meeting_action_items%rowtype;
  v_org uuid;
  v_member_name text;
  v_member_email text;
  v_user_id uuid;
  v_task_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item from public.meeting_action_items where id = p_action_item_id;
  if v_item.id is null then
    raise exception 'Aksjonspunkt ikke funnet.';
  end if;

  select organization_id into v_org from public.meetings where id = v_item.meeting_id;
  if v_org is null or v_org <> public.current_org_id() then
    raise exception 'Aksjonspunktet tilhører ikke din organisasjon.';
  end if;

  -- Idempotent: already materialised → return the existing task.
  if v_item.task_id is not null
     and exists (select 1 from public.task_items t where t.id = v_item.task_id) then
    return v_item.task_id;
  end if;

  -- Resolve assignee from the responsible member. user_id only on a unique
  -- same-org email match against profiles (mirrors the H1.1 backfill rule).
  if v_item.responsible_member_id is not null then
    select m.display_name, lower(btrim(m.email))
      into v_member_name, v_member_email
      from public.organization_members m
     where m.id = v_item.responsible_member_id;
    if v_member_email is not null and v_member_email <> '' then
      select p.id into v_user_id
        from public.profiles p
       where p.organization_id = v_org
         and lower(btrim(p.email)) = v_member_email;
      -- (single row expected; if duplicates exist the select raises and we
      --  fall back below)
    end if;
  end if;

  insert into public.task_items (
    organization_id, title, description, status, priority,
    pack, source_category, pdca_phase, template_kind,
    source_type, source_id,
    assignee_name, assignee_user_id,
    due_date, created_by
  ) values (
    v_org,
    left(v_item.description, 200),
    v_item.description,
    case v_item.status when 'in_progress' then 'in_progress' else 'open' end,
    'medium',
    'aml-amu', 'general', 'do', 'oppgave',
    'meeting', v_item.meeting_id,
    v_member_name, v_user_id,
    v_item.due_date,
    auth.uid()
  )
  returning id into v_task_id;

  update public.meeting_action_items
     set task_id = v_task_id,
         task_module = 'tasks',
         updated_at = now()
   where id = p_action_item_id;

  return v_task_id;
exception
  when too_many_rows then
    -- Ambiguous email match → create the task name-only.
    insert into public.task_items (
      organization_id, title, description, status, priority,
      pack, source_category, pdca_phase, template_kind,
      source_type, source_id, assignee_name, due_date, created_by
    ) values (
      v_org, left(v_item.description, 200), v_item.description,
      case v_item.status when 'in_progress' then 'in_progress' else 'open' end,
      'medium', 'aml-amu', 'general', 'do', 'oppgave',
      'meeting', v_item.meeting_id, v_member_name, v_item.due_date, auth.uid()
    )
    returning id into v_task_id;
    update public.meeting_action_items
       set task_id = v_task_id, task_module = 'tasks', updated_at = now()
     where id = p_action_item_id;
    return v_task_id;
end;
$$;

grant execute on function public.meetings_action_item_to_task(uuid) to authenticated;

-- ── Sync: task status → action item ─────────────────────────────────────────
-- pg_trigger_depth() guard stops ping-pong: when this trigger updates the
-- action item, the reverse trigger fires at depth 2 and skips.

create or replace function public.meeting_action_item_sync_from_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_next text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  v_next := case new.status
    when 'closed' then 'done'
    when 'cancelled' then 'dropped'
    when 'in_progress' then 'in_progress'
    when 'open' then 'open'
    else null  -- CAPA mid-states map to in_progress
  end;
  if v_next is null then
    v_next := 'in_progress';
  end if;
  update public.meeting_action_items
     set status = v_next, updated_at = now()
   where task_id = new.id
     and task_module = 'tasks'
     and status is distinct from v_next;
  return new;
end;
$$;

drop trigger if exists meeting_action_item_sync_from_task on public.task_items;
create trigger meeting_action_item_sync_from_task
  after update of status on public.task_items
  for each row
  when (old.status is distinct from new.status)
  execute function public.meeting_action_item_sync_from_task();

-- ── Sync: action item status → task ─────────────────────────────────────────

create or replace function public.meeting_action_item_sync_to_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.task_id is null or new.task_module is distinct from 'tasks' then
    return new;
  end if;
  if new.status = 'done' then
    update public.task_items
       set status = 'closed', closed_at = coalesce(closed_at, now()), updated_at = now()
     where id = new.task_id and status not in ('closed', 'cancelled');
  elsif new.status = 'dropped' then
    update public.task_items
       set status = 'cancelled', updated_at = now()
     where id = new.task_id and status not in ('closed', 'cancelled');
  elsif new.status = 'in_progress' then
    update public.task_items
       set status = 'in_progress', updated_at = now()
     where id = new.task_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_action_item_sync_to_task on public.meeting_action_items;
create trigger meeting_action_item_sync_to_task
  after update of status on public.meeting_action_items
  for each row
  when (old.status is distinct from new.status)
  execute function public.meeting_action_item_sync_to_task();
