-- Task items — relasjonell oppgavlagring med pack og law_refs.
--
-- Coverage gap closed:
--   Eksisterende oppgaver er lagret i org_module_payloads (JSONB-blob)
--   uten pack-kobling, law_refs eller prosjekttilknytning. Denne tabellen
--   erstatter JSON-lagring for nye oppgaver og introduserer:
--     - source_category (avvik/risikovurdering/tiltak/general) med AML-kobling
--     - pdca_phase (plan/do/check/act) for PDCA-tavle
--     - law_refs text[] for paragraf-sporbarhet
--     - project_id FK til task_projects for bevissamling
--     - digital signatur-feltene (assignee_signed_at, management_signed_at)
--
--   Gamle JSON-oppgaver i org_module_payloads er fortsatt lesbare —
--   ingen destruktive operasjoner. UI skriver kun til task_items fremover.
--
-- Self-audit (Arbeidstilsynet POV):
--   AML § 5-2 krever at avvik følges opp skriftlig og at tiltak
--   iverksettes. task_items.source_category='avvik' + law_refs
--   gir direkte sporbarhet. Signaturkolonnene dokumenterer hvem
--   som godkjente at oppgaven er utført (§ 3-1, § 4-1).
--   Audit-trigger → hse_audit_log sikrer uforanderlig logg.
--   Restrisiko: migrasjon av eksisterende JSON-oppgaver er anbefalt
--   som et separat script utenfor denne migrasjonen.

set local search_path = public, pg_catalog;

create table if not exists public.task_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Prosjekttilknytning er valgfri; frittstående oppgaver er tillatt
  project_id      uuid references public.task_projects (id) on delete set null,
  pack            public.task_pack not null default 'aml-amu',
  source_category public.task_source_category not null default 'general',
  pdca_phase      public.task_pdca_phase not null default 'do',
  title           text not null,
  description     text not null default '',
  -- Bevarer 3-stegs status for bakoverkompatibilitet med eksisterende Task-type
  status          text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  priority        text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  -- Paragrafkrav oppgaven adresserer, f.eks. ['AML § 3-1', 'IK-f § 5 nr. 6']
  law_refs        text[] not null default '{}'::text[],
  assignee_user_id uuid references auth.users (id) on delete set null,
  -- Denormalisert for visning uten auth-oppslag (offline / eksport)
  assignee_name   text,
  owner_role      text,
  due_date        date,
  -- Bro til eksisterende sourceType-verdier (hse_incident, ros_measure, m.fl.)
  source_type     text,
  source_id       uuid,
  requires_sign_off boolean not null default false,
  -- Fullføring bekreftet av ansvarlig
  assignee_signed_at  timestamptz,
  assignee_signed_by  uuid references auth.users (id) on delete set null,
  -- Ledelsessignatur (kreves når requires_sign_off = true)
  management_signed_at timestamptz,
  management_signed_by uuid references auth.users (id) on delete set null,
  closed_at       timestamptz,
  closed_by       uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Signatur-konsistens: begge tidsstempel og bruker-ID må settes sammen
  check (
    (assignee_signed_at is null) = (assignee_signed_by is null)
  ),
  check (
    (management_signed_at is null) = (management_signed_by is null)
  )
);

create index if not exists task_items_org_pack_category_status_idx
  on public.task_items (organization_id, pack, source_category, status, due_date)
  where deleted_at is null;

create index if not exists task_items_org_project_idx
  on public.task_items (organization_id, project_id)
  where deleted_at is null;

create index if not exists task_items_org_pdca_idx
  on public.task_items (organization_id, pack, pdca_phase, status)
  where deleted_at is null;

create index if not exists task_items_law_refs_idx
  on public.task_items using gin (law_refs);

alter table public.task_items enable row level security;

drop policy if exists task_items_select_org on public.task_items;
create policy task_items_select_org
  on public.task_items for select
  using (organization_id = public.current_org_id());

drop policy if exists task_items_write_org on public.task_items;
create policy task_items_write_org
  on public.task_items for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_items_before_insert_defaults()
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
  -- Sett standard law_refs basert på source_category om ikke oppgitt
  if new.law_refs = '{}'::text[] then
    new.law_refs := case new.source_category
      when 'avvik'           then array['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 7']
      when 'risikovurdering' then array['AML § 3-1', 'IK-f § 5 nr. 6']
      when 'tiltak'          then array['AML § 3-2', 'AML § 4-1', 'IK-f § 5 nr. 8']
      else '{}'::text[]
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists task_items_before_insert_defaults_tg on public.task_items;
create trigger task_items_before_insert_defaults_tg
  before insert on public.task_items
  for each row execute function public.task_items_before_insert_defaults();

create or replace function public.task_items_before_update_close()
returns trigger
language plpgsql
as $$
begin
  -- Sett closed_at automatisk når status endres til 'done'
  if new.status = 'done' and old.status <> 'done' then
    new.closed_at := coalesce(new.closed_at, now());
    new.closed_by := coalesce(new.closed_by, auth.uid());
  end if;
  -- Nullstill closed_at dersom status åpnes igjen
  if new.status <> 'done' and old.status = 'done' then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists task_items_before_update_close_tg on public.task_items;
create trigger task_items_before_update_close_tg
  before update on public.task_items
  for each row execute function public.task_items_before_update_close();

drop trigger if exists task_items_set_updated_at on public.task_items;
create trigger task_items_set_updated_at
  before update on public.task_items
  for each row execute function public.set_updated_at();

drop trigger if exists task_items_audit_tg on public.task_items;
create trigger task_items_audit_tg
  after insert or update or delete on public.task_items
  for each row execute function public.hse_audit_trigger();
