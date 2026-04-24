-- Standard saksliste (per organisasjon) for AMU — ingen hardkodet frontend-liste
create table if not exists public.amu_default_agenda_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  description     text not null default '',
  order_index     int not null default 0,
  source_module   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists amu_default_agenda_org_order_idx
  on public.amu_default_agenda_items (organization_id, order_index, title);

drop trigger if exists amu_default_agenda_items_set_updated_at on public.amu_default_agenda_items;
create trigger amu_default_agenda_items_set_updated_at
  before update on public.amu_default_agenda_items
  for each row execute function public.set_updated_at();

alter table public.amu_default_agenda_items enable row level security;

drop policy if exists amu_default_agenda_select on public.amu_default_agenda_items;
create policy amu_default_agenda_select on public.amu_default_agenda_items
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_default_agenda_insert on public.amu_default_agenda_items;
create policy amu_default_agenda_insert on public.amu_default_agenda_items
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu.manage'))
  );

drop policy if exists amu_default_agenda_update on public.amu_default_agenda_items;
create policy amu_default_agenda_update on public.amu_default_agenda_items
  for update to authenticated
  using (organization_id = public.current_org_id() and (public.is_org_admin() or public.user_has_permission('amu.manage')))
  with check (organization_id = public.current_org_id());

drop policy if exists amu_default_agenda_delete on public.amu_default_agenda_items;
create policy amu_default_agenda_delete on public.amu_default_agenda_items
  for delete to authenticated
  using (organization_id = public.current_org_id() and (public.is_org_admin() or public.user_has_permission('amu.manage')));

create or replace function public.amu_default_agenda_items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists amu_default_agenda_items_before_insert_tg on public.amu_default_agenda_items;
create trigger amu_default_agenda_items_before_insert_tg
  before insert on public.amu_default_agenda_items
  for each row execute function public.amu_default_agenda_items_before_insert();

grant select, insert, update, delete on public.amu_default_agenda_items to authenticated;

-- Arbeidsflyt: møte planlagt, referat signert
create or replace function public.trg_amu_meetings_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if tg_op = 'INSERT' and new.status = 'scheduled' then
    v_row := to_jsonb(new);
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'amu',
      'ON_AMU_MEETING_SCHEDULED',
      v_row
    );
  elsif tg_op = 'UPDATE' then
    if new.status = 'scheduled' and coalesce(old.status, '') is distinct from 'scheduled' then
      v_row := to_jsonb(new);
      perform public.workflow_dispatch_db_event(
        new.organization_id,
        'amu',
        'ON_AMU_MEETING_SCHEDULED',
        v_row
      );
    end if;
    if new.status = 'signed' and coalesce(old.status, '') is distinct from 'signed' then
      v_row := to_jsonb(new);
      perform public.workflow_dispatch_db_event(
        new.organization_id,
        'amu',
        'ON_AMU_MEETING_SIGNED',
        v_row
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists amu_meetings_workflow_tg on public.amu_meetings;
create trigger amu_meetings_workflow_tg
  after insert or update of status on public.amu_meetings
  for each row execute function public.trg_amu_meetings_workflow();
