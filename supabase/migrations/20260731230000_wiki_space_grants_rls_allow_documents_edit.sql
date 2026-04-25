-- Allow users with documents.edit (not only documents.manage) to manage folder access grants.
-- Without this, INSERT into wiki_space_access_grants fails RLS for document editors.

drop policy if exists "wiki_space_access_grants_select_manage" on public.wiki_space_access_grants;
create policy "wiki_space_access_grants_select_manage"
  on public.wiki_space_access_grants for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_access_grants_insert_manage" on public.wiki_space_access_grants;
create policy "wiki_space_access_grants_insert_manage"
  on public.wiki_space_access_grants for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_access_grants_delete_manage" on public.wiki_space_access_grants;
create policy "wiki_space_access_grants_delete_manage"
  on public.wiki_space_access_grants for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

-- Optional: allow editors to update capability flags on an existing grant row.
drop policy if exists "wiki_space_access_grants_update_manage" on public.wiki_space_access_grants;
create policy "wiki_space_access_grants_update_manage"
  on public.wiki_space_access_grants for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );
