-- Module saved views — reusable filter-bar state for module list pages
-- (Sjekklister, Avvik, Undersøkelser, etc.). One row = one filter
-- combination an admin or user has named and saved.
--
-- Why org-shared instead of per-user: HMS-admins curate views like
-- "Forfalte vernerunder i Bergen" once and the team consumes them.
-- A separate per-user defaults table tracks which view each user
-- chose as their default landing — so org-shared content + per-user
-- preference, no conflict.
--
-- Closes the gap from the UX review (round-3): saved-view dropdown +
-- star-to-set-default in the data-grid filter bar.

create table if not exists public.module_saved_views (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_slug     text not null,
  name            text not null,
  -- Free-form filter payload. Each module decides its own shape; the
  -- column is a typed contract between the module's filter bar and its
  -- list query. Examples (compliance):
  --   { "categoryIds": ["…"], "statuses": ["pågår"], "templateIds": [] }
  filters         jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, module_slug, name),
  check (length(name) between 1 and 80),
  check (length(module_slug) between 1 and 60)
);

comment on column public.module_saved_views.filters is
  'Module-specific filter payload (jsonb). Shape is defined by the consuming module''s filter bar; no DB-side validation.';

create index if not exists module_saved_views_org_module_idx
  on public.module_saved_views (organization_id, module_slug, name);

alter table public.module_saved_views enable row level security;

drop policy if exists module_saved_views_select_org on public.module_saved_views;
create policy module_saved_views_select_org
  on public.module_saved_views for select
  using (organization_id = public.current_org_id());

-- Any authenticated org member can create + edit saved views. Views
-- are deliberately shared chrome, not personal — if you don't want
-- yours visible to colleagues, don't save it. Module-admin gating
-- (e.g. only HMS-ansvarlig can curate) is a future refinement.
drop policy if exists module_saved_views_insert_member on public.module_saved_views;
create policy module_saved_views_insert_member
  on public.module_saved_views for insert
  with check (organization_id = public.current_org_id());

drop policy if exists module_saved_views_update_creator on public.module_saved_views;
create policy module_saved_views_update_creator
  on public.module_saved_views for update
  using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  )
  with check (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  );

drop policy if exists module_saved_views_delete_creator on public.module_saved_views;
create policy module_saved_views_delete_creator
  on public.module_saved_views for delete
  using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  );

create or replace function public.module_saved_views_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists module_saved_views_before_insert_defaults_tg on public.module_saved_views;
create trigger module_saved_views_before_insert_defaults_tg
  before insert on public.module_saved_views
  for each row execute function public.module_saved_views_before_insert_defaults();

drop trigger if exists module_saved_views_set_updated_at on public.module_saved_views;
create trigger module_saved_views_set_updated_at
  before update on public.module_saved_views
  for each row execute function public.set_updated_at();

-- Per-user, per-module default selection. The view itself is org-shared;
-- the "this is my landing view" preference is yours alone. One default
-- per user per module — toggling another star moves the bookmark.
create table if not exists public.module_saved_view_defaults (
  user_id       uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_slug   text not null,
  view_id       uuid not null references public.module_saved_views (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, organization_id, module_slug)
);

create index if not exists module_saved_view_defaults_view_idx
  on public.module_saved_view_defaults (view_id);

alter table public.module_saved_view_defaults enable row level security;

drop policy if exists module_saved_view_defaults_select_self on public.module_saved_view_defaults;
create policy module_saved_view_defaults_select_self
  on public.module_saved_view_defaults for select
  using (user_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists module_saved_view_defaults_upsert_self on public.module_saved_view_defaults;
create policy module_saved_view_defaults_upsert_self
  on public.module_saved_view_defaults for insert
  with check (user_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists module_saved_view_defaults_update_self on public.module_saved_view_defaults;
create policy module_saved_view_defaults_update_self
  on public.module_saved_view_defaults for update
  using (user_id = auth.uid() and organization_id = public.current_org_id())
  with check (user_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists module_saved_view_defaults_delete_self on public.module_saved_view_defaults;
create policy module_saved_view_defaults_delete_self
  on public.module_saved_view_defaults for delete
  using (user_id = auth.uid() and organization_id = public.current_org_id());

create or replace function public.module_saved_view_defaults_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists module_saved_view_defaults_before_insert_tg on public.module_saved_view_defaults;
create trigger module_saved_view_defaults_before_insert_tg
  before insert on public.module_saved_view_defaults
  for each row execute function public.module_saved_view_defaults_before_insert();
