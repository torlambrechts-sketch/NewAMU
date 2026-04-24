-- Per-folder grant capabilities: read, create, write, archive, delete.
-- Existing rows get can_read=true, others false (matches previous implicit behaviour).

alter table public.wiki_space_access_grants
  add column if not exists can_read boolean not null default true,
  add column if not exists can_create boolean not null default false,
  add column if not exists can_write boolean not null default false,
  add column if not exists can_archive boolean not null default false,
  add column if not exists can_delete boolean not null default false;

comment on column public.wiki_space_access_grants.can_read is
  'When folder has grants: subject may SELECT wiki_pages in this space.';
comment on column public.wiki_space_access_grants.can_create is
  'When folder has grants: subject may INSERT wiki_pages in this space.';
comment on column public.wiki_space_access_grants.can_write is
  'When folder has grants: subject may UPDATE wiki_pages (content/metadata).';
comment on column public.wiki_space_access_grants.can_archive is
  'When folder has grants: subject may set page status to archived.';
comment on column public.wiki_space_access_grants.can_delete is
  'When folder has grants: subject may DELETE wiki_pages in this space.';

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — grant table RLS must not block policy checks)
-- ---------------------------------------------------------------------------

create or replace function public.wiki_space_grant_subject_matches(p_grant_type text, p_subject_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_grant_type
    when 'user' then p_subject_id = auth.uid()::text
    when 'department' then exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.organization_id = public.current_org_id()
        and pr.department_id is not null
        and pr.department_id::text = p_subject_id
    )
    when 'team' then exists (
      select 1
      from public.profiles pr
      join public.organization_members om
        on om.organization_id = pr.organization_id
        and lower(trim(coalesce(om.email, ''))) = lower(trim(coalesce(pr.email, '')))
      where pr.id = auth.uid()
        and pr.organization_id = public.current_org_id()
        and om.team_id is not null
        and om.team_id::text = p_subject_id
    )
    else false
  end;
$$;

create or replace function public.wiki_space_has_access_grants(p_organization_id uuid, p_space_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wiki_space_access_grants g
    where g.organization_id = p_organization_id
      and g.space_id = p_space_id
  );
$$;

create or replace function public.wiki_space_grant_allows_op(p_organization_id uuid, p_space_id text, p_op text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wiki_space_access_grants g
    where g.organization_id = p_organization_id
      and g.space_id = p_space_id
      and public.wiki_space_grant_subject_matches(g.grant_type, g.subject_id)
      and (
        (p_op = 'read' and coalesce(g.can_read, true))
        or (p_op = 'create' and g.can_create)
        or (p_op = 'write' and g.can_write)
        or (p_op = 'archive' and g.can_archive)
        or (p_op = 'delete' and g.can_delete)
      )
  );
$$;

-- Subject has any write-side flag (for editors who should see the folder without explicit read)
create or replace function public.wiki_space_grant_allows_any_write_op(p_organization_id uuid, p_space_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wiki_space_access_grants g
    where g.organization_id = p_organization_id
      and g.space_id = p_space_id
      and public.wiki_space_grant_subject_matches(g.grant_type, g.subject_id)
      and (g.can_create or g.can_write or g.can_archive or g.can_delete)
  );
$$;

-- ---------------------------------------------------------------------------
-- wiki_pages SELECT (align with documents.view/edit + folder grant flags)
-- ---------------------------------------------------------------------------

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
            not public.wiki_space_has_access_grants(s.organization_id, s.id)
            or public.is_org_admin()
            or public.user_has_permission('documents.manage')
            or public.wiki_space_grant_allows_op(s.organization_id, s.id, 'read')
            or (
              public.user_has_permission('documents.view')
              and public.wiki_space_grant_allows_op(s.organization_id, s.id, 'read')
            )
            or (
              public.user_has_permission('documents.edit')
              and (
                public.wiki_space_grant_allows_op(s.organization_id, s.id, 'read')
                or public.wiki_space_grant_allows_any_write_op(s.organization_id, s.id)
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

-- ---------------------------------------------------------------------------
-- wiki_pages INSERT / UPDATE / DELETE
-- ---------------------------------------------------------------------------

drop policy if exists "wiki_pages_insert_manage" on public.wiki_pages;
create policy "wiki_pages_insert_manage"
  on public.wiki_pages for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or (
        public.user_has_permission('documents.edit')
        and (
          not public.wiki_space_has_access_grants(organization_id, space_id)
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'create')
        )
      )
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'create')
    )
  );

drop policy if exists "wiki_pages_update_manage" on public.wiki_pages;
create policy "wiki_pages_update_manage"
  on public.wiki_pages for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or (
        public.user_has_permission('documents.edit')
        and (
          not public.wiki_space_has_access_grants(organization_id, space_id)
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'write')
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'archive')
        )
      )
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'write')
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'archive')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or (
        public.user_has_permission('documents.edit')
        and (
          not public.wiki_space_has_access_grants(organization_id, space_id)
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'write')
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'archive')
        )
      )
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'write')
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'archive')
    )
  );

drop policy if exists "wiki_pages_delete_manage" on public.wiki_pages;
create policy "wiki_pages_delete_manage"
  on public.wiki_pages for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or (
        public.user_has_permission('documents.edit')
        and (
          not public.wiki_space_has_access_grants(organization_id, space_id)
          or public.wiki_space_grant_allows_op(organization_id, space_id, 'delete')
        )
      )
      or public.wiki_space_grant_allows_op(organization_id, space_id, 'delete')
    )
  );
