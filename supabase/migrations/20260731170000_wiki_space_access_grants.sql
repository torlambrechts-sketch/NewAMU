-- Folder-level access grants (user / department / team) for wiki spaces.
-- When a space has at least one row in wiki_space_access_grants, only matching
-- subjects (plus org admins and documents.manage) may read pages in that space,
-- in addition to existing restricted_permission and PII rules.

-- ---------------------------------------------------------------------------
-- 1. wiki_space_access_grants
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_space_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  space_id text not null references public.wiki_spaces (id) on delete cascade,
  grant_type text not null check (grant_type in ('user', 'department', 'team')),
  subject_id text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, space_id, grant_type, subject_id)
);

create index if not exists wiki_space_access_grants_org_space_idx
  on public.wiki_space_access_grants (organization_id, space_id);

comment on table public.wiki_space_access_grants is
  'Optional allow-list per folder: when rows exist for a space, only listed users/departments/teams (plus org admin / documents.manage) satisfy the wiki_pages SELECT policy for that space.';

alter table public.wiki_space_access_grants enable row level security;

drop policy if exists "wiki_space_access_grants_select_manage" on public.wiki_space_access_grants;
create policy "wiki_space_access_grants_select_manage"
  on public.wiki_space_access_grants for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
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
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Ensure wiki_spaces columns exist before policies reference them
--    (is_amu_space from AMU migration; restricted_permission from PII/RLS chain)
-- ---------------------------------------------------------------------------

alter table public.wiki_spaces
  add column if not exists is_amu_space boolean not null default false;

alter table public.wiki_spaces
  add column if not exists restricted_permission text;

-- ---------------------------------------------------------------------------
-- 3. wiki_pages SELECT — honor folder grant allow-list
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
