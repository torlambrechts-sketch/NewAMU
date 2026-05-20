-- Security hardening: close the last two advisor findings that touch
-- cross-tenant exposure.
--
-- 1. reporting_compliance_score_mv (advisor: materialized_view_in_api).
--    A materialized view cannot enforce RLS, and this one carries a per-org
--    `score` row for every organization with no row filter. `authenticated`
--    still held SELECT, so any signed-in user could read every tenant's
--    compliance score. Nothing in the app or edge functions reads the
--    matview (verified by grep) and it has no DB dependents, so SELECT is
--    revoked from anon, authenticated and PUBLIC outright. The view and its
--    data remain for whatever refreshes it; should a dashboard need it
--    later, expose it through a security-definer accessor filtered by
--    current_org_id().
--
-- 2. profile_avatars storage bucket (advisor: public_bucket_allows_listing).
--    The SELECT policy on storage.objects was `bucket_id = 'profile_avatars'`
--    with no owner check, so any client could LIST every user's avatar
--    objects. The bucket is public, so image display works through the
--    public object URL without any SELECT policy; the only legitimate list
--    is ProfilePage listing the caller's own folder before replacing an
--    avatar. The policy is narrowed to the caller's own folder, matching the
--    existing insert/update/delete "own" policies.

revoke select on public.reporting_compliance_score_mv from anon, authenticated, public;

drop policy if exists profile_avatars_select_public on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='profile_avatars_select_own'
  ) then
    create policy profile_avatars_select_own
      on storage.objects
      for select
      using (
        bucket_id = 'profile_avatars'
        and auth.uid() is not null
        and (storage.foldername(name))[1] = (auth.uid())::text
      );
  end if;
end$$;
