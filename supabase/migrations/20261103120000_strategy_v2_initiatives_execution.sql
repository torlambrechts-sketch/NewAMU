-- Strategy v2 — Wave 2: the execution spine (initiatives + risks + deps + RACI).
--
-- Coverage gap closed:
--   The Execution group (Initiatives, Kanban, Timeline, Roadmap, Projects) and
--   the Insight group (Health, Dependencies, RACI) all hang off a single new
--   concept the app lacked: a strategic INITIATIVE — a funded piece of work that
--   delivers an objective, with an owner, stage, health, progress, budget,
--   timeline, team, dependencies and risks.
--
--   Adds:
--     * strategy_initiatives        — the initiative itself
--     * strategy_initiative_members  — team roster (replaces design team[])
--     * strategy_initiative_deps      — prerequisite graph (replaces depends[])
--     * strategy_initiative_tasks     — link initiatives ↔ existing task_items
--     * strategy_risks                — risks attached to an initiative
--     * strategy_initiative_raci      — per-initiative R/A/C/I (distinct from the
--                                       plan-level okr_raci role matrix)
--     * task_items.is_blocked         — the design's "blocked" task state without
--                                       touching the shared 9-state status enum
--   provision_strategy_initiatives_for_org seeds a worked 12-initiative portfolio
--   (+ risks, deps, RACI) so the Execution/Insight views render populated.
--
-- Self-audit (Arbeidstilsynet POV):
--   * IK-f § 5 nr. 6 (tiltak/handlingsplaner): initiatives + risks dokumenterer
--     hvilke tiltak som er satt i verk, eier, status og restrisiko.
--   * Sporbarhet: dependencies + RACI gjør ansvar og avhengigheter etterprøvbare.
--   * Restrisiko: seed-porteføljen er eksempeldata (Pundit Invest) til
--     demonstrasjon; objective_id er nullbar inntil objektiv-kobling finnes i UI.
--
-- Idempotens: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP ... IF EXISTS;
--   seed only when no initiatives exist for the org; backfill loop.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. strategy_initiatives
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_initiatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,                              -- STR-01 …
  title text not null,
  summary text not null default '',
  pillar_code text,                               -- → strategy_pillars.code
  objective_id uuid references public.okr_objectives(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  stage text not null default 'backlog'
    check (stage in ('backlog','planned','active','review','done')),
  health text not null default 'on'
    check (health in ('on','risk','off','done')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  start_month int check (start_month is null or (start_month >= 0 and start_month <= 11)),
  end_month int check (end_month is null or (end_month >= 0 and end_month <= 11)),
  budget numeric not null default 0,
  spent numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.strategy_initiatives is
  'A strategic initiative: funded work delivering an objective. Drives the Execution + Insight views.';
create index if not exists strategy_initiatives_org_idx
  on public.strategy_initiatives (organization_id, stage, created_at desc) where deleted_at is null;
create index if not exists strategy_initiatives_pillar_idx
  on public.strategy_initiatives (organization_id, pillar_code) where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. team members / dependencies / task links / risks / raci
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.strategy_initiative_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.strategy_initiatives(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  member_name text,
  created_at timestamptz not null default now(),
  unique (initiative_id, member_user_id)
);
create index if not exists strategy_initiative_members_ini_idx on public.strategy_initiative_members (initiative_id);

create table if not exists public.strategy_initiative_deps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.strategy_initiatives(id) on delete cascade,
  depends_on_initiative_id uuid not null references public.strategy_initiatives(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (initiative_id, depends_on_initiative_id),
  check (initiative_id <> depends_on_initiative_id)
);
create index if not exists strategy_initiative_deps_ini_idx on public.strategy_initiative_deps (initiative_id);

create table if not exists public.strategy_initiative_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.strategy_initiatives(id) on delete cascade,
  task_item_id uuid not null references public.task_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (initiative_id, task_item_id)
);
create index if not exists strategy_initiative_tasks_ini_idx on public.strategy_initiative_tasks (initiative_id);
create index if not exists strategy_initiative_tasks_task_idx on public.strategy_initiative_tasks (task_item_id);

create table if not exists public.strategy_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid references public.strategy_initiatives(id) on delete cascade,
  title text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  likelihood int not null default 2 check (likelihood >= 1 and likelihood <= 3),
  impact int not null default 2 check (impact >= 1 and impact <= 3),
  status text not null default 'open' check (status in ('open','watch','closed')),
  mitigation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_risks_org_idx on public.strategy_risks (organization_id);
create index if not exists strategy_risks_ini_idx on public.strategy_risks (initiative_id);

create table if not exists public.strategy_initiative_raci (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.strategy_initiatives(id) on delete cascade,
  person_user_id uuid references auth.users(id) on delete set null,
  person_name text,
  role char(1) not null check (role in ('R','A','C','I')),
  created_at timestamptz not null default now()
);
create index if not exists strategy_initiative_raci_ini_idx on public.strategy_initiative_raci (initiative_id);

-- the design's "blocked" task state, without touching the 9-state status enum
alter table public.task_items add column if not exists is_blocked boolean not null default false;
comment on column public.task_items.is_blocked is
  'Strategy v2 board "blocked" flag — orthogonal to the 9-state status (a task can be in_progress AND blocked).';

-- cross-org guard for the dependency graph (both initiatives same org as the row)
create or replace function public.strategy_initiative_deps_validate()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare a uuid; b uuid;
begin
  select organization_id into a from public.strategy_initiatives where id = new.initiative_id;
  select organization_id into b from public.strategy_initiatives where id = new.depends_on_initiative_id;
  if a is null or a <> new.organization_id or b is null or b <> new.organization_id then
    raise exception 'Dependency must link two initiatives in the same org as the row.';
  end if;
  return new;
end; $$;
drop trigger if exists strategy_initiative_deps_validate_tg on public.strategy_initiative_deps;
create trigger strategy_initiative_deps_validate_tg before insert or update on public.strategy_initiative_deps
  for each row execute function public.strategy_initiative_deps_validate();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RLS — read in-org; owner/creator/admin write on initiatives; org members
--    manage children of initiatives they can see (kept simple + org-scoped).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.strategy_initiatives        enable row level security;
alter table public.strategy_initiative_members  enable row level security;
alter table public.strategy_initiative_deps      enable row level security;
alter table public.strategy_initiative_tasks     enable row level security;
alter table public.strategy_risks                enable row level security;
alter table public.strategy_initiative_raci      enable row level security;

drop policy if exists strategy_initiatives_select_org on public.strategy_initiatives;
create policy strategy_initiatives_select_org on public.strategy_initiatives for select
  using (organization_id = public.current_org_id() and deleted_at is null);
drop policy if exists strategy_initiatives_insert_org on public.strategy_initiatives;
create policy strategy_initiatives_insert_org on public.strategy_initiatives for insert
  with check (organization_id = public.current_org_id());
drop policy if exists strategy_initiatives_update_owner on public.strategy_initiatives;
create policy strategy_initiatives_update_owner on public.strategy_initiatives for update
  using (organization_id = public.current_org_id() and (created_by = auth.uid() or owner_user_id = auth.uid() or public.is_org_admin()))
  with check (organization_id = public.current_org_id());
drop policy if exists strategy_initiatives_delete_owner on public.strategy_initiatives;
create policy strategy_initiatives_delete_owner on public.strategy_initiatives for delete
  using (organization_id = public.current_org_id() and (created_by = auth.uid() or owner_user_id = auth.uid() or public.is_org_admin()));

-- child tables: read in-org; write requires org membership (org-scoped check).
do $$
declare t text;
begin
  foreach t in array array['strategy_initiative_members','strategy_initiative_deps','strategy_initiative_tasks','strategy_risks','strategy_initiative_raci']
  loop
    execute format('drop policy if exists %I_select_org on public.%I', t, t);
    execute format('create policy %I_select_org on public.%I for select using (organization_id = public.current_org_id())', t, t);
    execute format('drop policy if exists %I_modify_org on public.%I', t, t);
    execute format('create policy %I_modify_org on public.%I for all using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Triggers
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.strategy_initiatives_before_insert()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end; $$;
drop trigger if exists strategy_initiatives_before_insert_tg on public.strategy_initiatives;
create trigger strategy_initiatives_before_insert_tg before insert on public.strategy_initiatives
  for each row execute function public.strategy_initiatives_before_insert();
drop trigger if exists strategy_initiatives_set_updated_at on public.strategy_initiatives;
create trigger strategy_initiatives_set_updated_at before update on public.strategy_initiatives
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['strategy_initiative_members','strategy_initiative_deps','strategy_initiative_tasks','strategy_risks','strategy_initiative_raci']
  loop
    execute format('drop trigger if exists %I_before_insert_tg on public.%I', t, t);
    execute format('create trigger %I_before_insert_tg before insert on public.%I for each row execute function public.strategy_tools_child_before_insert()', t, t);
  end loop;
end $$;
drop trigger if exists strategy_risks_set_updated_at on public.strategy_risks;
create trigger strategy_risks_set_updated_at before update on public.strategy_risks
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Seed a worked 12-initiative portfolio (+ risks, deps, RACI)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public._strategy_seed_initiatives(v_org uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  iid uuid;
begin
  if v_org is null then return; end if;
  if exists (select 1 from public.strategy_initiatives where organization_id = v_org) then return; end if;

  insert into public.strategy_initiatives
    (organization_id, key, title, summary, pillar_code, owner_name, stage, health, progress, start_month, end_month, budget, spent) values
    (v_org,'STR-01','Nordic mid-market expansion','Open advisory desks in Stockholm and Copenhagen.','cus','Ola Hansen','active','on',62,0,8,4200000,2300000),
    (v_org,'STR-02','Wealth platform 2.0','Replace the legacy platform; self-serve + SMB ready.','pro','Henrik Dahl','active','risk',45,1,11,6800000,3600000),
    (v_org,'STR-03','SMB advisory tier','Launch a productised advisory tier for SMB owners.','cus','Mette Berg','planned','on',20,3,9,1500000,180000),
    (v_org,'STR-04','ESG / Article-9 fund range','Bring an Article-9 fund range to market.','fin','Kari Nilsen','active','on',55,0,6,900000,520000),
    (v_org,'STR-05','Automated KYC onboarding','Cut onboarding from 11 days to 5 via automation.','pro','Henrik Dahl','active','on',70,1,5,1200000,840000),
    (v_org,'STR-06','SOC 2 + DORA readiness','Close the remaining controls for SOC 2 and DORA.','pro','Ingrid Vik','review','on',88,0,3,700000,610000),
    (v_org,'STR-07','Fee restructuring','Move to a transparent tiered fee model.','fin','Kari Nilsen','planned','risk',15,4,7,300000,40000),
    (v_org,'STR-08','Advisor academy','Onboarding + development academy for advisors.','peo','Sofie Lind','active','on',40,2,10,650000,250000),
    (v_org,'STR-09','Data warehouse consolidation','One consolidated, governed data warehouse.','pro','Henrik Dahl','active','risk',35,1,9,2100000,820000),
    (v_org,'STR-10','Client portal redesign','Modern, accessible client portal.','cus','Jonas Ruud','backlog','on',5,5,11,1100000,0),
    (v_org,'STR-11','Scale investment team 16 → 24','Grow the investment team to 24 FTE.','peo','Sofie Lind','active','on',50,0,11,3400000,1700000),
    (v_org,'STR-12','Quarterly review coverage to 95%','Lift quarterly portfolio-review coverage to 95%.','cus','Ola Hansen','active','on',60,0,11,200000,110000);

  -- a few dependencies (by key lookups)
  insert into public.strategy_initiative_deps (organization_id, initiative_id, depends_on_initiative_id)
  select v_org,
    (select id from public.strategy_initiatives where organization_id=v_org and key=d.a),
    (select id from public.strategy_initiatives where organization_id=v_org and key=d.b)
  from (values ('STR-01','STR-05'),('STR-03','STR-02'),('STR-04','STR-06'),('STR-01','STR-02'),('STR-12','STR-05')) as d(a,b)
  on conflict do nothing;

  -- risks attached to a few initiatives
  insert into public.strategy_risks (organization_id, initiative_id, title, owner_name, likelihood, impact, status, mitigation)
  values
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-02'),'Platform migration slips','Henrik Dahl',3,3,'open','Phased cutover + dual-run; weekly steerco.'),
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-09'),'Data quality blocks reporting','Henrik Dahl',2,3,'open','Data contracts + validation gates.'),
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-07'),'Fee change hurts retention','Kari Nilsen',2,3,'watch','Grandfather existing clients; comms plan.'),
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-01'),'Talent scarcity in new desks','Ola Hansen',2,2,'open','Advisor academy pipeline; relocation support.'),
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-04'),'SFDR classification risk','Ingrid Vik',1,3,'watch','External legal review before launch.'),
    (v_org,(select id from public.strategy_initiatives where organization_id=v_org and key='STR-11'),'Hiring pace below plan','Sofie Lind',2,2,'open','Two retained search partners; referral bonus.');

  -- a little initiative-level RACI
  insert into public.strategy_initiative_raci (organization_id, initiative_id, person_name, role)
  select v_org, (select id from public.strategy_initiatives where organization_id=v_org and key=r.k), r.p, r.role
  from (values
    ('STR-01','Ola Hansen','A'),('STR-01','Mette Berg','C'),
    ('STR-02','Henrik Dahl','A'),('STR-02','Tor Lambrechts','I'),
    ('STR-05','Henrik Dahl','A'),('STR-06','Ingrid Vik','A')
  ) as r(k,p,role);
end; $$;

create or replace function public.provision_strategy_initiatives_for_org(p_org_id uuid default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_org uuid;
begin
  v_org := coalesce(p_org_id, public.current_org_id());
  if v_org is null then return; end if;
  if v_org <> public.current_org_id() and not public.is_org_admin() then return; end if;
  perform public._strategy_seed_initiatives(v_org);
end; $$;

comment on function public.provision_strategy_initiatives_for_org(uuid) is
  'Idempotently seeds a worked 12-initiative portfolio (+ risks, deps, RACI) for an org.';
revoke all on function public._strategy_seed_initiatives(uuid) from public;
revoke all on function public.provision_strategy_initiatives_for_org(uuid) from public;
grant execute on function public.provision_strategy_initiatives_for_org(uuid) to authenticated;

do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform public._strategy_seed_initiatives(v_org);
  end loop;
end $$;
