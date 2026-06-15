-- Strategy v2 — Wave 0: foundation, pillars, workspace settings, nudge prefs.
--
-- Coverage gap closed:
--   First slice of porting the full "Strategy v2" design beyond the Tools group.
--   Adds the shared "strategy core" tables every later view builds on:
--     * strategy_pillars            — the 4 balanced-scorecard perspectives
--     * strategy_foundation          — vision / mission / ambition / values / intent
--                                      (one row per org; replaces the design's
--                                      localStorage klarert_foundation_v1)
--     * strategy_workspace_settings  — active framework, branding, module toggles,
--                                      dashboard layout (one row per org)
--     * strategy_nudge_prefs         — cadence-engine nudge preferences (one/org)
--   Plus columns the OKR layer needs so Objectives/Strategy-map/Alignment can
--   render the design's pillar-grouped scorecard on real data:
--     * okr_objectives.pillar_code + catchball_state
--     * okr_key_results.start_value + kr_type + direction
--
--   provision_strategy_baseline_for_org seeds the 4 pillars + a default
--   settings/nudge/foundation row, idempotently, on first view.
--
-- Self-audit (Arbeidstilsynet POV):
--   * IK-f § 5 nr. 4 (fastsette mål): strategy_foundation gir skriftlig
--     dokumentasjon av visjon/ambisjon/verdier som rammer HMS-/virksomhetsmålene.
--   * Restrisiko: innholdet er fritekst/jsonb og kobles ennå ikke til okr_plans;
--     pillar_code er fri tekst (ingen FK) for å unngå hard kobling før
--     pillar-redigering finnes i UI.
--
-- Idempotens: CREATE TABLE/INDEX IF NOT EXISTS; ADD COLUMN IF NOT EXISTS;
--   DROP POLICY/TRIGGER IF EXISTS; provision seeds only when absent; backfill loop.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. strategy_pillars — balanced-scorecard perspectives
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_pillars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,                       -- 'fin' | 'cus' | 'pro' | 'peo' (or custom)
  name text not null,
  mission_question text not null default '',
  color text not null default '#1a3d32',
  soft_color text not null default '#e7efe9',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
comment on table public.strategy_pillars is
  'Strategy perspectives (balanced scorecard). 4 seeded per org; objectives/initiatives reference by pillar_code.';
create index if not exists strategy_pillars_org_idx on public.strategy_pillars (organization_id, position);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. strategy_foundation — vision / mission / ambition / values / intent (1/org)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_foundation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vision_text text not null default '',
  vision_tag text not null default '',
  mission_title text not null default '',
  mission_body text not null default '',
  ambition_title text not null default '',
  ambition_stats jsonb not null default '[]'::jsonb,   -- [{big,unit,label}]
  values jsonb not null default '[]'::jsonb,            -- [{t,b}]
  intent_lead text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);
comment on table public.strategy_foundation is
  'The strategic "golden thread" for an org: vision, mission, ambition (+stats), values, strategic intent. One row per org.';
comment on column public.strategy_foundation.ambition_stats is 'jsonb [{big,unit,label}] — headline ambition numbers.';
comment on column public.strategy_foundation.values is 'jsonb [{t,b}] — value title + blurb.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. strategy_workspace_settings — framework / branding / modules (1/org)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_workspace_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active_framework text not null default 'okr',     -- okr | bsc | 4dx | hoshin
  enforce_framework boolean not null default false,
  allow_mixed boolean not null default true,
  accent_color text not null default '#1a3d32',
  logo_path text,
  modules_enabled jsonb not null default '{"strategy":true,"reviews":true,"checkins":true,"reporting":true,"frameworks":true,"assessments":true}'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,  -- [{label,type,applies,options}]
  dashboard_layout jsonb,                            -- widget grid layout
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);
comment on table public.strategy_workspace_settings is
  'Per-org Strategy settings: active framework, branding accent/logo, module toggles, custom fields, dashboard layout.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. strategy_nudge_prefs — cadence nudge preferences (1/org)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_nudge_prefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cap_per_week int not null default 5,
  quiet_hours boolean not null default true,
  quiet_from time not null default '18:00',
  quiet_to time not null default '08:00',
  timezone text not null default 'Europe/Oslo',
  muted text[] not null default '{}',
  channels_on text[] not null default '{IN_APP,EMAIL}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);
comment on table public.strategy_nudge_prefs is
  'Per-org preferences for the check-in / nudge engine (cap, quiet hours, channels).';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Extend OKR tables so the scorecard views render on real data
-- ════════════════════════════════════════════════════════════════════════════
alter table public.okr_objectives add column if not exists pillar_code text;
alter table public.okr_objectives add column if not exists catchball_state text
  check (catchball_state is null or catchball_state in ('proposed','countered','agreed','locked'));
comment on column public.okr_objectives.pillar_code is 'Links an objective to a strategy_pillars.code (plain text — no FK, set per-org).';

alter table public.okr_key_results add column if not exists start_value numeric not null default 0;
alter table public.okr_key_results add column if not exists kr_type text
  check (kr_type is null or kr_type in ('KR','KPI','LEAD','LAG'));
alter table public.okr_key_results add column if not exists direction text
  check (direction is null or direction in ('INCREASE','DECREASE','MAINTAIN'));

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS — read in-org; org members may edit the shared strategy artifacts.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.strategy_pillars            enable row level security;
alter table public.strategy_foundation          enable row level security;
alter table public.strategy_workspace_settings   enable row level security;
alter table public.strategy_nudge_prefs          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['strategy_pillars','strategy_foundation','strategy_workspace_settings','strategy_nudge_prefs']
  loop
    execute format('drop policy if exists %I_select_org on public.%I', t, t);
    execute format('create policy %I_select_org on public.%I for select using (organization_id = public.current_org_id())', t, t);
    execute format('drop policy if exists %I_insert_org on public.%I', t, t);
    execute format('create policy %I_insert_org on public.%I for insert with check (organization_id = public.current_org_id())', t, t);
    execute format('drop policy if exists %I_update_org on public.%I', t, t);
    execute format('create policy %I_update_org on public.%I for update using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t, t);
    execute format('drop policy if exists %I_delete_admin on public.%I', t, t);
    execute format('create policy %I_delete_admin on public.%I for delete using (organization_id = public.current_org_id() and public.is_org_admin())', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Triggers — stamp org on insert + updated_at (reuse shared helpers)
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['strategy_pillars','strategy_foundation','strategy_workspace_settings','strategy_nudge_prefs']
  loop
    execute format('drop trigger if exists %I_before_insert_tg on public.%I', t, t);
    execute format('create trigger %I_before_insert_tg before insert on public.%I for each row execute function public.strategy_tools_child_before_insert()', t, t);
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. provision_strategy_baseline_for_org — seed pillars + singleton rows
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public._strategy_seed_baseline(v_org uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if v_org is null then return; end if;

  -- 4 balanced-scorecard pillars (idempotent on (org, code)).
  insert into public.strategy_pillars (organization_id, code, name, mission_question, color, soft_color, position) values
    (v_org, 'fin', 'Financial',  'How do we look to those who fund us?',            '#2f5d8a', '#e3ecf5', 1),
    (v_org, 'cus', 'Customer',   'How do the people we serve see us?',              '#3f7d5a', '#e1efe7', 2),
    (v_org, 'pro', 'Process',    'What must we excel at internally?',               '#b8862f', '#f6ecd6', 3),
    (v_org, 'peo', 'People',     'How do we sustain our ability to improve?',       '#a8553a', '#f2e2db', 4)
  on conflict (organization_id, code) do nothing;

  -- Singleton rows (foundation / settings / nudge prefs) — create empty if absent.
  insert into public.strategy_foundation (organization_id) values (v_org)
    on conflict (organization_id) do nothing;
  insert into public.strategy_workspace_settings (organization_id) values (v_org)
    on conflict (organization_id) do nothing;
  insert into public.strategy_nudge_prefs (organization_id) values (v_org)
    on conflict (organization_id) do nothing;
end; $$;

create or replace function public.provision_strategy_baseline_for_org(p_org_id uuid default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_org uuid;
begin
  v_org := coalesce(p_org_id, public.current_org_id());
  if v_org is null then return; end if;
  if v_org <> public.current_org_id() and not public.is_org_admin() then return; end if;
  perform public._strategy_seed_baseline(v_org);
end; $$;

comment on function public.provision_strategy_baseline_for_org(uuid) is
  'Idempotently seeds the 4 strategy pillars + default foundation/settings/nudge-prefs rows for an org.';
revoke all on function public._strategy_seed_baseline(uuid) from public;
revoke all on function public.provision_strategy_baseline_for_org(uuid) from public;
grant execute on function public.provision_strategy_baseline_for_org(uuid) to authenticated;

-- Backfill for existing organisations.
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform public._strategy_seed_baseline(v_org);
  end loop;
end $$;
