-- Compliance checklist template categories.
--
-- Per-org, per-pack groupings that admins can edit from the Innstillinger
-- → Kategorier tab. Templates carry a nullable `category_id` FK; templates
-- without a category fall into an "Uten kategori" bucket in the UI.
--
-- Why a separate table (vs. a free-text `category` column on templates)?
-- Surveys went with free text and we've already seen drift between orgs
-- typing "Onboarding" vs "Ansettelse". A small dimension table per (org,
-- pack) gives admins a controlled vocabulary, lets them rename a category
-- once and have every template follow, and keeps system-shipped defaults
-- distinguishable from org-authored ones via is_system.
--
-- Idempotent: every step uses `if not exists` / `on conflict do nothing`
-- and the seeding is gated by `not exists` checks per (org, pack).

set local search_path = public, pg_catalog;

-- ── 1. Categories table ───────────────────────────────────────────────────

create table if not exists public.compliance_checklist_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pack            public.compliance_pack not null,
  slug            text not null,
  name            text not null,
  description     text,
  position        integer not null default 0,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, pack, slug)
);

create index if not exists compliance_checklist_categories_org_pack_idx
  on public.compliance_checklist_categories (organization_id, pack, position)
  where deleted_at is null and is_active = true;

alter table public.compliance_checklist_categories enable row level security;

drop policy if exists compliance_checklist_categories_select_org on public.compliance_checklist_categories;
create policy compliance_checklist_categories_select_org
  on public.compliance_checklist_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_checklist_categories_write_org on public.compliance_checklist_categories;
create policy compliance_checklist_categories_write_org
  on public.compliance_checklist_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.compliance_checklist_categories_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_checklist_categories_before_insert_defaults_tg
  on public.compliance_checklist_categories;
create trigger compliance_checklist_categories_before_insert_defaults_tg
  before insert on public.compliance_checklist_categories
  for each row execute function public.compliance_checklist_categories_before_insert_defaults();

drop trigger if exists compliance_checklist_categories_set_updated_at
  on public.compliance_checklist_categories;
create trigger compliance_checklist_categories_set_updated_at
  before update on public.compliance_checklist_categories
  for each row execute function public.set_updated_at();

-- ── 2. category_id FK on templates ────────────────────────────────────────

alter table public.compliance_checklist_templates
  add column if not exists category_id uuid
    references public.compliance_checklist_categories (id) on delete set null;

create index if not exists compliance_checklist_templates_category_idx
  on public.compliance_checklist_templates (category_id)
  where category_id is not null and deleted_at is null;

-- ── 3. Seed default system categories per (org, pack) ─────────────────────
--
-- Five buckets for AML, one for ISO. Position values leave gaps so admins
-- can slot custom categories between them without a renumbering UI.

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.compliance_packs
    where is_active = true and deleted_at is null
  loop
    if v_pack.slug = 'aml-amu' then
      insert into public.compliance_checklist_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'aml-amu', 'vernerunder',
         'Vernerunder',
         'Standard runder etter arbeidsmiljøloven og internkontrollforskriften.',
         10, true),
        (v_pack.organization_id, 'aml-amu', 'fysisk',
         'Fysisk og kjemisk arbeidsmiljø',
         'Brann, ergonomi, maskiner og kjemikalier (AML §4-4 og §4-5).',
         20, true),
        (v_pack.organization_id, 'aml-amu', 'internkontroll',
         'Internkontroll og avvik',
         'Avviksoppfølging og årlig systemgjennomgang.',
         30, true),
        (v_pack.organization_id, 'aml-amu', 'ansettelse',
         'Ansettelse og opplæring',
         'Onboarding, mindreårige, arbeidsavtale og leder-HMS.',
         40, true),
        (v_pack.organization_id, 'aml-amu', 'psykososialt',
         'Psykososialt og verneombud',
         'Psykososial pulsmåling og verneombud-årsrapport.',
         50, true)
      on conflict (organization_id, pack, slug) do nothing;
    end if;

    if v_pack.slug = 'iso-45001' then
      insert into public.compliance_checklist_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'iso-45001', 'internrevisjon',
         'Internrevisjon',
         'Revisjon mot ISO 45001 — klausul 9.2.',
         10, true)
      on conflict (organization_id, pack, slug) do nothing;
    end if;
  end loop;
end $$;

-- ── 4. Map known system templates to their default category ───────────────

do $$
declare
  v_org record;
  v_aml_vernerunder uuid;
  v_aml_fysisk uuid;
  v_aml_internkontroll uuid;
  v_aml_ansettelse uuid;
  v_aml_psykososialt uuid;
  v_iso_internrevisjon uuid;
begin
  for v_org in
    select id from public.organizations
  loop
    select id into v_aml_vernerunder
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'vernerunder';
    select id into v_aml_fysisk
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'fysisk';
    select id into v_aml_internkontroll
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'internkontroll';
    select id into v_aml_ansettelse
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'ansettelse';
    select id into v_aml_psykososialt
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'psykososialt';
    select id into v_iso_internrevisjon
      from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'iso-45001' and slug = 'internrevisjon';

    -- Only set category_id where it's currently null so admin re-assignments
    -- aren't clobbered if this migration is re-run.
    update public.compliance_checklist_templates
      set category_id = v_aml_vernerunder
      where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
        and slug in ('vernerunde-standard');

    update public.compliance_checklist_templates
      set category_id = v_aml_fysisk
      where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
        and slug in ('brannvernrunde', 'ergonomi-runde', 'maskinsikkerhet-sjekk', 'stoffkartotek-runde');

    update public.compliance_checklist_templates
      set category_id = v_aml_internkontroll
      where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
        and slug in ('avviksoppfolging-runde', 'internkontroll-arsgjennomgang');

    update public.compliance_checklist_templates
      set category_id = v_aml_ansettelse
      where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
        and slug in ('onboarding-hms-opplaering', 'arbeidsgivers-hms-opplaering',
                     'tilsetting-mindrearig-sjekk', 'arbeidsavtale-sjekk');

    update public.compliance_checklist_templates
      set category_id = v_aml_psykososialt
      where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
        and slug in ('psykososial-pulsmaling', 'verneombud-arsrapport');

    update public.compliance_checklist_templates
      set category_id = v_iso_internrevisjon
      where organization_id = v_org.id and pack = 'iso-45001' and category_id is null
        and slug in ('iso-45001-internal-audit');
  end loop;
end $$;

-- ── 5. Extend the license-grant trigger so newly-licensed packs also get
--      the default categories provisioned (alongside the templates).

create or replace function public.compliance_pack_provision_on_change()
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
      perform public.provision_compliance_baseline_for_org(
        new.organization_id, new.slug
      );

      -- Default categories for the newly-active pack. Mirrors the seed
      -- block above; idempotent via the unique key.
      if new.slug = 'aml-amu' then
        insert into public.compliance_checklist_categories
          (organization_id, pack, slug, name, description, position, is_system)
        values
          (new.organization_id, 'aml-amu', 'vernerunder',
           'Vernerunder',
           'Standard runder etter arbeidsmiljøloven og internkontrollforskriften.',
           10, true),
          (new.organization_id, 'aml-amu', 'fysisk',
           'Fysisk og kjemisk arbeidsmiljø',
           'Brann, ergonomi, maskiner og kjemikalier (AML §4-4 og §4-5).',
           20, true),
          (new.organization_id, 'aml-amu', 'internkontroll',
           'Internkontroll og avvik',
           'Avviksoppfølging og årlig systemgjennomgang.',
           30, true),
          (new.organization_id, 'aml-amu', 'ansettelse',
           'Ansettelse og opplæring',
           'Onboarding, mindreårige, arbeidsavtale og leder-HMS.',
           40, true),
          (new.organization_id, 'aml-amu', 'psykososialt',
           'Psykososialt og verneombud',
           'Psykososial pulsmåling og verneombud-årsrapport.',
           50, true)
        on conflict (organization_id, pack, slug) do nothing;
      elsif new.slug = 'iso-45001' then
        insert into public.compliance_checklist_categories
          (organization_id, pack, slug, name, description, position, is_system)
        values
          (new.organization_id, 'iso-45001', 'internrevisjon',
           'Internrevisjon',
           'Revisjon mot ISO 45001 — klausul 9.2.',
           10, true)
        on conflict (organization_id, pack, slug) do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;
