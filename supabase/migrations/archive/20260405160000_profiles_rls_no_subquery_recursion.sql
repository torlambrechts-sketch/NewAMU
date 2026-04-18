-- Replace EXISTS(subquery on profiles) in policies — that re-enters RLS and causes
-- "infinite recursion detected in policy for relation profiles".
-- Use SECURITY DEFINER helpers (current_org_id, is_org_admin) instead.

drop policy if exists "profiles_select_peers_same_org" on public.profiles;

create policy "profiles_select_peers_same_org"
  on public.profiles for select
  using (
    organization_id is not null
    and public.current_org_id() is not null
    and organization_id = public.current_org_id()
  );

drop policy if exists "profiles_update_peer_by_org_admin" on public.profiles;

create policy "profiles_update_peer_by_org_admin"
  on public.profiles for update
  to authenticated
  using (
    id <> auth.uid()
    and coalesce(public.is_org_admin(), false)
    and public.current_org_id() is not null
    and organization_id = public.current_org_id()
  )
  with check (
    coalesce(public.is_org_admin(), false)
    and public.current_org_id() is not null
    and organization_id = public.current_org_id()
  );
