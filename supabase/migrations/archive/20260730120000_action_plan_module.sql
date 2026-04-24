-- Active migration: handlingsplan (action_plan_items + categories + v2).
-- Previously only lived under supabase/migrations/archive/ and was never applied.

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

-- Action plan module: categories, polymorphic source, extended status/priority, workflow events.
-- Audit: public.hse_audit_trigger on action_plan_items (append-only hse_audit_log) remains authoritative.

-- ── 1) Kategorier (admin) ───────────────────────────────────────────────────
create table if not exists public.action_plan_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists action_plan_categories_org_idx
  on public.action_plan_categories (organization_id, sort_order, name);

alter table public.action_plan_categories enable row level security;

drop policy if exists action_plan_categories_select on public.action_plan_categories;
create policy action_plan_categories_select
  on public.action_plan_categories for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists action_plan_categories_write on public.action_plan_categories;
create policy action_plan_categories_write
  on public.action_plan_categories for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update, delete on public.action_plan_categories to authenticated;

create or replace function public.action_plan_categories_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists action_plan_categories_before_insert_tg on public.action_plan_categories;
create trigger action_plan_categories_before_insert_tg
  before insert on public.action_plan_categories
  for each row execute function public.action_plan_categories_before_insert();

-- ── 2) Utvid action_plan_items (additive) ─────────────────────────────────
alter table public.action_plan_items
  add column if not exists category_id uuid references public.action_plan_categories (id) on delete set null;

alter table public.action_plan_items
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical'));

alter table public.action_plan_items
  add column if not exists source_module text;

alter table public.action_plan_items
  add column if not exists deadline timestamptz;

alter table public.action_plan_items
  add column if not exists assigned_to uuid references auth.users (id) on delete set null;

alter table public.action_plan_items
  add column if not exists verified_at timestamptz;

alter table public.action_plan_items
  add column if not exists verified_by uuid references auth.users (id) on delete set null;

-- Bakoverkompatibel utfylling
update public.action_plan_items
  set source_module = case source_table
    when 'deviations' then 'avvik'
    when 'inspection_findings' then 'inspection'
    when 'ros_rows' then 'ros'
    else coalesce(nullif(trim(source_table), ''), 'manual')
  end
  where source_module is null;

update public.action_plan_items
  set deadline = due_at
  where deadline is null and due_at is not null;

update public.action_plan_items
  set assigned_to = responsible_id
  where assigned_to is null and responsible_id is not null;

-- Utvid status: draft, open, in_progress, resolved, verified (+ eldre completed, overdue)
alter table public.action_plan_items
  drop constraint if exists action_plan_items_status_check;

update public.action_plan_items
  set status = 'resolved'
  where status = 'completed';

alter table public.action_plan_items
  add constraint action_plan_items_status_check
  check (status in (
    'draft', 'open', 'in_progress', 'resolved', 'verified', 'overdue'
  ));

-- Før-oppdatering: synk deadline/due, assigned, fullføringsfelter, forfalte
create or replace function public.action_plan_items_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_due timestamptz;
begin
  v_due := coalesce(new.deadline, new.due_at);
  if v_due is not null
     and v_due < now()
     and coalesce(new.status, '') not in ('resolved', 'verified', 'overdue', 'draft') then
    new.status := 'overdue';
  end if;
  if new.deadline is not null and new.due_at is null then
    new.due_at := new.deadline;
  elsif new.due_at is not null and new.deadline is null then
    new.deadline := new.due_at;
  end if;
  if new.assigned_to is not null and new.responsible_id is null then
    new.responsible_id := new.assigned_to;
  elsif new.responsible_id is not null and new.assigned_to is null then
    new.assigned_to := new.responsible_id;
  end if;
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  end if;
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Sikre at trigger fortsatt peker riktig (gjenopprett om migrasjoner er ute av synk)
drop trigger if exists action_plan_items_before_update_tg on public.action_plan_items;
create trigger action_plan_items_before_update_tg
  before update on public.action_plan_items
  for each row execute function public.action_plan_items_before_update();

-- ── 3) Arbeidsflyt: ON_MEASURE_* (modul: action_plan) ───────────────────────
-- Opprettelse: etter insetting
create or replace function public.trg_action_plan_items_workflow_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workflow_dispatch_db_event(
    new.organization_id, 'action_plan', 'ON_MEASURE_CREATED', to_jsonb(new)
  );
  return new;
end;
$$;

-- Oppdatering: løst / forfalt
create or replace function public.trg_action_plan_items_workflow_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  v_row := to_jsonb(new);
  if new.status is distinct from old.status
     and new.status in ('resolved', 'verified') then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'action_plan', 'ON_MEASURE_RESOLVED', v_row
    );
  end if;
  if new.status = 'overdue' and old.status is distinct from 'overdue' then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'action_plan', 'ON_MEASURE_OVERDUE', v_row
    );
  end if;
  return new;
end;
$$;

drop trigger if exists action_plan_items_workflow_insert_tg on public.action_plan_items;
create trigger action_plan_items_workflow_insert_tg
  after insert on public.action_plan_items
  for each row execute function public.trg_action_plan_items_workflow_on_insert();

drop trigger if exists action_plan_items_workflow_update_tg on public.action_plan_items;
create trigger action_plan_items_workflow_update_tg
  after update on public.action_plan_items
  for each row execute function public.trg_action_plan_items_workflow_on_update();

-- ── 4) Rettighet: action_plan.manage ──────────────────────────────────────
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'action_plan.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- Navigasjon / module.view (valgfri — app bruker module.view.hse i første omgang)
