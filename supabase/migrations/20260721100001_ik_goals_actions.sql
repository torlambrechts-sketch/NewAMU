-- ─────────────────────────────────────────────────────────
-- IK MODULE — HSE GOALS & ACTION PLANS
-- Covers Pillars 4 (goals/KPIs), 5 (action plans), 7 (annual review input)
-- ─────────────────────────────────────────────────────────

-- Pillar 4: HSE Goals
create table if not exists public.ik_hse_goals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year            int not null,
  title           text not null,
  description     text,
  goal_type       text not null default 'lagging',  -- 'lagging'|'leading'
  target_value    numeric,
  target_unit     text,
  law_pillar      text,                              -- 'AML'|'BVL' etc., optional
  owner_id        uuid references auth.users(id),
  owner_name      text,
  status          text not null default 'active',   -- 'active'|'achieved'|'missed'|'cancelled'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.ik_hse_goals enable row level security;
create policy "org members read ik_hse_goals"
  on public.ik_hse_goals for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_hse_goals"
  on public.ik_hse_goals for all
  using (organization_id = public.current_org_id() and public.is_org_admin());
create index if not exists ik_hse_goals_org_year_idx on public.ik_hse_goals(organization_id, year);

-- Pillar 4: Goal measurements (timeseries)
create table if not exists public.ik_hse_goal_measurements (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.ik_hse_goals(id) on delete cascade,
  measured_at date not null,
  value       numeric not null,
  note        text,
  recorded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
alter table public.ik_hse_goal_measurements enable row level security;
create policy "org members read ik_hse_goal_measurements"
  on public.ik_hse_goal_measurements for select
  using (
    exists (
      select 1 from public.ik_hse_goals g
      where g.id = goal_id and g.organization_id = public.current_org_id()
    )
  );
create policy "org admins manage ik_hse_goal_measurements"
  on public.ik_hse_goal_measurements for all
  using (
    exists (
      select 1 from public.ik_hse_goals g
      where g.id = goal_id and g.organization_id = public.current_org_id()
      and public.is_org_admin()
    )
  );

-- Pillar 5: Unified action plans (cross-source)
create table if not exists public.ik_action_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  description     text,
  source          text not null default 'manual',   -- 'manual'|'ros'|'avvik'|'inspection'|'annual_review'
  source_id       uuid,                             -- FK to source row (loosely typed)
  law_pillar      text,
  priority        text not null default 'medium',   -- 'critical'|'high'|'medium'|'low'
  status          text not null default 'open',     -- 'open'|'in_progress'|'completed'|'cancelled'
  due_date        date,
  assigned_to     uuid references auth.users(id),
  assigned_name   text,
  completed_at    timestamptz,
  completed_by    uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.ik_action_plans enable row level security;
create policy "org members read ik_action_plans"
  on public.ik_action_plans for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_action_plans"
  on public.ik_action_plans for all
  using (organization_id = public.current_org_id() and public.is_org_admin());
create index if not exists ik_action_plans_org_idx on public.ik_action_plans(organization_id);
create index if not exists ik_action_plans_status_idx on public.ik_action_plans(status);
create index if not exists ik_action_plans_due_idx on public.ik_action_plans(due_date);
