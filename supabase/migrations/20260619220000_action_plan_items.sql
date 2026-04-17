-- IK-f §5 nr. 2–3: documented action plans with deadline and responsible person.
-- Generic link via source_table + source_id (inspection_findings, deviations, ros_rows, …).

create table if not exists public.action_plan_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_table    text not null,   -- 'inspection_findings' | 'deviations' | 'ros_rows'
  source_id       uuid not null,
  title           text not null,
  description     text not null default '',
  responsible_id  uuid references auth.users (id) on delete set null,
  due_at          timestamptz not null,
  status          text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'overdue')),
  completed_at    timestamptz,
  completed_by    uuid references auth.users (id) on delete set null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists action_plan_items_source_idx
  on public.action_plan_items (source_table, source_id);

create index if not exists action_plan_items_org_status_idx
  on public.action_plan_items (organization_id, status, due_at);

alter table public.action_plan_items enable row level security;

drop policy if exists action_plan_items_select_org on public.action_plan_items;
create policy action_plan_items_select_org
  on public.action_plan_items for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists action_plan_items_write_org on public.action_plan_items;
create policy action_plan_items_write_org
  on public.action_plan_items for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update, delete on public.action_plan_items to authenticated;

-- Auto-fill defaults
create or replace function public.action_plan_items_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists action_plan_items_before_insert_tg on public.action_plan_items;
create trigger action_plan_items_before_insert_tg
  before insert on public.action_plan_items
  for each row execute function public.action_plan_items_before_insert();

-- Auto-set completed_at
create or replace function public.action_plan_items_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
    new.completed_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists action_plan_items_before_update_tg on public.action_plan_items;
create trigger action_plan_items_before_update_tg
  before update on public.action_plan_items
  for each row execute function public.action_plan_items_before_update();

-- Attach audit trigger
drop trigger if exists action_plan_items_audit_tg on public.action_plan_items;
create trigger action_plan_items_audit_tg
  after insert or update or delete on public.action_plan_items
  for each row execute function public.hse_audit_trigger();
