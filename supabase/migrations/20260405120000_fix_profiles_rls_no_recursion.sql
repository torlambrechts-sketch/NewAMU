-- Fix PostgREST 500 on GET /profiles: single policy with OR + subquery on same table
-- can cause PostgreSQL RLS infinite recursion. Split into self vs peers.

drop policy if exists "profiles_select_org" on public.profiles;

create policy "profiles_select_self"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_select_peers_same_org"
  on public.profiles for select
  using (
    organization_id is not null
    and exists (
      select 1
      from public.profiles as viewer
      where viewer.id = auth.uid()
        and viewer.organization_id is not null
        and viewer.organization_id = profiles.organization_id
    )
  );
