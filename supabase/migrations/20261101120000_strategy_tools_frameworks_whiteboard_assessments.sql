-- Strategy Tools — Frameworks · Whiteboard · Assessments.
--
-- Coverage gap closed:
--   The "Strategy v2" design ships a Tools group with three database-driven
--   surfaces that the app lacked entirely:
--     * Frameworks  — guided analysis tools (SWOT, Porter, McKinsey 7S, PESTEL,
--                     BCG, Ansoff, Business Model Canvas, Value Proposition
--                     Canvas) with named, versioned snapshots.
--     * Whiteboard  — a freeform canvas of sticky notes / text / shapes, stored
--                     and versioned exactly like a framework (same tables).
--     * Assessments — interactive diagnostics (Strategy Health Index, 4A,
--                     Strategy–Execution Gap, ADKAR, 1:1 Effectiveness, Kernel
--                     Check, Coaching Snapshot) with stored runs, longitudinal
--                     trends, and multi-rater team campaigns.
--
--   This migration adds:
--     1. strategy_tool_analyses        — one row per framework / whiteboard
--     2. strategy_tool_versions        — named snapshots of an analysis' content
--     3. strategy_assessment_runs       — a completed diagnostic (self/team)
--     4. strategy_assessment_campaigns  — a multi-rater round sent to the team
--     5. strategy_assessment_responses  — one respondent's status + result
--
--   Plus provision_strategy_tools_baseline_for_org(org) which idempotently
--   seeds the eight worked framework examples + one example whiteboard so the
--   "Inspiration · worked examples" gallery is populated on first view.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 3-1 (systematisk HMS-arbeid): de strategiske rammeverkene
--     (SWOT/PESTEL/Porter osv.) dokumenterer den systematiske kartleggingen
--     og vurderingen som ligger til grunn for HMS-/virksomhetsstrategien.
--   * AML § 7-2 / IK-f § 5 nr. 4 (mål + medvirkning): assessments-kampanjer
--     samler ledelsens og vernetjenestens vurdering av strategi- og
--     gjennomføringsmodenhet — divergens synliggjøres, ikke glattes bort.
--   * Sporbarhet: versjonering (strategy_tool_versions) gir revisorvennlig
--     historikk over hvordan en analyse utviklet seg.
--   * Restrisiko: innholdet er fritekst/jsonb og kobles ennå ikke automatisk
--     mot okr_plans/objectives; en senere migrasjon kan lenke en framework-
--     analyse til en OKR-plan. Assessments-benchmarks er syntetiske
--     referansepooler (publiserte vekter), ikke live bransjedata.
--
-- Idempotens:
--   * Alle CREATE TABLE bruker IF NOT EXISTS; indekser likeså.
--   * RLS-policies + triggere bruker DROP IF EXISTS før CREATE.
--   * provision_strategy_tools_baseline_for_org seeder kun hvis ingen
--     example-rader finnes for org-en; backfill-loopen nederst kjører den for
--     alle eksisterende organisasjoner.

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. strategy_tool_analyses — frameworks + whiteboards
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.strategy_tool_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Tool kind: swot | porter | s7 | pestel | bcg | ansoff | bmc | vpc | whiteboard
  fw text not null,
  title text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  -- 'draft' = user-created; 'example' = seeded worked example (read-mostly).
  status text not null default 'draft',
  -- Framework sections {"sections": {...}} OR whiteboard {"elements": [...]}.
  content jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.strategy_tool_analyses is
  'One strategy framework analysis or whiteboard board. content holds {sections} for frameworks or {elements} for whiteboards.';
comment on column public.strategy_tool_analyses.content is
  'jsonb. Frameworks: {"sections": {sectionId: {items[]|text|rating|risk}}}. Whiteboard: {"elements": [{id,type,x,y,w,h,text,color}]}.';

create index if not exists strategy_tool_analyses_org_idx
  on public.strategy_tool_analyses (organization_id, status, created_at desc)
  where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. strategy_tool_versions — named snapshots
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.strategy_tool_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.strategy_tool_analyses(id) on delete cascade,
  label text not null,
  note text not null default '',
  by_user_id uuid references auth.users(id) on delete set null,
  by_name text,
  -- Human-readable point count at snapshot time ("12 points", "3 of 7 elements").
  point_count text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.strategy_tool_versions is
  'Named, restorable snapshots of a strategy_tool_analyses content blob.';

create index if not exists strategy_tool_versions_analysis_idx
  on public.strategy_tool_versions (analysis_id, created_at asc);
create index if not exists strategy_tool_versions_org_idx
  on public.strategy_tool_versions (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. strategy_assessment_runs — completed diagnostics
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.strategy_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Static diagnostic id: shi | fourA | gap | adkar | oneonone | kernel | coaching
  assessment_id text not null,
  name text not null,
  mode text not null default 'self',          -- 'self' | 'team'
  composite int not null default 0,
  result jsonb not null default '{}'::jsonb,    -- {composite, dims[], comments[], responses[]}
  taken_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.strategy_assessment_runs is
  'A completed run of a strategy/leadership diagnostic. result holds the scored dimensions, comments and responses.';

create index if not exists strategy_assessment_runs_org_idx
  on public.strategy_assessment_runs (organization_id, assessment_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. strategy_assessment_campaigns — multi-rater rounds
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.strategy_assessment_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id text not null,
  title text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  message text,
  due_date date,
  created_at timestamptz not null default now()
);
comment on table public.strategy_assessment_campaigns is
  'A team assessment round — a diagnostic sent to several people; their responses compile into a group view.';

create index if not exists strategy_assessment_campaigns_org_idx
  on public.strategy_assessment_campaigns (organization_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. strategy_assessment_responses — per respondent
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.strategy_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.strategy_assessment_campaigns(id) on delete cascade,
  respondent_user_id uuid references auth.users(id) on delete set null,
  respondent_name text,
  status text not null default 'sent',          -- 'sent' | 'started' | 'done'
  result jsonb,                                  -- null until completed
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.strategy_assessment_responses is
  'One respondent in an assessment campaign: their status and (once done) their scored result.';

create index if not exists strategy_assessment_responses_campaign_idx
  on public.strategy_assessment_responses (campaign_id);
create index if not exists strategy_assessment_responses_org_idx
  on public.strategy_assessment_responses (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.strategy_tool_analyses        enable row level security;
alter table public.strategy_tool_versions         enable row level security;
alter table public.strategy_assessment_runs        enable row level security;
alter table public.strategy_assessment_campaigns   enable row level security;
alter table public.strategy_assessment_responses   enable row level security;

-- analyses: all org members read; insert in-org; the creator/owner or an admin
-- may edit/soft-delete. Seeded examples (created_by null) are admin-managed.
drop policy if exists strategy_tool_analyses_select_org on public.strategy_tool_analyses;
create policy strategy_tool_analyses_select_org on public.strategy_tool_analyses for select
  using (organization_id = public.current_org_id() and deleted_at is null);

drop policy if exists strategy_tool_analyses_insert_org on public.strategy_tool_analyses;
create policy strategy_tool_analyses_insert_org on public.strategy_tool_analyses for insert
  with check (organization_id = public.current_org_id());

drop policy if exists strategy_tool_analyses_update_owner on public.strategy_tool_analyses;
create policy strategy_tool_analyses_update_owner on public.strategy_tool_analyses for update
  using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or owner_user_id = auth.uid() or public.is_org_admin())
  )
  with check (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or owner_user_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists strategy_tool_analyses_delete_owner on public.strategy_tool_analyses;
create policy strategy_tool_analyses_delete_owner on public.strategy_tool_analyses for delete
  using (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or owner_user_id = auth.uid() or public.is_org_admin())
  );

-- versions: read in-org; manage versions of analyses you can edit.
drop policy if exists strategy_tool_versions_select_org on public.strategy_tool_versions;
create policy strategy_tool_versions_select_org on public.strategy_tool_versions for select
  using (organization_id = public.current_org_id());

drop policy if exists strategy_tool_versions_modify on public.strategy_tool_versions;
create policy strategy_tool_versions_modify on public.strategy_tool_versions for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or exists (
        select 1 from public.strategy_tool_analyses a
        where a.id = analysis_id
          and (a.created_by = auth.uid() or a.owner_user_id = auth.uid())
      )
    )
  )
  with check (organization_id = public.current_org_id());

-- runs: read in-org; the taker (or admin) writes / edits / deletes their runs.
drop policy if exists strategy_assessment_runs_select_org on public.strategy_assessment_runs;
create policy strategy_assessment_runs_select_org on public.strategy_assessment_runs for select
  using (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_runs_insert_org on public.strategy_assessment_runs;
create policy strategy_assessment_runs_insert_org on public.strategy_assessment_runs for insert
  with check (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_runs_modify on public.strategy_assessment_runs;
create policy strategy_assessment_runs_modify on public.strategy_assessment_runs for update
  using (organization_id = public.current_org_id() and (taken_by_user_id = auth.uid() or public.is_org_admin()))
  with check (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_runs_delete on public.strategy_assessment_runs;
create policy strategy_assessment_runs_delete on public.strategy_assessment_runs for delete
  using (organization_id = public.current_org_id() and (taken_by_user_id = auth.uid() or public.is_org_admin()));

-- campaigns: read in-org; the owner (or admin) manages.
drop policy if exists strategy_assessment_campaigns_select_org on public.strategy_assessment_campaigns;
create policy strategy_assessment_campaigns_select_org on public.strategy_assessment_campaigns for select
  using (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_campaigns_insert_org on public.strategy_assessment_campaigns;
create policy strategy_assessment_campaigns_insert_org on public.strategy_assessment_campaigns for insert
  with check (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_campaigns_modify on public.strategy_assessment_campaigns;
create policy strategy_assessment_campaigns_modify on public.strategy_assessment_campaigns for update
  using (organization_id = public.current_org_id() and (owner_user_id = auth.uid() or public.is_org_admin()))
  with check (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_campaigns_delete on public.strategy_assessment_campaigns;
create policy strategy_assessment_campaigns_delete on public.strategy_assessment_campaigns for delete
  using (organization_id = public.current_org_id() and (owner_user_id = auth.uid() or public.is_org_admin()));

-- responses: read in-org; insert/update by the respondent themselves OR the
-- campaign owner / admin (record on behalf). Delete cascades with the campaign.
drop policy if exists strategy_assessment_responses_select_org on public.strategy_assessment_responses;
create policy strategy_assessment_responses_select_org on public.strategy_assessment_responses for select
  using (organization_id = public.current_org_id());

drop policy if exists strategy_assessment_responses_modify on public.strategy_assessment_responses;
create policy strategy_assessment_responses_modify on public.strategy_assessment_responses for all
  using (
    organization_id = public.current_org_id()
    and (
      respondent_user_id = auth.uid()
      or public.is_org_admin()
      or exists (
        select 1 from public.strategy_assessment_campaigns c
        where c.id = campaign_id and c.owner_user_id = auth.uid()
      )
    )
  )
  with check (organization_id = public.current_org_id());

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Triggers — insert defaults + updated_at
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.strategy_tool_analyses_before_insert()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end; $$;
drop trigger if exists strategy_tool_analyses_before_insert_tg on public.strategy_tool_analyses;
create trigger strategy_tool_analyses_before_insert_tg before insert on public.strategy_tool_analyses
  for each row execute function public.strategy_tool_analyses_before_insert();
drop trigger if exists strategy_tool_analyses_set_updated_at on public.strategy_tool_analyses;
create trigger strategy_tool_analyses_set_updated_at before update on public.strategy_tool_analyses
  for each row execute function public.set_updated_at();

create or replace function public.strategy_tools_child_before_insert()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  return new;
end; $$;

drop trigger if exists strategy_tool_versions_before_insert_tg on public.strategy_tool_versions;
create trigger strategy_tool_versions_before_insert_tg before insert on public.strategy_tool_versions
  for each row execute function public.strategy_tools_child_before_insert();

-- runs: default org + taker.
create or replace function public.strategy_assessment_runs_before_insert()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.taken_by_user_id is null then new.taken_by_user_id := auth.uid(); end if;
  return new;
end; $$;
drop trigger if exists strategy_assessment_runs_before_insert_tg on public.strategy_assessment_runs;
create trigger strategy_assessment_runs_before_insert_tg before insert on public.strategy_assessment_runs
  for each row execute function public.strategy_assessment_runs_before_insert();

-- campaigns: default org + owner.
create or replace function public.strategy_assessment_campaigns_before_insert()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.owner_user_id is null then new.owner_user_id := auth.uid(); end if;
  return new;
end; $$;
drop trigger if exists strategy_assessment_campaigns_before_insert_tg on public.strategy_assessment_campaigns;
create trigger strategy_assessment_campaigns_before_insert_tg before insert on public.strategy_assessment_campaigns
  for each row execute function public.strategy_assessment_campaigns_before_insert();

drop trigger if exists strategy_assessment_responses_before_insert_tg on public.strategy_assessment_responses;
create trigger strategy_assessment_responses_before_insert_tg before insert on public.strategy_assessment_responses
  for each row execute function public.strategy_tools_child_before_insert();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. provision_strategy_tools_baseline_for_org — seed worked examples
--
-- Idempotent: seeds the eight framework examples + one whiteboard for the org
-- only if no example rows exist yet. Content is the Pundit Invest worked set
-- from the design package. Called on first view of any Tools page.
-- ════════════════════════════════════════════════════════════════════════════

-- Internal seeder (no auth guard — callable from the migration backfill and
-- from the guarded public wrapper below).
create or replace function public._strategy_tools_seed_examples(v_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if v_org is null then return; end if;

  if exists (select 1 from public.strategy_tool_analyses where organization_id = v_org and status = 'example') then
    return;
  end if;

  insert into public.strategy_tool_analyses (organization_id, fw, title, owner_name, status, content) values
  (v_org, 'swot', 'SWOT — 2026 planning cycle', 'Tor Lambrechts', 'example', $json$
    {"sections":{
      "s":{"items":["9.4 BNOK AUM and a loyal Nordic client base","Compliance-first culture; SOC 2 + DORA well advanced","Experienced advisory team, low historical attrition","Healthy ~0.80% management-fee margin"]},
      "w":{"items":["Legacy platform limits self-serve and SMB reach","Onboarding still 11 days vs. a 5-day target","Cost-to-income ratio elevated at 63%","Limited brand awareness beyond core segment"]},
      "o":{"items":["Mid-market mandate demand in Stockholm & Copenhagen","Growing appetite for ESG / Article-9 funds","SMB advisory tier as a new revenue line","Automation to cut cost and onboarding time"]},
      "t":{"items":["Fee compression and price-led competition","Tightening DORA / regulatory burden","Tight Nordic market for investment talent","Digital-first entrants and neobrokers"]}
    }}$json$::jsonb),
  (v_org, 'porter', 'Five Forces — Nordic wealth market', 'Kari Nilsen', 'example', $json$
    {"sections":{
      "ne":{"rating":"Medium","items":["Capital & licensing barriers remain","Fintech lowers cost of entry","Brand and trust still protect incumbents"]},
      "sp":{"rating":"Medium","items":["Data & tech vendors interchangeable","Talent scarcity raises leverage","Custody / banking partners concentrated"]},
      "cr":{"rating":"High","items":["Established Nordic managers compete on fee & service","Digital entrants pressure margin","Slow market growth intensifies the fight"]},
      "bp":{"rating":"High","items":["Clients increasingly fee-sensitive","Low switching cost, rising transparency","Mandates concentrated in fewer, larger clients"]},
      "sub":{"rating":"Medium","items":["Passive / index products","Robo-advisors & self-directed platforms","In-house family-office management"]}
    }}$json$::jsonb),
  (v_org, 's7', '7S — organisational alignment', 'Tor Lambrechts', 'example', $json$
    {"sections":{
      "strategy":{"text":"Grow AUM to 12 BNOK via Nordic mid-market and an SMB advisory tier, while protecting margin."},
      "structure":{"text":"Four-pillar operating model; advisory desks in Bergen, Stockholm and Copenhagen."},
      "systems":{"text":"Wealth platform 2.0, automated KYC and a consolidated data warehouse."},
      "values":{"text":"“The score informs; a person decides.” Client trust and a compliance-first mindset."},
      "skills":{"text":"Advisory depth and risk expertise; building analytics and data capability."},
      "style":{"text":"Sober, plain-spoken, human-in-the-loop leadership — no hype."},
      "staff":{"text":"Scaling the investment team 16 → 24 FTE; advisor academy for onboarding."}
    }}$json$::jsonb),
  (v_org, 'pestel', 'PESTEL — Nordics 2026', 'Ingrid Vik', 'example', $json$
    {"sections":{
      "p":{"items":["Stable Nordic financial regulation","EU passporting & cross-border rules","Government incentives for ESG investing"]},
      "e":{"items":["Interest-rate normalisation","Market volatility affecting AUM","Wage inflation lifting cost base"]},
      "s":{"items":["Demand for sustainable, transparent investing","Generational wealth transfer","Rising financial literacy & self-direction"]},
      "t":{"items":["AI document processing for KYC","Robo-advice and digital onboarding","Open banking / PSD2 data access"]},
      "en":{"items":["SFDR / Article-9 product demand","Climate-risk disclosure expectations","ESG scrutiny from clients & regulators"]},
      "l":{"items":["MiFID II suitability & best execution","DORA operational-resilience rules","AML / KYC and GDPR obligations"]}
    }}$json$::jsonb),
  (v_org, 'bcg', 'BCG — business-line portfolio', 'Kari Nilsen', 'example', $json$
    {"sections":{
      "star":{"items":["Nordic mid-market expansion","Brand & demand engine"]},
      "qm":{"items":["Wealth platform 2.0 · SMB advisory","ESG / Article-9 fund range"]},
      "cow":{"items":["Core discretionary mandates","Established advisory book"]},
      "dog":{"items":["Legacy self-service portal","Sub-scale legacy products"]}
    }}$json$::jsonb),
  (v_org, 'ansoff', 'Ansoff — growth options', 'Ola Hansen', 'example', $json$
    {"sections":{
      "pen":{"risk":"Low","items":["Deepen wallet share with existing clients","Quarterly-review coverage to 95%","Cross-sell ESG & advisory"]},
      "prod":{"risk":"Medium","items":["SMB advisory tier on platform 2.0","Launch Article-9 ESG fund range","Portfolio analytics for advisors"]},
      "mkt":{"risk":"Medium","items":["Stockholm & Copenhagen desks","Mid-market mandate segment","Localised onboarding (SE/DK)"]},
      "div":{"risk":"High","items":["Digital self-serve wealth for SMB","Adjacent fintech partnerships"]}
    }}$json$::jsonb),
  (v_org, 'bmc', 'Business Model Canvas — Pundit Invest', 'Tor Lambrechts', 'example', $json$
    {"sections":{
      "segments":{"items":["Affluent Nordic families","SMB owners & founders","Family offices"]},
      "value":{"items":["Transparent, conflict-free advice","Disciplined long-term investing","Human judgement with compliance-grade rigour"]},
      "channels":{"items":["Advisory desks — Bergen, Stockholm, Copenhagen","Digital onboarding & client portal","Referrals and events"]},
      "relations":{"items":["Dedicated advisor","Quarterly portfolio reviews","Self-serve digital tier (SMB)"]},
      "revenue":{"items":["Management fees (~0.80%)","Advisory tier subscriptions","Performance fees on select mandates"]},
      "resources":{"items":["Investment & advisory team (20 FTE)","Wealth platform 2.0 & data warehouse","Licences and client trust"]},
      "activities":{"items":["Portfolio management","Client onboarding & KYC","Compliance & risk"]},
      "partners":{"items":["Custody & banking partners","Data and technology vendors","ESG fund providers"]},
      "costs":{"items":["Personnel (largest cost)","Technology & platform","Compliance & licensing"]}
    }}$json$::jsonb),
  (v_org, 'vpc', 'Value Proposition Canvas — SMB advisory', 'Henrik Dahl', 'example', $json$
    {"sections":{
      "products":{"items":["Discretionary portfolio management","SMB advisory tier","ESG / Article-9 funds"]},
      "relievers":{"items":["Automated KYC cuts onboarding to 5 days","Transparent tiered fees","Compliance-grade controls"]},
      "gaincreators":{"items":["Quarterly reviews & live analytics","Access to mid-market mandates","Conflict-free long-term advice"]},
      "jobs":{"items":["Grow and protect wealth","Understand where money is invested","Stay compliant and informed"]},
      "pains":{"items":["Opaque fees and conflicts","Slow onboarding","Distrust of digital-only players"]},
      "gains":{"items":["Confidence and clarity","Better risk-adjusted returns","A partner who answers the phone"]}
    }}$json$::jsonb),
  (v_org, 'whiteboard', 'Whiteboard — 2026 offsite brainstorm', 'Tor Lambrechts', 'example', $json$
    {"elements":[
      {"id":"e1","type":"text","x":70,"y":24,"w":340,"h":44,"text":"Where do we win in 2026?","color":null},
      {"id":"e2","type":"sticky","x":70,"y":96,"w":150,"h":120,"text":"Nordic mid-market","color":"#f6e7b8"},
      {"id":"e3","type":"sticky","x":240,"y":96,"w":150,"h":120,"text":"SMB advisory tier","color":"#cfe6d2"},
      {"id":"e4","type":"sticky","x":410,"y":96,"w":150,"h":120,"text":"ESG fund range","color":"#cfe0f0"},
      {"id":"e5","type":"sticky","x":240,"y":250,"w":150,"h":120,"text":"Cut onboarding to 5 days","color":"#f0d8cd"},
      {"id":"e6","type":"ellipse","x":410,"y":250,"w":150,"h":120,"text":"Protect margin","color":null}
    ]}$json$::jsonb);
end;
$$;

-- Public, guarded wrapper called by the client on first view of any Tools page.
create or replace function public.provision_strategy_tools_baseline_for_org(p_org_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
begin
  v_org := coalesce(p_org_id, public.current_org_id());
  if v_org is null then return; end if;
  -- Defence in depth alongside RLS: only seed your own org (admins may seed any).
  if v_org <> public.current_org_id() and not public.is_org_admin() then return; end if;
  perform public._strategy_tools_seed_examples(v_org);
end;
$$;

comment on function public.provision_strategy_tools_baseline_for_org(uuid) is
  'Idempotently seeds the eight framework worked examples + one example whiteboard for an org. Called on first view of any Strategy Tools page.';

revoke all on function public._strategy_tools_seed_examples(uuid) from public;
revoke all on function public.provision_strategy_tools_baseline_for_org(uuid) from public;
grant execute on function public.provision_strategy_tools_baseline_for_org(uuid) to authenticated;

-- Backfill: seed examples for every existing organisation.
do $$
declare v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform public._strategy_tools_seed_examples(v_org);
  end loop;
end $$;
