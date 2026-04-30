-- Repair: wiki_pages_select_org may reference wiki_spaces columns that do not exist
-- yet on databases where AMU / PII migrations were skipped or applied out of order.
-- Safe to run multiple times (IF NOT EXISTS + DROP/CREATE policy).

-- ---------------------------------------------------------------------------
-- 1. wiki_space_access_grants (no-op if 20260731170000 already applied fully)
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
-- 2. wiki_spaces columns required by wiki_pages_select_org
-- ---------------------------------------------------------------------------

alter table public.wiki_spaces
  add column if not exists is_amu_space boolean not null default false;

alter table public.wiki_spaces
  add column if not exists restricted_permission text;

-- ---------------------------------------------------------------------------
-- 2b. wiki_pages PII columns (20260630120000 chain) — SELECT policy references them
-- ---------------------------------------------------------------------------

alter table public.wiki_pages
  add column if not exists contains_pii boolean not null default false,
  add column if not exists pii_categories text[] not null default '{}',
  add column if not exists pii_legal_basis text,
  add column if not exists pii_retention_note text;

-- ---------------------------------------------------------------------------
-- 3. Recreate wiki_pages SELECT policy (folder grants + prior RLS semantics)
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
