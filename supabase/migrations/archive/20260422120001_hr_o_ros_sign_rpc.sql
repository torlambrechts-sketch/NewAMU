-- O-ROS: sign RPCs and auto-unblock when both AMU and VO have signed.

create or replace function public.hr_ros_org_upsert_assignees(
  p_org_id uuid,
  p_ros_assessment_id text,
  p_amu_user_id uuid,
  p_verneombud_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_org_id <> public.current_org_id() then
    raise exception 'Not allowed';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('hr.o_ros.manage')) then
    raise exception 'Not allowed';
  end if;

  insert into public.hr_ros_org_signoffs (
    organization_id, ros_assessment_id, category, requires_amu_signoff,
    amu_representative_user_id, verneombud_user_id, blocked
  )
  values (
    p_org_id, p_ros_assessment_id, 'organizational_change', true,
    p_amu_user_id, p_verneombud_user_id, true
  )
  on conflict (organization_id, ros_assessment_id) do update set
    amu_representative_user_id = excluded.amu_representative_user_id,
    verneombud_user_id = excluded.verneombud_user_id,
    updated_at = now();
end;
$$;

grant execute on function public.hr_ros_org_upsert_assignees(uuid, text, uuid, uuid) to authenticated;

create or replace function public.hr_ros_org_sign_as(
  p_org_id uuid,
  p_ros_assessment_id text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hr_ros_org_signoffs%rowtype;
  t timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('amu', 'verneombud') then
    raise exception 'Invalid role';
  end if;
  if not public.user_has_permission('hr.o_ros.sign') then
    raise exception 'Missing hr.o_ros.sign';
  end if;

  select * into r
  from public.hr_ros_org_signoffs
  where organization_id = p_org_id and ros_assessment_id = p_ros_assessment_id
  for update;

  if r.id is null then
    raise exception 'Signoff row not found — create O-ROS signoff first';
  end if;

  if p_role = 'amu' then
    if r.amu_representative_user_id is distinct from auth.uid() then
      raise exception 'Not assigned AMU signer';
    end if;
    update public.hr_ros_org_signoffs set amu_signed_at = t, updated_at = t where id = r.id;
  else
    if r.verneombud_user_id is distinct from auth.uid() then
      raise exception 'Not assigned verneombud';
    end if;
    update public.hr_ros_org_signoffs set verneombud_signed_at = t, updated_at = t where id = r.id;
  end if;

  select * into r from public.hr_ros_org_signoffs where id = r.id;
  if r.amu_signed_at is not null and r.verneombud_signed_at is not null then
    update public.hr_ros_org_signoffs set blocked = false, updated_at = now() where id = r.id;
  end if;
end;
$$;

grant execute on function public.hr_ros_org_sign_as(uuid, text, text) to authenticated;
