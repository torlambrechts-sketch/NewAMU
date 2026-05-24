-- SECURITY DEFINER aggregator returning the auth metadata an org-admin
-- needs to render the Brukere-tabellen (Klarert Admin → Brukere):
-- last sign-in time, whether the user has a verified MFA factor, and
-- whether the account was created via an SSO provider.
--
-- auth.users is not selectable by `authenticated` so this function is
-- the only way the admin shell can surface MFA / SSO indicators
-- without sending the service-role key to the browser.
--
-- Authorization: caller must be a member of the org AND either
-- is_org_admin OR have users.manage permission. Returns an empty set
-- when unauthorized (RLS-style) so the UI degrades to "—" instead
-- of surfacing an error.

create or replace function public.users_admin_overview()
returns table (
  user_id uuid,
  last_sign_in_at timestamptz,
  has_verified_mfa boolean,
  is_sso boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null then
    return;
  end if;

  if not (public.is_org_admin() or public.user_has_permission('users.manage')) then
    return;
  end if;

  return query
    select
      p.id as user_id,
      u.last_sign_in_at,
      exists (
        select 1 from auth.mfa_factors mf
        where mf.user_id = p.id
          and mf.status = 'verified'
      ) as has_verified_mfa,
      coalesce(
        (u.raw_app_meta_data->>'provider') is not null
          and (u.raw_app_meta_data->>'provider') <> 'email',
        false
      ) as is_sso
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.organization_id = v_org;
end;
$$;

revoke all on function public.users_admin_overview() from public;
grant execute on function public.users_admin_overview() to authenticated;

comment on function public.users_admin_overview() is
  'Admin-only aggregator over auth.users + auth.mfa_factors. Gated to org-admin or users.manage permission. Returns auth metadata for every profile in the caller org. RLS-style: returns empty set instead of raising when unauthorized.';
