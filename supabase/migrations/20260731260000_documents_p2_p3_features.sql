-- P2/P3: review workflow, comments, nested spaces, page views, backlinks, mention notifications.
-- Aligns with existing schema: organization_id, wiki page/space ids as text.

-- ---------------------------------------------------------------------------
-- 1. wiki_pages: review gate (P2.1)
-- ---------------------------------------------------------------------------

alter table public.wiki_pages
  add column if not exists review_required boolean not null default false;

alter table public.wiki_pages
  add column if not exists reviewer_id uuid null references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. wiki_review_requests (P2.1)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  page_version int not null,
  requester_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  reviewer_comment text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists wiki_review_req_org_status_idx
  on public.wiki_review_requests (organization_id, status);

create index if not exists wiki_review_req_reviewer_idx
  on public.wiki_review_requests (reviewer_id, status);

alter table public.wiki_review_requests enable row level security;

drop policy if exists "wiki_review_req_select" on public.wiki_review_requests;
create policy "wiki_review_req_select"
  on public.wiki_review_requests for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      requester_id = auth.uid()
      or reviewer_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_review_req_insert" on public.wiki_review_requests;
create policy "wiki_review_req_insert"
  on public.wiki_review_requests for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and requester_id = auth.uid()
  );

drop policy if exists "wiki_review_req_update" on public.wiki_review_requests;
create policy "wiki_review_req_update"
  on public.wiki_review_requests for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      reviewer_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  )
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- 3. wiki_page_comments (P2.5)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_page_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  block_index int not null,
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wiki_page_comments_page_idx
  on public.wiki_page_comments (page_id, created_at desc);

alter table public.wiki_page_comments enable row level security;

drop policy if exists "wiki_page_comments_select" on public.wiki_page_comments;
create policy "wiki_page_comments_select"
  on public.wiki_page_comments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

drop policy if exists "wiki_page_comments_insert" on public.wiki_page_comments;
create policy "wiki_page_comments_insert"
  on public.wiki_page_comments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and author_id = auth.uid()
    and public.user_has_permission('documents.view')
  );

drop policy if exists "wiki_page_comments_update" on public.wiki_page_comments;
create policy "wiki_page_comments_update"
  on public.wiki_page_comments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      author_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  )
  with check (organization_id = public.current_org_id());

drop policy if exists "wiki_page_comments_delete" on public.wiki_page_comments;
create policy "wiki_page_comments_delete"
  on public.wiki_page_comments for delete
  to authenticated
  using (organization_id = public.current_org_id() and author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. wiki_spaces: nested folders (P2.6)
-- ---------------------------------------------------------------------------

alter table public.wiki_spaces
  add column if not exists parent_space_id text null references public.wiki_spaces (id) on delete set null;

create index if not exists wiki_spaces_parent_idx on public.wiki_spaces (parent_space_id);

create or replace function public.wiki_space_depth_from_root(p_id text)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  d int := 1;
  cur text := p_id;
  parent text;
begin
  loop
    select s.parent_space_id into parent
    from public.wiki_spaces s
    where s.id = cur;
    exit when not found;
    exit when parent is null;
    d := d + 1;
    if d > 10 then
      return 99;
    end if;
    cur := parent;
  end loop;
  return d;
end;
$$;

create or replace function public.wiki_spaces_enforce_parent_depth()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_space_id is not null then
    if public.wiki_space_depth_from_root(new.parent_space_id) >= 3 then
      raise exception 'Maksimalt 3 nivåer av mapper er tillatt';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wiki_spaces_parent_depth on public.wiki_spaces;
create trigger wiki_spaces_parent_depth
  before insert or update of parent_space_id on public.wiki_spaces
  for each row execute function public.wiki_spaces_enforce_parent_depth();

-- ---------------------------------------------------------------------------
-- 5. wiki_page_views (P3.2)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_page_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists wiki_page_views_page_time_idx
  on public.wiki_page_views (page_id, viewed_at desc);

alter table public.wiki_page_views enable row level security;

drop policy if exists "wiki_page_views_insert" on public.wiki_page_views;
create policy "wiki_page_views_insert"
  on public.wiki_page_views for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "wiki_page_views_select_admin" on public.wiki_page_views;
create policy "wiki_page_views_select_admin"
  on public.wiki_page_views for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  );

drop function if exists public.wiki_org_page_view_counts(uuid);

create or replace function public.wiki_org_page_view_counts(p_organization_id uuid)
returns table (page_id text, unique_viewers bigint, views_last_30 bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    v.page_id::text,
    count(distinct v.user_id)::bigint as unique_viewers,
    count(*) filter (where v.viewed_at > (now() - interval '30 days'))::bigint as views_last_30
  from public.wiki_page_views v
  where v.organization_id = p_organization_id
  group by v.page_id;
$$;

revoke all on function public.wiki_org_page_view_counts(uuid) from public;
grant execute on function public.wiki_org_page_view_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. wiki_page_links backlinks (P3.3)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_page_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_page_id text not null references public.wiki_pages (id) on delete cascade,
  target_page_id text not null references public.wiki_pages (id) on delete cascade,
  unique (source_page_id, target_page_id)
);

create index if not exists wiki_page_links_target_idx on public.wiki_page_links (target_page_id);

alter table public.wiki_page_links enable row level security;

drop policy if exists "wiki_page_links_select" on public.wiki_page_links;
create policy "wiki_page_links_select"
  on public.wiki_page_links for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

drop policy if exists "wiki_page_links_write" on public.wiki_page_links;
create policy "wiki_page_links_write"
  on public.wiki_page_links for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  )
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- 7. wiki_mention_notifications (P3.4) — lightweight in-app feed row
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_mention_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  actor_name text not null,
  page_id text null references public.wiki_pages (id) on delete set null,
  context text not null check (context in ('editor', 'comment')),
  snippet text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists wiki_mention_notif_recipient_idx
  on public.wiki_mention_notifications (recipient_user_id, created_at desc);

alter table public.wiki_mention_notifications enable row level security;

drop policy if exists "wiki_mention_notif_select" on public.wiki_mention_notifications;
create policy "wiki_mention_notif_select"
  on public.wiki_mention_notifications for select
  to authenticated
  using (organization_id = public.current_org_id() and recipient_user_id = auth.uid());

drop policy if exists "wiki_mention_notif_insert" on public.wiki_mention_notifications;
create policy "wiki_mention_notif_insert"
  on public.wiki_mention_notifications for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and actor_user_id = auth.uid()
  );

drop policy if exists "wiki_mention_notif_update" on public.wiki_mention_notifications;
create policy "wiki_mention_notif_update"
  on public.wiki_mention_notifications for update
  to authenticated
  using (organization_id = public.current_org_id() and recipient_user_id = auth.uid())
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- 8. Extend wiki_audit_ledger actions (P2.1)
-- ---------------------------------------------------------------------------

alter table public.wiki_audit_ledger drop constraint if exists wiki_audit_ledger_action_check;
alter table public.wiki_audit_ledger
  add constraint wiki_audit_ledger_action_check
  check (
    action in (
      'created',
      'updated',
      'published',
      'archived',
      'acknowledged',
      'annual_review_completed',
      'submitted_for_review',
      'approved',
      'changes_requested'
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
      or (
        user_id = auth.uid()
        and action in ('submitted_for_review', 'approved', 'changes_requested')
      )
    )
  );
