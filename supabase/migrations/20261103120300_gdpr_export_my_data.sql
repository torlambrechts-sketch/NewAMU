-- GDPR self-service data export (H3.8)
--
-- Gap closed: no Art. 15/20 self-service — users had to email an admin to
-- learn what the platform stores about them. gdpr_export_my_data() returns
-- the caller's own data as one jsonb document: profile, org membership,
-- functional roles, and tasks where they are assignee/owner. Content-free
-- beyond the caller's own rows; runs as the caller's identity check inside
-- a security-definer function (auth.uid() scoping on every branch).
--
-- Self-audit: GDPR Art. 15 (innsyn) + Art. 20 (dataportabilitet) for the
-- core personal-data surfaces. Restrisiko: module-specific traces (meeting
-- attendance, check-ins, comments) are not yet included — extend the jsonb
-- branches as modules are reviewed; deletion requests remain an admin flow.
--
-- usage: select gdpr_export_my_data();

create or replace function public.gdpr_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select to_jsonb(p) - 'id'
        from (
          select pr.display_name, pr.email, pr.locale, pr.created_at
            from public.profiles pr where pr.id = v_uid
        ) p
    ),
    'organization', (
      select jsonb_build_object('name', o.name, 'joined_via_profile', true)
        from public.profiles pr
        join public.organizations o on o.id = pr.organization_id
       where pr.id = v_uid
    ),
    'functional_roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', a.role_slug,
        'valid_from', a.valid_from,
        'valid_to', a.valid_to
      ) order by a.valid_from)
        from public.org_functional_role_assignments a
       where a.user_id = v_uid
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', t.title,
        'status', t.status,
        'role', case when t.assignee_user_id = v_uid then 'assignee' else 'owner' end,
        'due_date', t.due_date,
        'created_at', t.created_at
      ) order by t.created_at desc)
        from public.task_items t
       where (t.assignee_user_id = v_uid or t.owner_user_id = v_uid)
         and t.deleted_at is null
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.gdpr_export_my_data() to authenticated;
