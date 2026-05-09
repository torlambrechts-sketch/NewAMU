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
    {"id":"f1","label":"Område / prosess som vurderes","kind":"text","required":true},
    {"id":"f2","label":"Identifiserte farekilder","kind":"textarea","required":true},
    {"id":"f3","label":"Hvem kan bli skadet og hvordan?","kind":"textarea","required":true},
    {"id":"f4","label":"Risikogruppe","kind":"select","required":true,
      "options":["Alle ansatte","Spesifikk arbeidsgruppe","Enkeltperson","Besøkende","Kontraktører"]},
    {"id":"f5","label":"Eksisterende barrierer / tiltak","kind":"textarea","required":false},
    {"id":"f6","label":"Sannsynlighet uten tiltak (1=svært lav, 5=svært høy)","kind":"number","required":true},
    {"id":"f7","label":"Konsekvens uten tiltak (1=ubetydelig, 5=katastrofal)","kind":"number","required":true},
    {"id":"f8","label":"Planlagte nye tiltak","kind":"textarea","required":false},
    {"id":"f9","label":"Sannsynlighet etter tiltak","kind":"number","required":false},
    {"id":"f10","label":"Konsekvens etter tiltak","kind":"number","required":false},
    {"id":"f11","label":"Er restrisiko akseptabel?","kind":"boolean","required":false},
    {"id":"f12","label":"Begrunnelse for aksept av restrisiko","kind":"textarea","required":false}
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
