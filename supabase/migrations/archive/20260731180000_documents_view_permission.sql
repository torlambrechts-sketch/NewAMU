-- documents.view: viewers can read wiki pages (SELECT) without documents.manage.
-- documents.edit: editors can create/update/archive wiki pages without full template admin (documents.manage).
-- Seed: grant view + edit to every role that already has documents.manage.

insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'documents.view'
from public.role_permissions rp
where rp.permission_key = 'documents.manage'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select rp.role_id, 'documents.edit'
from public.role_permissions rp
where rp.permission_key = 'documents.manage'
on conflict do nothing;

-- wiki_pages_select_org references PII columns — ensure they exist if PII migration was skipped
alter table public.wiki_pages
  add column if not exists contains_pii boolean not null default false,
  add column if not exists pii_categories text[] not null default '{}',
  add column if not exists pii_legal_basis text,
  add column if not exists pii_retention_note text;

-- Extend wiki_pages SELECT (after wiki_space_access_grants policy) so documents.view matches documents.manage read paths.
drop policy if exists "wiki_pages_select_org" on public.wiki_pages;

create policy "wiki_pages_select_org"
  on public.wiki_pages for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      exists (
        select 1
        from public.wiki_spaces s
        where s.id = wiki_pages.space_id
          and s.organization_id = wiki_pages.organization_id
          and (
            s.restricted_permission is null
            or public.is_org_admin()
            or public.user_has_permission('documents.manage')
            or public.user_has_permission('documents.edit')
            or public.user_has_permission('documents.view')
            or public.user_has_permission(s.restricted_permission)
          )
          and (
            not exists (
              select 1
              from public.wiki_space_access_grants g0
              where g0.organization_id = s.organization_id
                and g0.space_id = s.id
            )
            or public.is_org_admin()
            or public.user_has_permission('documents.manage')
            or public.user_has_permission('documents.edit')
            or public.user_has_permission('documents.view')
            or exists (
              select 1
              from public.wiki_space_access_grants g
              where g.organization_id = s.organization_id
                and g.space_id = s.id
                and (
                  (g.grant_type = 'user' and g.subject_id = auth.uid()::text)
                  or (
                    g.grant_type = 'department'
                    and exists (
                      select 1
                      from public.profiles pr
                      where pr.id = auth.uid()
                        and pr.department_id is not null
                        and g.subject_id = pr.department_id::text
                    )
                  )
                  or (
                    g.grant_type = 'team'
                    and exists (
                      select 1
                      from public.profiles pr
                      join public.organization_members om
                        on om.organization_id = pr.organization_id
                        and lower(trim(coalesce(om.email, ''))) = lower(trim(coalesce(pr.email, '')))
                      where pr.id = auth.uid()
                        and om.team_id is not null
                        and g.subject_id = om.team_id::text
                    )
                  )
                )
            )
          )
      )
      or (
        wiki_pages.status = 'published'
        and exists (
          select 1
          from public.wiki_spaces s
          where s.id = wiki_pages.space_id
            and s.organization_id = wiki_pages.organization_id
            and coalesce(s.is_amu_space, false)
        )
      )
    )
    and (
      not coalesce(wiki_pages.contains_pii, false)
      or not (
        wiki_pages.pii_categories && array['helse', 'fagforeningsmedlemskap', 'etnisitet']::text[]
      )
      or public.user_has_permission('hr.sensitive')
      or public.is_org_admin()
      or public.user_has_permission('amu.member')
    )
  );

-- wiki_pages write: editors (documents.edit) or full admin (documents.manage)
drop policy if exists "wiki_pages_insert_manage" on public.wiki_pages;
create policy "wiki_pages_insert_manage"
  on public.wiki_pages for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_pages_update_manage" on public.wiki_pages;
create policy "wiki_pages_update_manage"
  on public.wiki_pages for update
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

-- Publish creates version snapshots
drop policy if exists "wiki_page_versions_insert_manage" on public.wiki_page_versions;
create policy "wiki_page_versions_insert_manage"
  on public.wiki_page_versions for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

-- Folder files (upload in space panel)
drop policy if exists "wiki_space_items_insert_manage" on public.wiki_space_items;
create policy "wiki_space_items_insert_manage"
  on public.wiki_space_items for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_items_update_manage" on public.wiki_space_items;
create policy "wiki_space_items_update_manage"
  on public.wiki_space_items for update
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_items_delete_manage" on public.wiki_space_items;
create policy "wiki_space_items_delete_manage"
  on public.wiki_space_items for delete
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_files_insert_own_org" on storage.objects;
create policy "wiki_space_files_insert_own_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_space_files_delete_manage" on storage.objects;
create policy "wiki_space_files_delete_manage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_audit_insert" on public.wiki_audit_ledger;
create policy "wiki_audit_insert"
  on public.wiki_audit_ledger for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      (
        public.is_org_admin()
        or public.user_has_permission('documents.manage')
        or public.user_has_permission('documents.edit')
      )
      or (user_id = auth.uid() and action = 'acknowledged')
      or (user_id = auth.uid() and action = 'annual_review_completed')
    )
  );
