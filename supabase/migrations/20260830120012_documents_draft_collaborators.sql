-- Documents collaboration — Phase 2.4: per-page draft collaborators.
-- Why: when a page is in draft, the author often wants to bring in specific
-- colleagues (a manager, the verneombud) to comment before publishing. The
-- existing wiki_space_access_grants only operates at the space level — too
-- coarse. This table lets the author add named collaborators to a single
-- draft.
--
-- Once published, page visibility falls back to space grants — collaborators
-- don't carry over because every org member with space-read can see the
-- page anyway.

create table if not exists public.wiki_page_draft_collaborators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'contributor'
    check (role in ('reviewer', 'contributor')),
  invited_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, user_id)
);

create index if not exists wiki_page_draft_collab_org_idx
  on public.wiki_page_draft_collaborators (organization_id, page_id);
create index if not exists wiki_page_draft_collab_user_idx
  on public.wiki_page_draft_collaborators (user_id, page_id);

alter table public.wiki_page_draft_collaborators enable row level security;

-- Anyone in the org who can manage the page (author, admin, documents.edit)
-- can list collaborators. The named collaborator can also see their own row.
drop policy if exists "wiki_draft_collab_select" on public.wiki_page_draft_collaborators;
create policy "wiki_draft_collab_select"
  on public.wiki_page_draft_collaborators for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

-- Inserts: admin, documents.manage, or documents.edit (page authors).
drop policy if exists "wiki_draft_collab_insert" on public.wiki_page_draft_collaborators;
create policy "wiki_draft_collab_insert"
  on public.wiki_page_draft_collaborators for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_draft_collab_delete" on public.wiki_page_draft_collaborators;
create policy "wiki_draft_collab_delete"
  on public.wiki_page_draft_collaborators for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

-- 2. Additive RLS on wiki_pages: a named draft collaborator can read the
--    page even if they wouldn't otherwise see it via space grants. Existing
--    SELECT policies on wiki_pages stay in place; Postgres OR-combines all
--    SELECT policies, so this widens visibility for the specific user
--    without weakening the other rules. -----------------------------------

drop policy if exists "wiki_pages_select_draft_collaborator" on public.wiki_pages;
create policy "wiki_pages_select_draft_collaborator"
  on public.wiki_pages for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and status = 'draft'
    and exists (
      select 1
      from public.wiki_page_draft_collaborators c
      where c.page_id = public.wiki_pages.id
        and c.user_id = auth.uid()
    )
  );

-- Same additive policy for wiki_page_comments so the collaborator can see
-- the discussion they were invited to.
drop policy if exists "wiki_page_comments_select_draft_collaborator" on public.wiki_page_comments;
create policy "wiki_page_comments_select_draft_collaborator"
  on public.wiki_page_comments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (is_confidential is false or author_id = auth.uid())
    and exists (
      select 1
      from public.wiki_page_draft_collaborators c
      where c.page_id = public.wiki_page_comments.page_id
        and c.user_id = auth.uid()
    )
  );
