-- Dashboard layouts — per-org persisted analytics layouts.
--
-- Each row stores ONE saved dashboard for ONE scope (e.g.
-- 'compliance_checklist'). The layout is a jsonb array of ReportModule
-- objects, matching the shape used by ReportModulesGrid + the new
-- dashboardRegistry. A scope can have many saved dashboards (e.g.
-- "Standard", "Vernerunder fokus", "Fysisk arbeidsmiljø") — `is_default`
-- marks which one to load on first visit, and `slug` makes deep-links
-- like /compliance/checklists/analyse?dashboard=vernerunder possible.
--
-- Ownership model — kept lean for v1:
--   - Every row is org-scoped via organization_id (RLS).
--   - `owner_user_id` null = shared org-wide; not-null = personal copy.
--     Phase 2 only reads/writes shared layouts; per-user layouts arrive
--     when the editor lands and we want save-as-private.
--
-- Optimistic concurrency via `version`, identical pattern to
-- report_definitions (the older custom-report stack).

set local search_path = public, pg_catalog;

create table if not exists public.dashboard_layouts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  /** Stable scope id from dashboardRegistry — e.g. 'compliance_checklist'. */
  scope_id        text not null,
  /** URL-safe slug; UNIQUE per (org, scope, owner). */
  slug            text not null default 'default',
  /** Display name shown in the dashboard chooser. */
  name            text not null default 'Standard',
  description     text,
  /** Array of ReportModule objects. */
  layout          jsonb not null default '[]'::jsonb,
  /** Persisted filter state (chips). */
  filters         jsonb not null default '[]'::jsonb,
  /** Null = shared with the whole org; not-null = personal layout. */
  owner_user_id   uuid references auth.users (id) on delete cascade,
  /** Used to pick which layout to load when no explicit slug is requested. */
  is_default      boolean not null default false,
  /** Optimistic-locking version, bumped on every successful update. */
  version         integer not null default 1,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, scope_id, slug, owner_user_id)
);

create index if not exists dashboard_layouts_org_scope_idx
  on public.dashboard_layouts (organization_id, scope_id, owner_user_id, is_default desc, updated_at desc)
  where deleted_at is null;

alter table public.dashboard_layouts enable row level security;

drop policy if exists dashboard_layouts_select_org on public.dashboard_layouts;
create policy dashboard_layouts_select_org
  on public.dashboard_layouts for select
  using (
    organization_id = public.current_org_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  );

drop policy if exists dashboard_layouts_write_org on public.dashboard_layouts;
create policy dashboard_layouts_write_org
  on public.dashboard_layouts for all
  using (
    organization_id = public.current_org_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  )
  with check (
    organization_id = public.current_org_id()
    and (owner_user_id is null or owner_user_id = auth.uid())
  );

create or replace function public.dashboard_layouts_before_insert_defaults()
returns trigger
language plpgsql
as $$
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

drop trigger if exists dashboard_layouts_before_insert_defaults_tg
  on public.dashboard_layouts;
create trigger dashboard_layouts_before_insert_defaults_tg
  before insert on public.dashboard_layouts
  for each row execute function public.dashboard_layouts_before_insert_defaults();

create or replace function public.dashboard_layouts_before_update()
returns trigger
language plpgsql
as $$
begin
  -- bump version on real changes (skip when nothing material moved)
  if new.layout is distinct from old.layout
     or new.filters is distinct from old.filters
     or new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.is_default is distinct from old.is_default then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dashboard_layouts_before_update_tg
  on public.dashboard_layouts;
create trigger dashboard_layouts_before_update_tg
  before update on public.dashboard_layouts
  for each row execute function public.dashboard_layouts_before_update();
