-- Documents collaboration — Phase 2.2: documents ↔ avvik bridge.
-- Why: deviations.source_id is uuid, wiki_pages.id is text. We can't store
-- the page id in source_id directly. The clean fix is a join table that
-- records the link, plus a back-pointer on wiki_page_comments so the UI can
-- find the auto-created deviation row.
--
-- For high/critical avvik proposals (kind='avvik_proposal', severity in
-- ('high','critical')) we auto-create a `deviations` row on insert via a
-- trigger and record the bridge. Lower severities (and `kind='comment'`)
-- can be promoted manually via the UI — same insert path, just user-driven.

-- 1. Back-pointer on the comment ---------------------------------------------

alter table public.wiki_page_comments
  add column if not exists linked_avvik_id uuid null
    references public.deviations (id) on delete set null;

create index if not exists wiki_page_comments_avvik_idx
  on public.wiki_page_comments (linked_avvik_id)
  where linked_avvik_id is not null;

-- 2. Bridge table -------------------------------------------------------------

create table if not exists public.wiki_page_avvik_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  deviation_id uuid not null references public.deviations (id) on delete cascade,
  source_comment_id uuid null references public.wiki_page_comments (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, deviation_id)
);

create index if not exists wiki_page_avvik_links_org_idx
  on public.wiki_page_avvik_links (organization_id, page_id);

alter table public.wiki_page_avvik_links enable row level security;

-- Visibility follows documents.view; the deviation row itself is org-scoped
-- via its own RLS so this link is safe to expose to any reader.
drop policy if exists "wiki_avvik_links_select" on public.wiki_page_avvik_links;
create policy "wiki_avvik_links_select"
  on public.wiki_page_avvik_links for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

-- Inserts: any documents.view user — they're already authenticated to write
-- a comment. RLS on `deviations` separately controls whether they can read
-- the linked row.
drop policy if exists "wiki_avvik_links_insert" on public.wiki_page_avvik_links;
create policy "wiki_avvik_links_insert"
  on public.wiki_page_avvik_links for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.user_has_permission('documents.view')
  );

-- Deletes: org admin + documents.manage only (avvik cleanup is privileged).
drop policy if exists "wiki_avvik_links_delete" on public.wiki_page_avvik_links;
create policy "wiki_avvik_links_delete"
  on public.wiki_page_avvik_links for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- 3. Trigger: auto-create a deviation for high/critical avvik proposals ------

create or replace function public.wiki_page_comments_create_avvik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_title text;
  v_dev_id uuid;
  v_severity public.inspection_finding_severity;
begin
  if new.kind <> 'avvik_proposal' or new.severity is null then
    return new;
  end if;
  if new.severity not in ('high', 'critical') then
    return new;
  end if;
  if new.linked_avvik_id is not null then
    return new;
  end if;

  -- Map our local severity enum (text) to the deviations enum.
  v_severity := new.severity::public.inspection_finding_severity;

  select wp.title into v_page_title from public.wiki_pages wp where wp.id = new.page_id;
  v_page_title := coalesce(v_page_title, 'Ukjent dokument');

  insert into public.deviations (
    organization_id,
    source,
    source_id,
    title,
    description,
    severity,
    status,
    created_by
  )
  values (
    new.organization_id,
    'wiki_page',
    null,                                            -- text page id stored in bridge table
    'Avvik foreslått: ' || left(v_page_title, 80),
    new.body,
    v_severity,
    'rapportert',
    new.author_id
  )
  returning id into v_dev_id;

  insert into public.wiki_page_avvik_links (organization_id, page_id, deviation_id, source_comment_id)
  values (new.organization_id, new.page_id, v_dev_id, new.id)
  on conflict (page_id, deviation_id) do nothing;

  -- Stamp the back-pointer on the comment row. We use a direct update here
  -- (the trigger fires AFTER insert) so the original insert keeps the
  -- author's permission check; the update is privileged via security definer.
  update public.wiki_page_comments
    set linked_avvik_id = v_dev_id
    where id = new.id;

  return new;
end;
$$;

revoke all on function public.wiki_page_comments_create_avvik() from public;

drop trigger if exists wiki_page_comments_avvik_after_insert on public.wiki_page_comments;
create trigger wiki_page_comments_avvik_after_insert
  after insert on public.wiki_page_comments
  for each row execute function public.wiki_page_comments_create_avvik();
