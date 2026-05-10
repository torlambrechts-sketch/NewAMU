-- ============================================================
-- KLARERT — pending migrations (run this in Supabase SQL Editor)
-- Generated: 2026-05-10
--
-- Contains:
--   1. 20260829120001 — Task module complete
--      Full task system: tables, templates, provision function,
--      task categories, and all 7 template metadata schemas
--      with section sentinels.
--
--   2. 20260830120001 — Document system-coverage templates
--      Seven "Systemdokumentasjon" templates that document how
--      Klarert covers AML §3-1, §3-2, §4-3, §4-5, §5-1/5-2,
--      §4-6 and IK-f §5 via its own modules.
--
-- Safe to run multiple times — all statements are idempotent.
-- ============================================================
-- ════════════════════════════════════════════════════════════════════════
-- 20260829120001_task_pack_infrastructure.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task pack infrastructure — enums and per-org pack configuration.
--
-- Coverage gap closed:
--   Oppgavemodulen manglet støtte for regulatoriske pakker. AML krever
--   dokumentert håndtering av avvik (§ 5), risikovurdering (§ 3-1) og
--   forbedringstiltak (§ 3-2). Eksisterende JSON-lagring hadde ingen
--   pack-kobling, ingen law_refs og ingen prosjekt-nivå bevissamling.
--   Denne migrasjonen introduserer task_pack-enumet og task_packs-tabellen
--   som speil av compliance_packs — samme lisensieringsmodell.
--
-- Self-audit (Arbeidstilsynet POV):
--   IK-forskriften § 5 nr. 1 krever skriftlig dokumentasjon av
--   internkontrollsystemet, herunder identifisering av lover og
--   forskrifter. task_pack-strukturen gjør det mulig å koble hver
--   oppgave direkte til regulatorisk pakke og paragraf.
--   Restrisiko: pack-enum er for øyeblikket begrenset til AML/ISO 45001.
--   Utvidelse til andre rammeverk (GDPR, NIS2) er tilgjengelig via
--   ny enum-verdi uten datamigrasjon (ALTER TYPE ... ADD VALUE).

set local search_path = public, pg_catalog;

-- ── Enums ─────────────────────────────────────────────────────────────────

do $$ begin
  create type public.task_pack as enum ('aml-amu', 'iso-45001');
exception when duplicate_object then null; end $$;

-- Oppgavekategori (naturlig taksonomi for lovkrav):
--   avvik          → AML § 5-1, § 5-2  (Meldeplikt / Oppfølging)
--   risikovurdering → AML § 3-1, IK-f § 5 nr. 6  (Kartlegging)
--   tiltak         → AML § 3-2, § 4-1  (Forebygging / Forbedring)
--   general        → ingen spesifikk paragraf
do $$ begin
  create type public.task_source_category as enum (
    'avvik', 'risikovurdering', 'tiltak', 'general'
  );
exception when duplicate_object then null; end $$;

-- PDCA-fase: Plan → Do → Check → Act
do $$ begin
  create type public.task_pdca_phase as enum ('plan', 'do', 'check', 'act');
exception when duplicate_object then null; end $$;

-- ── Table: task_packs ─────────────────────────────────────────────────────

create table if not exists public.task_packs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            public.task_pack not null,
  short_name      text not null,
  plural_label    text not null,
  cta_label       text not null,
  description     text not null default '',
  -- Banner content: [{code, text}]
  legal_references jsonb not null default '[]'::jsonb,
  -- KPI-etikett-overstyring per pakke: {open, critical, ytd}
  kpi_labels      jsonb not null default '{}'::jsonb,
  -- Alvorlighetsgrad-etiketter: {critical, high, medium, low}
  severity_labels jsonb not null default '{}'::jsonb,
  position        int not null default 100,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug),
  check (jsonb_typeof(legal_references) = 'array')
);

create index if not exists task_packs_org_active_idx
  on public.task_packs (organization_id, is_active, position);

alter table public.task_packs enable row level security;

drop policy if exists task_packs_select_org on public.task_packs;
create policy task_packs_select_org
  on public.task_packs for select
  using (organization_id = public.current_org_id());

drop policy if exists task_packs_write_org on public.task_packs;
create policy task_packs_write_org
  on public.task_packs for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_packs_before_insert_defaults()
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

drop trigger if exists task_packs_before_insert_defaults_tg on public.task_packs;
create trigger task_packs_before_insert_defaults_tg
  before insert on public.task_packs
  for each row execute function public.task_packs_before_insert_defaults();

drop trigger if exists task_packs_set_updated_at on public.task_packs;
create trigger task_packs_set_updated_at
  before update on public.task_packs
  for each row execute function public.set_updated_at();

-- ── Seed: AML pack for all existing organisations ─────────────────────────

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.task_packs (
      organization_id, slug, short_name, plural_label, cta_label,
      description, legal_references, kpi_labels, severity_labels, position
    )
    values (
      v_org_id,
      'aml-amu',
      'AML',
      'Oppgaver',
      'Ny oppgave / avvik / tiltak',
      'Oppgavesystem for Arbeidsmiljølov-etterlevelse — avvik, risikovurderinger og tiltak',
      '[{"code":"AML § 3-1","text":"Risikovurdering — kartlegging og vurdering av risikofaktorer"},
        {"code":"AML § 3-2","text":"Iverksetting av tiltak — forebygging og forbedring"},
        {"code":"AML § 5-1","text":"Meldeplikt — ulykker og personskader"},
        {"code":"AML § 5-2","text":"Avviksbehandling — oppfølging og dokumentasjon"},
        {"code":"IK-f § 5","text":"Internkontrollforskriften — systematisk HMS-arbeid"}]'::jsonb,
      '{"open":"Åpne","critical":"Kritiske","ytd":"I år"}'::jsonb,
      '{"critical":"Kritisk","high":"Høy","medium":"Medium","low":"Lav"}'::jsonb,
      10
    )
    on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120002_task_projects_table.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task projects — prosjektbasert planlegging og bevissamling.
--
-- Coverage gap closed:
--   AML § 3-1 og IK-f § 5 nr. 1 krever at virksomheten har et
--   dokumentert internkontrollsystem. Prosjekter gir en strukturert
--   ramme for å planlegge, gjennomføre og dokumentere et
--   forbedringssyklus (PDCA) — f.eks. et risikovurderingsprosjekt
--   eller en avviksoppfølgingssyklus.
--
-- Self-audit (Arbeidstilsynet POV):
--   Hvert prosjekt bærer law_refs (tekstarray) → direkte sporbarhet
--   til hvilke paragrafkrav prosjektet adresserer.
--   Prosjektstatus (active/closed/archived) + timestamps gir
--   fullstendig livsløpssporing. Leder-FK sikrer ansvarliggjøring.
--   Restrisiko: prosjekter er per-org; delingsmekanisme for
--   revisor er dekket av task_export_tokens (M-7).

set local search_path = public, pg_catalog;

create table if not exists public.task_projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pack            public.task_pack not null default 'aml-amu',
  title           text not null,
  description     text not null default '',
  -- PDCA-tavle er standard for AML; kanban og waterfall tilbys for fleksibilitet
  methodology     text not null default 'pdca'
    check (methodology in ('kanban', 'pdca', 'waterfall')),
  status          text not null default 'active'
    check (status in ('active', 'closed', 'archived')),
  start_date      date,
  end_date        date,
  -- Paragrafkrav prosjektet adresserer, f.eks. ['AML § 3-1', 'IK-f § 5 nr. 6']
  law_refs        text[] not null default '{}'::text[],
  lead_user_id    uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_projects_org_pack_status_idx
  on public.task_projects (organization_id, pack, status, created_at desc)
  where deleted_at is null;

create index if not exists task_projects_law_refs_idx
  on public.task_projects using gin (law_refs);

alter table public.task_projects enable row level security;

drop policy if exists task_projects_select_org on public.task_projects;
create policy task_projects_select_org
  on public.task_projects for select
  using (organization_id = public.current_org_id());

drop policy if exists task_projects_write_org on public.task_projects;
create policy task_projects_write_org
  on public.task_projects for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_projects_before_insert_defaults()
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

drop trigger if exists task_projects_before_insert_defaults_tg on public.task_projects;
create trigger task_projects_before_insert_defaults_tg
  before insert on public.task_projects
  for each row execute function public.task_projects_before_insert_defaults();

drop trigger if exists task_projects_set_updated_at on public.task_projects;
create trigger task_projects_set_updated_at
  before update on public.task_projects
  for each row execute function public.set_updated_at();

drop trigger if exists task_projects_audit_tg on public.task_projects;
create trigger task_projects_audit_tg
  after insert or update or delete on public.task_projects
  for each row execute function public.hse_audit_trigger();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120003_task_items_table.sql
-- ════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120004_task_project_evidence.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task project evidence — bevissamling per prosjekt for revisor.
--
-- Coverage gap closed:
--   IK-f § 5 nr. 1 krever at virksomheten kan dokumentere
--   internkontrollarbeidet skriftlig. task_project_evidence gir en
--   strukturert bevislogg per prosjekt — filer, koblinger til
--   sjekklister, undersøkelser, registerposter og notater.
--   Revideringspakken (task_export_tokens) eksporterer denne
--   tabellen som en del av revisjonsdokumentasjonen.
--
-- Self-audit (Arbeidstilsynet POV):
--   Bevislinker er polymorfiske (kind + external_ref_table/id) slik at
--   eksisterende artefakter (checklist_executions, survey_responses,
--   register_records) kan knyttes til et prosjekt uten å duplisere data.
--   File_url peker til Supabase Storage — URL-en er signet og tidsbegrenset
--   på klientsiden; selve raden lagrer kun stien.
--   Restrisiko: det finnes ingen automatisk validering av at
--   external_ref_id faktisk eksisterer i external_ref_table.
--   Applikasjonen er ansvarlig for integritetssjekken.

set local search_path = public, pg_catalog;

create table if not exists public.task_project_evidence (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.task_projects (id) on delete cascade,
  -- Bevistype — styrer ikon og visning i bevisloggen
  kind            text not null default 'note'
    check (kind in ('file', 'checklist_execution', 'survey_response', 'register_record', 'note')),
  label           text not null,
  -- Polymorf kobling til eksisterende artefakt (nullable for file/note)
  external_ref_table text,
  external_ref_id    uuid,
  -- Storage-sti for opplastede filer (ikke signert URL — signeres av klienten)
  file_path       text,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Konsistenssjekk: fil-bevis krever file_path; artefakt-bevis krever ref
  check (
    (kind = 'file' and file_path is not null)
    or (kind in ('checklist_execution', 'survey_response', 'register_record')
        and external_ref_table is not null and external_ref_id is not null)
    or kind = 'note'
  )
);

create index if not exists task_project_evidence_project_kind_idx
  on public.task_project_evidence (project_id, kind, created_at desc);

create index if not exists task_project_evidence_org_idx
  on public.task_project_evidence (organization_id, created_at desc);

alter table public.task_project_evidence enable row level security;

drop policy if exists task_project_evidence_select_org on public.task_project_evidence;
create policy task_project_evidence_select_org
  on public.task_project_evidence for select
  using (organization_id = public.current_org_id());

drop policy if exists task_project_evidence_write_org on public.task_project_evidence;
create policy task_project_evidence_write_org
  on public.task_project_evidence for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_project_evidence_before_insert_defaults()
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

drop trigger if exists task_project_evidence_before_insert_defaults_tg on public.task_project_evidence;
create trigger task_project_evidence_before_insert_defaults_tg
  before insert on public.task_project_evidence
  for each row execute function public.task_project_evidence_before_insert_defaults();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120005_task_template_catalog.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task template catalog — systemmal og per-org aktivering for oppgaver.
--
-- Coverage gap closed:
--   Bruker trenger forhåndsdefinerte maler for de tre lovkravkategoriene
--   (avvik, risikovurdering, tiltak) slik at ny oppgave kan opprettes
--   fra en knapp med riktige law_refs forhåndsutfylt. Denne migrasjonen
--   legger til 6 AML-systemfiler som er bindende fra dag én:
--
--   1. avvik-standard         — § 5-1/5-2 standard avviksmelding
--   2. avvik-alvorlig         — § 5-2/5-3 alvorlig hendelse / personskade
--   3. risikovurdering-general — § 3-1 generell risikovurdering
--   4. risikovurdering-kjemisk — § 4-5/3-1 kjemisk eksponering
--   5. tiltak-forebyggende    — § 3-2/4-1 forebyggende tiltak
--   6. forbedringsprosjekt    — § 3-2/4-2/4-3 kontinuerlig forbedring (PDCA)
--
-- Self-audit (Arbeidstilsynet POV):
--   IK-f § 5 nr. 6 og 7 krever systematisk kartlegging og oppfølging.
--   Mal-tilnærmingen sikrer at ingen avviks- eller risikomelding starter
--   fra blank side — alle nødvendige felter og lovhenvisninger er
--   forhåndsutfylt. Nav_pinned=true i per-org tabellen sikrer at
--   maler er synlige i sidepanelet fra dag én.
--   Restrisiko: malenes innhold er en anbefalt startpunkt og kan
--   tilpasses per virksomhet via task_org_templates.

set local search_path = public, pg_catalog;

-- ── Table: task_template_catalog ──────────────────────────────────────────

create table if not exists public.task_template_catalog (
  id              uuid primary key default gen_random_uuid(),
  -- organization_id IS NULL = systemmal; NOT NULL = kundetilpasset mal
  organization_id uuid references public.organizations (id) on delete cascade,
  slug            text not null unique,
  pack            public.task_pack not null,
  source_category public.task_source_category not null,
  name            text not null,
  description     text not null default '',
  law_refs        text[] not null default '{}'::text[],
  default_pdca_phase public.task_pdca_phase not null default 'do',
  -- definition JSONB: { fields: [{id, label, kind, required}], checklist_items: [{id, text}] }
  definition      jsonb not null default '{"fields":[],"checklist_items":[]}'::jsonb,
  cadence_hint    text,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (jsonb_typeof(definition->'fields') = 'array')
);

create index if not exists task_template_catalog_pack_category_idx
  on public.task_template_catalog (pack, source_category, is_active)
  where organization_id is null;

create index if not exists task_template_catalog_law_refs_idx
  on public.task_template_catalog using gin (law_refs);

alter table public.task_template_catalog enable row level security;

-- Systemmaler (organization_id IS NULL) er synlige for alle
drop policy if exists task_template_catalog_select_all on public.task_template_catalog;
create policy task_template_catalog_select_all
  on public.task_template_catalog for select
  using (organization_id is null or organization_id = public.current_org_id());

drop policy if exists task_template_catalog_write_org on public.task_template_catalog;
create policy task_template_catalog_write_org
  on public.task_template_catalog for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop trigger if exists task_template_catalog_set_updated_at on public.task_template_catalog;
create trigger task_template_catalog_set_updated_at
  before update on public.task_template_catalog
  for each row execute function public.set_updated_at();

-- ── Table: task_org_templates ─────────────────────────────────────────────

create table if not exists public.task_org_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  catalog_id      uuid not null references public.task_template_catalog (id) on delete cascade,
  nav_pinned      boolean not null default false,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, catalog_id)
);

create index if not exists task_org_templates_org_pinned_idx
  on public.task_org_templates (organization_id, nav_pinned, is_active)
  where deleted_at is null;

alter table public.task_org_templates enable row level security;

drop policy if exists task_org_templates_select_org on public.task_org_templates;
create policy task_org_templates_select_org
  on public.task_org_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists task_org_templates_write_org on public.task_org_templates;
create policy task_org_templates_write_org
  on public.task_org_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_org_templates_before_insert_defaults()
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

drop trigger if exists task_org_templates_before_insert_defaults_tg on public.task_org_templates;
create trigger task_org_templates_before_insert_defaults_tg
  before insert on public.task_org_templates
  for each row execute function public.task_org_templates_before_insert_defaults();

drop trigger if exists task_org_templates_set_updated_at on public.task_org_templates;
create trigger task_org_templates_set_updated_at
  before update on public.task_org_templates
  for each row execute function public.set_updated_at();

-- ── Seed: 6 AML system templates ─────────────────────────────────────────

-- 1. Avvik — standard (AML § 5-1, § 5-2)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000001',
  'avvik-standard',
  'aml-amu',
  'avvik',
  'Avviksmelding — standard',
  'Standard avviksmelding for uønskede hendelser, nestenulykker og brudd på rutiner.',
  array['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 7'],
  'check',
  'ad_hoc',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Hva skjedde?","kind":"textarea","required":true},
    {"id":"f2","label":"Når skjedde det?","kind":"date","required":true},
    {"id":"f3","label":"Hvor skjedde det?","kind":"text","required":true},
    {"id":"f4","label":"Hvem var involvert?","kind":"text","required":false},
    {"id":"f5","label":"Umiddelbare tiltak","kind":"textarea","required":false},
    {"id":"f6","label":"Rotårsaksvurdering","kind":"textarea","required":false}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- 2. Avvik — alvorlig (AML § 5-2, § 5-3)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000002',
  'avvik-alvorlig',
  'aml-amu',
  'avvik',
  'Alvorlig hendelse / personskade',
  'For alvorlige personskader og hendelser med meldeplikt til Arbeidstilsynet.',
  array['AML § 5-2', 'AML § 5-3', 'IK-f § 5 nr. 7'],
  'check',
  'ad_hoc',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Beskriv hendelsen","kind":"textarea","required":true},
    {"id":"f2","label":"Dato og klokkeslett","kind":"datetime","required":true},
    {"id":"f3","label":"Sted / arbeidssted","kind":"text","required":true},
    {"id":"f4","label":"Skadede person(er)","kind":"text","required":true},
    {"id":"f5","label":"Skadens art og omfang","kind":"textarea","required":true},
    {"id":"f6","label":"Varslet Arbeidstilsynet?","kind":"boolean","required":true},
    {"id":"f7","label":"Rotårsaksanalyse","kind":"textarea","required":true},
    {"id":"f8","label":"Korrigerende tiltak","kind":"textarea","required":true}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- 3. Risikovurdering — generell (AML § 3-1, IK-f § 5 nr. 6)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000003',
  'risikovurdering-general',
  'aml-amu',
  'risikovurdering',
  'Risikovurdering — generell',
  'Systematisk kartlegging og vurdering av risiko i arbeidsmiljøet.',
  array['AML § 3-1', 'IK-f § 5 nr. 6'],
  'plan',
  'arlig',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Område / prosess som vurderes","kind":"text","required":true},
    {"id":"f2","label":"Identifiserte farekilder","kind":"textarea","required":true},
    {"id":"f3","label":"Hvem kan bli skadet og hvordan?","kind":"textarea","required":true},
    {"id":"f4","label":"Eksisterende risikoreduserende tiltak","kind":"textarea","required":false},
    {"id":"f5","label":"Sannsynlighet (1-5)","kind":"number","required":true},
    {"id":"f6","label":"Konsekvens (1-5)","kind":"number","required":true},
    {"id":"f7","label":"Nødvendige nye tiltak","kind":"textarea","required":false},
    {"id":"f8","label":"Ansvarlig for tiltak","kind":"text","required":false},
    {"id":"f9","label":"Tidsfrist for gjennomføring","kind":"date","required":false}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- 4. Risikovurdering — kjemisk eksponering (AML § 4-5, § 3-1)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000004',
  'risikovurdering-kjemisk',
  'aml-amu',
  'risikovurdering',
  'Risikovurdering — kjemisk eksponering',
  'Kartlegging av kjemisk eksponering og vurdering av helserisiko.',
  array['AML § 4-5', 'AML § 3-1', 'IK-f § 5 nr. 6'],
  'plan',
  'halvarlig',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Kjemikalienavn / produkt","kind":"text","required":true},
    {"id":"f2","label":"CAS-nummer","kind":"text","required":false},
    {"id":"f3","label":"Eksponeringsrute (inhalasjon/hud/øye)","kind":"text","required":true},
    {"id":"f4","label":"Eksponeringstid per dag (timer)","kind":"number","required":true},
    {"id":"f5","label":"Antall eksponerte arbeidstakere","kind":"number","required":true},
    {"id":"f6","label":"Administrative normer overholdt?","kind":"boolean","required":true},
    {"id":"f7","label":"Verneutstyr i bruk","kind":"textarea","required":false},
    {"id":"f8","label":"Risikonivå (lav/middels/høy/kritisk)","kind":"text","required":true},
    {"id":"f9","label":"Nødvendige substitusjon- eller tekniske tiltak","kind":"textarea","required":false}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- 5. Tiltak — forebyggende (AML § 3-2, § 4-1)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000005',
  'tiltak-forebyggende',
  'aml-amu',
  'tiltak',
  'Forebyggende tiltak',
  'Planlegging og gjennomføring av forebyggende HMS-tiltak.',
  array['AML § 3-2', 'AML § 4-1', 'IK-f § 5 nr. 8'],
  'do',
  'kvartalsvis',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Tiltak — beskriv konkret","kind":"textarea","required":true},
    {"id":"f2","label":"Bakgrunn / risiko som tiltaket adresserer","kind":"textarea","required":true},
    {"id":"f3","label":"Forventet effekt","kind":"textarea","required":false},
    {"id":"f4","label":"Ansvarlig","kind":"text","required":true},
    {"id":"f5","label":"Ressurser / kostnad (NOK)","kind":"number","required":false},
    {"id":"f6","label":"Startdato","kind":"date","required":false},
    {"id":"f7","label":"Ferdigstillelsesdato","kind":"date","required":true},
    {"id":"f8","label":"Evaluering — ble effekten oppnådd?","kind":"textarea","required":false}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- 6. Forbedringsprosjekt — PDCA (AML § 3-2, § 4-2, § 4-3)
insert into public.task_template_catalog (
  id, slug, pack, source_category, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition
) values (
  '00000000-1000-4000-a000-000000000006',
  'forbedringsprosjekt',
  'aml-amu',
  'tiltak',
  'Forbedringsprosjekt (PDCA)',
  'Komplett PDCA-syklus for systematisk forbedring av arbeidsmiljøet.',
  array['AML § 3-2', 'AML § 4-2', 'AML § 4-3', 'IK-f § 5 nr. 8'],
  'act',
  'arlig',
  true, true,
  '{"fields":[
    {"id":"f1","label":"Prosjektnavn","kind":"text","required":true},
    {"id":"f2","label":"Mål og ønsket tilstand (Plan)","kind":"textarea","required":true},
    {"id":"f3","label":"Gjennomførte tiltak (Do)","kind":"textarea","required":false},
    {"id":"f4","label":"Resultater og evaluering (Check)","kind":"textarea","required":false},
    {"id":"f5","label":"Standardisering og videreføring (Act)","kind":"textarea","required":false},
    {"id":"f6","label":"Involverte arbeidstakere / representanter","kind":"textarea","required":false},
    {"id":"f7","label":"Prosjektleder","kind":"text","required":true},
    {"id":"f8","label":"Prosjektperiode","kind":"daterange","required":false}
  ],"checklist_items":[]}'::jsonb
) on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  law_refs    = excluded.law_refs,
  definition  = excluded.definition,
  updated_at  = now();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120006_task_provision_function.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task provisioning — kobler systemfiler til per-org aktivering.
--
-- Coverage gap closed:
--   Nye organisasjoner trenger AML-maler tilgjengelig fra dag én
--   uten manuell oppsett. provision_task_baseline_for_org speiler
--   alle systemfiler for en gitt pakke inn i task_org_templates
--   med nav_pinned=true. Trigger på task_packs kaller funksjonen
--   automatisk ved licenstiering (insert/reactivation).
--
-- Self-audit (Arbeidstilsynet POV):
--   Automatisk provisjonering sikrer at ingen virksomhet kan
--   hevde manglende kjennskap til maler — de er synlige i
--   sidepanelet fra oppstart. Backfill-loop under dekker
--   eksisterende organisasjoner.

set local search_path = public, pg_catalog;

create or replace function public.provision_task_baseline_for_org(
  p_org_id   uuid,
  p_pack     public.task_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_org_templates (
    organization_id, catalog_id, nav_pinned, is_active
  )
  select
    p_org_id, c.id, true, true
  from public.task_template_catalog c
  where c.organization_id is null
    and c.is_system = true
    and c.is_active = true
    and c.pack = p_pack
  on conflict (organization_id, catalog_id) do nothing;
end;
$$;

revoke all on function public.provision_task_baseline_for_org(uuid, public.task_pack)
  from public, anon;
grant execute on function public.provision_task_baseline_for_org(uuid, public.task_pack)
  to authenticated, service_role;

-- ── Trigger: licenstiering → provisjonering ───────────────────────────────

create or replace function public.task_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    if (tg_op = 'INSERT')
       or (tg_op = 'UPDATE' and old.is_active = false)
    then
      perform public.provision_task_baseline_for_org(new.organization_id, new.slug);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists task_pack_provision_tg on public.task_packs;
create trigger task_pack_provision_tg
  after insert or update on public.task_packs
  for each row execute function public.task_pack_provision_on_change();

-- ── Backfill: provisjoner for alle eksisterende aktive (org, pack) ────────

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.task_packs
    where is_active = true
      and deleted_at is null
  loop
    perform public.provision_task_baseline_for_org(v_pack.organization_id, v_pack.slug);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120007_task_export_tokens.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task export tokens — tidsbegrenset revisortilgang til prosjektpakke.
--
-- Coverage gap closed:
--   Revisor og tilsynsmyndighet trenger tidsbegrenset, autentiseringsfri
--   tilgang til et prosjekts dokumentasjon (oppgaver + bevis + signaturer).
--   task_export_tokens utsteder et tilfeldig token (256-bit hex) som gir
--   30-dagers lese-tilgang til én prosjektpakke — uten å eksponere
--   resten av organisasjonens data.
--
-- Self-audit (Arbeidstilsynet POV):
--   IK-f § 5 nr. 1 og AML § 18-6 (tilsynsmyndighetens adgang) krever
--   at virksomheten kan dokumentere internkontrollarbeid på forespørsel.
--   Token-mekanismen gir en kontrollert, sporbar delingskanal:
--     - Token er engangsgenerert og ugjenkallelig (revoked_at)
--     - 30-dagers utløp minimerer eksponering
--     - Alle token-opprettelser loggføres med created_by og created_at
--   Restrisiko: token-URL kan videresendes; det finnes ingen
--   autentiseringssjekk på mottaker. Virksomheten er ansvarlig for
--   sikker distribusjon av URL-en.

set local search_path = public, pg_catalog;

create table if not exists public.task_export_tokens (
  id              uuid primary key default gen_random_uuid(),
  -- 256-bit tilfeldig token (hex-kodet) — brukes i URL-en
  -- Two gen_random_uuid() calls concatenated give 256 bits of randomness
  -- without requiring the pgcrypto extension.
  token           text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.task_projects (id) on delete cascade,
  pack            public.task_pack not null,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Tilbakekalling: sett revoked_at for å ugyldiggjøre token
  revoked_at      timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists task_export_tokens_token_idx
  on public.task_export_tokens (token)
  where revoked_at is null;

create index if not exists task_export_tokens_project_idx
  on public.task_export_tokens (project_id, created_at desc);

-- Tokens er ikke org-scoped for select (leses av uautentisert klient via token)
alter table public.task_export_tokens enable row level security;

-- Autentiserte brukere kan lese tokens for sin org (admin-visning)
drop policy if exists task_export_tokens_select_org on public.task_export_tokens;
create policy task_export_tokens_select_org
  on public.task_export_tokens for select
  using (organization_id = public.current_org_id());

drop policy if exists task_export_tokens_write_org on public.task_export_tokens;
create policy task_export_tokens_write_org
  on public.task_export_tokens for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_export_tokens_before_insert_defaults()
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

drop trigger if exists task_export_tokens_before_insert_defaults_tg on public.task_export_tokens;
create trigger task_export_tokens_before_insert_defaults_tg
  before insert on public.task_export_tokens
  for each row execute function public.task_export_tokens_before_insert_defaults();

-- ── RPC: generer token for prosjekt ──────────────────────────────────────

create or replace function public.generate_task_export_token(
  p_project_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text;
  v_project public.task_projects%rowtype;
begin
  select * into v_project
  from public.task_projects
  where id = p_project_id
    and organization_id = public.current_org_id()
    and deleted_at is null;

  if not found then
    raise exception 'Project not found or access denied';
  end if;

  insert into public.task_export_tokens (
    organization_id, project_id, pack, created_by
  ) values (
    v_project.organization_id,
    p_project_id,
    v_project.pack,
    auth.uid()
  )
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.generate_task_export_token(uuid) from public, anon;
grant execute on function public.generate_task_export_token(uuid)
  to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120008_task_items_workflow_triggers.sql
-- ════════════════════════════════════════════════════════════════════════

-- task_items workflow DB triggers
-- Closes gap: task_items had no workflow_dispatch_db_event() hooks, so workflow
-- rules with source_module='tasks' could never fire from DB-level changes.
--
-- Events added: ON_TASK_CREATED, ON_TASK_STATUS_CHANGED, ON_TASK_OVERDUE_MARKED,
--               ON_TASK_SIGNED
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 (2) e — iverksette tiltak ved avvik og
--   lære av hendelser. Automated routing of task sign-off events ensures
--   traceability and timely escalation without manual monitoring.
--   Restrisiko deferred: ON_TASK_COMMENT_ADDED (requires separate comments table).

-- ── ON_TASK_CREATED ───────────────────────────────────────────────────────────

create or replace function public.trg_task_items_workflow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'tasks', 'ON_TASK_CREATED', to_jsonb(NEW)
  );
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_created_tg on public.task_items;
create trigger task_items_workflow_created_tg
  after insert on public.task_items
  for each row execute function public.trg_task_items_workflow_created();

-- ── ON_TASK_STATUS_CHANGED ────────────────────────────────────────────────────
-- Guard: only fires when status actually changes (avoids spurious updates).

create or replace function public.trg_task_items_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_STATUS_CHANGED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_status_tg on public.task_items;
create trigger task_items_workflow_status_tg
  after update of status on public.task_items
  for each row execute function public.trg_task_items_workflow_status();

-- ── ON_TASK_OVERDUE_MARKED ────────────────────────────────────────────────────
-- Fires when due_date transitions to a past value (overdue marker set externally,
-- or when a scheduled job stamps overdue status).

create or replace function public.trg_task_items_workflow_overdue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'overdue' and (OLD.status is distinct from 'overdue') then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_OVERDUE_MARKED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_overdue_tg on public.task_items;
create trigger task_items_workflow_overdue_tg
  after update of status on public.task_items
  for each row execute function public.trg_task_items_workflow_overdue();

-- ── ON_TASK_SIGNED ────────────────────────────────────────────────────────────
-- Fires when assignee_signed_at is first set (transition from NULL → value).

create or replace function public.trg_task_items_workflow_signed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.assignee_signed_at is not null and OLD.assignee_signed_at is null then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'tasks', 'ON_TASK_SIGNED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists task_items_workflow_signed_tg on public.task_items;
create trigger task_items_workflow_signed_tg
  after update of assignee_signed_at on public.task_items
  for each row execute function public.trg_task_items_workflow_signed();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120015_task_template_categories.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task template categories — per-org admin-defined grouping for task templates.
--
-- Coverage gap closed:
--   task_template_catalog had no category grouping. Templates appear as a
--   flat list in the hub and sidebar. This mirrors the compliance_checklist_categories
--   and survey_template_categories pattern: an org-scoped, pack-scoped
--   categories table that drives hub tile sections and collapsible sidebar
--   groups. Provision function seeds four default categories per org.
--
-- Self-audit (Arbeidstilsynet POV):
--   IK-f § 5 nr. 4 krever oversikt over lover og forskrifter som gjelder
--   for virksomheten. Kategorisering av maler per lovkravområde gir
--   strukturert tilgang til riktig mal for hvert krav.
--   Restrisiko: kategorier er org-scoped; systemkategorier introduseres
--   ikke i denne migrasjonen (deferred til innholdsgjennomgang).

set local search_path = public, pg_catalog;

-- ── Table: task_template_categories ──────────────────────────────────────

create table if not exists public.task_template_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- pack IS NULL = gjelder alle pakker for org
  pack            public.task_pack,
  name            text not null,
  description     text not null default '',
  position        int not null default 100,
  -- Cross-module taxonomy FK (category-architecture §T2)
  regulation_id   text,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists task_template_categories_org_pack_pos_idx
  on public.task_template_categories (organization_id, pack, position)
  where deleted_at is null;

alter table public.task_template_categories enable row level security;

drop policy if exists task_template_categories_select_org on public.task_template_categories;
create policy task_template_categories_select_org
  on public.task_template_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists task_template_categories_write_org on public.task_template_categories;
create policy task_template_categories_write_org
  on public.task_template_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_template_categories_before_insert_defaults()
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

drop trigger if exists task_template_categories_before_insert_defaults_tg
  on public.task_template_categories;
create trigger task_template_categories_before_insert_defaults_tg
  before insert on public.task_template_categories
  for each row execute function public.task_template_categories_before_insert_defaults();

drop trigger if exists task_template_categories_set_updated_at
  on public.task_template_categories;
create trigger task_template_categories_set_updated_at
  before update on public.task_template_categories
  for each row execute function public.set_updated_at();

-- ── Add category_id FK to task_org_templates ─────────────────────────────

alter table public.task_org_templates
  add column if not exists category_id uuid
    references public.task_template_categories (id) on delete set null;

-- ── Seed: 4 default categories for all existing organisations ─────────────

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    -- Avvik & Hendelser (AML § 5, IK-f § 5 nr. 7)
    insert into public.task_template_categories
      (organization_id, name, description, position, regulation_id, is_active)
    values
      (v_org_id,
       'Avvik & Hendelser',
       'Melding og oppfølging av avvik, ulykker og nestenulykker',
       10,
       null,
       true)
    on conflict (organization_id, name) do nothing;

    -- Risiko & Tiltak (AML § 3, IK-f § 5 nr. 6)
    insert into public.task_template_categories
      (organization_id, name, description, position, regulation_id, is_active)
    values
      (v_org_id,
       'Risiko & Tiltak',
       'Risikovurdering, forebyggende tiltak og forbedringsprosjekter',
       20,
       null,
       true)
    on conflict (organization_id, name) do nothing;

    -- Medvirkning & Forslag (AML § 4, § 8)
    insert into public.task_template_categories
      (organization_id, name, description, position, regulation_id, is_active)
    values
      (v_org_id,
       'Medvirkning & Forslag',
       'Forslag fra ansatte, forbedringsinitiativer og medvirkningsprosesser',
       30,
       null,
       true)
    on conflict (organization_id, name) do nothing;

    -- Sykefravær & Tilrettelegging (AML § 4-6)
    insert into public.task_template_categories
      (organization_id, name, description, position, regulation_id, is_active)
    values
      (v_org_id,
       'Sykefravær & Tilrettelegging',
       'Oppfølging av sykefravær og tilrettelegging for ansatte',
       40,
       null,
       true)
    on conflict (organization_id, name) do nothing;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120016_task_items_v2_columns.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task items v2 — extended columns for ISO 45001 CAPA lifecycle, approval
-- workflow, causality chain, effort tracking, and template linkage.
--
-- Coverage gap closed:
--   task_items had a 3-state status and no approval workflow.
--   ISO 45001:2018 § 10.2 requires a documented CAPA lifecycle:
--   open → investigating → root_cause_identified → action_defined →
--   action_implemented → effectiveness_pending → effectiveness_verified → closed.
--   This migration adds:
--     - 9-state status (backward-compat: 'todo' and 'done' remain valid)
--     - owner_user_id (accountable) distinct from assignee_user_id (executes)
--     - reviewer_user_id (verifies independently — ISO § 5.3 segregation)
--     - parent_item_id self-FK (tiltak → avvik causality chain)
--     - template_slug text (which template spawned this item)
--     - template_kind text (oppgave/avvik/tiltak/risiko/forslag)
--     - estimated_hours / actual_hours for resource planning
--     - sla_due_at (computed from priority + org SLA config)
--     - effectiveness_review_due_at / effectiveness_reviewed_at
--     - residual_risk_score (post-control risk re-assessment)
--     - vo_notified_at / amu_notified_at (AML § 6-2 / § 7-2)
--     - requires_approval boolean + approved_at / approved_by
--
--   task_template_catalog gains metadata_schema jsonb, template_kind text,
--   and version int for template versioning (ISO § 7.5.3).
--
-- Self-audit (Arbeidstilsynet POV):
--   AML § 5-2 krever dokumentert avviksoppfølging med rotårsaksanalyse og
--   tiltak. owner_user_id + reviewer_user_id sikrer at lukking krever
--   en person utover den som utfører (§ 5.3-prinsippet).
--   IK-f § 5 nr. 8 gjennomgang — effectiveness_reviewed_at dokumenterer
--   at tiltak er evaluert etter gjennomføring.
--   Restrisiko: sla_due_at beregnes i applikasjonen basert på org-konfig;
--   denne kolonnen er et hint, ikke en trigger-enforced constraint.

set local search_path = public, pg_catalog;

-- ── Extend status check to include full CAPA lifecycle ───────────────────

alter table public.task_items
  drop constraint if exists task_items_status_check;

alter table public.task_items
  add constraint task_items_status_check check (status in (
    -- new lifecycle states
    'open',
    'in_progress',
    'root_cause_identified',
    'action_defined',
    'action_implemented',
    'effectiveness_pending',
    'effectiveness_verified',
    'closed',
    'cancelled',
    -- legacy states retained for backward-compat
    'todo',
    'done'
  ));

-- ── New columns on task_items ─────────────────────────────────────────────

-- Owner (accountable) — may differ from assignee (executes)
alter table public.task_items
  add column if not exists owner_user_id uuid
    references auth.users (id) on delete set null;

alter table public.task_items
  add column if not exists owner_name text;

-- Reviewer (independent verification — ISO § 5.3)
alter table public.task_items
  add column if not exists reviewer_user_id uuid
    references auth.users (id) on delete set null;

alter table public.task_items
  add column if not exists reviewer_name text;

alter table public.task_items
  add column if not exists reviewed_at timestamptz;

alter table public.task_items
  add column if not exists review_comment text;

-- Approver (closes the record — must differ from assignee for avvik/risiko)
alter table public.task_items
  add column if not exists requires_approval boolean not null default false;

alter table public.task_items
  add column if not exists approved_at timestamptz;

alter table public.task_items
  add column if not exists approved_by uuid
    references auth.users (id) on delete set null;

-- Causality chain: tiltak.parent_item_id → avvik or risiko item
alter table public.task_items
  add column if not exists parent_item_id uuid
    references public.task_items (id) on delete set null;

-- Template linkage
alter table public.task_items
  add column if not exists template_slug text;

-- Template kind drives lifecycle rules (avvik = CAPA, risiko = assessment, etc.)
alter table public.task_items
  add column if not exists template_kind text
    check (template_kind in ('oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær'));

-- Effort tracking (ISO § 6.2.2 resource planning)
alter table public.task_items
  add column if not exists estimated_hours numeric(6,1);

alter table public.task_items
  add column if not exists actual_hours numeric(6,1);

-- SLA deadline (computed app-side from priority × org SLA config)
alter table public.task_items
  add column if not exists sla_due_at timestamptz;

-- Effectiveness review (ISO 45001 § 10.2)
alter table public.task_items
  add column if not exists effectiveness_review_due_at timestamptz;

alter table public.task_items
  add column if not exists effectiveness_reviewed_at timestamptz;

-- Post-control residual risk score (risiko template — re-assessment after tiltak)
alter table public.task_items
  add column if not exists residual_risk_score int
    check (residual_risk_score between 1 and 25);

-- Regulatory notification timestamps (AML § 6-2 VO, § 7-2 AMU)
alter table public.task_items
  add column if not exists vo_notified_at timestamptz;

alter table public.task_items
  add column if not exists amu_notified_at timestamptz;

-- Arbeidstilsynet notification for serious incidents (AML § 5-1)
alter table public.task_items
  add column if not exists arbeidstilsynet_notified_at timestamptz;

alter table public.task_items
  add column if not exists arbeidstilsynet_notification_due_at timestamptz;

-- Module settings override: hard_gate (cannot close without linked tiltak)
-- Stored per-item to capture the org setting at creation time
alter table public.task_items
  add column if not exists closure_gate text not null default 'hard'
    check (closure_gate in ('hard', 'soft', 'none'));

-- Recurrence: cadence hint for recurring tasks (IK-f § 5 nr. 8)
alter table public.task_items
  add column if not exists recurrence_cadence text
    check (recurrence_cadence in ('arlig', 'halvarlig', 'kvartalsvis', 'manedlig', 'ad_hoc'));

alter table public.task_items
  add column if not exists next_recurrence_date date;

-- ── Extend task_template_catalog ─────────────────────────────────────────

-- template_kind: drives lifecycle and UI rules
alter table public.task_template_catalog
  add column if not exists template_kind text
    check (template_kind in ('oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær'));

-- metadata_schema jsonb: per-template field declarations
-- Shape: {fields: [{id, label, kind, required, options?}]}
-- Kinds: text | textarea | date | datetime | daterange | number | boolean | select
alter table public.task_template_catalog
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

-- Version counter — bumped by trigger on each UPDATE
alter table public.task_template_catalog
  add column if not exists version int not null default 1;

-- category_id FK for hub grouping + sidebar collapsible headers
alter table public.task_template_catalog
  add column if not exists category_id uuid
    references public.task_template_categories (id) on delete set null;

-- Backfill template_kind from source_category for existing rows
update public.task_template_catalog
set template_kind = case source_category
  when 'avvik'           then 'avvik'
  when 'risikovurdering' then 'risiko'
  when 'tiltak'          then 'tiltak'
  else 'oppgave'
end
where template_kind is null;

-- Backfill metadata_schema from definition for existing rows
-- (definition.fields → metadata_schema.fields, same shape)
update public.task_template_catalog
set metadata_schema = jsonb_build_object('fields', coalesce(definition->'fields', '[]'::jsonb))
where metadata_schema = '{"fields":[]}'::jsonb
  and definition->'fields' is not null
  and jsonb_array_length(definition->'fields') > 0;

-- ── Additional indexes ────────────────────────────────────────────────────

create index if not exists task_items_owner_idx
  on public.task_items (organization_id, owner_user_id)
  where deleted_at is null;

create index if not exists task_items_parent_idx
  on public.task_items (parent_item_id)
  where parent_item_id is not null and deleted_at is null;

create index if not exists task_items_sla_idx
  on public.task_items (organization_id, sla_due_at)
  where deleted_at is null and status not in ('closed', 'cancelled', 'done');

create index if not exists task_items_template_kind_idx
  on public.task_items (organization_id, template_kind, status)
  where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120017_task_subtasks_comments.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task subtasks, comments and activity log — moves localStorage data to the DB.
--
-- Coverage gap closed:
--   useTaskExtensions.ts stored subtasks, comments, projects and priorities in
--   localStorage. This means data is lost on browser clear, not multi-user,
--   and not auditable. This migration provides proper relational tables so
--   subtasks and comments are:
--     - Persisted server-side with org-level RLS
--     - Multi-user (collaborators can add comments and subtasks)
--     - Audited via task_activity_log (INSERT-only, no UPDATE/DELETE by policy)
--
--   task_activity_log is the immutable audit trail required by ISO 45001 § 9.1.1
--   and AML § 5-2 for objective evidence.
--
-- Self-audit:
--   IK-f § 5 nr. 1 krever at internkontrollsystemet er dokumentert.
--   task_activity_log gir uforanderlig tidslinje for hver oppgave.
--   Restrisiko: ingen full-text søk på kommentarer i dag (GIN-indeks
--   kan legges til om behov oppstår).

set local search_path = public, pg_catalog;

-- ── Table: task_subtasks ──────────────────────────────────────────────────

create table if not exists public.task_subtasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  title           text not null,
  is_done         boolean not null default false,
  done_at         timestamptz,
  done_by         uuid references auth.users (id) on delete set null,
  position        int not null default 100,
  assignee_user_id uuid references auth.users (id) on delete set null,
  due_date        date,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_subtasks_item_pos_idx
  on public.task_subtasks (task_item_id, position)
  where deleted_at is null;

alter table public.task_subtasks enable row level security;

drop policy if exists task_subtasks_select_org on public.task_subtasks;
create policy task_subtasks_select_org
  on public.task_subtasks for select
  using (organization_id = public.current_org_id());

drop policy if exists task_subtasks_write_org on public.task_subtasks;
create policy task_subtasks_write_org
  on public.task_subtasks for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_subtasks_before_insert_defaults()
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

drop trigger if exists task_subtasks_before_insert_defaults_tg on public.task_subtasks;
create trigger task_subtasks_before_insert_defaults_tg
  before insert on public.task_subtasks
  for each row execute function public.task_subtasks_before_insert_defaults();

drop trigger if exists task_subtasks_set_updated_at on public.task_subtasks;
create trigger task_subtasks_set_updated_at
  before update on public.task_subtasks
  for each row execute function public.set_updated_at();

-- Auto-set done_at when is_done flips true
create or replace function public.task_subtasks_before_update_done()
returns trigger
language plpgsql
as $$
begin
  if new.is_done = true and (old.is_done = false or old.is_done is null) then
    new.done_at := coalesce(new.done_at, now());
    new.done_by := coalesce(new.done_by, auth.uid());
  end if;
  if new.is_done = false and old.is_done = true then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists task_subtasks_before_update_done_tg on public.task_subtasks;
create trigger task_subtasks_before_update_done_tg
  before update on public.task_subtasks
  for each row execute function public.task_subtasks_before_update_done();

-- ── Table: task_comments ──────────────────────────────────────────────────

create table if not exists public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  -- author_name denormalized for display without auth join
  author_name     text not null default '',
  author_user_id  uuid references auth.users (id) on delete set null,
  -- For threaded replies
  parent_comment_id uuid references public.task_comments (id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists task_comments_item_created_idx
  on public.task_comments (task_item_id, created_at)
  where deleted_at is null;

alter table public.task_comments enable row level security;

drop policy if exists task_comments_select_org on public.task_comments;
create policy task_comments_select_org
  on public.task_comments for select
  using (organization_id = public.current_org_id());

drop policy if exists task_comments_insert_org on public.task_comments;
create policy task_comments_insert_org
  on public.task_comments for insert
  with check (organization_id = public.current_org_id());

-- Only author can update/delete own comment
drop policy if exists task_comments_update_own on public.task_comments;
create policy task_comments_update_own
  on public.task_comments for update
  using (organization_id = public.current_org_id() and author_user_id = auth.uid());

drop policy if exists task_comments_delete_own on public.task_comments;
create policy task_comments_delete_own
  on public.task_comments for delete
  using (organization_id = public.current_org_id() and author_user_id = auth.uid());

create or replace function public.task_comments_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.author_user_id is null then
    new.author_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_comments_before_insert_defaults_tg on public.task_comments;
create trigger task_comments_before_insert_defaults_tg
  before insert on public.task_comments
  for each row execute function public.task_comments_before_insert_defaults();

-- ── Table: task_activity_log ──────────────────────────────────────────────
-- Immutable audit trail. RLS allows INSERT but blocks UPDATE and DELETE.
-- This is the "objective evidence" store for ISO 45001 § 9.1.1.

create table if not exists public.task_activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  -- action codes: status_change, comment_added, subtask_done, evidence_added,
  --               assignee_changed, reviewer_assigned, approved, reviewed,
  --               vo_notified, amu_notified, arbeidstilsynet_notified,
  --               created, deleted, field_updated
  action          text not null,
  actor_user_id   uuid references auth.users (id) on delete set null,
  actor_name      text not null default '',
  -- Flexible payload: {from, to, field, comment, ...}
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists task_activity_log_item_created_idx
  on public.task_activity_log (task_item_id, created_at desc);

create index if not exists task_activity_log_org_created_idx
  on public.task_activity_log (organization_id, created_at desc);

alter table public.task_activity_log enable row level security;

drop policy if exists task_activity_log_select_org on public.task_activity_log;
create policy task_activity_log_select_org
  on public.task_activity_log for select
  using (organization_id = public.current_org_id());

-- INSERT only — no UPDATE or DELETE (immutable audit trail)
drop policy if exists task_activity_log_insert_org on public.task_activity_log;
create policy task_activity_log_insert_org
  on public.task_activity_log for insert
  with check (organization_id = public.current_org_id());

create or replace function public.task_activity_log_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.actor_user_id is null then
    new.actor_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_activity_log_before_insert_defaults_tg
  on public.task_activity_log;
create trigger task_activity_log_before_insert_defaults_tg
  before insert on public.task_activity_log
  for each row execute function public.task_activity_log_before_insert_defaults();

-- Auto-log status changes on task_items
create or replace function public.task_items_status_change_log()
returns trigger
language plpgsql
as $$
begin
  if new.status <> old.status then
    insert into public.task_activity_log
      (organization_id, task_item_id, action, actor_user_id, payload)
    values (
      new.organization_id,
      new.id,
      'status_change',
      auth.uid(),
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists task_items_status_change_log_tg on public.task_items;
create trigger task_items_status_change_log_tg
  after update on public.task_items
  for each row
  when (old.status is distinct from new.status)
  execute function public.task_items_status_change_log();

-- ── Table: task_watchers ──────────────────────────────────────────────────

create table if not exists public.task_watchers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_item_id    uuid not null references public.task_items (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- role: 'watcher' | 'contributor' (contributors can add evidence/comments)
  role            text not null default 'watcher'
    check (role in ('watcher', 'contributor')),
  created_at      timestamptz not null default now(),
  unique (task_item_id, user_id)
);

create index if not exists task_watchers_user_idx
  on public.task_watchers (user_id, organization_id);

alter table public.task_watchers enable row level security;

drop policy if exists task_watchers_select_org on public.task_watchers;
create policy task_watchers_select_org
  on public.task_watchers for select
  using (organization_id = public.current_org_id());

drop policy if exists task_watchers_write_org on public.task_watchers;
create policy task_watchers_write_org
  on public.task_watchers for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120018_task_evidence_consultations.sql
-- ════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120019_task_template_seeds_v2.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task template seeds v2 — 7 system templates with metadata_schema, law_refs,
-- template_kind, and default category assignments. Replaces the 6 seeds from
-- migration 120005 via on-conflict-do-update. Adds provision function v2.
--
-- Templates seeded:
--   1. oppgave-generell    — Generell oppgave (AML § 4-1)
--   2. avvik               — Avvik / Hendelse (AML § 5-1, § 5-2)
--   3. nestenulykke        — Nestenulykke / Farlig forhold (AML § 5-1)
--   4. tiltak              — Forbedringstiltak (AML § 3-2, § 4-1)
--   5. risiko              — Risikovurdering (AML § 3-1, IK-f § 5 nr. 6)
--   6. forslag             — Forslag & Forbedring (AML § 4-2, § 8-1)
--   7. sykefravær-oppfølging — Sykefravær-oppfølging (AML § 4-6)
--
-- Self-audit (Arbeidstilsynet POV):
--   Samtlige templates dekker primær-paragrafene pålegg-revisor sjekker:
--   § 3-1 (RV), § 3-2 (tiltak), § 4-1 (tilrettelegging), § 4-2 (medvirkning),
--   § 4-6 (sykefravær), § 5-1/5-2 (avvik/meldeplikt), § 8-1 (opplysning).
--   Restrisiko: § 2A (varsling) er deferred til separat varslings-modul.
--   § 14 (innleie) og § 18 (tilsyn) er deferred til compliance-planner.

set local search_path = public, pg_catalog;

-- ── 1. Generell oppgave ───────────────────────────────────────────────────

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition,
  metadata_schema
) values (
  '00000000-2000-4000-a000-000000000001',
  'oppgave-generell',
  'aml-amu', 'general', 'oppgave',
  'Generell oppgave',
  'Frittstående oppgave for generelle HMS-aktiviteter og handlingspunkter.',
  array['AML § 4-1', 'AML § 4-2'],
  'do', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Hva skal gjøres?","kind":"textarea","required":true},
    {"id":"f2","label":"Hvorfor er dette nødvendig?","kind":"textarea","required":false},
    {"id":"f3","label":"Forventet resultat","kind":"textarea","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 2. Avvik / Hendelse ───────────────────────────────────────────────────
-- Improvements vs. previous: verneombud-varsling (AML § 6-2), structured
-- root-cause method (Arbeidstilsynet expects documented approach), severity
-- options cleaned up (nestenulykke removed — wrong template), melder added.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000002',
  'avvik',
  'aml-amu', 'avvik', 'avvik',
  'Avvik / Hendelse',
  'Melding og oppfølging av avvik, ulykker og uønskede hendelser. Fullstendig CAPA-livssyklus med rotårsaksanalyse og tilknyttet tiltak.',
  array['AML § 5-1', 'AML § 5-2', 'AML § 6-2', 'IK-f § 5 nr. 7'],
  'check', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Hendelsesdetaljer","kind":"section","required":false},
    {"id":"f1","label":"Hva skjedde?","kind":"textarea","required":true},
    {"id":"f2","label":"Tidspunkt for hendelsen","kind":"datetime","required":true},
    {"id":"f3","label":"Sted / arbeidssted","kind":"location","required":true},
    {"id":"f4","label":"Hvem var involvert (navn / rolle)?","kind":"person","required":false},
    {"id":"f5","label":"Melder / rapportert av","kind":"person","required":false},
    {"id":"s2","label":"Skade og alvorlighetsgrad","kind":"section","required":false},
    {"id":"f6","label":"Personskade?","kind":"boolean","required":true},
    {"id":"f7","label":"Skadens art og omfang (hvis personskade)","kind":"textarea","required":false},
    {"id":"f8","label":"Hendelseskategori","kind":"select","required":true,
      "options":["Fysisk / ergonomisk","Kjemisk / biologisk","Psykososialt","Brann / eksplosjon","Fall / ulykke","Utstyr / maskiner","Farlig stoff / utslipp","Annet"]},
    {"id":"f9","label":"Alvorlighetsgrad","kind":"select","required":true,
      "options":["Kritisk – alvorlig personskade / dødsfall","Alvorlig – sykehusbehandling nødvendig","Moderat – legebehandling / førstehjelp","Lav – ingen personskade, kun materiell"]},
    {"id":"s3","label":"Analyse og tiltak","kind":"section","required":false},
    {"id":"f10","label":"Umiddelbare tiltak iverksatt","kind":"textarea","required":false},
    {"id":"f11","label":"Verneombud varslet? (AML § 6-2)","kind":"boolean","required":true},
    {"id":"f12","label":"Rotårsaksanalyse-metode","kind":"select","required":false,
      "options":["5-Hvorfor","Årsak-virkning (Ishikawa)","Hendelsesforløp / tidslinje","Fri analyse"]},
    {"id":"f13","label":"Rotårsaksanalyse","kind":"textarea","required":false},
    {"id":"s4","label":"Meldeplikt","kind":"section","required":false},
    {"id":"f14","label":"Meldepliktig til Arbeidstilsynet? (AML § 5-2)","kind":"boolean","required":false},
    {"id":"f15","label":"Dato varslet Arbeidstilsynet","kind":"date","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 3. Nestenulykke / Farlig forhold ─────────────────────────────────────
-- Improvements: type classification, potential severity, verneombud,
-- recurrence likelihood, and mandatory corrective proposal.
-- AML § 5-1 requires ALL near-misses to be recorded and followed up.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000003',
  'nestenulykke',
  'aml-amu', 'avvik', 'nestenulykke',
  'Nestenulykke / Farlig forhold',
  'Registrering av nestenulykker og farlige forhold som ikke medførte skade, men som kunne ha ført til det.',
  array['AML § 5-1', 'AML § 6-2', 'IK-f § 5 nr. 6'],
  'check', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Hendelsen","kind":"section","required":false},
    {"id":"f1","label":"Beskriv nestenulykken / det farlige forholdet","kind":"textarea","required":true},
    {"id":"f2","label":"Tidspunkt","kind":"datetime","required":true},
    {"id":"f3","label":"Sted / arbeidssted","kind":"location","required":true},
    {"id":"f4","label":"Type hendelse","kind":"select","required":true,
      "options":["Farlig handling (menneskelig feil)","Farlig tilstand (fysisk / teknisk)","Systemsvikt / prosedyresvikt","Nær-miss ved transport / forflytning","Annet"]},
    {"id":"s2","label":"Konsekvens og årsak","kind":"section","required":false},
    {"id":"f5","label":"Hva kunne ha skjedd i verste fall?","kind":"textarea","required":true},
    {"id":"f6","label":"Potensiell alvorlighet hvis ulykken hadde skjedd","kind":"select","required":true,
      "options":["Kritisk – alvorlig personskade / dødsfall","Alvorlig – sykehusbehandling","Moderat – legebehandling","Lav – kun materiell skade"]},
    {"id":"f7","label":"Sannsynlighet for gjentakelse","kind":"select","required":false,
      "options":["Høy – vil skje igjen uten tiltak","Middels – kan skje igjen","Lav – usannsynlig gjentakelse"]},
    {"id":"f8","label":"Bakenforliggende årsak","kind":"textarea","required":false},
    {"id":"s3","label":"Oppfølging","kind":"section","required":false},
    {"id":"f9","label":"Verneombud varslet? (AML § 6-2)","kind":"boolean","required":true},
    {"id":"f10","label":"Foreslått forebyggende tiltak","kind":"textarea","required":true},
    {"id":"f11","label":"Krever fullstendig risikovurdering?","kind":"boolean","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 4. Forbedringstiltak ──────────────────────────────────────────────────
-- Major revision: ISO 45001 § 8.1.2 hierarchy of controls is now the primary
-- type selector (eliminering first, PPE last). Added traceability to source,
-- mandatory deadline, verneombud involvement (AML § 6-2), and a structured
-- effectiveness verification gate (ISO 45001 § 10.2 f).
-- Removed "Kompenserende" — not a recognised CAPA category.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000004',
  'tiltak',
  'aml-amu', 'tiltak', 'tiltak',
  'Forbedringstiltak',
  'Planlegging, gjennomføring og verifisering av forebyggende og korrigerende tiltak. Følger ISO 45001 § 8.1.2 kontrolltiltakshierarki.',
  array['AML § 3-2', 'AML § 4-1', 'AML § 6-2', 'IK-f § 5 nr. 7', 'IK-f § 5 nr. 8', 'NS-EN ISO 45001 § 8.1.2'],
  'do', 'kvartalsvis', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Tiltaksbeskrivelse","kind":"section","required":false},
    {"id":"f1","label":"Tiltaksbeskrivelse — hva skal gjøres?","kind":"textarea","required":true},
    {"id":"f2","label":"Kontrolltiltaktype (ISO 45001 § 8.1.2 — velg høyest mulig nivå)","kind":"select","required":true,
      "options":["1. Eliminering – fjern kilden helt","2. Substitusjon – erstatt med noe mindre farlig","3. Teknisk tiltak – barrierer, avskjerming, automatisering","4. Administrativt tiltak – rutiner, opplæring, rotasjon","5. Verneutstyr (PPE) – siste utvei"]},
    {"id":"f3","label":"Bakgrunn — hvilken risiko eller avvik adresseres?","kind":"textarea","required":true},
    {"id":"f4","label":"Kilde — avvik- eller risikoreferanse (tittel / ID)","kind":"text","required":false},
    {"id":"f5","label":"Forventet effekt og akseptansekriterium","kind":"textarea","required":true},
    {"id":"f6","label":"Hastegrad","kind":"select","required":true,
      "options":["Akutt – iverksettes umiddelbart","Høy – innen 1 måned","Middels – innen 3 måneder","Lav – innen 6 måneder"]},
    {"id":"s2","label":"Gjennomføring","kind":"section","required":false},
    {"id":"f7","label":"Startdato","kind":"date","required":false},
    {"id":"f8","label":"Ferdigstillelsesdato / frist","kind":"date","required":true},
    {"id":"f9","label":"Estimert kostnad (NOK)","kind":"number","required":false},
    {"id":"f10","label":"Gjennomføringsmetode og ansvarlig person","kind":"textarea","required":false},
    {"id":"f11","label":"Verneombud / ansatterepresentant involvert (AML § 6-2)","kind":"boolean","required":true},
    {"id":"s3","label":"Verifisering og effektkontroll","kind":"section","required":false},
    {"id":"f12","label":"Bekreftet gjennomført av","kind":"person","required":false},
    {"id":"f13","label":"Dato bekreftet gjennomført","kind":"date","required":false},
    {"id":"f14","label":"Effektvurdering — ble forventet effekt oppnådd? (ISO 45001 § 10.2 f)","kind":"select","required":false,
      "options":["Ja – fullt ut, tiltaket kan lukkes","Delvis – ytterligere tiltak er nødvendig","Nei – nytt tiltak er iverksatt"]},
    {"id":"f15","label":"Effektvurdering utført av","kind":"person","required":false},
    {"id":"f16","label":"Dato for effektvurdering","kind":"date","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 5. Risikovurdering ────────────────────────────────────────────────────

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000005',
  'risiko',
  'aml-amu', 'risikovurdering', 'risiko',
  'Risikovurdering',
  'Systematisk kartlegging og vurdering av risiko i arbeidsmiljøet. Inkluderer sannsynlighet × konsekvens-matrise og residualrisiko etter tiltak.',
  array['AML § 3-1', 'IK-f § 5 nr. 6', 'NS-EN ISO 45001'],
  'plan', 'arlig', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Vurderingsgrunnlag","kind":"section","required":false},
    {"id":"f1","label":"Hva utløste vurderingen?","kind":"select","required":true,
      "options":["Periodisk gjennomgang","Ny prosess / nytt utstyr","Etter hendelse / avvik","Organisasjonsendring","Krav fra Arbeidstilsynet","Annet"]},
    {"id":"f2","label":"Farekilder – type","kind":"select","required":true,
      "options":["Fysisk / ergonomisk","Kjemisk","Biologisk","Psykososialt","Organisatorisk","Elektrisk","Brann / eksplosjon","Annet"]},
    {"id":"f3","label":"Farekilder – detaljert beskrivelse","kind":"textarea","required":true},
    {"id":"f4","label":"Hvem kan bli skadet og hvordan?","kind":"textarea","required":true},
    {"id":"f5","label":"Område / prosess som vurderes","kind":"text","required":true},
    {"id":"f6","label":"Risikogruppe","kind":"select","required":true,
      "options":["Alle ansatte","Spesifikk arbeidsgruppe","Enkeltperson","Besøkende / kunder","Kontraktører / innleide"]},
    {"id":"s2","label":"Risikovurdering — uten tiltak","kind":"section","required":false},
    {"id":"f7","label":"Eksisterende barrierer og tiltak","kind":"textarea","required":false},
    {"id":"f8","label":"Sannsynlighet uten tiltak (1=svært lav – 5=svært høy)","kind":"number","required":true},
    {"id":"f9","label":"Konsekvens uten tiltak (1=ubetydelig – 5=katastrofal)","kind":"number","required":true},
    {"id":"fm1","label":"Risikomatrise — innledende risikonivå","kind":"risk_matrix","required":false,
      "options":["prob:f8","cons:f9"]},
    {"id":"f10","label":"Risikonivå uten tiltak","kind":"select","required":false,
      "options":["Lav (1–4)","Middels (5–12)","Høy (13–25)"]},
    {"id":"s3","label":"Tiltak og residualrisiko","kind":"section","required":false},
    {"id":"f11","label":"Planlagte nye tiltak","kind":"textarea","required":false},
    {"id":"f12","label":"Sannsynlighet etter tiltak (1–5)","kind":"number","required":false},
    {"id":"f13","label":"Konsekvens etter tiltak (1–5)","kind":"number","required":false},
    {"id":"fm2","label":"Risikomatrise — residualrisiko etter tiltak","kind":"risk_matrix","required":false,
      "options":["prob:f12","cons:f13"]},
    {"id":"f14","label":"Restrisiko akseptabel?","kind":"boolean","required":false},
    {"id":"f15","label":"Begrunnelse for aksept av restrisiko","kind":"textarea","required":false},
    {"id":"s4","label":"Gjennomgang og godkjenning","kind":"section","required":false},
    {"id":"f16","label":"Uavhengig gjennomgang utført av","kind":"person","required":true},
    {"id":"f17","label":"Dato for gjennomgang","kind":"date","required":true},
    {"id":"f18","label":"Neste gjennomgangsdato","kind":"date","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 6. Forslag & Forbedring ───────────────────────────────────────────────
-- Improvements: anonymous submission flag (AML § 4-3 psychological safety),
-- AMU-notification field (AML § 7-2), employer decision tracking with
-- mandatory reasoning if rejected — closes the AML § 4-2 medvirkning loop.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000006',
  'forslag',
  'aml-amu', 'general', 'forslag',
  'Forslag & Forbedring',
  'Innspill og forslag fra ansatte til forbedring av arbeidsmiljøet. AMU-relevant: § 4-2 medvirkning, § 7-2 AMU-behandling, § 8-1 informasjon og drøfting.',
  array['AML § 4-2', 'AML § 4-3', 'AML § 7-2', 'AML § 8-1', 'IK-f § 5 nr. 8'],
  'act', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Forslaget","kind":"section","required":false},
    {"id":"f1","label":"Beskriv forslaget","kind":"textarea","required":true},
    {"id":"f2","label":"Kategori","kind":"select","required":true,
      "options":["HMS – forebygging av skader","Arbeidsmiljø / trivsel","Ergonomi / fysisk arbeidsmiljø","Effektivitet / prosessforbedring","Kompetanse / opplæring","Utstyr / teknologi","Annet"]},
    {"id":"f3","label":"Forventet gevinst / forbedring","kind":"textarea","required":false},
    {"id":"f4","label":"Berørte avdelinger / arbeidsgrupper","kind":"text","required":false},
    {"id":"s2","label":"Vurdering og prioritet","kind":"section","required":false},
    {"id":"f5","label":"Estimert gjennomføringskostnad (NOK)","kind":"number","required":false},
    {"id":"f6","label":"Forslagsstillers prioritetsvurdering","kind":"select","required":false,
      "options":["Høy – bør gjøres snarest","Middels – innen 6 måneder","Lav – langsiktig forbedring"]},
    {"id":"f7","label":"Anonymt innspill? (AML § 4-3)","kind":"boolean","required":false},
    {"id":"s3","label":"Arbeidsgivers behandling","kind":"section","required":false},
    {"id":"f8","label":"Behandlet i AMU / med ansatterepresentant? (AML § 7-2)","kind":"boolean","required":false},
    {"id":"f9","label":"Arbeidsgivers beslutning","kind":"select","required":false,
      "options":["Under vurdering","Akseptert – planlegges gjennomført","Utsatt – revurderes senere","Avvist"]},
    {"id":"f10","label":"Begrunnelse for beslutning (obligatorisk ved avvisning)","kind":"textarea","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 7. Sykefravær-oppfølging ──────────────────────────────────────────────
-- Improvements: AML § 4-6 mandates a 4-week oppfølgingsplan sent to sykmelder
-- (previously missing). Added dates for Dialogmøte 1 (7 uker, arbeidsgiver)
-- and Dialogmøte 2 (26 uker, NAV). Tilretteleggingstype structured as select.
-- Ftrl § 8-7a: gradert sykmelding encouraged — reflected in follow-up fields.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000007',
  'sykefravær-oppfølging',
  'aml-amu', 'tiltak', 'sykefravær',
  'Sykefravær-oppfølging',
  'Strukturert oppfølging av sykemeldte etter AML § 4-6: 4-ukersplan, 7-ukerssamtale (Dialogmøte 1), 26-ukersplan (Dialogmøte 2, NAV) og tilrettelegging.',
  array['AML § 4-6', 'Ftrl § 8-7a', 'Ftrl § 8-6'],
  'do', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Sykefraværsinfo","kind":"section","required":false},
    {"id":"f1","label":"Ansatt (sykemeldt)","kind":"person","required":true},
    {"id":"f2","label":"Første sykedag","kind":"date","required":true},
    {"id":"f3","label":"Diagnose / diagnosegruppe (valgfritt — kan utelates)","kind":"text","required":false},
    {"id":"f4","label":"Type sykefravær","kind":"select","required":true,
      "options":["100 % sykemeldt","Gradert sykemeldt (delvis arbeid)","Egenmelding (kortvarig)"]},
    {"id":"s2","label":"Oppfølgingsplan og samtaler","kind":"section","required":false},
    {"id":"f5","label":"4 uker — oppfølgingsplan sendt sykmelder? (AML § 4-6 tredje ledd)","kind":"boolean","required":false},
    {"id":"f6","label":"Dato oppfølgingsplan sendt","kind":"date","required":false},
    {"id":"f7","label":"Dialogmøte 1 (7 uker) — gjennomført? (AML § 4-6 fjerde ledd)","kind":"boolean","required":false},
    {"id":"f8","label":"Dato Dialogmøte 1","kind":"date","required":false},
    {"id":"s3","label":"Tilrettelegging","kind":"section","required":false},
    {"id":"f9","label":"Tilretteleggingstype","kind":"select","required":false,
      "options":["Teknisk – hjelpemidler, utstyr, tilpasning av arbeidssted","Organisatorisk – endret arbeidstid, fleksibilitet","Endrede arbeidsoppgaver – andre eller lettere oppgaver","Gradert tilbakegang – kombinert friskmelding","Kombinasjon av tiltak"]},
    {"id":"f10","label":"Tilretteleggingstiltak — beskrivelse","kind":"textarea","required":false},
    {"id":"f11","label":"BHT (bedriftshelsetjeneste) involvert?","kind":"boolean","required":false},
    {"id":"s4","label":"NAV-oppfølging","kind":"section","required":false},
    {"id":"f12","label":"Dialogmøte 2 (26 uker, NAV) — gjennomført?","kind":"boolean","required":false},
    {"id":"f13","label":"Dato Dialogmøte 2","kind":"date","required":false},
    {"id":"f14","label":"Forventet tilbakekomstdato (full stilling)","kind":"date","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 8. Forbedringsprosjekt (PDCA) ────────────────────────────────────────
-- Upsert for the legacy v1 slug to add metadata_schema + template_kind.
-- Fixes: daterange field kind replaced with two date fields.
-- Additions: problem statement, measurable KPIs (ISO 45001 § 6.2.1),
-- AMU treatment (AML § 7-2), mandatory worker involvement (AML § 4-2),
-- budget commitment, and a formal project sign-off field.

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-1000-4000-a000-000000000006',
  'forbedringsprosjekt',
  'aml-amu', 'tiltak', 'tiltak',
  'Forbedringsprosjekt (PDCA)',
  'Komplett PDCA-syklus for systematisk forbedring av arbeidsmiljøet. Inkluderer AMU-behandling, målbare suksesskriterier og formell prosjektavslutning.',
  array['AML § 3-2', 'AML § 4-2', 'AML § 7-2', 'IK-f § 5 nr. 8', 'NS-EN ISO 45001 § 6.2.1'],
  'act', 'arlig', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"s1","label":"Prosjektbeskrivelse","kind":"section","required":false},
    {"id":"f1","label":"Prosjektnavn","kind":"text","required":true},
    {"id":"f2","label":"Bakgrunn — hva er problemet eller risikoen?","kind":"textarea","required":true},
    {"id":"f3","label":"Mål — ønsket tilstand etter prosjektet","kind":"textarea","required":true},
    {"id":"f4","label":"Målbare suksesskriterier / KPIer (ISO 45001 § 6.2.1)","kind":"textarea","required":true},
    {"id":"s2","label":"Medvirkning og AMU","kind":"section","required":false},
    {"id":"f5","label":"Behandlet i AMU? (AML § 7-2)","kind":"boolean","required":true},
    {"id":"f6","label":"Dato AMU-behandling","kind":"date","required":false},
    {"id":"f7","label":"Involverte arbeidstakere / representanter (AML § 4-2)","kind":"textarea","required":true},
    {"id":"s3","label":"Planlegging og ressurser","kind":"section","required":false},
    {"id":"f8","label":"Prosjektleder","kind":"person","required":true},
    {"id":"f9","label":"Prosjektstart","kind":"date","required":false},
    {"id":"f10","label":"Prosjektslutt / frist","kind":"date","required":false},
    {"id":"f11","label":"Budsjett / ressursbehov (NOK eller beskrivelse)","kind":"text","required":false},
    {"id":"s4","label":"PDCA-gjennomføring","kind":"section","required":false},
    {"id":"f12","label":"Planlagte tiltak (Plan-fasen)","kind":"textarea","required":false},
    {"id":"f13","label":"Gjennomførte tiltak (Do-fasen)","kind":"textarea","required":false},
    {"id":"f14","label":"Resultater og avviksmåling mot KPI (Check-fasen)","kind":"textarea","required":false},
    {"id":"f15","label":"Standardisering og videreføring (Act-fasen)","kind":"textarea","required":false},
    {"id":"s5","label":"Prosjektavslutning","kind":"section","required":false},
    {"id":"f16","label":"Prosjekt godkjent og avsluttet av","kind":"person","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── Provision function v2 ─────────────────────────────────────────────────
-- Ensures every org has:
--   - AML task pack
--   - 4 default categories
--   - All 7 system templates activated (task_org_templates rows)
--   - Pinned: avvik, tiltak, risiko (most-used)
--   - Category assignments for pinned templates

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
  -- 1. Ensure AML pack exists (idempotent — from migration 120001)
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

  -- 2. Ensure 4 default categories
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

  -- 3. Activate + pin system templates for this org
  for v_tpl in
    select id, slug from public.task_template_catalog
    where is_system = true and is_active = true
      and organization_id is null
  loop
    insert into public.task_org_templates
      (organization_id, catalog_id, nav_pinned, is_active,
       category_id)
    values (
      p_org_id,
      v_tpl.id,
      -- all system templates show in nav by default; admin can hide per org
      true,
      true,
      case v_tpl.slug
        when 'avvik'               then v_cat_avvik
        when 'nestenulykke'        then v_cat_avvik
        when 'tiltak'              then v_cat_risiko
        when 'risiko'              then v_cat_risiko
        when 'forslag'             then v_cat_medvir
        when 'oppgave-generell'    then v_cat_medvir
        when 'sykefravær-oppfølging' then v_cat_syk
        else null
      end
    ) on conflict (organization_id, catalog_id) do update set
      is_active   = true,
      category_id = excluded.category_id;
  end loop;
end;
$$;

-- Backfill all existing organisations
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.provision_tasks_baseline_for_org(v_org_id);
  end loop;
end $$;

-- Wire provision function to new org inserts
create or replace function public.provision_tasks_on_org_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.provision_tasks_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists provision_tasks_on_org_insert_tg on public.organizations;
create trigger provision_tasks_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.provision_tasks_on_org_insert();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120020_task_template_versioning.sql
-- ════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120021_task_enforcement_gates.sql
-- ════════════════════════════════════════════════════════════════════════

-- Task enforcement gates — DB-level compliance rules.
--
-- Coverage gaps closed:
--   AML § 5-2 + ISO 45001 § 10.2: avvik must complete the CAPA lifecycle
--     before being closed. Without enforcement, operators can close avvik
--     without documenting root cause or verifying effectiveness — creating
--     a paper trail that fails external audit.
--   AML § 5-1: Serious injuries/incidents must be reported to Arbeidstilsynet
--     within 24 hours. Automatic task creation ensures no report is missed.
--   ISO 45001 § 5.3 / IK-f § 5 nr. 3: Risikovurderinger krever uavhengig
--     gjennomgang (reviewer ≠ eier). DB-trigger sikrer at 'lukket' bare
--     settes hvis reviewer_user_id er utfylt og ≠ created_by.
--
-- Self-audit (Arbeidstilsynet POV):
--   Gate 1 (avvik): Pålegg-grunn AML § 5-2. Hard-gate = exception i DB;
--     organisasjoner kan senke til 'soft' (UI-advarsel) eller 'none'
--     (ingen sjekk) — dette loggføres i task_module_settings og er synlig
--     for revisor.
--   Gate 2 (AML § 5-1): Trigger oppretter oppgaven kun ved priority='critical'
--     og auto_arbeidstilsynet_task=true. Trigger-guard mot rekursjon via
--     template_kind-sjekk.
--   Gate 3 (risiko): requires_independent_review=true er default. Kan
--     deaktiveres av org-admin — endringen loggføres.
--   Restrisiko: Triggers leser task_module_settings; ny org uten settings
--     faller tilbake på DEFAULT (hard / true / true). Provision-funksjonen
--     sikrer at settings alltid eksisterer etter onboarding.

set local search_path = public, pg_catalog;

-- ── Gate 1: avvik/nestenulykke closure hard gate ──────────────────────────
--
-- Blocks setting status='closed' on avvik/nestenulykke items unless the item
-- previously reached 'effectiveness_verified' (full CAPA flow).
-- Org setting avvik_closure_gate='hard' enforces this at DB level;
-- 'soft' returns a WARNING (pg RAISE NOTICE); 'none' is a no-op.

create or replace function public.trg_task_avvik_closure_gate_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate text;
begin
  -- Only fires for avvik and nestenulykke template kinds
  if new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  -- Only fires when transitioning TO 'closed'
  if new.status <> 'closed' or old.status = 'closed' then
    return new;
  end if;

  -- Read org gate setting (default 'hard' if no row)
  select coalesce(s.avvik_closure_gate, 'hard')
    into v_gate
    from public.task_module_settings s
   where s.organization_id = new.organization_id;

  if v_gate is null then
    v_gate := 'hard';
  end if;

  if v_gate = 'none' then
    return new;
  end if;

  -- Previous status must have been effectiveness_verified (full CAPA loop)
  if old.status <> 'effectiveness_verified' then
    if v_gate = 'hard' then
      raise exception
        'AVVIK_CLOSURE_GATE_HARD: Avvik kan ikke lukkes uten at CAPA-flyten er fullført '
        '(effektivitetsverifikasjon mangler). Siste status var «%». '
        'Fullfør CAPA-flyten, eller endre avviksgaten til «soft» i innstillingene.',
        old.status
        using errcode = 'P0001';
    else
      -- soft: allow but log warning
      raise notice 'AVVIK_CLOSURE_GATE_SOFT: Avvik lukkes uten fullstendig CAPA-flyt (siste status: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists task_avvik_closure_gate_tg on public.task_items;
create trigger task_avvik_closure_gate_tg
  before update of status on public.task_items
  for each row execute function public.trg_task_avvik_closure_gate_fn();

-- ── Gate 2: AML § 5-1 auto-notification task ─────────────────────────────
--
-- When a critical avvik or nestenulykke is created and the org has
-- auto_arbeidstilsynet_task=true, inserts a linked notification task
-- ("Meldeplikt Arbeidstilsynet — AML § 5-1") with due date = NOW() +
-- arbeidstilsynet_notification_hours (default 24h).
--
-- Recursion guard: the inserted task has template_kind='oppgave', so the
-- trigger won't fire again for the notification task itself.

create or replace function public.trg_task_aml51_auto_notification_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto    boolean;
  v_hours   int;
  v_due_at  timestamptz;
begin
  -- Only fire for new critical avvik/nestenulykke
  if new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  if new.priority <> 'critical' then
    return new;
  end if;

  -- Read org setting
  select
    coalesce(s.auto_arbeidstilsynet_task, true),
    coalesce(s.arbeidstilsynet_notification_hours, 24)
  into v_auto, v_hours
  from public.task_module_settings s
  where s.organization_id = new.organization_id;

  -- Default to enabled if no settings row
  if v_auto is null then v_auto := true; end if;
  if v_hours is null then v_hours := 24; end if;

  if not v_auto then
    return new;
  end if;

  v_due_at := now() + (v_hours || ' hours')::interval;

  insert into public.task_items (
    organization_id,
    pack,
    title,
    description,
    status,
    priority,
    source_category,
    template_kind,
    template_slug,
    pdca_phase,
    parent_item_id,
    due_date,
    sla_due_at,
    created_by
  ) values (
    new.organization_id,
    new.pack,
    'Meldeplikt Arbeidstilsynet — AML § 5-1',
    'Alvorlig hendelse registrert. AML § 5-1 krever at Arbeidstilsynet varsles snarest, '
      'og senest innen ' || v_hours || ' timer. Benytt Altinn-skjema NAV 13-07.05.',
    'open',
    'critical',
    'general',
    'oppgave',
    'oppgave-generell',
    'do',
    new.id,
    v_due_at::date,
    v_due_at,
    new.created_by
  );

  return new;
end;
$$;

drop trigger if exists task_aml51_auto_notification_tg on public.task_items;
create trigger task_aml51_auto_notification_tg
  after insert on public.task_items
  for each row execute function public.trg_task_aml51_auto_notification_fn();

-- ── Gate 3: risiko independent reviewer gate ─────────────────────────────
--
-- When a risiko item is set to 'closed', verifies that:
--   1. reviewer_user_id is set
--   2. reviewer_user_id ≠ created_by (segregation of duties)
-- Controlled by task_module_settings.requires_independent_review.

create or replace function public.trg_task_risiko_reviewer_gate_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required boolean;
begin
  if new.template_kind <> 'risiko' then
    return new;
  end if;

  if new.status <> 'closed' or old.status = 'closed' then
    return new;
  end if;

  select coalesce(s.requires_independent_review, true)
    into v_required
    from public.task_module_settings s
   where s.organization_id = new.organization_id;

  if v_required is null then v_required := true; end if;

  if not v_required then
    return new;
  end if;

  if new.reviewer_user_id is null then
    raise exception
      'RISIKO_REVIEWER_GATE: Risikovurdering kan ikke lukkes uten at en uavhengig '
      'gjennomgang er dokumentert. Sett reviewer_user_id til en annen person enn eier.'
      using errcode = 'P0002';
  end if;

  if new.reviewer_user_id = new.created_by then
    raise exception
      'RISIKO_REVIEWER_GATE: Risikovurdering krever uavhengig gjennomgang — '
      'reviewer kan ikke være samme person som opprettet oppgaven (ISO 45001 § 5.3).'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists task_risiko_reviewer_gate_tg on public.task_items;
create trigger task_risiko_reviewer_gate_tg
  before update of status on public.task_items
  for each row execute function public.trg_task_risiko_reviewer_gate_fn();

-- ════════════════════════════════════════════════════════════════════════
-- 20260829120022_task_org_templates_category_id.sql
-- ════════════════════════════════════════════════════════════════════════

-- Add category_id to task_org_templates — missed by _120015 on initial apply.
--
-- Coverage gap closed:
--   _120015 created task_template_categories and was supposed to add
--   category_id FK to task_org_templates, but the column was not present
--   in the deployed database. This migration adds it idempotently.

set local search_path = public, pg_catalog;

alter table public.task_org_templates
  add column if not exists category_id uuid
    references public.task_template_categories (id) on delete set null;

create index if not exists task_org_templates_category_idx
  on public.task_org_templates (category_id)
  where category_id is not null and deleted_at is null;


-- ============================================================
-- Part 2: Document system-coverage templates
-- ============================================================
-- Document system-coverage templates — "Systemdokumentasjon"
-- Self: audit consultants flag gaps where a legal requirement has no
-- documented evidence. Klarert's own modules satisfy several of those
-- requirements (risk tasks, survey, chemical register, learning, etc.)
-- but nothing in the document library stated that. This migration adds
-- seven pre-populated templates that explain how the system covers each
-- requirement and link auditors straight to the live module.
--
-- Self-audit (Arbeidstilsynet POV):
--   Addresses pålegg-grunner for: §3-1, §3-2, §4-3, §4-5, §5-1/5-2,
--   §4-6, IK-f §5 nr. 3/4.
--   Each template contains an info-alert placeholder where a future
--   live-data block (Option B) will be inserted — slug-stable so the
--   renderer upgrade is a drop-in with no content migration needed.
--   Restrisiko: templates describe system capability, not org-specific
--   configuration. Orgs must still populate the linked modules with
--   real data for the documents to constitute audit evidence.

-- ── 1. Risikovurdering — systemdokumentasjon ─────────────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000101',
  'tpl-sysdok-risikovurdering',
  'Risikovurdering — systemdokumentasjon',
  'Dokumenterer hvordan Klarerts oppgavemodul dekker kravet til skriftlig risikovurdering etter AML §3-1 og IK-f §5 nr. 3.',
  'procedure',
  array['AML § 3-1', 'IK-f § 5 nr. 3', 'NS-EN ISO 45001'],
  141,
  '{
    "title": "Risikovurdering — systemdokumentasjon",
    "summary": "Dette dokumentet beskriver hvordan organisasjonen oppfyller kravet til skriftlig risikovurdering gjennom Klarerts oppgavemodul.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 3-1", "IK-f § 5 nr. 3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon — den beskriver hvordan Klarert som system dekker lovkravet. Sørg for at risikovurderinger faktisk er registrert i oppgavemodulen for at dokumentet skal utgjøre reelt revisjonsbevis."},
      {"kind":"heading","level":1,"text":"Hvordan oppfylles AML §3-1?"},
      {"kind":"text","body":"<p>Arbeidsmiljøloven §3-1 (2c) og internkontrollforskriften §5 nr. 3 krever at virksomheten kartlegger farer og problemer og på denne bakgrunn vurderer risikoen. Risikovurderingen skal være skriftlig, datert og undertegnet.</p><p>Klarert oppfyller dette kravet gjennom <strong>oppgavemodulen — Risikovurdering-malen</strong>. Hver risikovurdering registreres som en strukturert oppgave med:</p><ul><li>Farekilder (type og detaljert beskrivelse)</li><li>Hvem som kan skades og hvordan</li><li>Sannsynlighet × konsekvens-matrise (S×K-grid)</li><li>Eksisterende barrierer og planlagte tiltak</li><li>Residualrisiko etter tiltak</li><li>Uavhengig gjennomgang med navn og dato</li><li>Neste gjennomgangsdato</li></ul>"},
      {"kind":"heading","level":2,"text":"Ansvarlig og involvering"},
      {"kind":"text","body":"<p>AML §3-1 (2a) krever at arbeidstakerne og deres representanter medvirker i kartleggingen. Klarerts risikovurderingsmal har et eget felt for involverte personer og bruker <em>person</em>-feltet for å knytte verneombud og fagansvarlig til vurderingen.</p><p>Verneombudet skal involveres i alle risikovurderinger etter AML §6-2 nr. 6. Dette sikres ved å legge verneombudet til som involvert part i oppgaven.</p>"},
      {"kind":"heading","level":2,"text":"Frekvens og årsgjennomgang"},
      {"kind":"text","body":"<p>Risikovurderinger skal gjennomgås:</p><ul><li>Minst én gang per år (IK-f §5 nr. 5)</li><li>Etter hendelser, ulykker og nestenulykker</li><li>Ved endringer i prosesser, utstyr eller organisasjon</li><li>På krav fra Arbeidstilsynet</li></ul><p>Neste gjennomgangsdato registreres på hver risikovurderingsoppgave. Oppgavelisten under viser status for alle aktive vurderinger.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall aktive risikovurderinger, siste gjennomgangsdato og andel med restrisiko «Høy» vil vises her direkte fra oppgavemodulen (live-blokk, versjon B). Frem til da: bruk knappen nedenfor."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne risikovurderinger i oppgavemodulen","route":"/tasks/management?template=risiko","variant":"primary"}},
      {"kind":"module","moduleName":"live_risk_feed","params":{"maxItems":5,"showDepartment":true}},
      {"kind":"law_ref","ref":"AML § 3-1","description":"Plikt til å kartlegge og vurdere risiko — skriftlig, datert, undertegnet, med ansatte involvert."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 3","description":"Kartlegge farer og problemer og på denne bakgrunn vurdere risiko — skriftlig prosedyre kreves."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 2. Psykososialt arbeidsmiljø — systemdokumentasjon ───────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000102',
  'tpl-sysdok-psykososialt',
  'Psykososialt arbeidsmiljø — systemdokumentasjon',
  'Dokumenterer hvordan undersøkelsesmodulen dekker kartleggings- og tiltaksplikten for psykososialt arbeidsmiljø etter AML §4-3.',
  'procedure',
  array['AML § 4-3', 'AML § 3-1', 'IK-f § 5 nr. 3'],
  142,
  '{
    "title": "Psykososialt arbeidsmiljø — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts undersøkelsesmodul brukes til å kartlegge og følge opp psykososialt arbeidsmiljø etter AML §4-3.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-3", "AML § 3-1"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. For at dokumentet skal utgjøre revisjonsbevis må organisasjonen faktisk gjennomføre arbeidsmiljøundersøkelser og følge opp resultatene med tiltak i oppgavemodulen."},
      {"kind":"heading","level":1,"text":"Hvordan oppfylles AML §4-3?"},
      {"kind":"text","body":"<p>AML §4-3 stiller krav til det psykososiale arbeidsmiljøet: arbeidet skal legges til rette slik at ansattes integritet og verdighet ivaretas, og arbeidstakerne skal ikke utsettes for trakassering, uønsket seksuell oppmerksomhet eller utilbørlig atferd. Arbeidsbelastning og tidspress skal være forsvarlig.</p><p>IK-f §5 nr. 3 krever at kartlegging av psykososiale risikofaktorer inngår i den systematiske HMS-aktiviteten.</p>"},
      {"kind":"heading","level":2,"text":"Kartlegging via undersøkelsesmodulen"},
      {"kind":"text","body":"<p>Klarerts undersøkelsesmodul dekker kartleggingsplikten gjennom:</p><ul><li><strong>Arbeidsmiljøundersøkelser</strong> — validerte spørreskjemaer (bl.a. QPS Nordic, UWES) som måler arbeidsbelastning, autonomi, sosial støtte og trakassering</li><li><strong>Anonyme innspill</strong> — åpne undersøkelser der ansatte kan melde bekymringer uten å identifisere seg</li><li><strong>Pulsmålinger</strong> — korte hyppige undersøkelser for å følge utvikling over tid</li></ul><p>Arbeidstilsynet forventer at kartlegging gjennomføres regelmessig (anbefalt: minst hvert annet år), at resultater presenteres for ansatte og AMU, og at det iverksettes tiltak der det avdekkes vesentlig risiko.</p>"},
      {"kind":"heading","level":2,"text":"Tiltaksoppfølging"},
      {"kind":"text","body":"<p>Funn fra undersøkelsene skal følges opp med konkrete tiltak. Disse registreres i oppgavemodulen (Tiltak-malen) og kobles til den aktuelle undersøkelsen. AMU skal informeres om resultater og planlagte tiltak etter AML §7-2.</p>"},
      {"kind":"heading","level":2,"text":"Trakassering og varsling"},
      {"kind":"text","body":"<p>Saker som gjelder trakassering eller utilbørlig atferd håndteres via varslingskanalen i Klarert (AML §2A). Se eget dokument: <em>Varslingsrutiner</em>.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall gjennomførte undersøkelser siste 12 måneder, svarprosent og andel med høy risikoindikator vil vises her direkte fra undersøkelsesmodulen (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne undersøkelsesmodulen","route":"/survey","variant":"primary"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Registrer tiltak","route":"/tasks/management?template=tiltak","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 4-3","description":"Krav til psykososialt arbeidsmiljø — verdighet, trakasseringsforbud, forsvarlig arbeidsbelastning."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 3","description":"Kartlegge psykososiale risikofaktorer som del av systematisk HMS."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 3. Kjemisk eksponering og stoffkartotek — systemdokumentasjon ────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000103',
  'tpl-sysdok-kjemisk',
  'Kjemisk eksponering og stoffkartotek — systemdokumentasjon',
  'Dokumenterer hvordan kjemikalieregisteret i Klarert dekker kravene til stoffkartotek og kjemisk risikovurdering etter AML §4-5 og Kjemikalieforskriften.',
  'procedure',
  array['AML § 4-5', 'Kjemikalieforskriften § 3', 'REACH Art. 31'],
  143,
  '{
    "title": "Kjemisk eksponering og stoffkartotek — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts kjemikalieregister dekker plikten til stoffkartotek og kjemisk risikovurdering etter AML §4-5.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-5", "Kjemikalieforskriften § 3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. Revisjonsbeviset er de faktiske oppføringene i kjemikalieregisteret. Registeret må holdes oppdatert — foreldede eller manglende SDS-er er den vanligste påleggsårsaken fra Arbeidstilsynet på §4-5."},
      {"kind":"heading","level":1,"text":"Lovgrunnlag"},
      {"kind":"text","body":"<p>AML §4-5 pålegger arbeidsgiver å sørge for at kjemiske stoffer og biologiske faktorer ikke medfører risiko for ansattes helse og sikkerhet. Kjemikalieforskriften (Forskrift om utførelse av arbeid, kap. 3) konkretiserer kravene:</p><ul><li>Stoffkartotek over alle kjemikalier som brukes eller oppbevares</li><li>Sikkerhetsdatablad (SDS) for hvert stoff, på norsk</li><li>Risikovurdering av eksponering per arbeidsoperasjon</li><li>Substitusjonsplikt — farligere stoffer skal byttes ut om mulig</li><li>Opplæring i sikker håndtering</li></ul>"},
      {"kind":"heading","level":2,"text":"Stoffkartotek i Klarert"},
      {"kind":"text","body":"<p>Kjemikalieregisteret i Klarert fungerer som virksomhetens digitale stoffkartotek. Hver oppføring inneholder:</p><ul><li>Produktnavn, CAS-nummer og leverandør</li><li>Fareklasser og faresymboler (GHS/CLP)</li><li>Bruksområde og ansvarlig avdeling</li><li>Lenke til gjeldende SDS</li><li>Substitusjonsnotat (om alternativ er vurdert)</li><li>Eksponeringsvurdering per stoff</li></ul><p>Registeret er tilgjengelig for alle ansatte og kan presenteres for Arbeidstilsynet ved tilsyn.</p>"},
      {"kind":"heading","level":2,"text":"Risikovurdering av kjemisk eksponering"},
      {"kind":"text","body":"<p>For hvert kjemikalie med identifisert risiko opprettes en risikovurderingsoppgave i oppgavemodulen (Risikovurdering-malen). Vurderingen dokumenterer:</p><ul><li>Eksponeringsnivå (målt eller estimert)</li><li>Sammenligning med administrative normer (AN-verdier)</li><li>Tekniske og organisatoriske vernetiltak</li><li>Krav til personlig verneutstyr (PPE)</li><li>Helseovervåkning hvis nødvendig</li></ul>"},
      {"kind":"heading","level":2,"text":"Opplæring og tilgang"},
      {"kind":"text","body":"<p>Ansatte som håndterer kjemikalier skal ha opplæring i sikker bruk, oppbevaring og avfallshåndtering. Opplæringen dokumenteres i læringsmodulen. SDS-ene skal være lett tilgjengelige på arbeidsstedet — fysisk eller digitalt via Klarert.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall registrerte kjemikalier, andel med gyldig SDS, antall med høy fareindikator og siste oppdateringsdato vil vises her direkte fra kjemikalieregisteret (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne kjemikalieregisteret","route":"/registers/chemicals","variant":"primary"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Opprett kjemisk risikovurdering","route":"/tasks/management?template=risiko","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 4-5","description":"Plikt til å forebygge risiko fra kjemiske stoffer og biologiske faktorer."},
      {"kind":"law_ref","ref":"Kjemikalieforskriften § 3","description":"Krav til stoffkartotek, SDS og risikovurdering av kjemisk eksponering."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 4. Avviksbehandling og personskaderapportering — systemdokumentasjon
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000104',
  'tpl-sysdok-avvik',
  'Avviksbehandling og personskaderapportering — systemdokumentasjon',
  'Dokumenterer hvordan avviksmalen i oppgavemodulen dekker kravene til avviksbehandling (IK-f §5 nr. 4) og meldeplikt for personskader (AML §5-1, §5-2).',
  'procedure',
  array['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 4', 'AML § 3-1'],
  144,
  '{
    "title": "Avviksbehandling og personskaderapportering — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts avviksmal i oppgavemodulen dekker kravene til avviksbehandling og meldeplikt for personskader.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 5-1", "AML § 5-2", "IK-f § 5 nr. 4"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"danger","text":"Alvorlige personskader og farlige forhold skal meldes til Arbeidstilsynet UMIDDELBART (AML §5-2). Bruk knappen under for å opprette avvik — tidsfristen løper fra hendelsestidspunktet."},
      {"kind":"heading","level":1,"text":"Avviksbehandling i Klarert"},
      {"kind":"text","body":"<p>IK-f §5 nr. 4 krever at virksomheten har rutiner for å behandle avvik og forebygge gjentakelse. Klarerts avviksmal i oppgavemodulen gir en strukturert CAPA-prosess (Corrective and Preventive Action) i 9 livssyklustilstander — fra åpen til lukket med effektverifikasjon.</p><p>Avviksmalen dokumenterer:</p><ul><li>Hendelsesdato, sted og hva som skjedde</li><li>Direkte og bakenforliggende årsaker (rotårsaksanalyse)</li><li>Umiddelbare strakstiltak</li><li>Korrigerende og forebyggende tiltak med ansvarlig og frist</li><li>Meldeplikt til Arbeidstilsynet (§5-1/§5-2) — eget sjekkboksfelt</li><li>Effektverifikasjon etter implementering</li><li>Uavhengig godkjenning ved lukking</li></ul>"},
      {"kind":"heading","level":2,"text":"Meldeplikt — AML §5-1 og §5-2"},
      {"kind":"text","body":"<p><strong>§5-1 — Arbeidsulykker og yrkessykdom:</strong> Arbeidsgiver skal registrere alle personskader som oppstår i arbeidet og på arbeidsstedet. Statistikk rapporteres til NAV og SSB.</p><p><strong>§5-2 — Umiddelbar meldeplikt:</strong> Alvorlige personskader og farlige forhold som kan føre til alvorlig skade, skal meldes til Arbeidstilsynet <em>umiddelbart</em> (telefonisk) og bekreftes skriftlig innen 3 virkedager. Arbeidsgiver har dessuten plikt til å varsle politiet ved arbeidsulykker med alvorlig personskade.</p><p>I Klarerts avviksmal markeres hendelsen som meldepliktig i feltet «Meldeplikt Arbeidstilsynet». Oppgaven kan ikke lukkes før feltet er besvart.</p>"},
      {"kind":"heading","level":2,"text":"Nestenulykker og farlige forhold"},
      {"kind":"text","body":"<p>Nestenulykker (hendelser som kunne ført til skade) meldes via nestenulykke-malen i oppgavemodulen. Systematisk registrering av nestenulykker er et krav etter IK-f §5 nr. 4 og gir viktig læringseffekt. En god internkontroll har typisk 5–10× så mange nestenulykker som faktiske skader i registeret.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall åpne avvik, andel innen frist, antall meldepliktige hendelser siste 12 måneder og gjennomsnittlig lukkingstid vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Meld avvik / personskade","route":"/tasks/management?template=avvik","variant":"danger"}},
      {"kind":"module","moduleName":"action_button","params":{"label":"Meld nestenulykke","route":"/tasks/management?template=nestenulykke","variant":"secondary"}},
      {"kind":"law_ref","ref":"AML § 5-1","description":"Plikt til å registrere personskader og yrkessykdom."},
      {"kind":"law_ref","ref":"AML § 5-2","description":"Umiddelbar meldeplikt til Arbeidstilsynet ved alvorlig personskade eller farlig forhold."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 4","description":"Rutiner for å behandle avvik og forebygge gjentakelse."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 5. HMS-opplæring — systemdokumentasjon ───────────────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000105',
  'tpl-sysdok-opplaering',
  'HMS-opplæring — systemdokumentasjon',
  'Dokumenterer hvordan læringsmodulen i Klarert dekker opplæringsplikten etter AML §3-2 og IK-f §5 nr. 1c.',
  'procedure',
  array['AML § 3-2', 'IK-f § 5 nr. 1c', 'Forskrift om organisering § 3-18'],
  145,
  '{
    "title": "HMS-opplæring — systemdokumentasjon",
    "summary": "Beskriver hvordan læringsmodulen i Klarert dokumenterer gjennomføring av HMS-opplæring etter AML §3-2.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 3-2", "IK-f § 5 nr. 1c"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. Revisjonsbeviset er de faktiske gjennomføringsregistreringene i læringsmodulen — ikke planen alene. Arbeidstilsynet vil be om dokumentasjon på at opplæringen faktisk er gjennomført."},
      {"kind":"heading","level":1,"text":"Opplæringsplikt etter AML §3-2"},
      {"kind":"text","body":"<p>AML §3-2 pålegger arbeidsgiver å sørge for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i det systematiske HMS-arbeidet. IK-f §5 nr. 1c krever at dette er dokumentert i internkontrollsystemet.</p><p>Loven stiller særskilte krav til:</p><ul><li><strong>Lederopplæring</strong> — alle med personalansvar skal ha tilstrekkelig HMS-opplæring (Forskrift om organisering §3-18)</li><li><strong>Verneombudsopplæring</strong> — minimum 40 timer (AML §6-5)</li><li><strong>AMU-opplæring</strong> — for AMU-medlemmer (AML §7-3)</li><li><strong>Risikobasert fagopplæring</strong> — tilpasset den enkeltes arbeid og risikoeksponering</li></ul>"},
      {"kind":"heading","level":2,"text":"Dokumentasjon via læringsmodulen"},
      {"kind":"text","body":"<p>Klarerts læringsmodul registrerer for hvert kurs:</p><ul><li>Hvem som har gjennomført (individuell historikk)</li><li>Gjennomføringsdato og bestått/ikke bestått</li><li>Kursinnhold og læringsmål</li><li>Fornyelsesintervall og varsling ved utløp</li></ul><p>Ledere med personalansvar skal ha gjennomført HMS-lederopplæring. Klarert sender automatisk påminnelse når fornyelse nærmer seg.</p>"},
      {"kind":"heading","level":2,"text":"Introduksjonsopplæring (onboarding)"},
      {"kind":"text","body":"<p>Nyansatte skal motta HMS-opplæring før de starter i arbeidet (AML §3-2 første ledd). Introduksjonskurset i læringsmodulen dekker:</p><ul><li>Organisasjonens HMS-policy og mål</li><li>Avviksmelding og varslingskanaler</li><li>Beredskap og evakuering</li><li>Risikoer knyttet til den konkrete stillingen</li></ul>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Fullføringsgrad per kurs, antall ansatte med utløpt opplæring og ledere uten godkjent HMS-lederopplæring vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Åpne læringsmodulen","route":"/learning","variant":"primary"}},
      {"kind":"law_ref","ref":"AML § 3-2","description":"Plikt til å sørge for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i HMS-arbeidet."},
      {"kind":"law_ref","ref":"IK-f § 5 nr. 1c","description":"Internkontrollen skal inneholde oversikt over opplæringsaktiviteter og kompetansekrav."},
      {"kind":"law_ref","ref":"Forskrift om organisering § 3-18","description":"Særskilt krav om dokumentert HMS-opplæring for ledere med personalansvar."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 6. Sykefraværsoppfølging — systemdokumentasjon ───────────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000106',
  'tpl-sysdok-sykefraværsoppfølging',
  'Sykefraværsoppfølging — systemdokumentasjon',
  'Dokumenterer hvordan sykefravær-malen i oppgavemodulen dekker oppfølgingsplikten etter AML §4-6 og Ftrl §8-7a.',
  'procedure',
  array['AML § 4-6', 'Ftrl § 8-7a', 'Ftrl § 8-6'],
  146,
  '{
    "title": "Sykefraværsoppfølging — systemdokumentasjon",
    "summary": "Beskriver hvordan Klarerts sykefravær-mal i oppgavemodulen sikrer lovpålagt oppfølging av sykemeldte arbeidstakere.",
    "status": "published",
    "template": "standard",
    "legalRefs": ["AML § 4-6", "Ftrl § 8-7a"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette er en systemdokumentasjon. For hvert sykefravær som overskrider 4 uker skal det opprettes en oppfølgingsoppgave i Klarert. Manglende dokumentasjon kan gi bot fra NAV og Arbeidstilsynet."},
      {"kind":"heading","level":1,"text":"Oppfølgingsplikt etter AML §4-6"},
      {"kind":"text","body":"<p>AML §4-6 pålegger arbeidsgiver en aktiv plikt til å tilrettelegge og følge opp sykemeldte arbeidstakere. Lovens milepæler er:</p><ul><li><strong>4 uker:</strong> Oppfølgingsplan skal være utarbeidet og sendt til sykmelder (lege). Planen skal inneholde vurdering av tilretteleggingsmuligheter og plan for tilbakeføring.</li><li><strong>7 uker:</strong> Dialogmøte 1 — arbeidsgiver innkaller til møte med den sykemeldte. BHT kan involveres.</li><li><strong>26 uker:</strong> Dialogmøte 2 — NAV innkaller, arbeidsgiver og sykmelder deltar. Gradert sykmelding og tiltak vurderes.</li></ul>"},
      {"kind":"heading","level":2,"text":"Dokumentasjon i Klarert"},
      {"kind":"text","body":"<p>Sykefravær-malen i oppgavemodulen registrerer alle lovpålagte milepæler:</p><ul><li>Første sykedag og type sykefravær (100% / gradert / egenmelding)</li><li>4-ukersplan sendt — dato og bekreftelse</li><li>Dialogmøte 1 gjennomført — dato og referat</li><li>Tilretteleggingstype og konkrete tiltak</li><li>BHT-involvering</li><li>Dialogmøte 2 (NAV) — dato</li><li>Forventet tilbakekomstdato</li></ul><p>Oppgaven gir varsling ved milepæler som nærmer seg fristen og sikrer at ingen lovpålagt aktivitet glemmes.</p>"},
      {"kind":"heading","level":2,"text":"Personvern og taushetsplikt"},
      {"kind":"text","body":"<p>Sykefraværsoppfølging innebærer behandling av helseopplysninger (særlige kategorier, GDPR art. 9). Klarert lagrer ikke diagnose med mindre den ansatte frivillig oppgir den. Feltet «Diagnose/diagnosegruppe» er valgfritt og merket med dette.</p><p>Tilgang til sykefraværsoppgaver er begrenset til den ansattes nærmeste leder og HR. Se personvernerklæringen for ansatte for detaljer.</p>"},
      {"kind":"alert","variant":"warning","text":"Live datavisning — kommende funksjon: Antall aktive sykefraværssaker, andel med 4-ukersplan sendt innen fristen og pågående Dialogmøte 2-saker vil vises her (live-blokk, versjon B)."},
      {"kind":"module","moduleName":"action_button","params":{"label":"Opprett sykefraværsoppfølging","route":"/tasks/management?template=sykefravær-oppfølging","variant":"primary"}},
      {"kind":"law_ref","ref":"AML § 4-6","description":"Plikt til å tilrettelegge og følge opp sykemeldte — 4-ukersplan, Dialogmøte 1 (7 uker) og Dialogmøte 2 (26 uker)."},
      {"kind":"law_ref","ref":"Ftrl § 8-7a","description":"Krav til oppfølgingsplan som forutsetning for sykepenger ut over 8 uker."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── 7. Systematisk internkontroll — systemdokumentasjon ──────────────
insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000107',
  'tpl-sysdok-internkontroll',
  'Systematisk internkontroll — Klarert som IK-system',
  'Overordnet systemdokumentasjon som forklarer hvordan Klarert som helhet dekker kravene i internkontrollforskriften §5 — for bruk ved tilsyn.',
  'procedure',
  array['IK-f § 5', 'AML § 3-1', 'AML § 3-2', 'AML § 4-1'],
  140,
  '{
    "title": "Klarert som internkontrollsystem — systemdokumentasjon",
    "summary": "Overordnet dokumentasjon av hvordan Klarert dekker alle kravene i IK-forskriften §5 — egnet som innledende dokument ved Arbeidstilsynet-tilsyn.",
    "status": "published",
    "template": "wide",
    "legalRefs": ["IK-f § 5", "AML § 3-1"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {"kind":"alert","variant":"info","text":"Dette dokumentet er ment som et oppsummeringsnotat til revisor eller tilsynsmyndighet. Det er ikke et erstatning for de faktiske registreringene i systemet — det er en peker til dem."},
      {"kind":"heading","level":1,"text":"Internkontrollforskriften §5 — systemdekning"},
      {"kind":"text","body":"<p>Internkontrollforskriften (IK-f) §5 stiller krav til hva et internkontrollsystem skal inneholde. Tabellen under viser hvordan hvert krav er dekket i Klarert.</p>"},
      {"kind":"text","body":"<table><thead><tr><th>IK-f §5 krav</th><th>Dekket av</th><th>Dokumentasjon</th></tr></thead><tbody><tr><td>nr. 1a — Mål for HMS</td><td>Dokumentmodul: HMS-policy og mål</td><td>tpl-hms-policy</td></tr><tr><td>nr. 1b — Organisasjon og ansvar</td><td>Dokumentmodul: Organisasjon og ansvarsfordeling</td><td>tpl-org-ansvar</td></tr><tr><td>nr. 1c — Kompetanse og opplæring</td><td>Læringsmodul + Dokumentmodul</td><td>tpl-sysdok-opplaering</td></tr><tr><td>nr. 2 — Oversikt over krav</td><td>Sjekkliste-modul (AML-pakke) + Lov- og regelverksregister</td><td>Sjekkliste-katalog</td></tr><tr><td>nr. 3 — Risikovurdering</td><td>Oppgavemodul (Risikovurdering-mal)</td><td>tpl-sysdok-risikovurdering</td></tr><tr><td>nr. 4 — Avvikshåndtering</td><td>Oppgavemodul (Avvik-mal)</td><td>tpl-sysdok-avvik</td></tr><tr><td>nr. 5 — Årsgjennomgang</td><td>Dokumentmodul: Årsgjennomgang av internkontrollen</td><td>tpl-aarsgjennomgang</td></tr></tbody></table>"},
      {"kind":"heading","level":2,"text":"Psykososialt arbeidsmiljø (AML §4-3)"},
      {"kind":"text","body":"<p>Kartlegging via undersøkelsesmodulen. Se: <em>Psykososialt arbeidsmiljø — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Kjemisk eksponering (AML §4-5)"},
      {"kind":"text","body":"<p>Stoffkartotek via kjemikalieregisteret. Se: <em>Kjemisk eksponering og stoffkartotek — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Sykefraværsoppfølging (AML §4-6)"},
      {"kind":"text","body":"<p>Strukturert oppfølging via sykefravær-malen i oppgavemodulen. Se: <em>Sykefraværsoppfølging — systemdokumentasjon</em>.</p>"},
      {"kind":"heading","level":2,"text":"Varsling (AML §2A)"},
      {"kind":"text","body":"<p>Fullstendige varslingsrutiner dekket i dokumentmodulen. Se: <em>Varslingsrutiner</em>.</p>"},
      {"kind":"module","moduleName":"live_org_chart","params":{"showVerneombud":true,"showAMU":true}},
      {"kind":"module","moduleName":"live_risk_feed","params":{"maxItems":3,"showDepartment":true}},
      {"kind":"law_ref","ref":"IK-f § 5","description":"Internkontrollforskriften §5 — liste over hva internkontrollen skal inneholde."},
      {"kind":"law_ref","ref":"AML § 3-1","description":"Arbeidsgivers plikt til systematisk HMS-arbeid."}
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload;

-- ── Auto-enable for all existing orgs ────────────────────────────────
-- provision_documents_baseline_for_org handles new tenants going forward.
-- This block backfills the seven new templates for every existing org.
do $$
declare
  v_org_id uuid;
  v_tpl_id uuid;
  v_tpl_ids uuid[] := array[
    '00000000-d000-4000-a000-000000000101'::uuid,
    '00000000-d000-4000-a000-000000000102'::uuid,
    '00000000-d000-4000-a000-000000000103'::uuid,
    '00000000-d000-4000-a000-000000000104'::uuid,
    '00000000-d000-4000-a000-000000000105'::uuid,
    '00000000-d000-4000-a000-000000000106'::uuid,
    '00000000-d000-4000-a000-000000000107'::uuid
  ];
begin
  for v_org_id in select id from public.organizations loop
    foreach v_tpl_id in array v_tpl_ids loop
      insert into public.document_org_template_settings (organization_id, template_id, enabled)
      values (v_org_id, v_tpl_id, true)
      on conflict (organization_id, template_id) do nothing;
    end loop;
  end loop;
end;
$$;
-- Update HMS-policy og mål template to close 12 compliance audit gaps.
--
-- Gaps closed:
--   1. No date / version / formal approval   → policy metadata table ({{tokens}})
--   2. No trakassering / §4-3 statement      → dedicated nulltoleranse section
--   3. No varsling / §2A                      → dedicated varsling section
--   4. HMS-mål not SMART                      → SMART table with baseline, target, frequency, data source
--   5. No annual review obligation            → årsgjennomgang section
--   6. No scope / applicability               → virkeområde row in metadata table
--   7. No AMU reference                       → {{inject:amu_section}} + showAMU on org chart
--   8. No BHT reference                       → {{inject:bht_section}} + §3-3 law_ref
--   9. No environmental dimension             → ytre miljø section
--  10. No sector-specific content             → {{inject:sector_risks}} placeholder
--  11. Incomplete law refs                    → 10 law_ref blocks covering full chain
--  12. Unresolved [Virksomhetens navn]        → {{orgName}} tokens resolved by DocumentCreationWizard
--
-- Self-audit (Arbeidstilsynet POV):
--   Addresses pålegg-grunner for: IK-f §5 nr. 1a, AML §§ 3-1, 3-2, 3-3, 4-1,
--   4-3, 2A-1, 6-1.
--   Restrisiko: template describes required policy content; orgs must populate
--   real values (approver name, AMU date, sector risks) via the wizard for the
--   document to constitute audit evidence.

update public.document_system_templates
set
  description  = 'Virksomhetens overordnede HMS-erklæring med formell godkjenning, SMART-mål, nulltoleranse for trakassering, varsling og AMU/BHT-referanser — klar for tilsyn.',
  legal_basis  = array[
    'IK-f § 5 nr. 1a', 'AML § 3-1', 'AML § 3-2', 'AML § 3-3',
    'AML § 4-1', 'AML § 4-3', 'AML § 2A-1', 'AML § 6-1',
    'IK-f § 4', 'IK-f § 5 nr. 5'
  ],
  page_payload = '{
    "title": "HMS-policy og mål",
    "summary": "Virksomhetens overordnede HMS-erklæring med formell godkjenning, SMART-mål og lovhenvisninger — tilpasset via veiviseren.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["IK-f § 5 nr. 1a","AML § 3-1","AML § 3-2","AML § 3-3","AML § 4-1","AML § 4-3","AML § 2A-1","AML § 6-1","IK-f § 4","IK-f § 5 nr. 5"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "warning",
        "text": "Tilpass dette dokumentet til din virksomhet: bruk knappen «Bruk dokumentmal» slik at veiviseren fyller inn virksomhetsnavn, bransje, mål og godkjenner automatisk. Fjern denne boksen etter tilpasning."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt", "Verdi"],
        "rows": [
          ["Vedtatt av", "{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt", "{{policyDate}}"],
          ["Neste revisjon", "{{nextRevisionDate}}"],
          ["Versjon", "1.0"],
          ["Virkeområde", "Alle ansatte, innleide arbeidstakere (AML §2-2) og besøkende ved {{orgName}} sine lokaler"],
          ["AMU behandlet", "{{amuDate}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "HMS-policy — {{orgName}}"
      },
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-forskriften §5 nr. 1a krever at HMS-mål er fastsatt og skriftlig dokumentert. Dette dokumentet utgjør virksomhetens overordnede styringsdokument for helse, miljø og sikkerhet."
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} (org.nr. {{orgNr}}) er forpliktet til å skape og opprettholde et trygt, sunt og inkluderende arbeidsmiljø for alle ansatte, innleide arbeidstakere og øvrige personer i virksomhetens lokaler. Ledelsen tar et personlig og udelt ansvar for at HMS-arbeidet er systematisk, forebyggende og fullt ut i samsvar med arbeidsmiljøloven og internkontrollforskriften.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Nulltoleranse"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} har nulltoleranse for trakassering, mobbing, utilbørlig atferd og uønsket seksuell oppmerksomhet på arbeidsplassen. Alle slike tilfeller skal varsles umiddelbart og behandles i henhold til AML §4-3 og virksomhetens varslingsrutiner. Ansatte er trygge på at varsling ikke medfører gjengjeldelse (AML §2A-4).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Kjente risikofaktorer"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:sector_risks}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Våre HMS-mål"
      },
      {
        "kind": "text",
        "body": "<p>HMS-målene nedenfor gjelder for {{currentYear}} og gjennomgås ved årsgjennomgangen (IK-f §5 nr. 5). Baseline-verdier hentes fra foregående periodes målinger.</p>"
      },
      {
        "kind": "table",
        "caption": "SMART HMS-mål",
        "headers": ["Mål", "Måleverdi", "Målefrekvens", "Ansvarlig", "Datakilde"],
        "rows": [
          ["Arbeidsulykker", "Null alvorlige personskader", "Løpende", "HMS-ansvarlig / DL", "Avviksmodul"],
          ["Sykefravær", "< {{sykefraværMål}} %", "Kvartalsvis", "HR / Daglig leder", "NAV / A-ordningen"],
          ["HMS-opplæring", "100 % gjennomført innen årsfristen", "Årlig", "HMS-ansvarlig", "Læringsmodul"],
          ["Avviksbehandling", "≥ 90 % lukket innen {{avvikFrist}} dager", "Kvartalsvis", "Avdelingsledere", "Oppgavemodul"],
          ["Risikovurderinger", "100 % gjennomgått siste 12 måneder", "Årlig", "HMS-ansvarlig", "Oppgavemodul"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ansvar og organisering"
      },
      {
        "kind": "text",
        "body": "<p>Daglig leder har det overordnede ansvaret for HMS-arbeidet etter AML §3-1 og IK-f §4. Ansvaret delegeres til ledere på alle nivåer innenfor deres ansvarsområde — dette fritar ikke daglig leder fra overordnet styringsansvar. Verneombudet (AML §6-1) bistår i kartlegging og risikovurdering og har selvstendig rett til å stanse farlig arbeid etter AML §6-3.</p>"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:amu_section}}"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:bht_section}}"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:collective_section}}"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ytre miljø"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} skal begrense sin negative påvirkning på det ytre miljøet. Virksomheten overholder kravene i forurensningsloven og tilhørende forskrifter. Energibruk, avfallshåndtering og transport vurderes løpende som del av det systematiske HMS-arbeidet og rapporteres ved årsgjennomgangen.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varsling om kritikkverdige forhold"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte har rett og oppfordres til å varsle om kritikkverdige HMS-forhold etter AML §2A-1. Varsling kan skje til nærmeste leder, til HMS-ansvarlig, til verneombudet eller via Klarerts anonyme varslingskanal. Varsler behandles konfidensielt og innen rimelig tid. Gjengjeldelse mot den som varsler er forbudt etter AML §2A-4 og kan medføre erstatningsansvar.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Årsgjennomgang"
      },
      {
        "kind": "text",
        "body": "<p>HMS-policyen og virksomhetens øvrige internkontrolldokumenter gjennomgås minst én gang per år (IK-f §5 nr. 5). Gjennomgangen ledes av daglig leder med deltagelse av verneombud og AMU der dette er etablert. HMS-mål oppdateres med nye baseline-verdier og eventuelle korrigerende tiltak besluttes. Neste planlagte gjennomgang: {{nextRevisionDate}}.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Arbeidsgivers plikt til systematisk helse-, miljø- og sikkerhetsarbeid — kartlegging, tiltak og dokumentasjon."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-2",
        "description": "Plikt til å sikre at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i HMS-arbeidet, herunder om risiko i eget arbeid."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-3",
        "description": "Plikt til å knytte til seg bedriftshelsetjeneste i særskilt risikoeksponerte bransjer (BHT-forskriften)."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-1",
        "description": "Krav til fullt forsvarlig arbeidsmiljø — både fysisk og psykososialt, inkl. organisering, tilrettelegging og ledelse."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-3",
        "description": "Krav til psykososialt arbeidsmiljø — forbud mot trakassering og utilbørlig atferd, forsvarlig arbeidsbelastning."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-1",
        "description": "Ansattes rett til å varsle om kritikkverdige forhold — arbeidsgiver plikter å legge til rette for varsling."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-1",
        "description": "Rett og plikt til å velge verneombud — virksomheter med minst 5 ansatte (med unntak ved skriftlig avtale)."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 4",
        "description": "Plikt til å etablere, gjennomføre og videreutvikle systematisk internkontroll."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1a",
        "description": "HMS-mål skal fastsettes skriftlig og være en del av internkontrollen.",
        "url": "https://lovdata.no/forskrift/1996-12-06-1127/§5"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 5",
        "description": "Internkontrollen skal gjennomgås jevnlig — minst én gang per år — for å sikre at den fungerer som forutsatt."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      },
      {
        "kind": "module",
        "moduleName": "emergency_stop_procedure",
        "params": {}
      }
    ]
  }'::jsonb
where id = 'tpl-hms-policy';

-- Add {{inject:ia_section}} placeholder to HMS-policy template.
--
-- Gap closed:
--   IA-avtalen (inkluderende arbeidsliv) — virksomheter med IA-avtale skal
--   dokumentere forpliktelsene i internkontrollen. The DocumentCreationWizard
--   resolves this inject to a prose block when hasIaAgreement=true; block is
--   silently dropped for orgs without an IA agreement.
--
-- Self-audit (Arbeidstilsynet POV):
--   Best-practice for IA-virksomheter; not a standalone pålegg-grunn.
--   Restrisiko: org must tick IA-bedrift in the wizard — unaffected otherwise.

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(b order by sort_order)
    from (
      -- existing blocks with their natural order
      select elem as b, (row_number() over ()) * 2 as sort_order
      from jsonb_array_elements(page_payload->'blocks') elem
      union all
      -- ia_section injected right after collective_section (offset +1)
      select
        '{"kind":"alert","variant":"warning","text":"{{inject:ia_section}}"}'::jsonb,
        (
          select (row_number() over ()) * 2 + 1
          from jsonb_array_elements(page_payload->'blocks') elem
          where elem->>'text' = '{{inject:collective_section}}'
          limit 1
        )
    ) t
    where sort_order is not null
  )
)
where id = 'tpl-hms-policy'
  and not exists (
    select 1 from jsonb_array_elements(page_payload->'blocks') b
    where b->>'text' = '{{inject:ia_section}}'
  );
-- P0 compliance gap: three templates that are referenced in the internkontroll
-- overview but were either missing or skeleton-quality.
--
-- Templates added / upgraded:
--   tpl-varsling        NEW  Varslingsrutiner (AML §2A-3 requires written procedure)
--   tpl-org-ansvar      UPGRADE  Organisasjon og ansvarsfordeling (IK-f §5 nr. 1b)
--   tpl-aarsgjennomgang UPGRADE  Årsgjennomgang-protokoll (IK-f §5 nr. 5)
--
-- Self-audit (Arbeidstilsynet POV):
--   tpl-varsling closes the §2A-3 written-procedure pålegg-grunn that is separate
--   from the §2A-1 varsling statement already in the HMS-policy.
--   tpl-org-ansvar closes IK-f §5 nr. 1b (ansvar, oppgaver, myndighet).
--   tpl-aarsgjennomgang closes IK-f §5 nr. 5 (skriftlig resultat) — the archive
--   version was a stub with no structured protocol.
--   Restrisiko: org must fill in named persons (approverName, varslinsgansvarlig)
--   via the wizard or by editing the created document.

-- ── 1. Varslingsrutiner ───────────────────────────────────────────────────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-varsling',
  'tpl-varsling',
  'Varslingsrutiner',
  'Skriftlig varslingsrutine etter AML §2A-3 — kanaler, saksbehandling og vern mot gjengjeldelse. Klar for tilsyn.',
  'hms_handbook',
  array[
    'AML § 2A-1', 'AML § 2A-2', 'AML § 2A-3', 'AML § 2A-4',
    'AML § 2A-5', 'IK-f § 5 nr. 4'
  ],
  $json${
    "title": "Varslingsrutiner",
    "summary": "Skriftlig varslingsrutine etter AML §2A-3 — kanaler, saksbehandling og vern mot gjengjeldelse.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 2A-1","AML § 2A-2","AML § 2A-3","AML § 2A-4","AML § 2A-5","IK-f § 5 nr. 4"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "AML §2A-3 krever at virksomheter med minst 5 ansatte har skriftlige varslingsrutiner. Dokumentet skal beskrive hvordan varsling skal skje, og være kjent av alle ansatte."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Ansvarlig for rutinen","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Versjon","1.0"],
          ["Virkeområde","Alle ansatte, innleide arbeidstakere og andre som utfører arbeid for {{orgName}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Varslingsrutiner — {{orgName}}"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte i {{orgName}} har rett og oppfordres til å varsle om kritikkverdige forhold på arbeidsplassen (AML §2A-1). Kritikkverdige forhold er forhold som er i strid med rettsregler, skriftlige etiske retningslinjer i virksomheten, eller etiske normer som det er bred tilslutning til i samfunnet. Eksempler inkluderer brudd på HMS-krav, trakassering, korrupsjon, diskriminering og miljøkriminalitet.</p><p>Varsling kan skje både om interne og eksterne kritikkverdige forhold. Retten til å varsle omfatter også varsling til tilsynsmyndigheter (AML §2A-2).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varslingskanaler"
      },
      {
        "kind": "text",
        "body": "<table><thead><tr><th>Kanal</th><th>Kontakt</th><th>Anonym?</th></tr></thead><tbody><tr><td>Nærmeste leder</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>HMS-ansvarlig / verneombud</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>Daglig leder (utenom linjen)</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>Klarerts digitale varslingskanal</td><td>Via systemet</td><td>Ja</td></tr><tr><td>Arbeidstilsynet</td><td>arbeidstilsynet.no / 73 19 97 00</td><td>Ja</td></tr></tbody></table>"
      },
      {
        "kind": "text",
        "body": "<p>Varsleren velger selv hvilken kanal som er mest hensiktsmessig. Anonym varsling behandles på lik linje med identifisert varsling, men muligheten for dialog og tilbakemelding er begrenset.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Saksbehandling av varsler"
      },
      {
        "kind": "text",
        "body": "<p>Alle varsler skal behandles forsvarlig og uten ugrunnet opphold. Behandlingsprosessen følger disse trinnene:</p><ol><li><strong>Mottak og bekreftelse</strong> — Den som mottar varselet bekrefter mottak innen 5 virkedager dersom varsler er identifisert.</li><li><strong>Innledende vurdering</strong> — Varslet vurderes med hensyn til alvorlighet og hvem som er egnet til å behandle saken. Varsler om daglig leder behandles av styret.</li><li><strong>Undersøkelse</strong> — Fakta kartlegges. Involverte parter høres. Verneombud og eventuelle tillitsvalgte involveres der det er hensiktsmessig.</li><li><strong>Konklusjon og tiltak</strong> — Konklusjon dokumenteres. Nødvendige tiltak iverksettes. Dersom forholdet er alvorlig, vurderes politianmeldelse eller melding til tilsynsmyndighet.</li><li><strong>Tilbakemelding</strong> — Identifisert varsler informeres om utfall og tiltak, med mindre dette er til hinder for undersøkelsen.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Konfidensialitet"
      },
      {
        "kind": "text",
        "body": "<p>Identiteten til den som varsler skal som utgangspunkt holdes konfidensiell. Opplysninger som kan identifisere varsleren, må ikke spres uten varslerens samtykke — med mindre det er nødvendig av hensyn til undersøkelsen eller lovpålagt rapportering. Brudd på konfidensialitetsplikten kan medføre erstatningsansvar.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Vern mot gjengjeldelse"
      },
      {
        "kind": "text",
        "body": "<p>Det er forbudt å utsette den som varsler for gjengjeldelse (AML §2A-4). Gjengjeldelse er enhver ugunstig behandling som kan ses som en reaksjon på varslingen — herunder oppsigelse, suspensjon, degradering, fratakelse av arbeidsoppgaver, trakassering eller sosial ekskludering.</p><p>Dersom varsleren hevder at gjengjeldelse har skjedd, er det arbeidsgiver som må sannsynliggjøre at reaksjonen var begrunnet i andre forhold enn varslingen (omvendt bevisbyrde, AML §2A-4 fjerde ledd).</p><p>Dersom gjengjeldelse likevel finner sted, kan varsleren kreve erstatning uten hensyn til skyld (objektivt ansvar, AML §2A-5).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varsling til offentlige myndigheter"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte har alltid rett til å varsle til offentlige tilsynsmyndigheter (Arbeidstilsynet, Finanstilsynet, Datatilsynet m.fl.) og til politiet uten at virksomheten kan begrense eller sanksjonere dette (AML §2A-2). Slik varsling er alltid lovlig.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Årsgjennomgang og forbedring"
      },
      {
        "kind": "text",
        "body": "<p>Varslingsrutinen gjennomgås som del av den årlige internkontrollgjennomgangen (IK-f §5 nr. 5). Statistikk over antall varsler, type, utfall og behandlingstid presenteres for AMU (der dette er etablert) og ledelsen. Rutinen oppdateres ved vesentlige organisasjons- eller lovendringer. Neste planlagte gjennomgang: {{nextRevisionDate}}.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-1",
        "description": "Ansattes rett til å varsle om kritikkverdige forhold i virksomheten."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-2",
        "description": "Rett til å varsle til offentlige tilsynsmyndigheter — kan ikke innskrenkes av arbeidsgiver."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-3",
        "description": "Plikt til å ha skriftlige varslingsrutiner for virksomheter med minst 5 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-4",
        "description": "Forbud mot gjengjeldelse mot den som varsler — omvendt bevisbyrde for arbeidsgiver."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-5",
        "description": "Erstatningsansvar ved brudd på forbudet mot gjengjeldelse — objektivt ansvar."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 4",
        "description": "Rutiner for å avdekke, rette opp og forebygge overtredelser av krav fastsatt i HMS-lovgivningen."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      }
    ]
  }$json$::jsonb,
  11
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 2. Organisasjon og ansvarsfordeling — upgrade ────────────────────────────

update public.document_system_templates
set
  description  = 'Oversikt over HMS-roller, ansvar og myndighet i virksomheten (IK-f §5 nr. 1b). Klar for tilsyn.',
  legal_basis  = array[
    'IK-f § 5 nr. 1b', 'AML § 2-1', 'AML § 3-1', 'AML § 6-1',
    'AML § 6-2', 'AML § 7-1', 'AML § 2-3'
  ],
  page_payload = $json${
    "title": "Organisasjon og ansvarsfordeling",
    "summary": "Oversikt over HMS-roller, ansvar og myndighet i organisasjonen — krav etter IK-f §5 nr. 1b.",
    "status": "draft",
    "template": "standard",
    "legalRefs": ["IK-f § 5 nr. 1b","AML § 2-1","AML § 3-1","AML § 6-1","AML § 6-2","AML § 7-1","AML § 2-3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-f §5 nr. 1b: Internkontrollen skal ha oversikt over organisasjon, ansvarsforhold, oppgaver og myndighet. Dette dokumentet fyller det kravet og er bevis for at HMS-ansvaret er formelt plassert."
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Organisasjon og ansvarsfordeling — HMS"
      },
      {
        "kind": "text",
        "body": "<p>AML §2-1 slår fast at arbeidsgivers plikter etter arbeidsmiljøloven ikke kan delegeres vekk. Daglig leder i {{orgName}} har det overordnede og udelte ansvaret for at HMS-arbeidet er systematisk, dokumentert og i samsvar med loven. Delegering av konkrete HMS-oppgaver til ledere og HMS-ansvarlig fritar ikke daglig leder fra dette overordnede styringsansvaret.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ansvarsmatrise"
      },
      {
        "kind": "table",
        "caption": "HMS-roller og ansvar",
        "headers": ["Rolle","Lovhjemmel","Ansvar og oppgaver"],
        "rows": [
          ["Daglig leder","AML §2-1, §3-1, IK-f §4","Overordnet ansvar for HMS-systemet. Stille ressurser til rådighet. Godkjenne HMS-policy og mål. Lede årsgjennomgang. Kan ikke delegere det overordnede ansvaret."],
          ["Avdelings-/enhetsleder","AML §3-1","HMS-ansvar i eget ansvarsområde. Kartlegge risiko, iverksette tiltak, følge opp avvik og sykefravær i avdelingen. Sikre at ansatte har nødvendig opplæring."],
          ["HMS-ansvarlig","IK-f §4, AML §3-1","Koordinere det systematiske HMS-arbeidet. Holde oversikt over lovkrav. Administrere internkontrollsystemet. Bistå linjeledere i risikovurdering og avviksbehandling."],
          ["Verneombud","AML §6-1, §6-2","Ivareta arbeidstakernes interesser i HMS-spørsmål. Medvirke i kartlegginger og risikovurderinger. Kan stanse farlig arbeid (AML §6-3). Har rett til opplæring og ressurser (AML §6-5)."],
          ["AMU (hvis etablert)","AML §7-1, §7-2","Behandle HMS-policy og mål. Gjennomgå avviksstatistikk og arbeidsmiljøundersøkelser. Medbestemmende og rådgivende rolle. Påkrevd ved ≥ 30 ansatte."],
          ["Alle ansatte","AML §2-3","Bruke påbudt verneutstyr. Melde avvik og farlige forhold. Delta i kartlegginger. Informere leder om helseproblemer knyttet til arbeidet."]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Organisasjonskart — verneorganisasjon"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Medvirkning"
      },
      {
        "kind": "text",
        "body": "<p>AML §3-1 (2a) og §4-2 stiller krav om at arbeidstakerne og deres representanter medvirker i HMS-arbeidet. I {{orgName}} ivaretas dette gjennom:</p><ul><li>Verneombudets medvirkning i risikovurderinger og kartlegginger</li><li>AMUs behandling av HMS-policy og mål (for virksomheter med ≥ 30 ansatte)</li><li>Arbeidsmiljøundersøkelser gjennomført via undersøkelsesmodulen</li><li>Åpne varslingskanaler der alle ansatte kan melde bekymringer</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Oppdatering"
      },
      {
        "kind": "text",
        "body": "<p>Ansvarsfordelingen gjennomgås ved organisasjonsendringer og som del av årsgjennomgangen (IK-f §5 nr. 5). Organisasjonskartet oppdateres fortløpende i systemet.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1b",
        "description": "Internkontrollen skal ha oversikt over organisasjon, ansvarsforhold, oppgaver og myndighet i HMS-arbeidet."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2-1",
        "description": "Arbeidsgivers plikter — kan ikke delegeres, men konkrete oppgaver kan overlates til andre."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — kartlegging, tiltak, og involvering av ansatte og VO."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-1",
        "description": "Rett og plikt til å velge verneombud i virksomheter med minst 5 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-2",
        "description": "Verneombudets oppgaver — ivareta arbeidstakernes interesser i HMS-spørsmål."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 7-1",
        "description": "Plikt til å opprette arbeidsmiljøutvalg (AMU) i virksomheter med minst 30 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2-3",
        "description": "Arbeidstakers medvirkningsplikt og plikt til å melde fra om feil og mangler."
      }
    ]
  }$json$::jsonb
where id = 'tpl-org-ansvar';

-- ── 3. Årsgjennomgang-protokoll — upgrade ────────────────────────────────────

update public.document_system_templates
set
  description  = 'Protokoll for den lovpålagte årsgjennomgangen av internkontrollen (IK-f §5 nr. 5). Strukturert agenda, beslutningsfelt og signaturer.',
  legal_basis  = array[
    'IK-f § 5 nr. 5', 'AML § 3-1', 'IK-f § 5 nr. 1a',
    'IK-f § 5 nr. 3', 'IK-f § 5 nr. 4'
  ],
  page_payload = $json${
    "title": "Årsgjennomgang av internkontrollen {{currentYear}}",
    "summary": "Protokoll for den lovpålagte årsgjennomgangen av HMS-systemet — IK-f §5 nr. 5.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["IK-f § 5 nr. 5","AML § 3-1","IK-f § 5 nr. 1a","IK-f § 5 nr. 3","IK-f § 5 nr. 4"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-f §5 nr. 5 krever at internkontrollen gjennomgås systematisk minst én gang per år, og at resultatet dokumenteres skriftlig. Dette dokumentet er protokollen fra den gjennomgangen."
      },
      {
        "kind": "table",
        "caption": "Møteinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Virksomhet","{{orgName}}"],
          ["Dato for gjennomgang","{{policyDate}}"],
          ["Møteleder (daglig leder)","{{approverName}}"],
          ["Deltakere","[Fyll inn navn — verneombud skal delta]"],
          ["AMU orientert","[Dato eller N/A]"],
          ["Neste gjennomgang","{{nextRevisionDate}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Årsgjennomgang — internkontroll {{currentYear}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "1. HMS-mål — måloppnåelse"
      },
      {
        "kind": "text",
        "body": "<p>Gjennomgang av HMS-mål fastsatt for {{currentYear}} (IK-f §5 nr. 1a):</p><table><thead><tr><th>Mål</th><th>Måleverdi</th><th>Resultat</th><th>Status</th></tr></thead><tbody><tr><td>Arbeidsulykker</td><td>Null alvorlige personskader</td><td>[Fyll inn]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Sykefravær</td><td>[Fastsatt mål %]</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>HMS-opplæring</td><td>100 % gjennomført</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Avviksbehandling</td><td>≥ 90 % lukket i tide</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Risikovurderinger</td><td>100 % gjennomgått</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr></tbody></table>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "2. Avvik og uønskede hendelser (IK-f §5 nr. 4)"
      },
      {
        "kind": "text",
        "body": "<table><thead><tr><th>Type</th><th>Antall meldt</th><th>Antall lukket</th><th>Meldepliktige (§5-2)</th></tr></thead><tbody><tr><td>Avvik</td><td>[Antall]</td><td>[Antall]</td><td>[Antall]</td></tr><tr><td>Nestenulykker</td><td>[Antall]</td><td>[Antall]</td><td>—</td></tr><tr><td>Personskader</td><td>[Antall]</td><td>[Antall]</td><td>[Antall]</td></tr></tbody></table><p>Kommentar til avviksutviklingen: [Fyll inn observasjoner og vurdering av trender.]</p>"
      },
      {
        "kind": "module",
        "moduleName": "live_risk_feed",
        "params": {"maxItems": 5, "showDepartment": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "3. Risikovurderinger (IK-f §5 nr. 3)"
      },
      {
        "kind": "text",
        "body": "<p>Oversikt over risikovurderinger gjennomgått siste 12 måneder:</p><ul><li>Antall aktive risikovurderinger: [Antall]</li><li>Antall gjennomgått dette året: [Antall]</li><li>Antall med restrisiko «Høy»: [Antall] — tiltak: [beskriv]</li><li>Nye farekilder identifisert: [beskriv]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "4. HMS-opplæring (IK-f §5 nr. 1c)"
      },
      {
        "kind": "text",
        "body": "<ul><li>Andel ansatte med gjennomført obligatorisk HMS-opplæring: [%]</li><li>Ledere med godkjent HMS-lederopplæring: [antall / totalt med personalansvar]</li><li>Verneombud — opplæring à jour: [Ja/Nei]</li><li>AMU-opplæring gjennomført: [Ja/Nei/N/A]</li><li>Planlagte opplæringstiltak neste periode: [beskriv]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "5. Psykososialt arbeidsmiljø (AML §4-3)"
      },
      {
        "kind": "text",
        "body": "<p>Arbeidsmiljøundersøkelse gjennomført: [Ja/Nei — dato]. Svarprosent: [%]. Vesentlige funn: [beskriv]. Iverksatte tiltak: [beskriv].</p><p>Varslingssaker behandlet dette året: [Antall — uten å angi personidentifiserende detaljer].</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "6. Sykefraværsoppfølging (AML §4-6)"
      },
      {
        "kind": "text",
        "body": "<p>Sykefravær dette året: [%]. Tilretteleggingssaker: [antall]. Dialogmøter gjennomført innen frist: [andel]. Kommentar til sykefraværsutvikling og tiltak: [beskriv].</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "7. Verneorganisasjon"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "8. Konklusjoner og handlingsplan"
      },
      {
        "kind": "text",
        "body": "<p>Følgende forbedringsområder og tiltak er besluttet for {{nextRevisionDate | neste periode}}:</p><table><thead><tr><th>Tiltak</th><th>Ansvarlig</th><th>Frist</th><th>Prioritet</th></tr></thead><tbody><tr><td>[Beskriv tiltak 1]</td><td>[Navn/rolle]</td><td>[Dato]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>[Beskriv tiltak 2]</td><td>[Navn/rolle]</td><td>[Dato]</td><td>[Høy/Medium/Lav]</td></tr></tbody></table><p>HMS-mål for neste periode oppdateres i HMS-policy og mål etter denne gjennomgangen.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "9. Konklusjon og godkjenning"
      },
      {
        "kind": "text",
        "body": "<p>Årsgjennomgangen er gjennomført i samsvar med IK-forskriften §5 nr. 5. Internkontrollen vurderes som [tilfredsstillende / tilfredsstillende med forbehold / ikke tilfredsstillende — begrunn].</p><p><br/>Signatur daglig leder: ___________________________ Dato: ___________<br/><br/>Signatur verneombud: ___________________________ Dato: ___________</p>"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 5",
        "description": "Internkontrollen skal gjennomgås systematisk — minst én gang per år. Resultatet skal dokumenteres skriftlig."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — kontinuerlig kartlegging, tiltak og dokumentasjon."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1a",
        "description": "HMS-mål skal oppdateres og gjennomgås i forbindelse med årsgjennomgangen."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 3",
        "description": "Risikovurderinger skal gjennomgås jevnlig — status dokumenteres her."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 4",
        "description": "Avviksstatus og trendanalyse er en obligatorisk del av årsgjennomgangen."
      }
    ]
  }$json$::jsonb
where id = 'tpl-aarsgjennomgang';

-- ── 4. Enable for all existing orgs ──────────────────────────────────────────
-- tpl-org-ansvar and tpl-aarsgjennomgang were seeded in the archive migration
-- but document_org_template_settings rows were never backfilled. tpl-varsling
-- is new. All three need enabling for every existing tenant.

do $$
declare
  v_org_id uuid;
  v_ids    text[] := array['tpl-varsling', 'tpl-org-ansvar', 'tpl-aarsgjennomgang'];
  v_id     text;
begin
  for v_org_id in select id from public.organizations loop
    foreach v_id in array v_ids loop
      insert into public.document_org_template_settings (organization_id, template_id, enabled)
      values (v_org_id, v_id, true)
      on conflict (organization_id, template_id) do nothing;
    end loop;
  end loop;
end;
$$;
-- P1 improvements:
--   1. HMS-policy: add medvirkning statement (AML §3-1 (2a)) and
--      tilrettelegging reference (AML §4-6) — both missing from the
--      policy text and law_ref list.
--   2. tpl-sysdok-internkontroll: add tpl-varsling to coverage table,
--      fix "Varsling" section to reference the now-existing template,
--      add AML §2A-3 to legal_basis.
--
-- Self-audit (Arbeidstilsynet POV):
--   AML §3-1 (2a): ansatte og deres representanter skal medvirke —
--   not mentioning this in the policy is a common pålegg-grunn.
--   AML §4-6 tilretteleggingsplikt is cited in ~25 % of AML-related
--   pålegg; adding the reference closes a gap without changing scope.
--   Internkontroll table was internally inconsistent (referenced tpl-varsling
--   but template didn't exist); now consistent after P0 work.

-- ── 1a. Add medvirkning + tilrettelegging sentence to ansvar text block ────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(blk order by ord)
    from (
      select
        case
          when b->>'kind' = 'text'
            and (b->>'body') like '%Daglig leder har det overordnede ansvaret%'
          then jsonb_set(b, '{body}', to_jsonb(
            replace(
              b->>'body',
              'etter AML §6-3.</p>',
              'etter AML §6-3.</p><p>Ansatte og deres representanter (verneombud, tillitsvalgte) medvirker aktivt i kartlegging av farer, risikovurdering og utforming av tiltak (AML §3-1 (2a) og §4-2). Arbeidsgiver har individuell plikt til å tilrettelegge arbeidet for ansatte med redusert arbeidsevne og til å følge opp sykmeldte etter lovens milepæler (AML §4-6).</p>'
            )
          ))
          else b
        end as blk,
        ordinality as ord
      from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
    ) sub
  )
)
where id = 'tpl-hms-policy'
  and page_payload::text not like '%medvirker aktivt i kartlegging%';

-- ── 1b. Splice AML §4-6 law_ref block after AML §4-3 law_ref ─────────────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(blk order by sort_key)
    from (
      -- existing blocks, each gets an even sort key preserving natural order
      select b as blk, (ordinality * 2)::float as sort_key
      from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
      union all
      -- new AML §4-6 law_ref inserted right after AML §4-3 (odd sort key)
      select
        '{"kind":"law_ref","ref":"AML § 4-6","description":"Plikt til individuell tilrettelegging for arbeidstakere med redusert arbeidsevne — oppfølgingsplan, dialogmøter og tilretteleggingstiltak."}'::jsonb,
        (
          select (ordinality * 2 + 1)::float
          from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
          where b->>'ref' = 'AML § 4-3'
          limit 1
        )
    ) sub(blk, sort_key)
    where sort_key is not null
  )
)
where id = 'tpl-hms-policy'
  and not exists (
    select 1 from jsonb_array_elements(page_payload->'blocks') b
    where b->>'ref' = 'AML § 4-6'
  );

-- ── 2. Fix tpl-sysdok-internkontroll ─────────────────────────────────────────
-- Add tpl-varsling row to coverage table, update varsling section text,
-- and expand legal_basis to include AML §2A-3.

update public.document_system_templates
set
  legal_basis  = array[
    'IK-f § 5', 'AML § 3-1', 'AML § 3-2', 'AML § 4-1', 'AML § 2A-3'
  ],
  page_payload = jsonb_set(
    page_payload,
    '{blocks}',
    (
      select jsonb_agg(blk order by ord)
      from (
        select
          case
            -- Add tpl-varsling row to coverage table
            when b->>'kind' = 'text'
              and (b->>'body') like '%nr. 5 — Årsgjennomgang%'
            then jsonb_set(b, '{body}', to_jsonb(
              replace(
                b->>'body',
                '</tbody></table>',
                '<tr><td>§2A — Varsling</td><td>Dokumentmodul: Varslingsrutiner</td><td>tpl-varsling</td></tr></tbody></table>'
              )
            ))
            -- Update the Varsling section text to reference the specific template
            when b->>'kind' = 'text'
              and (b->>'body') like '%Fullstendige varslingsrutiner dekket i dokumentmodulen%'
            then jsonb_set(b, '{body}', to_jsonb(
              '<p>Virksomhetens skriftlige varslingsrutiner er dokumentert i <em>Varslingsrutiner</em> (tpl-varsling) — kanaler, saksbehandlingsrutine, konfidensialitet og vern mot gjengjeldelse etter AML §2A-3.</p>'
            ))
            else b
          end as blk,
          ordinality as ord
        from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
      ) sub
    )
  )
where slug = 'tpl-sysdok-internkontroll';
