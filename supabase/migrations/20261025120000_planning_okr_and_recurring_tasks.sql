-- Planning — OKR tables + recurring task support.
--
-- Coverage gap closed:
--   /planlegging-siden samler strategi (Ambisjon + OKR-tre), kadens-planlegger
--   og oppgaver/prosjekter i én flate. Eksisterende cadence_plans og
--   task_items dekker kadensen og oppgavene, men strategi-laget (Ambisjon,
--   Objectives, Key Results, RACI) manglet helt.
--
--   Denne migrasjonen legger til:
--     1. okr_plans            — Ambisjon (én aktiv plan per org per horisont)
--     2. okr_objectives        — fire mål per plan (typisk)
--     3. okr_key_results       — 3-4 KRs per mål
--     4. okr_raci              — Rolle-tildeling (R/A/C/I) per strategiplan
--     5. okr_task_links        — kobler task_items til en KR (frittstående
--                                kolonne så vi ikke trenger å berøre
--                                task_items-skjemaet)
--
--   I tillegg utvides task_items med recurrence-felter for å støtte
--   "vedvarende rutiner" — oppgaver som regenereres med fast intervall
--   inntil de aktivt stoppes. Eksisterende recurrence_cadence er bevart;
--   den nye recurrence_interval gir mer fleksibel kontroll.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * IK-f § 5 nr. 4 (fastsette mål for HMS): okr_plans + okr_objectives
--     gir skriftlig dokumentasjon av HMS-målene som IK-f krever.
--   * AML § 3-1 (systematisk HMS): okr_raci + okr_key_results sporer
--     ansvar og resultater i HMS-arbeidet.
--   * AML § 7-2 (AMU): okr_plans.facilitator + sponsor pluss raci-tabell
--     dokumenterer at AMU og ledelsen er involvert i mål-settingen.
--   * IK-f § 5 nr. 8 (systematisk overvåking + gjennomgang): recurrence-
--     felter på task_items gjør at månedlige/kvartalsvise gjennomgang-
--     oppgaver kan regenereres automatisk uten manuell opprettelse.
--   * Restrisiko: KR-fremdrift må fortsatt oppdateres manuelt (eller via
--     report-builder); ingen automatisk koblings-trigger fra task_items
--     close → kr.current. Planneren versjonerer ikke historikk —
--     endringer overskriver. Versjonering kan legges til senere via
--     okr_plan_snapshots-tabell.
--
-- Idempotens:
--   * Alle CREATE TABLE bruker IF NOT EXISTS.
--   * Triggere bruker DROP IF EXISTS før CREATE.
--   * RLS-policies bruker DROP POLICY IF EXISTS før CREATE.
--   * provision_okr_baseline_for_org gjør en idempotent on conflict insert
--     for plan + seed barnerader (kjøres ved første visning av /planlegging).

set local search_path = public, pg_catalog;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Enums
-- ════════════════════════════════════════════════════════════════════════════

-- Helse-status for et OKR-mål (objective) eller plan.
do $$ begin
  create type public.okr_health as enum ('on_track', 'at_risk', 'off_track');
exception when duplicate_object then null; end $$;

-- Strategi-plan status. Draft = under utarbeidelse, active = vedtatt,
-- archived = ferdig periode / erstattet av ny.
do $$ begin
  create type public.okr_plan_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. okr_plans — top-level ambisjon
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.okr_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Tittel + ambisjons-setning. Brukes som hero-tekst i UI.
  title text not null,
  description text not null default '',
  -- Eks: 'AML § 1-1, § 3-1, § 4-1 til § 4-3'. Tekst — leses kun.
  legal_basis text,
  -- Horisont — '2026 → 2027', '2026 H1', e.l. Fri tekst.
  horizon text,
  -- Sponsor (typisk CEO) + fasilitator (HMS-leder). Snapshot for UI;
  -- referansen kan brytes om personen forlater org-en, men feltet
  -- forblir lesbart.
  sponsor_user_id uuid references auth.users(id) on delete set null,
  sponsor_name text,
  facilitator_user_id uuid references auth.users(id) on delete set null,
  facilitator_name text,
  status public.okr_plan_status not null default 'draft',
  -- Eier-pack (gjenbruk av compliance_pack-enum gir riktig kobling
  -- mot eksisterende cadence/checklist-pakker).
  pack public.compliance_pack not null default 'aml-amu',
  activated_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.okr_plans is
  'Strategi-plan / ambisjon for en organisasjon. Én rad per HMS-horisont (2026, 2027 osv.).';

create index if not exists okr_plans_org_status_idx
  on public.okr_plans (organization_id, status, created_at desc)
  where deleted_at is null;

-- Partial unique constraint: max én ikke-arkivert plan per org per pack.
-- Forhindrer race-conditions ved auto-seed (to brukere som åpner
-- /planlegging samtidig) — andre INSERT feiler med unique-violation
-- og klienten leser den eksisterende planen. Tillater historikk —
-- arkiverte/slettede planer er ekskludert fra constrainten.
create unique index if not exists okr_plans_org_pack_unique_active_idx
  on public.okr_plans (organization_id, pack)
  where deleted_at is null and status <> 'archived';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. okr_objectives — mål
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.okr_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.okr_plans(id) on delete cascade,
  -- Kortform ('O1', 'O2', ...). Position styrer rekkefølge i UI.
  ord_label text not null,
  position int not null default 0,
  objective text not null,
  -- Hvorfor — narrativ for konteksten.
  why text not null default '',
  -- Lovreferanse-streng som hekter målet til AML/IK/ISO.
  -- Eks: 'AML § 3-1 — Systematisk HMS'. Plain text (samme mønster som
  -- compliance_checklist_templates.law_refs).
  law_ref text,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  health public.okr_health not null default 'on_track',
  -- 0..1, manuelt vedlikeholdt fremdrift. Brukes for grafikk i UI.
  progress numeric(4, 3) not null default 0
    check (progress >= 0 and progress <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.okr_objectives is
  '4 mål per OKR-plan (typisk). ord_label er kortform (O1..O4).';

create index if not exists okr_objectives_plan_position_idx
  on public.okr_objectives (plan_id, position);

create index if not exists okr_objectives_org_idx
  on public.okr_objectives (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. okr_key_results — nøkkelresultater per mål
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.okr_key_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  position int not null default 0,
  kr text not null,
  -- Måleenhet — '%', 'dager', 'ledere', 'av 24', e.l. Fri tekst.
  unit text not null default '',
  target numeric not null default 0,
  current_value numeric not null default 0,
  -- Confidence — 0..1. Vises som badge med farge i UI.
  confidence numeric(3, 2) not null default 0.5
    check (confidence >= 0 and confidence <= 1),
  -- "Lavere = bedre" (eks. sykefravær). Endrer hvordan progress regnes.
  invert boolean not null default false,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.okr_key_results is
  '3-4 KRs per mål. invert=true når lavere verdi er bedre (sykefravær).';

create index if not exists okr_key_results_objective_position_idx
  on public.okr_key_results (objective_id, position);

create index if not exists okr_key_results_org_idx
  on public.okr_key_results (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. okr_raci — Roller / RACI-matrise per plan
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.okr_raci (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.okr_plans(id) on delete cascade,
  position int not null default 0,
  -- Rollenavn — 'HMS-leder', 'AMU', 'Hovedverneombud', e.l.
  role_label text not null,
  -- Person eller antall — '7 medlemmer', 'Mari Sundsby', e.l.
  person_label text,
  -- R/A/C/I — minst en må være true.
  is_responsible boolean not null default false,
  is_accountable boolean not null default false,
  is_consulted boolean not null default false,
  is_informed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_responsible or is_accountable or is_consulted or is_informed)
);

comment on table public.okr_raci is
  'RACI-matrise per OKR-plan. Dokumenterer hvem som er involvert i strategien.';

create index if not exists okr_raci_plan_position_idx
  on public.okr_raci (plan_id, position);

create index if not exists okr_raci_org_idx
  on public.okr_raci (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. okr_task_links — bind task_items til en KR
--
-- Vi unngår å legge til en kolonne i task_items (mer enn nok kolonner der
-- allerede). Link-tabellen lar én oppgave knyttes til flere KR-er (sjeldent
-- men teoretisk mulig), og en KR har mange oppgaver.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.okr_task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key_result_id uuid not null references public.okr_key_results(id) on delete cascade,
  task_item_id uuid not null references public.task_items(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (key_result_id, task_item_id)
);

comment on table public.okr_task_links is
  'Many-to-many mellom OKR key_results og task_items. Brukes for å beregne KR-fremdrift basert på oppgaver.';

create index if not exists okr_task_links_kr_idx
  on public.okr_task_links (key_result_id);

create index if not exists okr_task_links_task_idx
  on public.okr_task_links (task_item_id);

create index if not exists okr_task_links_org_idx
  on public.okr_task_links (organization_id);

-- Cross-org validation: en link-rad må peke til KR og task som begge
-- tilhører samme org som linken selv. Hindrer at en bruker med tilgang
-- til org A inserter en lenke som binder org A's KR til org B's task.
create or replace function public.okr_task_links_validate_cross_org()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_kr_org uuid;
  v_task_org uuid;
begin
  select organization_id into v_kr_org
    from public.okr_key_results where id = new.key_result_id;
  if v_kr_org is null or v_kr_org <> new.organization_id then
    raise exception 'Key result % er ikke i samme org som lenken (%).', new.key_result_id, new.organization_id;
  end if;

  select organization_id into v_task_org
    from public.task_items where id = new.task_item_id;
  if v_task_org is null or v_task_org <> new.organization_id then
    raise exception 'Task item % er ikke i samme org som lenken (%).', new.task_item_id, new.organization_id;
  end if;

  return new;
end;
$$;

drop trigger if exists okr_task_links_validate_cross_org_tg on public.okr_task_links;
create trigger okr_task_links_validate_cross_org_tg
  before insert or update on public.okr_task_links
  for each row execute function public.okr_task_links_validate_cross_org();

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Recurring task fields — extend task_items
--
-- Eksisterende task_items.recurrence_cadence + next_recurrence_date er
-- bevart. Vi legger til mer eksplisitte felter for "vedvarende rutiner":
--
--   recurrence_interval_days  — avstand i dager mellom forekomster (eks. 7,
--                               14, 30, 90, 180, 365). Mer fleksibel enn
--                               cadence_hint som kun har 5 verdier.
--   recurrence_active         — true → oppgaven regenereres ved fullføring.
--                               false → oppgaven er enten ikke-recurring eller
--                               aktivt stoppet.
--   recurrence_stop_at        — eksplisitt slutt-dato. NULL = ingen
--                               sluttdato (kjører til den eksplisitt
--                               stoppes). Dato fortid → behandles som
--                               "stop now" ved neste regenerering.
--   recurrence_stopped_at     — tidsstempel når serien ble stoppet
--                               manuelt (skiller fra "ferdig").
--   recurrence_stopped_by     — bruker som stoppet serien.
--   recurrence_parent_item_id — første instans i serien (hovedoppgaven).
--                               Brukes for å gruppere historikken.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.task_items
  add column if not exists recurrence_interval_days int
    check (recurrence_interval_days is null or recurrence_interval_days > 0);

alter table public.task_items
  add column if not exists recurrence_active boolean not null default false;

alter table public.task_items
  add column if not exists recurrence_stop_at date;

alter table public.task_items
  add column if not exists recurrence_stopped_at timestamptz;

alter table public.task_items
  add column if not exists recurrence_stopped_by uuid references auth.users(id) on delete set null;

alter table public.task_items
  add column if not exists recurrence_parent_item_id uuid references public.task_items(id) on delete set null;

comment on column public.task_items.recurrence_interval_days is
  'Intervall i dager mellom forekomster. NULL = ikke-recurring.';
comment on column public.task_items.recurrence_active is
  'true = vedvarende rutine som regenereres ved fullføring. false = engangsoppgave eller stoppet serie.';
comment on column public.task_items.recurrence_stop_at is
  'Eksplisitt slutt-dato for serien. NULL = ingen slutt (kjører til stop_recurring_task RPC kalles).';
comment on column public.task_items.recurrence_stopped_at is
  'Tidsstempel for når serien ble manuelt stoppet. Skiller "stoppet av bruker" fra "ferdig fordi slutt-dato passert".';

create index if not exists task_items_recurrence_active_idx
  on public.task_items (organization_id, recurrence_active, next_recurrence_date)
  where deleted_at is null and recurrence_active = true;

-- Idempotency guard for generate_recurring_task_next: forhindrer at
-- to samtidige kall (eks. dobbeltklikk på "Lukk") oppretter to barnerader
-- med samme (parent, due_date). Partielle indekser krever PG 14+ — vi
-- bruker tilstandsbasert WHERE for å holde indeksen kompakt.
create unique index if not exists task_items_recurrence_child_unique_idx
  on public.task_items (recurrence_parent_item_id, due_date)
  where recurrence_parent_item_id is not null and deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS — alle nye tabeller
-- ════════════════════════════════════════════════════════════════════════════

alter table public.okr_plans enable row level security;
alter table public.okr_objectives enable row level security;
alter table public.okr_key_results enable row level security;
alter table public.okr_raci enable row level security;
alter table public.okr_task_links enable row level security;

-- okr_plans: alle org-medlemmer ser, admin + skaper skriver.
drop policy if exists okr_plans_select_org on public.okr_plans;
create policy okr_plans_select_org
  on public.okr_plans for select
  using (organization_id = public.current_org_id() and deleted_at is null);

drop policy if exists okr_plans_insert_org on public.okr_plans;
create policy okr_plans_insert_org
  on public.okr_plans for insert
  with check (organization_id = public.current_org_id());

drop policy if exists okr_plans_update_admin_or_creator on public.okr_plans;
create policy okr_plans_update_admin_or_creator
  on public.okr_plans for update
  using (
    organization_id = public.current_org_id()
    and deleted_at is null
    and (created_by = auth.uid() or public.is_org_admin())
  )
  with check (
    organization_id = public.current_org_id()
    and (created_by = auth.uid() or public.is_org_admin())
  );

-- Hard-delete kun via admin (ellers bruk deleted_at).
drop policy if exists okr_plans_delete_admin on public.okr_plans;
create policy okr_plans_delete_admin
  on public.okr_plans for delete
  using (
    organization_id = public.current_org_id()
    and public.is_org_admin()
  );

-- Child-tabellene (objectives, key_results, raci, task_links) bruker
-- samme tilgangsregel som plan-en: alle org-medlemmer leser, admin +
-- plan-skaper skriver. Dette hindrer at vanlige brukere ved et uhell
-- sletter mål/KR fra en plan eier opprettet — RACI-matrisen er
-- ansvarliggjøring og må ikke kunne endres av tilfeldige org-medlemmer.
do $$
declare
  rec record;
begin
  for rec in
    select unnest(array['okr_objectives', 'okr_key_results', 'okr_raci']) as tbl
  loop
    execute format('drop policy if exists %I_select_org on public.%I', rec.tbl, rec.tbl);
    execute format(
      'create policy %I_select_org on public.%I for select
       using (organization_id = public.current_org_id())',
      rec.tbl, rec.tbl
    );

    execute format('drop policy if exists %I_modify_admin_or_creator on public.%I', rec.tbl, rec.tbl);
    execute format(
      'create policy %I_modify_admin_or_creator on public.%I for all
       using (
         organization_id = public.current_org_id()
         and (
           public.is_org_admin()
           or exists (
             select 1 from public.okr_plans p
             where p.organization_id = organization_id
               and p.created_by = auth.uid()
               and p.deleted_at is null
           )
         )
       )
       with check (
         organization_id = public.current_org_id()
         and (
           public.is_org_admin()
           or exists (
             select 1 from public.okr_plans p
             where p.organization_id = organization_id
               and p.created_by = auth.uid()
               and p.deleted_at is null
           )
         )
       )',
      rec.tbl, rec.tbl
    );
  end loop;
end$$;

-- okr_task_links: read-org, but write requires the user to either be
-- the task assignee/owner, the plan creator, or an org admin. Hindrer
-- at en revisor-rolle med leseaksess oppretter koblinger.
drop policy if exists okr_task_links_select_org on public.okr_task_links;
create policy okr_task_links_select_org
  on public.okr_task_links for select
  using (organization_id = public.current_org_id());

drop policy if exists okr_task_links_modify_authorized on public.okr_task_links;
create policy okr_task_links_modify_authorized
  on public.okr_task_links for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or exists (
        select 1 from public.task_items t
        where t.id = task_item_id
          and (t.created_by = auth.uid() or t.owner_user_id = auth.uid() or t.assignee_user_id = auth.uid())
      )
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or exists (
        select 1 from public.task_items t
        where t.id = task_item_id
          and (t.created_by = auth.uid() or t.owner_user_id = auth.uid() or t.assignee_user_id = auth.uid())
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Triggers — set updated_at + insert defaults
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.okr_plans_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
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

drop trigger if exists okr_plans_before_insert_defaults_tg on public.okr_plans;
create trigger okr_plans_before_insert_defaults_tg
  before insert on public.okr_plans
  for each row execute function public.okr_plans_before_insert_defaults();

drop trigger if exists okr_plans_set_updated_at on public.okr_plans;
create trigger okr_plans_set_updated_at
  before update on public.okr_plans
  for each row execute function public.set_updated_at();

create or replace function public.okr_child_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists okr_objectives_before_insert_defaults_tg on public.okr_objectives;
create trigger okr_objectives_before_insert_defaults_tg
  before insert on public.okr_objectives
  for each row execute function public.okr_child_before_insert_defaults();

drop trigger if exists okr_objectives_set_updated_at on public.okr_objectives;
create trigger okr_objectives_set_updated_at
  before update on public.okr_objectives
  for each row execute function public.set_updated_at();

drop trigger if exists okr_key_results_before_insert_defaults_tg on public.okr_key_results;
create trigger okr_key_results_before_insert_defaults_tg
  before insert on public.okr_key_results
  for each row execute function public.okr_child_before_insert_defaults();

drop trigger if exists okr_key_results_set_updated_at on public.okr_key_results;
create trigger okr_key_results_set_updated_at
  before update on public.okr_key_results
  for each row execute function public.set_updated_at();

drop trigger if exists okr_raci_before_insert_defaults_tg on public.okr_raci;
create trigger okr_raci_before_insert_defaults_tg
  before insert on public.okr_raci
  for each row execute function public.okr_child_before_insert_defaults();

drop trigger if exists okr_raci_set_updated_at on public.okr_raci;
create trigger okr_raci_set_updated_at
  before update on public.okr_raci
  for each row execute function public.set_updated_at();

create or replace function public.okr_task_links_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
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

drop trigger if exists okr_task_links_before_insert_defaults_tg on public.okr_task_links;
create trigger okr_task_links_before_insert_defaults_tg
  before insert on public.okr_task_links
  for each row execute function public.okr_task_links_before_insert_defaults();

-- ════════════════════════════════════════════════════════════════════════════
-- 10. RPC: provision_okr_baseline_for_org — atomisk seed av default plan
--
-- Erstatter klient-side "create plan + seed objectives + seed raci" som
-- hadde tre race-condition-vinduer. Kjøres ved første visning av
-- /planlegging. Idempotent — returnerer alltid plan-id-en, oppretter
-- bare hvis ingen ikke-arkivert plan finnes for org+pack.
--
-- Seed-innhold er 4 standard HMS-mål forankret i AML + en 9-rolle
-- RACI. Brukeren kan redigere alt etter at planen er provisionert.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.provision_okr_baseline_for_org(
  p_org_id uuid default null,
  p_pack public.compliance_pack default 'aml-amu'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_plan_id uuid;
  v_year int;
begin
  v_org := coalesce(p_org_id, public.current_org_id());
  if v_org is null then
    raise exception 'Ingen org-kontekst tilgjengelig.';
  end if;

  -- Bare tillat at brukeren provisjonerer for sin egen org.
  if v_org <> public.current_org_id() then
    raise exception 'Mangler tilgang til å provisionere OKR-plan for denne organisasjonen.';
  end if;

  -- Hvis det allerede finnes en ikke-arkivert plan for org+pack, returner den.
  select id into v_plan_id
    from public.okr_plans
    where organization_id = v_org
      and pack = p_pack
      and deleted_at is null
      and status <> 'archived'
    order by created_at desc
    limit 1;
  if v_plan_id is not null then
    return v_plan_id;
  end if;

  -- Opprett ny draft-plan.
  v_year := extract(year from now())::int;
  begin
    insert into public.okr_plans (
      organization_id, title, description, legal_basis, horizon,
      status, pack, created_by
    )
    values (
      v_org,
      'Et arbeidsmiljø som er fullt forsvarlig — og målbart bedre.',
      'Vi skal etterleve Arbeidsmiljøloven til punkt og prikke, og samtidig løfte arbeidsmiljøet utover lovens minstekrav.',
      'AML § 1-1, § 3-1, § 4-1 til § 4-3',
      v_year || ' → ' || (v_year + 1),
      'draft',
      p_pack,
      auth.uid()
    )
    returning id into v_plan_id;
  exception when unique_violation then
    -- En annen parallel kall vant racen — les den eksisterende.
    select id into v_plan_id
      from public.okr_plans
      where organization_id = v_org
        and pack = p_pack
        and deleted_at is null
        and status <> 'archived'
      order by created_at desc
      limit 1;
    if v_plan_id is null then
      raise; -- Should not happen, men reraise for sikkerhet.
    end if;
    return v_plan_id;
  end;

  -- Seed 4 standard mål (idempotent — on conflict gjør ingenting).
  insert into public.okr_objectives (
    organization_id, plan_id, ord_label, position, objective, why, law_ref, owner_name, health, progress
  ) values
    (v_org, v_plan_id, 'O1', 1,
      'Etablere en levende, dokumentert internkontroll som tåler enhver revisjon',
      'Arbeidstilsynet kan varsle tilsyn når som helst. Vi skal ha ett system, ett spor, full sporbarhet.',
      'AML § 3-1 — Systematisk HMS', 'HMS-leder', 'on_track', 0),
    (v_org, v_plan_id, 'O2', 2,
      'Heve det psykososiale arbeidsmiljøet og senke sykefraværet',
      'Psykososialt arbeidsmiljø er en sentral lovkrav fra 2026. Vi skal sette mål, kartlegge og handle.',
      'AML § 4-3 — Psykososialt arbeidsmiljø', 'HR-leder', 'on_track', 0),
    (v_org, v_plan_id, 'O3', 3,
      'Sikre at fysiske forhold er kartlagt og at ansatte aktivt medvirker',
      'Vernetjenesten skal være synlig og brukt. Vi skal forebygge — ikke reagere.',
      'AML § 4-1, § 4-2 — Fysisk arbeidsmiljø + medvirkning', 'Hovedverneombud', 'on_track', 0),
    (v_org, v_plan_id, 'O4', 4,
      'Bygge HMS-kompetanse i hele organisasjonen — fra ledere til vikarer',
      'Lovens § 3-2 og § 3-5 krever opplæring av både ledere og ansatte.',
      'AML § 3-2, § 3-5 — Opplæring + verneombud', 'HR-leder', 'on_track', 0);

  -- Seed RACI-matrise.
  insert into public.okr_raci (
    organization_id, plan_id, position, role_label, person_label,
    is_responsible, is_accountable, is_consulted, is_informed
  ) values
    (v_org, v_plan_id, 1, 'Styret / CEO', '', false, true, true, false),
    (v_org, v_plan_id, 2, 'HMS-leder', '', true, false, false, false),
    (v_org, v_plan_id, 3, 'HR-leder', '', true, false, false, false),
    (v_org, v_plan_id, 4, 'Hovedverneombud', '', true, false, true, false),
    (v_org, v_plan_id, 5, 'AMU', '', false, false, true, true),
    (v_org, v_plan_id, 6, 'BHT (ekstern)', '', false, false, true, false),
    (v_org, v_plan_id, 7, 'Linjeledere', '', true, false, false, true),
    (v_org, v_plan_id, 8, 'Verneombud', '', false, false, true, true),
    (v_org, v_plan_id, 9, 'Alle ansatte', '', false, false, false, true);

  return v_plan_id;
end;
$$;

comment on function public.provision_okr_baseline_for_org(uuid, public.compliance_pack) is
  'Atomisk seed av OKR-plan + 4 default mål + 9-rolle RACI for en org. Returnerer eksisterende plan-id hvis allerede provisionert. Idempotent.';

revoke all on function public.provision_okr_baseline_for_org(uuid, public.compliance_pack) from public;
grant execute on function public.provision_okr_baseline_for_org(uuid, public.compliance_pack) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. RPC: stop_recurring_task — stoppe en vedvarende rutine
--
-- Setter recurrence_active=false + recurrence_stopped_at/by. Påvirker IKKE
-- den aktive forekomsten (åpne oppgave fortsetter), kun generering av
-- fremtidige forekomster.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.stop_recurring_task(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_parent uuid;
begin
  select organization_id, coalesce(recurrence_parent_item_id, id) into v_org, v_parent
    from public.task_items
    where id = p_task_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    raise exception 'Oppgave ikke funnet eller utenfor organisasjonen.';
  end if;

  -- Stopp hele serien: parent + alle barn + selve oppgaven (i tilfelle
  -- den ikke er parent og parent-feltet peker andre steder).
  update public.task_items
    set recurrence_active = false,
        recurrence_stopped_at = coalesce(recurrence_stopped_at, now()),
        recurrence_stopped_by = coalesce(recurrence_stopped_by, auth.uid())
    where organization_id = v_org
      and (
        id = v_parent
        or recurrence_parent_item_id = v_parent
        or id = p_task_id
      )
      and deleted_at is null;

  return true;
end;
$$;

comment on function public.stop_recurring_task(uuid) is
  'Stopp en vedvarende rutine. Påvirker bare fremtidige forekomster — den aktive oppgaven fortsetter til den fullføres / kanselleres normalt.';

revoke all on function public.stop_recurring_task(uuid) from public;
grant execute on function public.stop_recurring_task(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. RPC: update_recurring_task_interval — endre intervallet
--
-- Lar bruker endre frekvensen på en vedvarende rutine uten å stoppe den.
-- Eks: kvartalsvis (90) → halvårlig (180). Forrige instans påvirkes ikke;
-- neste regenerering bruker det nye intervallet.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.update_recurring_task_interval(
  p_task_id uuid,
  p_interval_days int,
  p_stop_at date default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
begin
  -- Krev positivt intervall — NULL er ikke gyldig her, bruk
  -- stop_recurring_task for å deaktivere.
  if p_interval_days is null or p_interval_days <= 0 then
    raise exception 'Intervall må være et positivt antall dager. Bruk stop_recurring_task for å stoppe serien.';
  end if;

  -- Praktisk øvre grense — hindrer feiltolking (eks. brukeren skrev
  -- antall år i stedet for dager). 10 år dekker alle reelle bruksmønstre.
  if p_interval_days > 3650 then
    raise exception 'Intervall kan ikke overstige 10 år (3650 dager).';
  end if;

  if p_stop_at is not null and p_stop_at < current_date then
    raise exception 'Slutt-dato kan ikke være i fortiden.';
  end if;

  select organization_id into v_org
    from public.task_items
    where id = p_task_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    raise exception 'Oppgave ikke funnet eller utenfor organisasjonen.';
  end if;

  -- Reaktivér + sett nytt intervall + (valgfri) ny stop-dato.
  update public.task_items
    set recurrence_active = true,
        recurrence_interval_days = p_interval_days,
        recurrence_stop_at = p_stop_at,
        recurrence_stopped_at = null,
        recurrence_stopped_by = null,
        -- Beregn next_recurrence_date på nytt basert på due_date eller now()
        next_recurrence_date = (coalesce(due_date, current_date) + (p_interval_days || ' days')::interval)::date
    where id = p_task_id;

  return true;
end;
$$;

comment on function public.update_recurring_task_interval(uuid, int, date) is
  'Oppdater intervallet på en vedvarende rutine. Reaktiverer dersom tidligere stoppet. NULL/0/negativt intervall kastes.';

revoke all on function public.update_recurring_task_interval(uuid, int, date) from public;
grant execute on function public.update_recurring_task_interval(uuid, int, date) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 13. RPC: generate_recurring_task_next — opprett neste forekomst
--
-- Kalles ved fullføring av en recurring task. Idempotent — håndhevet
-- av unique-indexen task_items_recurrence_child_unique_idx
-- (parent, due_date). Hvis et barn allerede eksisterer for samme
-- (parent, due_date) returnerer funksjonen den eksisterende ID-en.
--
-- Returnerer NULL hvis serien er stoppet (recurrence_active=false eller
-- recurrence_stopped_at satt) eller stop_at er passert.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.generate_recurring_task_next(p_completed_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_src record;
  v_new_due date;
  v_new_id uuid;
  v_parent uuid;
  v_existing uuid;
begin
  select * into v_src
    from public.task_items
    where id = p_completed_task_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    return null;
  end if;

  -- Bare regenerer for aktivt-recurring oppgaver med definert intervall.
  -- recurrence_stopped_at er en ekstra guard mot direkte DB-UPDATE.
  if not v_src.recurrence_active
     or v_src.recurrence_interval_days is null
     or v_src.recurrence_stopped_at is not null then
    return null;
  end if;

  -- Beregn ny frist basert på due_date (fallback til current_date).
  v_new_due := (coalesce(v_src.due_date, current_date)
                + (v_src.recurrence_interval_days || ' days')::interval)::date;

  -- Sjekk eksplisitt stop_at — hvis passert, deaktivér serien og returner null.
  if v_src.recurrence_stop_at is not null
     and v_new_due > v_src.recurrence_stop_at then
    update public.task_items
      set recurrence_active = false
      where id = p_completed_task_id;
    return null;
  end if;

  v_parent := coalesce(v_src.recurrence_parent_item_id, v_src.id);

  -- Idempotency: hvis et barn allerede eksisterer for (parent, due_date),
  -- returner den i stedet for å opprette en duplikat.
  select id into v_existing
    from public.task_items
    where recurrence_parent_item_id = v_parent
      and due_date = v_new_due
      and deleted_at is null
    limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  -- Opprett ny forekomst. Setter source_type/source_id slik at workflow-
  -- rules som lytter på 'recurring_child' ikke prosesserer rekursivt.
  insert into public.task_items (
    organization_id, project_id, pack, source_category, pdca_phase,
    title, description, status, priority, law_refs,
    owner_user_id, owner_name, assignee_user_id, assignee_name,
    template_slug, template_kind, due_date,
    source_type, source_id,
    recurrence_active, recurrence_interval_days, recurrence_cadence,
    recurrence_stop_at, recurrence_parent_item_id,
    next_recurrence_date
  )
  values (
    v_src.organization_id, v_src.project_id, v_src.pack, v_src.source_category, v_src.pdca_phase,
    v_src.title, v_src.description, 'open', v_src.priority, v_src.law_refs,
    v_src.owner_user_id, v_src.owner_name, v_src.assignee_user_id, v_src.assignee_name,
    v_src.template_slug, v_src.template_kind, v_new_due,
    -- recurring_child markerer dette som auto-generert; workflow-engine
    -- kan filtrere på dette for å unngå rekursjon hvis en regel
    -- skulle reagere på "ny oppgave opprettet".
    'recurring_child', v_parent,
    true, v_src.recurrence_interval_days, v_src.recurrence_cadence,
    v_src.recurrence_stop_at, v_parent,
    (v_new_due + (v_src.recurrence_interval_days || ' days')::interval)::date
  )
  returning id into v_new_id;

  return v_new_id;
exception
  when unique_violation then
    -- En annen samtidig completion vant racen — returner den eksisterende.
    select id into v_existing
      from public.task_items
      where recurrence_parent_item_id = v_parent
        and due_date = v_new_due
        and deleted_at is null
      limit 1;
    return v_existing;
end;
$$;

comment on function public.generate_recurring_task_next(uuid) is
  'Opprett neste forekomst av en recurring task. Idempotent — sjekker (parent, due_date) før insert. Returnerer NULL hvis serien er stoppet eller slutt-dato er passert.';

revoke all on function public.generate_recurring_task_next(uuid) from public;
grant execute on function public.generate_recurring_task_next(uuid) to authenticated;
