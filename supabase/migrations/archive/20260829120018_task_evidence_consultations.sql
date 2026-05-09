-- Task evidence and consultations — per-item objective evidence and worker
-- consultation records required by ISO 45001 and AML.
--
-- Coverage gap closed:
--   task_project_evidence existed only at project level. ISO 45001 § 9.1.1
--   requires objective evidence at the individual nonconformity/action level.
--   AML § 5-2 requires documented follow-up per avvik, not just per project.
--
--   task_item_consultations implements ISO 45001 § 5.4 "consultation and
--   participation of workers": for every risiko and significant avvik the
--   system now records who was consulted, in what role, and when.
--   AML § 6-2 requires verneombud to be consulted — this is enforced
--   application-side (hard gate for avvik/risiko template_kind).
--
-- Self-audit (Arbeidstilsynet POV):
--   § 6-2 nr. 6 pålegger verneombudet å delta i risikovurderinger.
--   task_item_consultations.role = 'verneombud' + consulted_at gir
--   dokumentasjon at plikten er oppfylt.
--   Restrisiko: systemet validerer ikke at rollen «verneombud» tilhører
--   en reell VO — det er org-admins ansvar å tilordre rollen korrekt.

set local search_path = public, pg_catalog;

-- ── Table: task_item_evidence ─────────────────────────────────────────────

create table if not exists public.task_item_evidence (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  -- kind: what type of evidence
  kind            text not null
    check (kind in (
      'file',            -- uploaded file / photo
      'photo',           -- photo specifically
      'note',            -- text note
      'measurement',     -- numeric measurement result
      'checklist_ref',   -- reference to a checklist execution
      'survey_ref',      -- reference to a survey response
      'external_link'    -- external URL or reference
    )),
  label           text not null,
  description     text not null default '',
  -- File storage path (Supabase Storage bucket)
  file_path       text,
  file_size_bytes bigint,
  mime_type       text,
  -- Cross-module references (checklist_ref, survey_ref)
  external_ref_table  text,
  external_ref_id     uuid,
  -- For measurement kind
  measurement_value   numeric,
  measurement_unit    text,
  uploaded_by     uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists task_item_evidence_item_idx
  on public.task_item_evidence (task_item_id, created_at)
  where deleted_at is null;

create index if not exists task_item_evidence_org_idx
  on public.task_item_evidence (organization_id, created_at desc)
  where deleted_at is null;

alter table public.task_item_evidence enable row level security;

drop policy if exists task_item_evidence_select_org on public.task_item_evidence;
create policy task_item_evidence_select_org
  on public.task_item_evidence for select
  using (organization_id = public.current_org_id());

drop policy if exists task_item_evidence_write_org on public.task_item_evidence;
create policy task_item_evidence_write_org
  on public.task_item_evidence for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_item_evidence_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_item_evidence_before_insert_defaults_tg
  on public.task_item_evidence;
create trigger task_item_evidence_before_insert_defaults_tg
  before insert on public.task_item_evidence
  for each row execute function public.task_item_evidence_before_insert_defaults();

-- Log evidence additions to activity trail
create or replace function public.task_item_evidence_after_insert_log()
returns trigger
language plpgsql
as $$
begin
  insert into public.task_activity_log
    (organization_id, task_item_id, action, actor_user_id, payload)
  values (
    new.organization_id,
    new.task_item_id,
    'evidence_added',
    auth.uid(),
    jsonb_build_object('kind', new.kind, 'label', new.label, 'evidence_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists task_item_evidence_after_insert_log_tg
  on public.task_item_evidence;
create trigger task_item_evidence_after_insert_log_tg
  after insert on public.task_item_evidence
  for each row execute function public.task_item_evidence_after_insert_log();

-- ── Table: task_item_consultations ────────────────────────────────────────
-- ISO 45001 § 5.4 consultation and participation record.

create table if not exists public.task_item_consultations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  -- consulted_user_id links to an authenticated org member when known
  consulted_user_id uuid references auth.users (id) on delete set null,
  -- consulted_name is always populated (denormalized for records integrity)
  consulted_name  text not null,
  -- role documents the capacity in which this person was consulted
  role            text not null
    check (role in (
      'verneombud',      -- Safety representative (AML § 6-2)
      'amu_member',      -- AMU member (AML § 7-2)
      'worker',          -- Employee / worker (§ 5.4 general participation)
      'union_rep',       -- Union representative (AML § 8)
      'manager',         -- Line manager
      'external_expert', -- BHT / consultant / external safety expert
      'other'
    )),
  consulted_at    timestamptz not null default now(),
  -- How were they consulted?
  method          text
    check (method in ('meeting', 'written', 'email', 'phone', 'other')),
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists task_item_consultations_item_idx
  on public.task_item_consultations (task_item_id, consulted_at desc);

create index if not exists task_item_consultations_org_role_idx
  on public.task_item_consultations (organization_id, role, consulted_at desc);

alter table public.task_item_consultations enable row level security;

drop policy if exists task_item_consultations_select_org on public.task_item_consultations;
create policy task_item_consultations_select_org
  on public.task_item_consultations for select
  using (organization_id = public.current_org_id());

drop policy if exists task_item_consultations_write_org on public.task_item_consultations;
create policy task_item_consultations_write_org
  on public.task_item_consultations for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_item_consultations_before_insert_defaults()
returns trigger
language plpgsql
as $$
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

drop trigger if exists task_item_consultations_before_insert_defaults_tg
  on public.task_item_consultations;
create trigger task_item_consultations_before_insert_defaults_tg
  before insert on public.task_item_consultations
  for each row execute function public.task_item_consultations_before_insert_defaults();

-- Log consultation additions to activity trail
create or replace function public.task_item_consultations_after_insert_log()
returns trigger
language plpgsql
as $$
begin
  insert into public.task_activity_log
    (organization_id, task_item_id, action, actor_user_id, payload)
  values (
    new.organization_id,
    new.task_item_id,
    'vo_notified',
    auth.uid(),
    jsonb_build_object(
      'role', new.role,
      'consulted_name', new.consulted_name,
      'consulted_at', new.consulted_at,
      'method', new.method
    )
  );
  return new;
end;
$$;

drop trigger if exists task_item_consultations_after_insert_log_tg
  on public.task_item_consultations;
create trigger task_item_consultations_after_insert_log_tg
  after insert on public.task_item_consultations
  for each row execute function public.task_item_consultations_after_insert_log();
