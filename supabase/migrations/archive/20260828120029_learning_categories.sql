-- Learning categories — per-org curated groupings for learning_courses.
--
-- Per /specs/elearning-parity.md OQ-L2: org-scoped, no pack concept (e-learning
-- doesn't have packs analogous to compliance/survey). Default seeds cover
-- the common HMS / brann / verneombud / onboarding domains; admin can rename,
-- deactivate, or add their own.
--
-- The existing `learning_courses.tags text[]` column stays — it's still useful
-- as a free-form keyword bag — but `category_id` becomes the structured
-- primary grouping that drives the courses-list grouping + sidebar headers.
--
-- Idempotent: every step uses `if not exists` / `on conflict do nothing`.

set local search_path = public, pg_catalog;

-- ── 1. Categories table ───────────────────────────────────────────────────

create table if not exists public.learning_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  position        integer not null default 0,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists learning_categories_org_idx
  on public.learning_categories (organization_id, position)
  where deleted_at is null and is_active = true;

alter table public.learning_categories enable row level security;

drop policy if exists learning_categories_select_org on public.learning_categories;
create policy learning_categories_select_org
  on public.learning_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists learning_categories_write_org on public.learning_categories;
create policy learning_categories_write_org
  on public.learning_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.learning_categories_before_insert_defaults()
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

drop trigger if exists learning_categories_before_insert_defaults_tg
  on public.learning_categories;
create trigger learning_categories_before_insert_defaults_tg
  before insert on public.learning_categories
  for each row execute function public.learning_categories_before_insert_defaults();

drop trigger if exists learning_categories_set_updated_at
  on public.learning_categories;
create trigger learning_categories_set_updated_at
  before update on public.learning_categories
  for each row execute function public.set_updated_at();

-- ── 2. category_id FK on learning_courses ─────────────────────────────────

alter table public.learning_courses
  add column if not exists category_id uuid
    references public.learning_categories (id) on delete set null;

create index if not exists learning_courses_category_idx
  on public.learning_courses (category_id)
  where category_id is not null;

-- ── 3. Seed default system categories per org ─────────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    insert into public.learning_categories
      (organization_id, slug, name, description, position, is_system)
    values
      (v_org.id, 'hms-grunnopplaering',
       'HMS-grunnopplæring',
       'Lovpålagt HMS-opplæring for ledere og verneombud (AML §3-5, §6-5).',
       10, true),
      (v_org.id, 'brann',
       'Brann',
       'Brannvern, slokkeutstyr og evakuering.',
       20, true),
      (v_org.id, 'forstehjelp',
       'Førstehjelp',
       'Førstehjelpsopplæring og hjertestarter-bruk.',
       30, true),
      (v_org.id, 'verneombud',
       'Verneombud',
       'Verneombud-opplæring og oppdatering (AML §6-5).',
       40, true),
      (v_org.id, 'onboarding',
       'Onboarding',
       'Introduksjonskurs for nye ansatte.',
       50, true),
      (v_org.id, 'eksterne-kurs',
       'Eksterne kurs',
       'Kurs gjennomført hos ekstern leverandør med innloggings-cert.',
       60, true)
    on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ── 4. Best-effort backfill: link existing courses to a category ──────────
-- Walk each course's tags array; if any tag string-matches a seeded category
-- name (case-insensitive), link the course. Doesn't overwrite manually-set
-- category_id values.

do $$
declare
  v_course record;
  v_cat_id uuid;
  v_tag text;
begin
  for v_course in
    select id, organization_id, tags
      from public.learning_courses
     where category_id is null
       and tags is not null
       and array_length(tags, 1) > 0
  loop
    foreach v_tag in array v_course.tags
    loop
      select id into v_cat_id
        from public.learning_categories
       where organization_id = v_course.organization_id
         and (
           lower(name) = lower(v_tag)
           or lower(slug) = lower(replace(v_tag, ' ', '-'))
         )
       limit 1;
      if v_cat_id is not null then
        update public.learning_courses
           set category_id = v_cat_id
         where id = v_course.id;
        exit;  -- first hit wins
      end if;
    end loop;
  end loop;
end $$;

-- ── 5. Auto-provision categories for new orgs ─────────────────────────────
-- Hook into the existing organizations AFTER INSERT trigger if one exists,
-- otherwise add our own. Idempotent — uses on conflict do nothing.

create or replace function public.organizations_provision_learning_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.learning_categories
    (organization_id, slug, name, description, position, is_system)
  values
    (new.id, 'hms-grunnopplaering',
     'HMS-grunnopplæring',
     'Lovpålagt HMS-opplæring for ledere og verneombud (AML §3-5, §6-5).',
     10, true),
    (new.id, 'brann',
     'Brann', 'Brannvern, slokkeutstyr og evakuering.',
     20, true),
    (new.id, 'forstehjelp',
     'Førstehjelp', 'Førstehjelpsopplæring og hjertestarter-bruk.',
     30, true),
    (new.id, 'verneombud',
     'Verneombud', 'Verneombud-opplæring og oppdatering (AML §6-5).',
     40, true),
    (new.id, 'onboarding',
     'Onboarding', 'Introduksjonskurs for nye ansatte.',
     50, true),
    (new.id, 'eksterne-kurs',
     'Eksterne kurs', 'Kurs gjennomført hos ekstern leverandør med innloggings-cert.',
     60, true)
  on conflict (organization_id, slug) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_provision_learning_categories_tg on public.organizations;
create trigger organizations_provision_learning_categories_tg
  after insert on public.organizations
  for each row execute function public.organizations_provision_learning_categories();
