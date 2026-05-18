-- ISO IMS — foundation tables.
--
-- Three tables that underpin the ISO IMS module (src/pages/iso/):
--
--   1. organization_iso_settings  — per-org control plane: which standards
--      are active and certification targets. Drives IsoSettingsPage.tsx and
--      acts as the trigger surface for activating compliance packs from the
--      IMS settings shortcut (Model C in the plan).
--
--   2. iso_standard_clauses — read-only catalogue of all auditable clauses
--      for the four standards (9001 / 14001 / 27001 / 45001). Seeded in
--      20260914100008_iso_clauses_seed.sql. The gap analysis session page
--      walks this list.
--
--   3. iso_gap_analysis_sessions / iso_gap_analysis_responses — one session
--      per (org, standard, run). Responses record a 0-3 maturity rating per
--      clause; score_pct is computed on completion.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. organization_iso_settings ─────────────────────────────────────────────

create table if not exists public.organization_iso_settings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  -- Which standards the org is actively working with. Valid values:
  -- 'iso-9001', 'iso-14001', 'iso-27001', 'iso-45001'.
  -- Activating a standard here also activates the corresponding compliance
  -- pack (handled by IsoSettingsPage calling activatePack on the frontend).
  active_standards      text[] not null default '{}',
  -- Sparse JSONB map: standard → {target_date text, certifying_body text}
  -- e.g. '{"iso-9001": {"target_date": "2027-06-01", "certifying_body": "DNV"}}'
  certification_targets jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id)
);

comment on column public.organization_iso_settings.active_standards is
  'Standards the org is actively working toward. Front-end reads this to decide
   which ISO modules, register types, and compliance packs to surface.';

comment on column public.organization_iso_settings.certification_targets is
  'Per-standard certification metadata: {standard: {target_date, certifying_body}}.
   Purely informational; not validated by DB constraints.';

alter table public.organization_iso_settings enable row level security;

drop policy if exists iso_settings_select on public.organization_iso_settings;
create policy iso_settings_select on public.organization_iso_settings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists iso_settings_write on public.organization_iso_settings;
create policy iso_settings_write on public.organization_iso_settings
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

drop trigger if exists iso_settings_set_updated_at on public.organization_iso_settings;
create trigger iso_settings_set_updated_at
  before update on public.organization_iso_settings
  for each row execute function public.set_updated_at();

-- ── 2. iso_standard_clauses ───────────────────────────────────────────────────

create table if not exists public.iso_standard_clauses (
  id          text primary key,            -- 'iso-9001:4.1'
  standard    text not null,               -- 'iso-9001'
  clause_id   text not null,              -- '4.1'
  title       text not null,
  description text,
  parent_id   text references public.iso_standard_clauses (id),
  is_leaf     boolean not null default true, -- false = section heading; gap analysis only scores leaves
  position    integer not null default 0,
  unique (standard, clause_id)
);

comment on table public.iso_standard_clauses is
  'Read-only catalogue of auditable clauses for ISO 9001/14001/27001/45001.
   Seeded by 20260914100008_iso_clauses_seed.sql. The gap analysis session
   page (IsoGapAnalysisSessionPage.tsx) walks this list.';

-- No RLS needed — clauses are system-level public data, not org-scoped.
-- The select policy grants read to all authenticated users.
alter table public.iso_standard_clauses enable row level security;

drop policy if exists iso_standard_clauses_select on public.iso_standard_clauses;
create policy iso_standard_clauses_select on public.iso_standard_clauses
  for select to authenticated
  using (true);

-- ── 3. iso_gap_analysis_sessions ─────────────────────────────────────────────

create table if not exists public.iso_gap_analysis_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  standard        text not null,         -- 'iso-9001' | 'iso-14001' | 'iso-27001' | 'iso-45001'
  title           text not null,
  status          text not null default 'in_progress',  -- 'in_progress' | 'completed'
  -- 0-100 integer, null until completed. Computed as (count of responses
  -- with rating >= 2) / (count of leaf clauses) * 100.
  score_pct       integer check (score_pct between 0 and 100),
  completed_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.iso_gap_analysis_sessions.score_pct is
  'Computed on completion: (clauses rated >=2) / (total leaf clauses) * 100.
   Null while in_progress. Feeds the iso_gap_score_* kpi widgets on the IMS
   composite dashboard.';

alter table public.iso_gap_analysis_sessions enable row level security;

drop policy if exists iso_gap_sessions_select on public.iso_gap_analysis_sessions;
create policy iso_gap_sessions_select on public.iso_gap_analysis_sessions
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists iso_gap_sessions_write on public.iso_gap_analysis_sessions;
create policy iso_gap_sessions_write on public.iso_gap_analysis_sessions
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

drop trigger if exists iso_gap_sessions_set_updated_at on public.iso_gap_analysis_sessions;
create trigger iso_gap_sessions_set_updated_at
  before update on public.iso_gap_analysis_sessions
  for each row execute function public.set_updated_at();

create index if not exists iso_gap_sessions_org_standard_idx
  on public.iso_gap_analysis_sessions (organization_id, standard, status);

-- ── 4. iso_gap_analysis_responses ────────────────────────────────────────────

create table if not exists public.iso_gap_analysis_responses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id      uuid not null references public.iso_gap_analysis_sessions (id) on delete cascade,
  clause_id       text not null,   -- references iso_standard_clauses.clause_id; soft FK (text)
  -- Maturity rating:
  --   0 = not started / no evidence
  --   1 = partial / in progress
  --   2 = implemented (evidence available)
  --   3 = verified (independently audited / certified)
  rating          integer not null default 0 check (rating between 0 and 3),
  notes           text,
  task_ids        uuid[] not null default '{}',  -- linked CAPA task IDs from the tasks module
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, clause_id)
);

comment on column public.iso_gap_analysis_responses.rating is
  '0=not started, 1=partial, 2=implemented, 3=verified.
   Ratings >=2 count toward score_pct on the parent session.';

comment on column public.iso_gap_analysis_responses.task_ids is
  'UUIDs of tasks created from this gap response via "Opprett tiltak".
   Soft reference — tasks module owns the rows.';

alter table public.iso_gap_analysis_responses enable row level security;

drop policy if exists iso_gap_responses_select on public.iso_gap_analysis_responses;
create policy iso_gap_responses_select on public.iso_gap_analysis_responses
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists iso_gap_responses_write on public.iso_gap_analysis_responses;
create policy iso_gap_responses_write on public.iso_gap_analysis_responses
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

drop trigger if exists iso_gap_responses_set_updated_at on public.iso_gap_analysis_responses;
create trigger iso_gap_responses_set_updated_at
  before update on public.iso_gap_analysis_responses
  for each row execute function public.set_updated_at();

create index if not exists iso_gap_responses_session_idx
  on public.iso_gap_analysis_responses (session_id);
