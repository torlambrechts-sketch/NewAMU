-- Page Layouts: DB-backed layout config for any page in the app.
-- Each row is a named page (page_key) + sections JSONB + published flag.
-- Admins read/write their own rows; all authenticated users can read published rows.

create table if not exists public.page_layouts (
  id          uuid        primary key default gen_random_uuid(),
  page_key    text        not null,                     -- e.g. "hse.vernerunder"
  sections    jsonb       not null default '[]'::jsonb,  -- PageLayoutSection[]
  published   boolean     not null default false,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Useful indexes
create index if not exists page_layouts_page_key_published_idx
  on public.page_layouts (page_key, published, updated_at desc);

create index if not exists page_layouts_created_by_idx
  on public.page_layouts (created_by);

-- Trigger: keep updated_at fresh on every update
create or replace function public.set_page_layouts_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_page_layouts_updated_at on public.page_layouts;
create trigger trg_page_layouts_updated_at
  before update on public.page_layouts
  for each row execute function public.set_page_layouts_updated_at();

-- RLS
alter table public.page_layouts enable row level security;

-- Any authenticated user can read published layouts.
create policy "page_layouts_read_published"
  on public.page_layouts
  for select
  using (
    published = true
    and auth.role() = 'authenticated'
  );

-- Platform admins can read ALL layouts (including drafts) for their org.
-- We piggyback on the same "is_platform_admin" check used elsewhere.
create policy "page_layouts_admin_read_all"
  on public.page_layouts
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Admins can insert new layouts.
create policy "page_layouts_admin_insert"
  on public.page_layouts
  for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Admins can update any layout row.
create policy "page_layouts_admin_update"
  on public.page_layouts
  for update
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Admins can delete layout rows.
create policy "page_layouts_admin_delete"
  on public.page_layouts
  for delete
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Enable Realtime so the page auto-refreshes when an admin publishes a layout.
alter publication supabase_realtime add table public.page_layouts;
