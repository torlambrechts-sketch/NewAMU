-- Task template versioning — immutable history of every template change.
--
-- Coverage gap closed:
--   ISO 45001 § 7.5.3 requires control of documented information including
--   protection from unintended alteration. task_template_catalog had no
--   version history: modifying a template after items were created against it
--   loses "what was required at the time" for audit purposes.
--   This migration adds:
--     - task_template_versions table (full snapshot per change)
--     - Trigger on task_template_catalog UPDATE that bumps version counter
--       and writes the previous state as a snapshot row
--     - task_module_settings table for org-level task module configuration
--       (SLA rules, lifecycle gates, notification preferences)
--
-- Self-audit:
--   ISO § 7.5.3 + AML § 5-2 krav om dokumentert informasjon. Versjonering
--   sikrer at en revisor kan se malen som gjaldt da et avvik ble opprettet.
--   Restrisiko: snapshots er JSONB, ikke strukturert schema — søk og diff
--   er app-ansvar, ikke DB-ansvar.

set local search_path = public, pg_catalog;

-- ── Table: task_template_versions ────────────────────────────────────────

create table if not exists public.task_template_versions (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.task_template_catalog (id) on delete cascade,
  version     int not null,
  -- Full snapshot of the template at this version
  snapshot    jsonb not null,
  changed_by  uuid references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now(),
  unique (catalog_id, version)
);

create index if not exists task_template_versions_catalog_version_idx
  on public.task_template_versions (catalog_id, version desc);

alter table public.task_template_versions enable row level security;

-- System templates readable by all orgs; custom templates by owner org
drop policy if exists task_template_versions_select on public.task_template_versions;
create policy task_template_versions_select
  on public.task_template_versions for select
  using (
    exists (
      select 1 from public.task_template_catalog c
      where c.id = task_template_versions.catalog_id
        and (c.organization_id is null or c.organization_id = public.current_org_id())
    )
  );

-- INSERT allowed for org-owned templates
drop policy if exists task_template_versions_insert on public.task_template_versions;
create policy task_template_versions_insert
  on public.task_template_versions for insert
  with check (
    exists (
      select 1 from public.task_template_catalog c
      where c.id = task_template_versions.catalog_id
        and (c.organization_id is null or c.organization_id = public.current_org_id())
    )
  );

-- Trigger: on every UPDATE to task_template_catalog, snapshot old state
create or replace function public.task_template_catalog_version_trigger()
returns trigger
language plpgsql
as $$
begin
  -- Bump version counter
  new.version := old.version + 1;

  -- Write snapshot of the PREVIOUS state before applying the update
  insert into public.task_template_versions (catalog_id, version, snapshot, changed_by)
  values (
    old.id,
    old.version,
    to_jsonb(old),
    auth.uid()
  ) on conflict (catalog_id, version) do nothing;

  return new;
end;
$$;

drop trigger if exists task_template_catalog_version_tg on public.task_template_catalog;
create trigger task_template_catalog_version_tg
  before update on public.task_template_catalog
  for each row execute function public.task_template_catalog_version_trigger();

-- ── Table: task_module_settings ───────────────────────────────────────────
-- Per-org module configuration: SLA rules, lifecycle gate behaviour,
-- notification preferences, and approval rules.

create table if not exists public.task_module_settings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  unique (organization_id),

  -- SLA hours by priority (default: critical=24, high=168, medium=720, low=2160)
  sla_critical_hours  int not null default 24,
  sla_high_hours      int not null default 168,
  sla_medium_hours    int not null default 720,
  sla_low_hours       int not null default 2160,

  -- Lifecycle gate for avvik: hard = cannot close without linked tiltak
  -- soft = warning only, none = no check
  avvik_closure_gate  text not null default 'hard'
    check (avvik_closure_gate in ('hard', 'soft', 'none')),

  -- Require VO consultation before approving risiko items
  risiko_requires_vo_consultation boolean not null default true,

  -- Require reviewer != assignee for avvik and risiko
  requires_independent_review boolean not null default true,

  -- Auto-create Arbeidstilsynet notification task for serious incidents (AML § 5-1)
  auto_arbeidstilsynet_task boolean not null default true,

  -- Notification deadline hours for serious incidents (AML § 5-1: 24h)
  arbeidstilsynet_notification_hours int not null default 24,

  -- Escalation: notify manager after this many hours past SLA
  escalation_hours_after_sla int not null default 24,

  -- Email digest: daily | weekly | none
  email_digest text not null default 'daily'
    check (email_digest in ('daily', 'weekly', 'none')),

  -- Show effectiveness review prompt after this many days past action_implemented
  effectiveness_review_days int not null default 30,

  -- Recurring task auto-create: create next instance on close
  enable_recurring_tasks boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.task_module_settings enable row level security;

drop policy if exists task_module_settings_select_org on public.task_module_settings;
create policy task_module_settings_select_org
  on public.task_module_settings for select
  using (organization_id = public.current_org_id());

drop policy if exists task_module_settings_write_org on public.task_module_settings;
create policy task_module_settings_write_org
  on public.task_module_settings for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop trigger if exists task_module_settings_set_updated_at on public.task_module_settings;
create trigger task_module_settings_set_updated_at
  before update on public.task_module_settings
  for each row execute function public.set_updated_at();

-- Seed default settings for all existing orgs
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.task_module_settings (organization_id)
    values (v_org_id)
    on conflict (organization_id) do nothing;
  end loop;
end $$;

-- Extend provision function to also seed settings
create or replace function public.provision_tasks_baseline_for_org(
  p_org_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_cat_avvik   uuid;
  v_cat_risiko  uuid;
  v_cat_medvir  uuid;
  v_cat_syk     uuid;
  v_tpl         record;
begin
  -- AML pack
  insert into public.task_packs (
    organization_id, slug, short_name, plural_label, cta_label,
    description, legal_references, kpi_labels, severity_labels, position
  ) values (
    p_org_id, 'aml-amu', 'AML', 'Oppgaver', 'Ny oppgave',
    'Oppgavemodul for HMS og AML-etterlevelse',
    '[{"code":"AML § 3-1","text":"Risikovurdering"},
      {"code":"AML § 5-1","text":"Meldeplikt"},
      {"code":"AML § 5-2","text":"Avviksbehandling"}]'::jsonb,
    '{"open":"Åpne","critical":"Kritiske","ytd":"I år"}'::jsonb,
    '{"critical":"Kritisk","high":"Høy","medium":"Medium","low":"Lav"}'::jsonb,
    10
  ) on conflict (organization_id, slug) do nothing;

  -- Default categories
  insert into public.task_template_categories
    (organization_id, name, description, position, is_active)
  values
    (p_org_id, 'Avvik & Hendelser',        'Avvik, ulykker og nestenulykker',             10, true),
    (p_org_id, 'Risiko & Tiltak',          'Risikovurderinger og forbedringstiltak',       20, true),
    (p_org_id, 'Medvirkning & Forslag',    'Forslag fra ansatte og medvirkningsprosesser', 30, true),
    (p_org_id, 'Sykefravær & Tilrettelegging', 'Oppfølging av sykefravær',               40, true)
  on conflict (organization_id, name) do nothing;

  select id into v_cat_avvik  from public.task_template_categories
    where organization_id = p_org_id and name = 'Avvik & Hendelser';
  select id into v_cat_risiko from public.task_template_categories
    where organization_id = p_org_id and name = 'Risiko & Tiltak';
  select id into v_cat_medvir from public.task_template_categories
    where organization_id = p_org_id and name = 'Medvirkning & Forslag';
  select id into v_cat_syk    from public.task_template_categories
    where organization_id = p_org_id and name = 'Sykefravær & Tilrettelegging';

  -- Activate system templates
  for v_tpl in
    select id, slug from public.task_template_catalog
    where is_system = true and is_active = true and organization_id is null
  loop
    insert into public.task_org_templates
      (organization_id, catalog_id, nav_pinned, is_active, category_id)
    values (
      p_org_id, v_tpl.id,
      (v_tpl.slug in ('avvik', 'tiltak', 'risiko')),
      true,
      case v_tpl.slug
        when 'avvik'                 then v_cat_avvik
        when 'nestenulykke'          then v_cat_avvik
        when 'tiltak'                then v_cat_risiko
        when 'risiko'                then v_cat_risiko
        when 'forslag'               then v_cat_medvir
        when 'oppgave-generell'      then v_cat_medvir
        when 'sykefravær-oppfølging' then v_cat_syk
        else null
      end
    ) on conflict (organization_id, catalog_id) do update set
      is_active   = true,
      category_id = excluded.category_id;
  end loop;

  -- Module settings
  insert into public.task_module_settings (organization_id)
  values (p_org_id)
  on conflict (organization_id) do nothing;
end;
$$;
