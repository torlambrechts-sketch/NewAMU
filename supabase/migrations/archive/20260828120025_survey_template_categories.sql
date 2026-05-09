-- Survey template categories — per-(org, pack) groupings admins curate
-- from the survey admin's "Kategorier" tab. Mirrors
-- compliance_checklist_categories (migration 20260828120022) so the same
-- discovery surfaces (hub tile groups + sidebar collapsible groups) can
-- consume both.
--
-- Why a structured table (vs the existing free-text
-- survey_template_catalog.category column)? Same rationale as compliance:
-- a controlled vocabulary lets admins rename a category once and have
-- every template follow, prevents per-org drift ("Onboarding" vs
-- "Ansettelse"), and gives FK-clean filter semantics in analytics.
-- The existing catalog `category` column stays — it's the platform-shipped
-- default that we backfill from when a system template lands.
--
-- Idempotent: every step uses `if not exists` / `on conflict do nothing`.

set local search_path = public, pg_catalog;

-- ── 1. Categories table ───────────────────────────────────────────────────

create table if not exists public.survey_template_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pack            public.survey_pack not null,
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

create index if not exists survey_template_categories_org_pack_idx
  on public.survey_template_categories (organization_id, pack, position)
  where deleted_at is null and is_active = true;

alter table public.survey_template_categories enable row level security;

drop policy if exists survey_template_categories_select_org on public.survey_template_categories;
create policy survey_template_categories_select_org
  on public.survey_template_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists survey_template_categories_write_org on public.survey_template_categories;
create policy survey_template_categories_write_org
  on public.survey_template_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.survey_template_categories_before_insert_defaults()
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

drop trigger if exists survey_template_categories_before_insert_defaults_tg
  on public.survey_template_categories;
create trigger survey_template_categories_before_insert_defaults_tg
  before insert on public.survey_template_categories
  for each row execute function public.survey_template_categories_before_insert_defaults();

drop trigger if exists survey_template_categories_set_updated_at
  on public.survey_template_categories;
create trigger survey_template_categories_set_updated_at
  before update on public.survey_template_categories
  for each row execute function public.set_updated_at();

-- ── 2. category_id FK on survey_org_templates ────────────────────────────
-- Per spec OQ-1: categories attach to the *org* template (org-curated),
-- not the platform catalog. Catalog rows still seed defaults via the
-- provisioning flow; per-org overrides decide which category a tenant
-- has actually placed the template in.

alter table public.survey_org_templates
  add column if not exists category_id uuid
    references public.survey_template_categories (id) on delete set null;

create index if not exists survey_org_templates_category_idx
  on public.survey_org_templates (category_id)
  where category_id is not null and deleted_at is null;

-- ── 3. Seed default system categories per (org, pack) ─────────────────────
-- Per spec OQ-2 (confirmed):
--   vendor       → Egenerklæring, HMS-status, Avtaler
--   arbeidsmiljo → Pulsmåling, Verneombud, Trivsel
--   compliance   → AML-kartlegging, Internkontroll
--   engagement   → Onboarding, Eksternt
--   exit         → Utgang, Anonyme tilbakemeldinger
-- Position values leave gaps for admin-inserted custom categories.

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.survey_packs
    where is_active = true and deleted_at is null
  loop
    if v_pack.slug = 'vendor' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'vendor', 'egenerklaering',
         'Egenerklæring',
         'Selvrapportering fra leverandør om HMS-status og rutiner.',
         10, true),
        (v_pack.organization_id, 'vendor', 'hms-status',
         'HMS-status',
         'Status på leverandørens HMS-system og sertifiseringer.',
         20, true),
        (v_pack.organization_id, 'vendor', 'avtaler',
         'Avtaler',
         'Kartlegging knyttet til kontrakts- og avtaleforhold.',
         30, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif v_pack.slug = 'arbeidsmiljo' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'arbeidsmiljo', 'pulsmaling',
         'Pulsmåling',
         'Korte, hyppige målinger av arbeidsmiljø og trivsel.',
         10, true),
        (v_pack.organization_id, 'arbeidsmiljo', 'verneombud',
         'Verneombud',
         'Undersøkelser knyttet til verneombudets oppgaver (AML §6-2).',
         20, true),
        (v_pack.organization_id, 'arbeidsmiljo', 'trivsel',
         'Trivsel',
         'Bredere trivselskartlegginger og psykososialt arbeidsmiljø.',
         30, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif v_pack.slug = 'compliance' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'compliance', 'aml-kartlegging',
         'AML-kartlegging',
         'Lovpålagte kartlegginger etter arbeidsmiljøloven.',
         10, true),
        (v_pack.organization_id, 'compliance', 'internkontroll',
         'Internkontroll',
         'IK-forskriftens systematiske gjennomganger.',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif v_pack.slug = 'engagement' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'engagement', 'onboarding',
         'Onboarding',
         'Tilbakemelding fra nye ansatte i deres første tid.',
         10, true),
        (v_pack.organization_id, 'engagement', 'eksternt',
         'Eksternt',
         'Eksternt rettede engasjementsmålinger (kunder, partnere).',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif v_pack.slug = 'exit' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (v_pack.organization_id, 'exit', 'utgang',
         'Utgang',
         'Sluttsamtaler og strukturerte exit-undersøkelser.',
         10, true),
        (v_pack.organization_id, 'exit', 'anonyme-tilbakemeldinger',
         'Anonyme tilbakemeldinger',
         'Anonyme exit-kanaler hvor identifikasjon vil forhindre svar.',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    end if;
  end loop;
end $$;

-- ── 4. Backfill: link existing org_templates to a category by best-effort
-- match against the catalog row's free-text `category`. Only sets where
-- currently null so admin re-assignments aren't clobbered.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    update public.survey_org_templates ot
      set category_id = c.id
      from public.survey_template_catalog cat
      join public.survey_template_categories c
        on c.organization_id = v_org.id and c.pack = cat.pack
       and (
         lower(c.name) = lower(cat.category)
         or lower(c.slug) = lower(replace(cat.category, ' ', '-'))
       )
      where ot.organization_id = v_org.id
        and ot.catalog_id = cat.id
        and ot.category_id is null;
  end loop;
end $$;

-- ── 5. Auto-provision categories when a new pack is licensed ──────────────
-- Mirrors the compliance pattern: the moment a new (org, pack) row is
-- inserted into survey_packs, the same default seed runs for that pair.
-- Idempotent via the unique key.

create or replace function public.survey_pack_provision_categories_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true and (
       tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and old.is_active = false)
     ) then
    if new.slug = 'vendor' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (new.organization_id, 'vendor', 'egenerklaering',
         'Egenerklæring',
         'Selvrapportering fra leverandør om HMS-status og rutiner.',
         10, true),
        (new.organization_id, 'vendor', 'hms-status',
         'HMS-status',
         'Status på leverandørens HMS-system og sertifiseringer.',
         20, true),
        (new.organization_id, 'vendor', 'avtaler',
         'Avtaler',
         'Kartlegging knyttet til kontrakts- og avtaleforhold.',
         30, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif new.slug = 'arbeidsmiljo' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (new.organization_id, 'arbeidsmiljo', 'pulsmaling',
         'Pulsmåling', 'Korte, hyppige målinger av arbeidsmiljø og trivsel.',
         10, true),
        (new.organization_id, 'arbeidsmiljo', 'verneombud',
         'Verneombud', 'Undersøkelser knyttet til verneombudets oppgaver (AML §6-2).',
         20, true),
        (new.organization_id, 'arbeidsmiljo', 'trivsel',
         'Trivsel', 'Bredere trivselskartlegginger og psykososialt arbeidsmiljø.',
         30, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif new.slug = 'compliance' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (new.organization_id, 'compliance', 'aml-kartlegging',
         'AML-kartlegging', 'Lovpålagte kartlegginger etter arbeidsmiljøloven.',
         10, true),
        (new.organization_id, 'compliance', 'internkontroll',
         'Internkontroll', 'IK-forskriftens systematiske gjennomganger.',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif new.slug = 'engagement' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (new.organization_id, 'engagement', 'onboarding',
         'Onboarding', 'Tilbakemelding fra nye ansatte i deres første tid.',
         10, true),
        (new.organization_id, 'engagement', 'eksternt',
         'Eksternt', 'Eksternt rettede engasjementsmålinger (kunder, partnere).',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    elsif new.slug = 'exit' then
      insert into public.survey_template_categories
        (organization_id, pack, slug, name, description, position, is_system)
      values
        (new.organization_id, 'exit', 'utgang',
         'Utgang', 'Sluttsamtaler og strukturerte exit-undersøkelser.',
         10, true),
        (new.organization_id, 'exit', 'anonyme-tilbakemeldinger',
         'Anonyme tilbakemeldinger',
         'Anonyme exit-kanaler hvor identifikasjon vil forhindre svar.',
         20, true)
      on conflict (organization_id, pack, slug) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_pack_provision_categories_tg on public.survey_packs;
create trigger survey_pack_provision_categories_tg
  after insert or update on public.survey_packs
  for each row execute function public.survey_pack_provision_categories_on_change();
