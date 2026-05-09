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
