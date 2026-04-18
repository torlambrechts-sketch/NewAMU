-- Sikker jobbanalyse (SJA): templates, analyses, participants, tasks, hazards, measures.

-- ── sja_templates ────────────────────────────────────────────────────────────

create table if not exists public.sja_templates (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  name                  text not null,
  job_type              text not null,
  description           text,
  required_certs        text[],
  prefill_tasks         jsonb,
  is_active             boolean not null default true,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── sja_analyses ─────────────────────────────────────────────────────────────

create table if not exists public.sja_analyses (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations(id) on delete cascade,
  template_id                uuid references public.sja_templates(id) on delete set null,
  location_id                uuid references public.locations(id) on delete set null,
  location_text              text,
  title                      text not null,
  job_description            text not null,
  job_type                   text not null,
  trigger_reason             text not null,
  responsible_id             uuid references auth.users(id) on delete set null,
  scheduled_start            timestamptz,
  scheduled_end              timestamptz,
  actual_start               timestamptz,
  actual_end                 timestamptz,
  status                     text not null default 'draft'
                               check (status in ('draft','active','approved','in_execution','completed','archived','stopped')),
  stop_reason                text,
  debrief_notes              text,
  unexpected_hazards         boolean,
  debrief_completed_by       uuid references auth.users(id) on delete set null,
  debrief_completed_at       timestamptz,
  avvik_created              boolean not null default false,
  deleted_at                 timestamptz,
  created_by                 uuid references auth.users(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ── sja_participants ─────────────────────────────────────────────────────────

create table if not exists public.sja_participants (
  id                      uuid primary key default gen_random_uuid(),
  sja_id                  uuid not null references public.sja_analyses(id) on delete cascade,
  user_id                 uuid references auth.users(id) on delete set null,
  name                    text not null,
  role                    text not null check (role in ('responsible','worker','contractor','observer')),
  company                 text,
  certs_verified          boolean not null default false,
  certs_notes             text,
  signed_at               timestamptz,
  created_at              timestamptz not null default now()
);

-- ── sja_tasks ─────────────────────────────────────────────────────────────────

create table if not exists public.sja_tasks (
  id           uuid primary key default gen_random_uuid(),
  sja_id       uuid not null references public.sja_analyses(id) on delete cascade,
  title        text not null,
  description  text,
  position     integer not null,
  created_at   timestamptz not null default now()
);

-- ── sja_hazards ──────────────────────────────────────────────────────────────

create table if not exists public.sja_hazards (
  id                    uuid primary key default gen_random_uuid(),
  sja_id                uuid not null references public.sja_analyses(id) on delete cascade,
  task_id               uuid not null references public.sja_tasks(id) on delete cascade,
  description           text not null,
  category              text,
  initial_probability   integer check (initial_probability between 1 and 5),
  initial_consequence   integer check (initial_consequence between 1 and 5),
  residual_probability  integer check (residual_probability between 1 and 5),
  residual_consequence  integer check (residual_consequence between 1 and 5),
  chemical_ref          text,
  created_at            timestamptz not null default now()
);

-- ── sja_measures ─────────────────────────────────────────────────────────────

create table if not exists public.sja_measures (
  id                uuid primary key default gen_random_uuid(),
  sja_id            uuid not null references public.sja_analyses(id) on delete cascade,
  hazard_id         uuid not null references public.sja_hazards(id) on delete cascade,
  description       text not null,
  control_type      text not null
                      check (control_type in ('eliminate','substitute','engineering','administrative','ppe')),
  assigned_to_id    uuid references auth.users(id) on delete set null,
  assigned_to_name  text,
  completed         boolean not null default false,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists sja_analyses_org_status_idx on public.sja_analyses(organization_id, status, created_at desc);
create index if not exists sja_hazards_task_idx on public.sja_hazards(task_id);
create index if not exists sja_measures_hazard_idx on public.sja_measures(hazard_id);
create index if not exists sja_participants_sja_idx on public.sja_participants(sja_id);
create index if not exists sja_tasks_sja_idx on public.sja_tasks(sja_id);
create index if not exists sja_hazards_sja_idx on public.sja_hazards(sja_id);
create index if not exists sja_measures_sja_idx on public.sja_measures(sja_id);

-- ── RLS: sja_analyses ─────────────────────────────────────────────────────────

alter table public.sja_analyses enable row level security;

create policy if not exists sja_analyses_select on public.sja_analyses for select to authenticated
  using (organization_id = public.current_org_id() and deleted_at is null);

create policy if not exists sja_analyses_insert on public.sja_analyses for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy if not exists sja_analyses_update on public.sja_analyses for update to authenticated
  using (organization_id = public.current_org_id());

create policy if not exists sja_analyses_delete on public.sja_analyses for delete to authenticated
  using (organization_id = public.current_org_id());

-- ── RLS: sja_templates (direct org column) ───────────────────────────────────

alter table public.sja_templates enable row level security;

create policy if not exists sja_templates_select on public.sja_templates for select to authenticated
  using (organization_id = public.current_org_id());

create policy if not exists sja_templates_insert on public.sja_templates for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy if not exists sja_templates_update on public.sja_templates for update to authenticated
  using (organization_id = public.current_org_id());

create policy if not exists sja_templates_delete on public.sja_templates for delete to authenticated
  using (organization_id = public.current_org_id());

-- ── RLS: nested rows (org via parent sja_analyses) ───────────────────────────

alter table public.sja_participants enable row level security;
alter table public.sja_tasks enable row level security;
alter table public.sja_hazards enable row level security;
alter table public.sja_measures enable row level security;

create policy if not exists sja_participants_select on public.sja_participants for select to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_participants.sja_id
      and a.organization_id = public.current_org_id()
      and a.deleted_at is null
  ));

create policy if not exists sja_participants_insert on public.sja_participants for insert to authenticated
  with check (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_participants.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_participants_update on public.sja_participants for update to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_participants.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_participants_delete on public.sja_participants for delete to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_participants.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_tasks_select on public.sja_tasks for select to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_tasks.sja_id
      and a.organization_id = public.current_org_id()
      and a.deleted_at is null
  ));

create policy if not exists sja_tasks_insert on public.sja_tasks for insert to authenticated
  with check (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_tasks.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_tasks_update on public.sja_tasks for update to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_tasks.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_tasks_delete on public.sja_tasks for delete to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_tasks.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_hazards_select on public.sja_hazards for select to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_hazards.sja_id
      and a.organization_id = public.current_org_id()
      and a.deleted_at is null
  ));

create policy if not exists sja_hazards_insert on public.sja_hazards for insert to authenticated
  with check (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_hazards.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_hazards_update on public.sja_hazards for update to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_hazards.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_hazards_delete on public.sja_hazards for delete to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_hazards.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_measures_select on public.sja_measures for select to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_measures.sja_id
      and a.organization_id = public.current_org_id()
      and a.deleted_at is null
  ));

create policy if not exists sja_measures_insert on public.sja_measures for insert to authenticated
  with check (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_measures.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_measures_update on public.sja_measures for update to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_measures.sja_id
      and a.organization_id = public.current_org_id()
  ));

create policy if not exists sja_measures_delete on public.sja_measures for delete to authenticated
  using (exists (
    select 1 from public.sja_analyses a
    where a.id = sja_measures.sja_id
      and a.organization_id = public.current_org_id()
  ));

-- ── Grants ───────────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.sja_templates to authenticated;
grant select, insert, update, delete on public.sja_analyses to authenticated;
grant select, insert, update, delete on public.sja_participants to authenticated;
grant select, insert, update, delete on public.sja_tasks to authenticated;
grant select, insert, update, delete on public.sja_hazards to authenticated;
grant select, insert, update, delete on public.sja_measures to authenticated;

-- ── BEFORE INSERT: sja_analyses ───────────────────────────────────────────────

create or replace function public.sja_analyses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists sja_analyses_before_insert_tg on public.sja_analyses;
create trigger sja_analyses_before_insert_tg
  before insert on public.sja_analyses
  for each row execute function public.sja_analyses_before_insert();

-- ── BEFORE INSERT: sja_templates ──────────────────────────────────────────────

create or replace function public.sja_templates_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists sja_templates_before_insert_tg on public.sja_templates;
create trigger sja_templates_before_insert_tg
  before insert on public.sja_templates
  for each row execute function public.sja_templates_before_insert();

-- ── Audit: sja_analyses ───────────────────────────────────────────────────────

drop trigger if exists sja_analyses_audit_tg on public.sja_analyses;
create trigger sja_analyses_audit_tg
  after insert or update or delete on public.sja_analyses
  for each row execute function public.hse_audit_trigger();
