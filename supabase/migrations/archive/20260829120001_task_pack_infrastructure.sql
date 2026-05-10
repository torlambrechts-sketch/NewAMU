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
