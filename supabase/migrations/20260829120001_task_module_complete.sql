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
  array['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 7'],
  'check', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Hva skjedde?","kind":"textarea","required":true},
    {"id":"f2","label":"Tidspunkt for hendelsen","kind":"datetime","required":true},
    {"id":"f3","label":"Sted / arbeidssted","kind":"text","required":true},
    {"id":"f4","label":"Hvem var involvert?","kind":"text","required":false},
    {"id":"f5","label":"Personskade?","kind":"boolean","required":true},
    {"id":"f6","label":"Skadens art og omfang (hvis personskade)","kind":"textarea","required":false},
    {"id":"f7","label":"Kategori","kind":"select","required":true,
      "options":["Fysisk/ergonomisk","Kjemisk/biologisk","Psykososialt","Brann/eksplosjon","Fall/ulykke","Utstyr/maskiner","Annet"]},
    {"id":"f8","label":"Alvorlighetsgrad","kind":"select","required":true,
      "options":["Kritisk – alvorlig personskade","Alvorlig – behandling nødvendig","Moderat – førstehjelp","Mindre – nesten-ulykke"]},
    {"id":"f9","label":"Umiddelbare tiltak iverksatt","kind":"textarea","required":false},
    {"id":"f10","label":"Rotårsaksanalyse","kind":"textarea","required":false},
    {"id":"f11","label":"Varslet Arbeidstilsynet?","kind":"boolean","required":false},
    {"id":"f12","label":"Dato varslet Arbeidstilsynet","kind":"date","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 3. Nestenulykke / Farlig forhold ─────────────────────────────────────

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
  array['AML § 5-1', 'IK-f § 5 nr. 6'],
  'check', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Beskriv nestenulykken / det farlige forholdet","kind":"textarea","required":true},
    {"id":"f2","label":"Tidspunkt","kind":"datetime","required":true},
    {"id":"f3","label":"Sted","kind":"text","required":true},
    {"id":"f4","label":"Hva kunne ha skjedd i verste fall?","kind":"textarea","required":true},
    {"id":"f5","label":"Bakenforliggende årsak","kind":"textarea","required":false},
    {"id":"f6","label":"Foreslått forebyggende tiltak","kind":"textarea","required":false}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 4. Forbedringstiltak ──────────────────────────────────────────────────

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000004',
  'tiltak',
  'aml-amu', 'tiltak', 'tiltak',
  'Forbedringstiltak',
  'Planlegging, gjennomføring og verifisering av forebyggende og korrigerende tiltak.',
  array['AML § 3-2', 'AML § 4-1', 'IK-f § 5 nr. 7', 'IK-f § 5 nr. 8'],
  'do', 'kvartalsvis', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Tiltaksbeskrivelse","kind":"textarea","required":true},
    {"id":"f2","label":"Type tiltak","kind":"select","required":true,
      "options":["Forebyggende","Korrigerende","Kompenserende","Teknisk","Administrativt","Verneutstyr"]},
    {"id":"f3","label":"Bakgrunn / risiko som adresseres","kind":"textarea","required":true},
    {"id":"f4","label":"Forventet effekt / akseptansekriterium","kind":"textarea","required":true},
    {"id":"f5","label":"Estimert kostnad (NOK)","kind":"number","required":false},
    {"id":"f6","label":"Startdato","kind":"date","required":false},
    {"id":"f7","label":"Gjennomføringsmetode","kind":"textarea","required":false},
    {"id":"f8","label":"Effektvurdering etter gjennomføring","kind":"textarea","required":false}
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
    {"id":"f1","label":"Hva utløste vurderingen?","kind":"select","required":true,
      "options":["Periodisk gjennomgang","Ny prosess / nytt utstyr","Etter hendelse / avvik","Organisasjonsendring","Krav fra Arbeidstilsynet","Annet"]},
    {"id":"f2","label":"Farekilder – type","kind":"select","required":true,
      "options":["Fysisk / ergonomisk","Kjemisk","Biologisk","Psykososialt","Organisatorisk","Elektrisk","Brann / eksplosjon","Annet"]},
    {"id":"f3","label":"Farekilder – detaljert beskrivelse","kind":"textarea","required":true},
    {"id":"f4","label":"Hvem kan bli skadet og hvordan?","kind":"textarea","required":true},
    {"id":"f5","label":"Område / prosess som vurderes","kind":"text","required":true},
    {"id":"f6","label":"Risikogruppe","kind":"select","required":true,
      "options":["Alle ansatte","Spesifikk arbeidsgruppe","Enkeltperson","Besøkende / kunder","Kontraktører / innleide"]},
    {"id":"f7","label":"Eksisterende barrierer og tiltak","kind":"textarea","required":false},
    {"id":"f8","label":"Sannsynlighet uten tiltak (1=svært lav – 5=svært høy)","kind":"number","required":true},
    {"id":"f9","label":"Konsekvens uten tiltak (1=ubetydelig – 5=katastrofal)","kind":"number","required":true},
    {"id":"f10","label":"Risikonivå uten tiltak","kind":"select","required":false,
      "options":["Lav (1–4)","Middels (5–12)","Høy (13–25)"]},
    {"id":"f11","label":"Planlagte nye tiltak","kind":"textarea","required":false},
    {"id":"f12","label":"Sannsynlighet etter tiltak (1–5)","kind":"number","required":false},
    {"id":"f13","label":"Konsekvens etter tiltak (1–5)","kind":"number","required":false},
    {"id":"f14","label":"Restrisiko akseptabel?","kind":"boolean","required":false},
    {"id":"f15","label":"Begrunnelse for aksept av restrisiko","kind":"textarea","required":false},
    {"id":"f16","label":"Uavhengig gjennomgang utført av (navn)","kind":"text","required":true},
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

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000006',
  'forslag',
  'aml-amu', 'general', 'forslag',
  'Forslag & Forbedring',
  'Innspill og forslag fra ansatte til forbedring av arbeidsmiljøet. AMU-relevant: § 4-2 medvirkning, § 8-1 informasjon og drøfting.',
  array['AML § 4-2', 'AML § 8-1', 'IK-f § 5 nr. 8'],
  'act', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Beskriv forslaget","kind":"textarea","required":true},
    {"id":"f2","label":"Kategori","kind":"select","required":true,
      "options":["HMS","Arbeidsmiljø / trivsel","Effektivitet","Kompetanse / opplæring","Utstyr / teknologi","Annet"]},
    {"id":"f3","label":"Forventet gevinst / forbedring","kind":"textarea","required":false},
    {"id":"f4","label":"Berørte avdelinger / arbeidsgrupper","kind":"text","required":false},
    {"id":"f5","label":"Estimert gjennomføringskostnad","kind":"text","required":false},
    {"id":"f6","label":"Forslagsstillers vurdering av prioritet","kind":"select","required":false,
      "options":["Høy – bør gjøres snarest","Middels – innen 6 måneder","Lav – langsiktig forbedring"]}
  ]}'::jsonb
) on conflict (slug) do update set
  template_kind   = excluded.template_kind,
  name            = excluded.name,
  description     = excluded.description,
  law_refs        = excluded.law_refs,
  metadata_schema = excluded.metadata_schema,
  updated_at      = now();

-- ── 7. Sykefravær-oppfølging ──────────────────────────────────────────────

insert into public.task_template_catalog (
  id, slug, pack, source_category, template_kind, name, description,
  law_refs, default_pdca_phase, cadence_hint, is_active, is_system,
  definition, metadata_schema
) values (
  '00000000-2000-4000-a000-000000000007',
  'sykefravær-oppfølging',
  'aml-amu', 'tiltak', 'sykefravær',
  'Sykefravær-oppfølging',
  'Strukturert oppfølging av sykemeldte etter AML § 4-6: 7-ukerssamtale, 16-ukersplan og 26-ukersrapportering til NAV.',
  array['AML § 4-6', 'Ftrl § 8-7a'],
  'do', 'ad_hoc', true, true,
  '{"fields":[],"checklist_items":[]}'::jsonb,
  '{"fields":[
    {"id":"f1","label":"Ansatt (navn)","kind":"text","required":true},
    {"id":"f2","label":"Første sykedag","kind":"date","required":true},
    {"id":"f3","label":"Diagnose / diagnosegruppe (valgfritt)","kind":"text","required":false},
    {"id":"f4","label":"Type sykefravær","kind":"select","required":true,
      "options":["100% sykemeldt","Gradert sykemeldt","Egenmelding"]},
    {"id":"f5","label":"Oppfølgingssamtale 7 uker — gjennomført?","kind":"boolean","required":false},
    {"id":"f6","label":"Oppfølgingsplan 16 uker — sendt NAV?","kind":"boolean","required":false},
    {"id":"f7","label":"26-ukersrapport — sendt?","kind":"boolean","required":false},
    {"id":"f8","label":"Tilretteleggingstiltak iverksatt","kind":"textarea","required":false},
    {"id":"f9","label":"BHT invitert til oppfølging?","kind":"boolean","required":false},
    {"id":"f10","label":"Forventet tilbakekomstdato","kind":"date","required":false}
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
      -- pin avvik, tiltak, risiko by default
      (v_tpl.slug in ('avvik', 'tiltak', 'risiko')),
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

