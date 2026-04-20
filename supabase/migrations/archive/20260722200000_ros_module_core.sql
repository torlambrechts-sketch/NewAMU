-- ─────────────────────────────────────────────────────────────────────────────
-- ROS MODULE — RISIKOVURDERING OG OPPFØLGING
-- Covers IK-forskriften § 5 nr. 6 (risk mapping) across 5 laws.
-- Builds on existing RiskMatrix component (src/components/hse/RiskMatrix.tsx).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ros_analyses ─────────────────────────────────────────────────────────────
create table if not exists public.ros_analyses (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  title               text not null,
  description         text,
  scope               text,                    -- what is being assessed
  location_id         uuid references public.locations(id) on delete set null,
  location_text       text,
  law_domains         text[] not null default '{}', -- ['AML','BVL','ETL','FL','PKL']
  ros_type            text not null default 'general'
                        check (ros_type in ('general','org_change','fire','electrical','chemical','project')),
  status              text not null default 'draft'
                        check (status in ('draft','in_review','approved','archived')),
  version             integer not null default 1,
  parent_id           uuid references public.ros_analyses(id) on delete set null,
  assessor_id         uuid references auth.users(id) on delete set null,
  assessor_name       text,
  assessed_at         date,
  next_review_date    date,
  conclusion          text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── ros_participants ──────────────────────────────────────────────────────────
create table if not exists public.ros_participants (
  id              uuid primary key default gen_random_uuid(),
  ros_id          uuid not null references public.ros_analyses(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null,
  role            text not null default 'participant'
                    check (role in ('responsible','verneombud','participant','observer')),
  created_at      timestamptz not null default now()
);

-- ── ros_hazards ───────────────────────────────────────────────────────────────
create table if not exists public.ros_hazards (
  id                      uuid primary key default gen_random_uuid(),
  ros_id                  uuid not null references public.ros_analyses(id) on delete cascade,
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  description             text not null,
  category                text,                -- 'physical','chemical','ergonomic','psychosocial','fire','electrical','environmental'
  law_domain              text not null default 'AML'
                            check (law_domain in ('AML','BVL','ETL','FL','PKL')),
  existing_controls       text,
  initial_probability     integer check (initial_probability between 1 and 5),
  initial_consequence     integer check (initial_consequence between 1 and 5),
  residual_probability    integer check (residual_probability between 1 and 5),
  residual_consequence    integer check (residual_consequence between 1 and 5),
  -- Computed columns (application-level, not DB-generated to stay PG12-compatible)
  chemical_ref            text,                -- stoffkartotek reference (future link)
  action_plan_id          uuid references public.ik_action_plans(id) on delete set null,
  position                integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── ros_measures ─────────────────────────────────────────────────────────────
create table if not exists public.ros_measures (
  id               uuid primary key default gen_random_uuid(),
  ros_id           uuid not null references public.ros_analyses(id) on delete cascade,
  hazard_id        uuid not null references public.ros_hazards(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  description      text not null,
  control_type     text not null default 'administrative'
                     check (control_type in ('eliminate','substitute','engineering','administrative','ppe')),
  assigned_to_id   uuid references auth.users(id) on delete set null,
  assigned_to_name text,
  due_date         date,
  status           text not null default 'open'
                     check (status in ('open','in_progress','completed','cancelled')),
  completed_at     timestamptz,
  is_from_template boolean not null default false,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── ros_signatures ────────────────────────────────────────────────────────────
create table if not exists public.ros_signatures (
  id              uuid primary key default gen_random_uuid(),
  ros_id          uuid not null references public.ros_analyses(id) on delete cascade,
  role            text not null check (role in ('responsible','verneombud','manager')),
  signer_id       uuid references auth.users(id) on delete set null,
  signer_name     text not null,
  signed_at       timestamptz not null default now(),
  unique (ros_id, role)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists ros_analyses_org_idx    on public.ros_analyses(organization_id, status, created_at desc);
create index if not exists ros_hazards_ros_idx     on public.ros_hazards(ros_id, position);
create index if not exists ros_measures_hazard_idx on public.ros_measures(hazard_id);
create index if not exists ros_measures_status_idx on public.ros_measures(status, due_date);
