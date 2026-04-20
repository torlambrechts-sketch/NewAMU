-- ROS module: organization-scoped settings (probability scale, consequence & hazard categories, templates)
-- + DB workflow events for ros module (db_event triggers)

-- ── 1. Settings: probability scale (1–5) ─────────────────────────────────────
create table if not exists public.ros_probability_scale_levels (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  level             smallint not null check (level between 1 and 5),
  label             text not null,
  description       text,
  sort_order        smallint not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, level)
);

create index if not exists ros_prob_scale_org_idx
  on public.ros_probability_scale_levels(organization_id, sort_order)
  where deleted_at is null;

-- ── 2. Consequence categories (matrix axis / reporting) ───────────────────────
create table if not exists public.ros_consequence_categories (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  code              text not null,
  label             text not null,
  description       text,
  matrix_column     smallint not null check (matrix_column between 1 and 5),
  sort_order        smallint not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, matrix_column)
);

create index if not exists ros_cons_cat_org_idx
  on public.ros_consequence_categories(organization_id, sort_order)
  where deleted_at is null;

-- ── 3. Hazard categories ───────────────────────────────────────────────────
create table if not exists public.ros_hazard_categories (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  code              text not null,
  label             text not null,
  description       text,
  sort_order        smallint not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists ros_haz_cat_org_idx
  on public.ros_hazard_categories(organization_id, sort_order)
  where deleted_at is null;

-- ── 4. Standard ROS templates (JSONB definition) ─────────────────────────────
create table if not exists public.ros_templates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  definition        jsonb not null default '{}',
  is_active         boolean not null default true,
  deleted_at        timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ros_templates_org_idx
  on public.ros_templates(organization_id, is_active, updated_at desc)
  where deleted_at is null;

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
alter table public.ros_probability_scale_levels enable row level security;
alter table public.ros_consequence_categories enable row level security;
alter table public.ros_hazard_categories enable row level security;
alter table public.ros_templates enable row level security;

drop policy if exists ros_prob_scale_select on public.ros_probability_scale_levels;
drop policy if exists ros_prob_scale_write on public.ros_probability_scale_levels;
create policy ros_prob_scale_select on public.ros_probability_scale_levels
  for select to authenticated using (organization_id = public.current_org_id());
create policy ros_prob_scale_write on public.ros_probability_scale_levels
  for all to authenticated using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists ros_cons_cat_select on public.ros_consequence_categories;
drop policy if exists ros_cons_cat_write on public.ros_consequence_categories;
create policy ros_cons_cat_select on public.ros_consequence_categories
  for select to authenticated using (organization_id = public.current_org_id());
create policy ros_cons_cat_write on public.ros_consequence_categories
  for all to authenticated using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists ros_haz_cat_select on public.ros_hazard_categories;
drop policy if exists ros_haz_cat_write on public.ros_hazard_categories;
create policy ros_haz_cat_select on public.ros_hazard_categories
  for select to authenticated using (organization_id = public.current_org_id());
create policy ros_haz_cat_write on public.ros_hazard_categories
  for all to authenticated using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists ros_templates_select on public.ros_templates;
drop policy if exists ros_templates_write on public.ros_templates;
create policy ros_templates_select on public.ros_templates
  for select to authenticated using (organization_id = public.current_org_id());
create policy ros_templates_write on public.ros_templates
  for all to authenticated using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update, delete on public.ros_probability_scale_levels to authenticated;
grant select, insert, update, delete on public.ros_consequence_categories to authenticated;
grant select, insert, update, delete on public.ros_hazard_categories to authenticated;
grant select, insert, update, delete on public.ros_templates to authenticated;

-- updated_at triggers (reuse set_updated_at if present)
drop trigger if exists ros_prob_scale_updated_at on public.ros_probability_scale_levels;
create trigger ros_prob_scale_updated_at
  before update on public.ros_probability_scale_levels
  for each row execute function public.set_updated_at();

drop trigger if exists ros_cons_cat_updated_at on public.ros_consequence_categories;
create trigger ros_cons_cat_updated_at
  before update on public.ros_consequence_categories
  for each row execute function public.set_updated_at();

drop trigger if exists ros_haz_cat_updated_at on public.ros_hazard_categories;
create trigger ros_haz_cat_updated_at
  before update on public.ros_hazard_categories
  for each row execute function public.set_updated_at();

drop trigger if exists ros_templates_updated_at on public.ros_templates;
create trigger ros_templates_updated_at
  before update on public.ros_templates
  for each row execute function public.set_updated_at();

-- ── 6. Workflow DB triggers (requires workflow_dispatch_db_event from archive migrations) ──

create or replace function public.trg_ros_analyses_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_row   jsonb;
begin
  v_row := to_jsonb(new);

  if tg_op = 'INSERT' then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'ros', 'ON_ROS_CREATED', v_row
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'approved' and old.status is distinct from 'approved' then
      perform public.workflow_dispatch_db_event(
        new.organization_id, 'ros', 'ON_ROS_APPROVED', v_row
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ros_analyses_workflow_insert_tg on public.ros_analyses;
create trigger ros_analyses_workflow_insert_tg
  after insert on public.ros_analyses
  for each row execute function public.trg_ros_analyses_workflow();

drop trigger if exists ros_analyses_workflow_status_tg on public.ros_analyses;
create trigger ros_analyses_workflow_status_tg
  after update of status on public.ros_analyses
  for each row execute function public.trg_ros_analyses_workflow();

create or replace function public.trg_ros_hazards_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_score   int;
  v_res_p   int;
  v_res_c   int;
  v_ini_p   int;
  v_ini_c   int;
begin
  v_row := to_jsonb(new);
  v_res_p := (new.residual_probability);
  v_res_c := (new.residual_consequence);
  v_ini_p := (new.initial_probability);
  v_ini_c := (new.initial_consequence);

  if v_res_p is not null and v_res_c is not null then
    v_score := v_res_p * v_res_c;
  elsif v_ini_p is not null and v_ini_c is not null then
    v_score := v_ini_p * v_ini_c;
  else
    return new;
  end if;

  if v_score >= 15 then
    if tg_op = 'INSERT' then
      perform public.workflow_dispatch_db_event(
        new.organization_id, 'ros', 'ON_ROS_CRITICAL_RISK', v_row
      );
    elsif tg_op = 'UPDATE' then
      if old.residual_probability is distinct from new.residual_probability
         or old.residual_consequence is distinct from new.residual_consequence
         or old.initial_probability is distinct from new.initial_probability
         or old.initial_consequence is distinct from new.initial_consequence
      then
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'ros', 'ON_ROS_CRITICAL_RISK', v_row
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ros_hazards_workflow_tg on public.ros_hazards;
create trigger ros_hazards_workflow_tg
  after insert or update of residual_probability, residual_consequence, initial_probability, initial_consequence
  on public.ros_hazards
  for each row execute function public.trg_ros_hazards_workflow();

-- ── 8. Seed defaults for existing organizations (idempotent per row) ─────────
insert into public.ros_probability_scale_levels (organization_id, level, label, description, sort_order)
select o.id, x.level, x.label, x.description, x.level
from public.organizations o
cross join (values
  (1, 'Svært lav', 'Innbygget sikkerhet, sjelden hendelse'),
  (2, 'Lav', 'Lite sannsynlig i normal drift'),
  (3, 'Middels', 'Kan forekomme i løpet av året'),
  (4, 'Høy', 'Forekommer ofte eller under visse forhold'),
  (5, 'Svært høy', 'Nært forestående eller allerede observert')
) as x(level, label, description)
where not exists (
  select 1 from public.ros_probability_scale_levels p
  where p.organization_id = o.id and p.level = x.level and p.deleted_at is null
);

insert into public.ros_consequence_categories (organization_id, code, label, description, matrix_column, sort_order)
select o.id, x.code, x.label, x.description, x.matrix_column, x.matrix_column
from public.organizations o
cross join (values
  ('C1', 'Ubetydelig', 'Ingen eller ubetydelig personskade', 1),
  ('C2', 'Liten', 'Mindre skade, kort sykefravær', 2),
  ('C3', 'Moderat', 'Alvorlig skade eller miljøskade', 3),
  ('C4', 'Alvorlig', 'Dødsfall, varig invaliditet eller større utslipp', 4),
  ('C5', 'Katastrofal', 'Flere dødsfall eller omfattende miljøkatastrofe', 5)
) as x(code, label, description, matrix_column)
where not exists (
  select 1 from public.ros_consequence_categories c
  where c.organization_id = o.id and c.code = x.code and c.deleted_at is null
);

insert into public.ros_hazard_categories (organization_id, code, label, description, sort_order)
select o.id, x.code, x.label, x.description, x.sort_order
from public.organizations o
cross join (values
  ('physical', 'Fysisk', 'Støy, vibrasjon, temperatur', 10),
  ('ergonomic', 'Ergonomisk', 'Arbeidsstillinger, løft', 20),
  ('chemical', 'Kjemisk', 'Eksponering for stoffer', 30),
  ('psychosocial', 'Psykososialt', 'Organisasjon, vold/trusler', 40),
  ('fire', 'Brann/eksplosjon', 'Tenning, trykk', 50),
  ('electrical', 'Elektrisk', 'Støt, brenning', 60),
  ('environmental', 'Miljø', 'Utslipp til luft/vann/jord', 70),
  ('machinery', 'Maskiner', 'Klem, kutt, trekk', 80),
  ('other', 'Annet', 'Øvrige farer', 90)
) as x(code, label, description, sort_order)
where not exists (
  select 1 from public.ros_hazard_categories h
  where h.organization_id = o.id and h.code = x.code and h.deleted_at is null
);
