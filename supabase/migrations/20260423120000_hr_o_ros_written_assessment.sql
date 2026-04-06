-- O-ROS: require written assessment text when AMU / verneombud sign (AML — dokumentert høring).

alter table public.hr_ros_org_signoffs
  add column if not exists amu_assessment_text text,
  add column if not exists verneombud_assessment_text text;

comment on column public.hr_ros_org_signoffs.amu_assessment_text is 'Skriftlig vurdering fra AMU-representant før signatur';
comment on column public.hr_ros_org_signoffs.verneombud_assessment_text is 'Skriftlig vurdering fra verneombud før signatur';

-- Replace RPC: fourth argument is mandatory non-empty assessment text for the signing role.
drop function if exists public.hr_ros_org_sign_as(uuid, text, text);

create or replace function public.hr_ros_org_sign_as(
  p_org_id uuid,
  p_ros_assessment_id text,
  p_role text,
  p_assessment_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hr_ros_org_signoffs%rowtype;
  t timestamptz := now();
  trimmed text;
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

  trimmed := trim(coalesce(p_assessment_text, ''));
  if length(trimmed) < 10 then
    raise exception 'Skriftlig vurdering må fylles ut (minst 10 tegn)';
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
    update public.hr_ros_org_signoffs
    set amu_signed_at = t,
        amu_assessment_text = trimmed,
        updated_at = t
    where id = r.id;
  else
    if r.verneombud_user_id is distinct from auth.uid() then
      raise exception 'Not assigned verneombud';
    end if;
    update public.hr_ros_org_signoffs
    set verneombud_signed_at = t,
        verneombud_assessment_text = trimmed,
        updated_at = t
    where id = r.id;
  end if;

  select * into r from public.hr_ros_org_signoffs where id = r.id;
  if r.amu_signed_at is not null and r.verneombud_signed_at is not null then
    update public.hr_ros_org_signoffs set blocked = false, updated_at = now() where id = r.id;
  end if;
end;
$$;

grant execute on function public.hr_ros_org_sign_as(uuid, text, text, text) to authenticated;
