-- Wiki editor presence + receipt lookup index

-- ---------------------------------------------------------------------------
-- 1. wiki_page_presence — collaborative awareness (who has editor open)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_page_presence (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null references public.wiki_pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index if not exists wiki_page_presence_org_seen_idx
  on public.wiki_page_presence (organization_id, last_seen desc);

alter table public.wiki_page_presence enable row level security;

drop policy if exists "wiki_page_presence_select_org" on public.wiki_page_presence;
create policy "wiki_page_presence_select_org"
  on public.wiki_page_presence for select
  using (organization_id = public.current_org_id());

drop policy if exists "wiki_page_presence_upsert_own" on public.wiki_page_presence;
create policy "wiki_page_presence_upsert_own"
  on public.wiki_page_presence for insert
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "wiki_page_presence_update_own" on public.wiki_page_presence;
create policy "wiki_page_presence_update_own"
  on public.wiki_page_presence for update
  using (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists "wiki_page_presence_delete_own" on public.wiki_page_presence;
create policy "wiki_page_presence_delete_own"
  on public.wiki_page_presence for delete
  using (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 2. Receipt index (user + page + version lookups)
-- ---------------------------------------------------------------------------

create index if not exists wiki_receipts_user_page_idx
  on public.wiki_compliance_receipts (user_id, page_id, page_version);

-- ---------------------------------------------------------------------------
-- 3. Realtime: wiki_pages for collaborative hints (optional; safe for org RLS)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wiki_pages'
  ) then
    alter publication supabase_realtime add table public.wiki_pages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wiki_page_presence'
  ) then
    alter publication supabase_realtime add table public.wiki_page_presence;
  end if;
end $$;
