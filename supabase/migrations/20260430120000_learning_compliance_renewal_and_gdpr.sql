-- GAP-C03: mark certificates for renewal on course version bump.
-- GAP-C05: GDPR — delete all learning data for a user in the current org (security definer).

-- One renewal tracking row per (user, course) for version bumps (latest certificate wins).
create unique index if not exists learning_renewals_user_course_uidx
  on public.learning_certification_renewals (user_id, course_id);

-- ---------------------------------------------------------------------------
-- learning_mark_certs_for_renewal
-- ---------------------------------------------------------------------------

create or replace function public.learning_mark_certs_for_renewal(p_course_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;

  insert into public.learning_certification_renewals (
    organization_id, user_id, course_id, certificate_id, expires_at, status
  )
  select distinct on (c.user_id, c.course_id)
    c.organization_id,
    c.user_id,
    c.course_id,
    c.id,
    now(),
    'expired'
  from public.learning_certificates c
  where c.course_id = p_course_id
    and c.organization_id = v_org
  order by c.user_id, c.course_id, c.issued_at desc
  on conflict (user_id, course_id) do update set
    certificate_id = excluded.certificate_id,
    expires_at = excluded.expires_at,
    status = excluded.status;
end;
$$;

grant execute on function public.learning_mark_certs_for_renewal(text) to authenticated;

-- ---------------------------------------------------------------------------
-- learning_delete_user_data (GDPR Art. 17)
-- ---------------------------------------------------------------------------

create or replace function public.learning_delete_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = v_caller;
  if v_org is null then
    raise exception 'No organization';
  end if;

  if v_caller <> p_user_id and not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_user_id and p.organization_id = v_org
  ) then
    raise exception 'User not in organization';
  end if;

  delete from public.learning_certification_renewals where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_certificates where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_course_completion_audit where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_course_progress where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_quiz_reviews where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_module_assignments where assigned_to_user_id = p_user_id and organization_id = v_org;
  delete from public.learning_external_certificates where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_ilt_rsvps where user_id = p_user_id;
  delete from public.learning_ilt_attendance where user_id = p_user_id;
  delete from public.learning_streaks where user_id = p_user_id and organization_id = v_org;
  delete from public.learning_path_enrollments where user_id = p_user_id;
end;
$$;

grant execute on function public.learning_delete_user_data(uuid) to authenticated;
