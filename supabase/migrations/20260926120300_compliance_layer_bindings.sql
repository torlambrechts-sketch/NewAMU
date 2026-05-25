-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M4 — internal_control_bindings (declarative spec)
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   `internal_control_bindings` is the *declarative* layer between Tier
--   2 (control) and Tier 3 (module artefact). A binding row says: "this
--   control is satisfied when an artefact of THIS kind from THIS template
--   exists/is signed/falls within THIS cadence". Without it, an admin
--   would have to manually mark every checklist execution as evidence
--   of every control it satisfies. With it, M5's auto-bind triggers can
--   look up bindings and produce internal_control_executions rows for
--   free on every sign event.
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 1 a + AML § 3-1 (2) c krever skriftlig dokumentasjon
--     av hvilke aktiviteter som oppfyller hvilke krav. En binding-rad
--     er det skriftlige sporet: "ledelses-gjennomgang-kontroll satisfies
--     ved AMU-årsmøte-mal ELLER ved Årsgjennomgang-dokument-mal".
--   - IK-f § 5 nr. 7 krever dokumentasjon for tilsyn. `requirement_kind`
--     ('latest_within_cadence' / 'signed' / 'exists') gjør det maskin-
--     lesbart hva som teller som tilstrekkelig bevis — Arbeidstilsynet
--     trenger ikke tolke heuristikker.
--   - Restrisiko: 1) `source_template_id` er text fordi de seks bundne
--     template-tabellene bruker både uuid og text-id (compliance_
--     checklist_templates = uuid, document_system_templates = text,
--     osv.). Validerings-triggeren caster eksplisitt. 2) `manual_
--     evidence` source_kind hopper over template-validering (binding er
--     placeholder for ad hoc bevisopplastning per M5).

set local search_path = public, pg_catalog;

-- ── 1. Enums ─────────────────────────────────────────────────────────────

do $$ begin
  create type public.control_binding_source_kind as enum (
    'compliance_execution',
    'survey_response',
    'document_acknowledgement',
    'learning_completion',
    'task_completion',
    'meeting_protocol',
    'register_record',
    'manual_evidence'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.control_binding_requirement_kind as enum (
    'latest_within_cadence',   -- Most recent execution must be within frequency_hint window
    'count_within_period',     -- Need N executions within the period (e.g. 4 quarterly fire drills)
    'exists',                  -- Any matching artefact at all (one-shot)
    'signed'                   -- Latest matching artefact must be signed (not just submitted)
  );
exception when duplicate_object then null; end $$;

-- ── 2. Table ─────────────────────────────────────────────────────────────

create table if not exists public.internal_control_bindings (
  id                      uuid primary key default gen_random_uuid(),
  control_id              uuid not null references public.internal_controls (id) on delete cascade,
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  source_kind             public.control_binding_source_kind not null,
  source_template_table   text not null,
  source_template_id      text not null,
  source_template_slug    text,
  requirement_kind        public.control_binding_requirement_kind not null
                            default 'latest_within_cadence',
  cadence_hint            text,
  lead_time_days          integer not null default 30
                            check (lead_time_days >= 0),
  required_count          integer not null default 1
                            check (required_count >= 1),
  period_months           integer not null default 12
                            check (period_months >= 1),
  is_required             boolean not null default true,
  is_active               boolean not null default true,
  notes                   text not null default '',
  metadata                jsonb not null default '{}'::jsonb,
  is_system               boolean not null default false,
  deleted_at              timestamptz,
  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Same template cannot be bound twice to the same control with same
  -- requirement kind — prevents duplicate-counting in status view.
  unique (control_id, source_kind, source_template_id, requirement_kind),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    cadence_hint is null
    or cadence_hint in ('arlig','halvarlig','kvartalsvis','manedlig','ukentlig','daglig','ad_hoc')
  ),
  check (
    source_template_table in (
      'compliance_checklist_templates',
      'survey_template_catalog',
      'surveys',
      'survey_campaigns',
      'document_system_templates',
      'document_org_templates',
      'learning_courses',
      'task_template_catalog',
      'task_org_templates',
      'meeting_system_templates',
      'meeting_org_templates',
      'register_types',
      ''  -- empty allowed only for source_kind='manual_evidence'
    )
  ),
  check (
    (source_kind = 'manual_evidence' and source_template_table = '' and source_template_id = '')
    or (source_kind <> 'manual_evidence' and char_length(source_template_table) > 0 and char_length(source_template_id) > 0)
  )
);

comment on table public.internal_control_bindings is
  $c$Declarative spec of what counts as proof. Polymorphic over the
  seven module template surfaces. Auto-bind triggers (M5) look up
  matching bindings on every sign event and insert
  internal_control_executions rows. requirement_kind controls how the
  status view computes "satisfied".$c$;

comment on column public.internal_control_bindings.source_template_table is
  $c$Which template table the binding points at. Enumerated via CHECK
  rather than enum so adding a new template surface is a forward
  migration (just extend the CHECK) without an ALTER TYPE.$c$;

comment on column public.internal_control_bindings.source_template_id is
  $c$Text because the bound template tables use a mix of uuid PKs and
  slug PKs. Validation trigger casts as needed.$c$;

comment on column public.internal_control_bindings.cadence_hint is
  $c$Per-binding override of the parent control's frequency_hint.
  Used when a control has multiple bindings with different cadences
  (e.g. monthly fire drill log + annual fire policy review).$c$;

comment on column public.internal_control_bindings.is_required is
  $c$When true, the binding must be satisfied for the control to be
  'on_track'. When false, the binding is supporting evidence — useful
  for redundant or partial coverage.$c$;

create index if not exists internal_control_bindings_control_idx
  on public.internal_control_bindings (control_id, is_active)
  where deleted_at is null;

create index if not exists internal_control_bindings_lookup_idx
  on public.internal_control_bindings (organization_id, source_kind, source_template_id)
  where deleted_at is null and is_active = true;

-- ── 3. RLS ───────────────────────────────────────────────────────────────

alter table public.internal_control_bindings enable row level security;

drop policy if exists internal_control_bindings_select_org on public.internal_control_bindings;
create policy internal_control_bindings_select_org
  on public.internal_control_bindings for select
  using (organization_id = public.current_org_id());

drop policy if exists internal_control_bindings_write_org on public.internal_control_bindings;
create policy internal_control_bindings_write_org
  on public.internal_control_bindings for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
  );

-- ── 4. Triggers: defaults, updated_at, template-existence validation ─────

create or replace function public.internal_control_bindings_before_insert_defaults()
returns trigger
language plpgsql
as $$
declare
  v_control_org uuid;
begin
  -- Derive organization_id from the parent control.
  select organization_id into v_control_org
    from public.internal_controls
    where id = new.control_id
      and deleted_at is null;
  if v_control_org is null then
    raise exception
      'internal_control_bindings.control_id % does not exist (active)',
      new.control_id;
  end if;
  new.organization_id := v_control_org;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists internal_control_bindings_before_insert_defaults_tg on public.internal_control_bindings;
create trigger internal_control_bindings_before_insert_defaults_tg
  before insert on public.internal_control_bindings
  for each row execute function public.internal_control_bindings_before_insert_defaults();

drop trigger if exists internal_control_bindings_set_updated_at on public.internal_control_bindings;
create trigger internal_control_bindings_set_updated_at
  before update on public.internal_control_bindings
  for each row execute function public.set_updated_at();

-- Validate that the referenced template exists in the chosen table.
-- Uses dynamic SQL because we can't pre-declare FKs across 12 different
-- template tables. Skipped for manual_evidence bindings.
--
-- NB: the function body is wrapped in $fn$...$fn$ (tagged dollar quote)
-- so the dynamic-SQL string literals using $$ inside don't terminate the
-- outer body prematurely. Anonymous $$...$$ wrapping would parse as
-- `as $$...$$select count(*)...$$` and fail with "syntax error at select".
create or replace function public.internal_control_bindings_validate_template()
returns trigger
language plpgsql
as $fn$
declare
  v_count int;
  v_sql   text;
begin
  if new.source_kind = 'manual_evidence' then
    return new;
  end if;

  if to_regclass('public.' || new.source_template_table) is null then
    raise exception
      'internal_control_bindings: template table public.% does not exist',
      new.source_template_table;
  end if;

  -- Text-equality existence check works for both uuid PKs and text PKs.
  -- Org-scope is already enforced by RLS on the parent control + the
  -- internal_control_bindings_before_insert_defaults trigger that derives
  -- organization_id from the parent, so we don't re-check it here.
  v_sql := format(
    'select count(*) from public.%I where id::text = %L',
    new.source_template_table, new.source_template_id
  );
  execute v_sql into v_count;
  if v_count = 0 then
    raise exception
      'internal_control_bindings: template id % not found in public.%',
      new.source_template_id, new.source_template_table;
  end if;
  return new;
end;
$fn$;

drop trigger if exists internal_control_bindings_validate_template_tg on public.internal_control_bindings;
create trigger internal_control_bindings_validate_template_tg
  before insert or update on public.internal_control_bindings
  for each row execute function public.internal_control_bindings_validate_template();
