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
