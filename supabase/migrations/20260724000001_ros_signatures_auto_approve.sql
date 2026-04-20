-- ROS: auto-godkjenn når begge signaturer finnes (DB), og fjern «signed»-status som blokkerte oppdatering til «approved»

-- Map evt. eksisterende «signed» tilbake til gjennomgang
update public.ros_analyses set status = 'in_review' where status = 'signed';

alter table public.ros_analyses drop constraint if exists ros_analyses_status_check;
alter table public.ros_analyses add constraint ros_analyses_status_check
  check (status in ('draft','in_review','approved','archived'));

-- Tillat oppdatering frem til godkjent (samme som før «signed»-forsøket)
drop policy if exists ros_analyses_update on public.ros_analyses;
create policy ros_analyses_update on public.ros_analyses for update to authenticated
  using (organization_id = public.current_org_id() and status not in ('approved','archived'));

drop policy if exists ros_hazards_write on public.ros_hazards;
create policy ros_hazards_write on public.ros_hazards for all to authenticated
  using (
    organization_id = public.current_org_id() and
    exists (
      select 1 from public.ros_analyses a
      where a.id = ros_id and a.status not in ('approved','archived')
    )
  );

drop policy if exists ros_measures_write on public.ros_measures;
create policy ros_measures_write on public.ros_measures for all to authenticated
  using (
    organization_id = public.current_org_id() and
    exists (
      select 1 from public.ros_analyses a
      where a.id = ros_id and a.status not in ('approved','archived')
    )
  );

create or replace function public.trg_ros_signatures_auto_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_has_resp boolean;
  v_has_vo boolean;
begin
  select organization_id into v_org from public.ros_analyses where id = new.ros_id;
  if v_org is null then
    return new;
  end if;

  select
    bool_or(s.role = 'responsible'),
    bool_or(s.role = 'verneombud')
  into v_has_resp, v_has_vo
  from public.ros_signatures s
  where s.ros_id = new.ros_id;

  if coalesce(v_has_resp, false) and coalesce(v_has_vo, false) then
    update public.ros_analyses
    set status = 'approved', updated_at = now()
    where id = new.ros_id
      and organization_id = v_org
      and status not in ('approved','archived');
  end if;

  return new;
end;
$$;

drop trigger if exists ros_signatures_auto_approve_tg on public.ros_signatures;
create trigger ros_signatures_auto_approve_tg
  after insert on public.ros_signatures
  for each row execute function public.trg_ros_signatures_auto_approve();
