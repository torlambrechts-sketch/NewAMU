-- Strategy v2 — Wave 5: the signal layer (cadence + measures + org graph).
--
-- Coverage gap closed: the remaining design surfaces (Check-ins, Reviews,
-- Decision log, Data sources, Dashboard, Accountability, My work, Alignment)
-- all hang off live signals the app lacked. Adds 12 org-scoped tables:
--   strategy_data_sources, strategy_measures, strategy_measure_readings,
--   strategy_checkins, strategy_nudges, strategy_reviews, strategy_review_items,
--   strategy_decision_log, strategy_teams, strategy_team_members,
--   strategy_objective_edges, strategy_role_charters
-- + provision_strategy_signal_for_org seeding a modest worked set so the views
-- render populated. RLS + triggers reuse the shared helpers.
--
-- Self-audit (Arbeidstilsynet POV): check-ins + decision log give a traceable
-- cadence/decision record (IK-f § 5 nr. 8 systematisk overvåking + gjennomgang);
-- charters document accountability. Restrisiko: measures/sources are demo seeds;
-- nudge dispatch is not wired to a real channel yet.
--
-- Idempotens: IF NOT EXISTS / DROP IF EXISTS; seed guarded by NOT EXISTS; backfill.

set local search_path = public, pg_catalog;

-- ── data sources ───────────────────────────────────────────────────────────
create table if not exists public.strategy_data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'Spreadsheet',
  source_code text not null default 'MANUAL',
  status text not null default 'available' check (status in ('connected','error','available')),
  last_sync_at timestamptz,
  missed_runs int not null default 0,
  detail text not null default '',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── measures + readings ──────────────────────────────────────────────────────
create table if not exists public.strategy_measures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective_id uuid references public.okr_objectives(id) on delete set null,
  key_result_id uuid references public.okr_key_results(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  measure_type text not null default 'KPI' check (measure_type in ('KR','KPI','LEAD','LAG')),
  direction text not null default 'INCREASE' check (direction in ('INCREASE','DECREASE','MAINTAIN')),
  unit text not null default '',
  start_value numeric not null default 0,
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  source_id uuid references public.strategy_data_sources(id) on delete set null,
  cadence_days int not null default 30,
  confidence int not null default 3 check (confidence between 1 and 5),
  guardrail_threshold numeric,
  guardrail_breached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_measures_org_idx on public.strategy_measures (organization_id);

create table if not exists public.strategy_measure_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  measure_id uuid not null references public.strategy_measures(id) on delete cascade,
  reading_date date not null default current_date,
  value numeric not null,
  posted_by_user_id uuid references auth.users(id) on delete set null,
  posted_by_name text,
  source_id uuid references public.strategy_data_sources(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists strategy_measure_readings_measure_idx on public.strategy_measure_readings (measure_id, reading_date);

-- ── check-ins ────────────────────────────────────────────────────────────────
create table if not exists public.strategy_checkins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid references public.strategy_initiatives(id) on delete cascade,
  who_user_id uuid references auth.users(id) on delete set null,
  who_name text,
  status text not null default 'on' check (status in ('on','risk','off','done')),
  confidence int not null default 3 check (confidence between 1 and 5),
  note text not null default '',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists strategy_checkins_org_idx on public.strategy_checkins (organization_id, initiative_id, checked_at desc);

-- ── nudges ───────────────────────────────────────────────────────────────────
create table if not exists public.strategy_nudges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nudge_type text not null default 'STALE_GOAL',
  priority text not null default 'NORMAL' check (priority in ('NORMAL','PRIORITY','CRITICAL')),
  channel text not null default 'IN_APP',
  status text not null default 'PENDING' check (status in ('PENDING','SENT','ACTIONED','SNOOZED','DISMISSED')),
  subject_kind text not null default 'initiative',
  subject_id uuid,
  title text not null,
  rationale text not null default '',
  importance numeric(3,2) not null default 0.5,
  snoozed_until timestamptz,
  outcome_met boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_nudges_org_idx on public.strategy_nudges (organization_id, status, created_at desc);

-- ── reviews + items ──────────────────────────────────────────────────────────
create table if not exists public.strategy_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_type text not null default 'weekly' check (review_type in ('weekly','mbr','qbr','one_on_one')),
  title text not null,
  held_at timestamptz not null default now(),
  facilitator_user_id uuid references auth.users(id) on delete set null,
  facilitator_name text,
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_name text,
  mood int check (mood is null or mood between 1 and 4),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_reviews_org_idx on public.strategy_reviews (organization_id, created_at desc);

create table if not exists public.strategy_review_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id uuid not null references public.strategy_reviews(id) on delete cascade,
  kind text not null default 'action' check (kind in ('decision','action')),
  text text not null,
  who_user_id uuid references auth.users(id) on delete set null,
  who_name text,
  ref_initiative_id uuid references public.strategy_initiatives(id) on delete set null,
  ref_objective_id uuid references public.okr_objectives(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists strategy_review_items_review_idx on public.strategy_review_items (review_id);

-- ── decision log ─────────────────────────────────────────────────────────────
create table if not exists public.strategy_decision_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_date date not null default current_date,
  who_user_id uuid references auth.users(id) on delete set null,
  who_name text,
  entry_type text not null default 'decision' check (entry_type in ('decision','milestone','risk','update','edit')),
  initiative_id uuid references public.strategy_initiatives(id) on delete set null,
  title text not null,
  detail text not null default '',
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);
create index if not exists strategy_decision_log_org_idx on public.strategy_decision_log (organization_id, entry_date desc);

-- ── teams + members ──────────────────────────────────────────────────────────
create table if not exists public.strategy_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  pillar_code text,
  lead_user_id uuid references auth.users(id) on delete set null,
  lead_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.strategy_team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.strategy_teams(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  member_name text,
  created_at timestamptz not null default now(),
  unique (team_id, member_user_id)
);

-- ── objective alignment edges ────────────────────────────────────────────────
create table if not exists public.strategy_objective_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  to_objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  edge_type text not null default 'contributes_to' check (edge_type in ('contributes_to','drives')),
  created_at timestamptz not null default now(),
  unique (from_objective_id, to_objective_id),
  check (from_objective_id <> to_objective_id)
);

-- ── role charters ────────────────────────────────────────────────────────────
create table if not exists public.strategy_role_charters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_user_id uuid references auth.users(id) on delete set null,
  person_name text not null,
  purpose text not null default '',
  responsibilities text[] not null default '{}',
  decisions text[] not null default '{}',
  stakeholders text[] not null default '{}',
  priorities text[] not null default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + triggers (org-scoped; reuse shared helpers)
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'strategy_data_sources','strategy_measures','strategy_measure_readings','strategy_checkins',
    'strategy_nudges','strategy_reviews','strategy_review_items','strategy_decision_log',
    'strategy_teams','strategy_team_members','strategy_objective_edges','strategy_role_charters']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select_org on public.%I', t, t);
    execute format('create policy %I_select_org on public.%I for select using (organization_id = public.current_org_id())', t, t);
    execute format('drop policy if exists %I_modify_org on public.%I', t, t);
    execute format('create policy %I_modify_org on public.%I for all using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t, t);
    execute format('drop trigger if exists %I_before_insert_tg on public.%I', t, t);
    execute format('create trigger %I_before_insert_tg before insert on public.%I for each row execute function public.strategy_tools_child_before_insert()', t, t);
  end loop;
  -- updated_at on the mutable tables
  foreach t in array array['strategy_data_sources','strategy_measures','strategy_nudges','strategy_reviews','strategy_teams','strategy_role_charters']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Seed a modest worked signal set
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public._strategy_seed_signal(v_org uuid)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  ini_kyc uuid; ini_plat uuid; ini_esg uuid; ini_nordic uuid;
  src_sheets uuid; src_jira uuid; m1 uuid; r record;
begin
  if v_org is null then return; end if;
  if exists (select 1 from public.strategy_data_sources where organization_id = v_org) then return; end if;

  select id into ini_kyc from public.strategy_initiatives where organization_id=v_org and key='STR-05';
  select id into ini_plat from public.strategy_initiatives where organization_id=v_org and key='STR-02';
  select id into ini_esg from public.strategy_initiatives where organization_id=v_org and key='STR-04';
  select id into ini_nordic from public.strategy_initiatives where organization_id=v_org and key='STR-01';

  -- data sources
  insert into public.strategy_data_sources (organization_id, name, kind, source_code, status, last_sync_at, missed_runs, detail, error) values
    (v_org,'Finance sheet','Spreadsheet','SHEETS','connected', now()-interval '40 min',0,'AUM, fees, CTI',null),
    (v_org,'Jira','Delivery','JIRA','connected', now()-interval '12 min',0,'Initiative delivery status',null),
    (v_org,'Salesforce','CRM','SALESFORCE','error', now()-interval '3 day',2,'Client + pipeline data','Auth token expired'),
    (v_org,'BigQuery','Warehouse','BIGQUERY','available', null,0,'Consolidated warehouse',null)
  ;
  select id into src_sheets from public.strategy_data_sources where organization_id=v_org and source_code='SHEETS';
  select id into src_jira from public.strategy_data_sources where organization_id=v_org and source_code='JIRA';

  -- measures
  insert into public.strategy_measures (organization_id, name, owner_name, measure_type, direction, unit, start_value, target_value, current_value, source_id, cadence_days, confidence, guardrail_threshold, guardrail_breached) values
    (v_org,'Assets under management','Kari Nilsen','LAG','INCREASE',' BNOK',9.4,12,10.6,src_sheets,30,4,9,false),
    (v_org,'KYC cycle time','Mette Berg','LEAD','DECREASE',' days',11,5,7,src_jira,14,3,12,false),
    (v_org,'Client NPS','Ola Hansen','LAG','INCREASE','',48,60,54,src_sheets,90,3,40,false),
    (v_org,'Fee margin','Kari Nilsen','LAG','MAINTAIN','%',0.80,0.82,0.79,src_sheets,30,2,0.75,false),
    (v_org,'Cost-to-income','Kari Nilsen','LAG','DECREASE','%',66,58,63,src_sheets,30,3,68,false);
  -- a few readings for the AUM measure (sparkline)
  select id into m1 from public.strategy_measures where organization_id=v_org and name='Assets under management';
  for r in select * from (values
      (current_date-150,9.4),(current_date-120,9.7),(current_date-90,10.0),(current_date-60,10.2),(current_date-30,10.4),(current_date,10.6)
    ) as v(d,val)
  loop
    insert into public.strategy_measure_readings (organization_id, measure_id, reading_date, value, posted_by_name, source_id)
    values (v_org, m1, r.d, r.val, 'Kari Nilsen', src_sheets);
  end loop;

  -- check-ins (recent)
  insert into public.strategy_checkins (organization_id, initiative_id, who_name, status, confidence, note, checked_at) values
    (v_org, ini_kyc,'Henrik Dahl','on',4,'Automation live in staging; on track for the 5-day target.', now()-interval '2 day'),
    (v_org, ini_plat,'Henrik Dahl','risk',2,'Migration dependency slipping; need more QA capacity.', now()-interval '5 day'),
    (v_org, ini_nordic,'Ola Hansen','on',4,'Stockholm desk hiring on plan.', now()-interval '9 day'),
    (v_org, ini_esg,'Kari Nilsen','on',3,'SFDR review booked.', now()-interval '3 day');

  -- nudges
  insert into public.strategy_nudges (organization_id, nudge_type, priority, channel, status, subject_kind, subject_id, title, rationale, importance) values
    (v_org,'STALE_GOAL','PRIORITY','IN_APP','SENT','initiative', ini_plat,'Wealth platform 2.0 needs a check-in','Last update 5 days ago; the cycle is 70% elapsed and it is at risk.',0.82),
    (v_org,'SYNC_FAILURE','CRITICAL','IN_APP','SENT','source', src_sheets,'Salesforce sync failed','Auth token expired — client data is stale.',0.9),
    (v_org,'GUARDRAIL','NORMAL','IN_APP','PENDING','measure', m1,'Fee margin near guardrail','Fee margin 0.79% is approaching the 0.75% floor.',0.6);

  -- decision log
  insert into public.strategy_decision_log (organization_id, entry_date, who_name, entry_type, initiative_id, title, detail) values
    (v_org, current_date-30,'Tor Lambrechts','decision', ini_plat,'Approved platform 2.0 phased cutover','Dual-run for two months to de-risk migration.'),
    (v_org, current_date-22,'Kari Nilsen','milestone', ini_kyc,'KYC automation hit staging','Onboarding pilot at 6 days, trending to 5.'),
    (v_org, current_date-15,'Ingrid Vik','risk', ini_esg,'SFDR classification risk logged','External legal review scheduled before launch.'),
    (v_org, current_date-8,'Ola Hansen','update', ini_nordic,'Stockholm desk lead signed','Start date confirmed for next quarter.'),
    (v_org, current_date-3,'Tor Lambrechts','decision', null,'Held fee restructuring to Q3','Retention risk; revisit after NPS improves.');

  -- teams
  insert into public.strategy_teams (organization_id, name, pillar_code, lead_name) values
    (v_org,'Investment','fin','Kari Nilsen'),
    (v_org,'Advisory','cus','Ola Hansen'),
    (v_org,'Platform & Data','pro','Henrik Dahl'),
    (v_org,'People & Risk','peo','Sofie Lind');

  -- charters
  insert into public.strategy_role_charters (organization_id, person_name, purpose, responsibilities, decisions, stakeholders, priorities) values
    (v_org,'Tor Lambrechts','Set direction and protect the firm''s long-term trust.',
      array['Own the strategy','Chair the board reviews','Final escalation'],
      array['Approve the annual plan','Approve major investments'],
      array['Board','ExCo','Key clients'],
      array['Land platform 2.0','Open the Nordic mid-market']),
    (v_org,'Henrik Dahl','Deliver the technology that makes the strategy possible.',
      array['Own platform 2.0','Own data & KYC automation'],
      array['Architecture decisions','Vendor selection'],
      array['ExCo','Engineering','Compliance'],
      array['Ship platform 2.0','Cut onboarding to 5 days']);

  -- objective alignment edges (between the first two objectives, if present)
  insert into public.strategy_objective_edges (organization_id, from_objective_id, to_objective_id, edge_type)
  select v_org, a.id, b.id, 'contributes_to'
  from (select id, position from public.okr_objectives where organization_id=v_org order by position limit 1) a
  cross join (select id, position from public.okr_objectives where organization_id=v_org order by position offset 1 limit 1) b
  where a.id is not null and b.id is not null
  on conflict do nothing;
end; $$;

create or replace function public.provision_strategy_signal_for_org(p_org_id uuid default null)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_org uuid;
begin
  v_org := coalesce(p_org_id, public.current_org_id());
  if v_org is null then return; end if;
  if v_org <> public.current_org_id() and not public.is_org_admin() then return; end if;
  perform public._strategy_seed_signal(v_org);
end; $$;

revoke all on function public._strategy_seed_signal(uuid) from public;
revoke all on function public.provision_strategy_signal_for_org(uuid) from public;
grant execute on function public.provision_strategy_signal_for_org(uuid) to authenticated;

do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform public._strategy_seed_signal(v_org);
  end loop;
end $$;
