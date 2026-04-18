-- Split profile UPDATE policies: own row always updatable; org admin can update peers.
-- Fixes silent RLS failures on PATCH /profiles when the combined policy was hard to satisfy.

drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_peer_by_org_admin"
  on public.profiles for update
  to authenticated
  using (
    id <> auth.uid()
    and exists (
      select 1
      from public.profiles as admin
      where admin.id = auth.uid()
        and coalesce(admin.is_org_admin, false) = true
        and admin.organization_id is not null
        and admin.organization_id = profiles.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles as admin
      where admin.id = auth.uid()
        and coalesce(admin.is_org_admin, false) = true
        and admin.organization_id is not null
        and admin.organization_id = profiles.organization_id
    )
  );
