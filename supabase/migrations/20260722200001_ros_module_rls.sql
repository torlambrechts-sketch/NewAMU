-- ── RLS: ros_analyses ─────────────────────────────────────────────────────────
alter table public.ros_analyses enable row level security;

drop policy if exists ros_analyses_select  on public.ros_analyses;
drop policy if exists ros_analyses_insert  on public.ros_analyses;
drop policy if exists ros_analyses_update  on public.ros_analyses;
drop policy if exists ros_analyses_delete  on public.ros_analyses;

create policy ros_analyses_select on public.ros_analyses for select to authenticated
  using (organization_id = public.current_org_id());
create policy ros_analyses_insert on public.ros_analyses for insert to authenticated
  with check (organization_id = public.current_org_id());
create policy ros_analyses_update on public.ros_analyses for update to authenticated
  using (organization_id = public.current_org_id() and status not in ('approved','archived'));
create policy ros_analyses_delete on public.ros_analyses for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin() and status = 'draft');

-- ── RLS: ros_hazards ──────────────────────────────────────────────────────────
alter table public.ros_hazards enable row level security;
drop policy if exists ros_hazards_select on public.ros_hazards;
drop policy if exists ros_hazards_write  on public.ros_hazards;
create policy ros_hazards_select on public.ros_hazards for select to authenticated
  using (organization_id = public.current_org_id());
create policy ros_hazards_write on public.ros_hazards for all to authenticated
  using (
    organization_id = public.current_org_id() and
    exists (
      select 1 from public.ros_analyses a
      where a.id = ros_id and a.status not in ('approved','archived')
    )
  );

-- ── RLS: ros_measures ─────────────────────────────────────────────────────────
alter table public.ros_measures enable row level security;
drop policy if exists ros_measures_select on public.ros_measures;
drop policy if exists ros_measures_write  on public.ros_measures;
create policy ros_measures_select on public.ros_measures for select to authenticated
  using (organization_id = public.current_org_id());
create policy ros_measures_write on public.ros_measures for all to authenticated
  using (
    organization_id = public.current_org_id() and
    exists (
      select 1 from public.ros_analyses a
      where a.id = ros_id and a.status not in ('approved','archived')
    )
  );

-- ── RLS: ros_participants / ros_signatures ────────────────────────────────────
alter table public.ros_participants enable row level security;
drop policy if exists ros_participants_select on public.ros_participants;
drop policy if exists ros_participants_write  on public.ros_participants;
create policy ros_participants_select on public.ros_participants for select to authenticated
  using (exists (select 1 from public.ros_analyses a where a.id = ros_id and a.organization_id = public.current_org_id()));
create policy ros_participants_write on public.ros_participants for all to authenticated
  using (exists (select 1 from public.ros_analyses a where a.id = ros_id and a.organization_id = public.current_org_id()));

alter table public.ros_signatures enable row level security;
drop policy if exists ros_signatures_select on public.ros_signatures;
drop policy if exists ros_signatures_insert on public.ros_signatures;
create policy ros_signatures_select on public.ros_signatures for select to authenticated
  using (exists (select 1 from public.ros_analyses a where a.id = ros_id and a.organization_id = public.current_org_id()));
create policy ros_signatures_insert on public.ros_signatures for insert to authenticated
  with check (exists (select 1 from public.ros_analyses a where a.id = ros_id and a.organization_id = public.current_org_id()));

-- ── Grants ────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.ros_analyses    to authenticated;
grant select, insert, update, delete on public.ros_hazards     to authenticated;
grant select, insert, update, delete on public.ros_measures    to authenticated;
grant select, insert, update, delete on public.ros_participants to authenticated;
grant select, insert                 on public.ros_signatures  to authenticated;

-- ── BEFORE INSERT: auto-fill organization_id ─────────────────────────────────
create or replace function public.ros_analyses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  return new;
end; $$;
drop trigger if exists ros_analyses_before_insert_tg on public.ros_analyses;
create trigger ros_analyses_before_insert_tg
  before insert on public.ros_analyses
  for each row execute function public.ros_analyses_before_insert();

create or replace function public.ros_hazards_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  return new;
end; $$;
drop trigger if exists ros_hazards_before_insert_tg on public.ros_hazards;
create trigger ros_hazards_before_insert_tg
  before insert on public.ros_hazards
  for each row execute function public.ros_hazards_before_insert();

create or replace function public.ros_measures_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  return new;
end; $$;
drop trigger if exists ros_measures_before_insert_tg on public.ros_measures;
create trigger ros_measures_before_insert_tg
  before insert on public.ros_measures
  for each row execute function public.ros_measures_before_insert();
