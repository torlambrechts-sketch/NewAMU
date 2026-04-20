-- ROS: system (global) hazard categories and templates — organization_id IS NULL
-- Mirrors inspection_templates (20260618120000_global_inspection_templates.sql).

-- ── 1. ros_hazard_categories: nullable organization_id + partial uniques ─────
alter table public.ros_hazard_categories
  alter column organization_id drop not null;

alter table public.ros_hazard_categories
  drop constraint if exists ros_hazard_categories_organization_id_fkey;
alter table public.ros_hazard_categories
  add constraint ros_hazard_categories_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

alter table public.ros_hazard_categories
  drop constraint if exists ros_hazard_categories_organization_id_code_key;

create unique index if not exists ros_hazard_categories_org_code_active_uq
  on public.ros_hazard_categories (organization_id, code)
  where organization_id is not null and deleted_at is null;

create unique index if not exists ros_hazard_categories_global_code_active_uq
  on public.ros_hazard_categories (code)
  where organization_id is null and deleted_at is null;

-- ── 2. ros_templates: nullable organization_id ──────────────────────────────
alter table public.ros_templates
  alter column organization_id drop not null;

alter table public.ros_templates
  drop constraint if exists ros_templates_organization_id_fkey;
alter table public.ros_templates
  add constraint ros_templates_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

drop index if exists ros_templates_org_idx;
create index if not exists ros_templates_org_idx
  on public.ros_templates (organization_id, is_active, updated_at desc)
  where deleted_at is null;

create unique index if not exists ros_templates_global_name_active_uq
  on public.ros_templates (name)
  where organization_id is null and deleted_at is null;

create unique index if not exists ros_templates_org_name_active_uq
  on public.ros_templates (organization_id, name)
  where organization_id is not null and deleted_at is null;

-- ── 3. RLS: read globals + org rows; write only org rows ─────────────────────
drop policy if exists ros_haz_cat_select on public.ros_hazard_categories;
create policy ros_haz_cat_select on public.ros_hazard_categories
  for select to authenticated
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

drop policy if exists ros_haz_cat_write on public.ros_hazard_categories;
create policy ros_haz_cat_write on public.ros_hazard_categories
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists ros_templates_select on public.ros_templates;
create policy ros_templates_select on public.ros_templates
  for select to authenticated
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

drop policy if exists ros_templates_write on public.ros_templates;
create policy ros_templates_write on public.ros_templates
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ── 4. BEFORE INSERT: preserve NULL when auth.uid() is null (migrations) ──
create or replace function public.ros_hazard_categories_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and auth.uid() is not null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists ros_hazard_categories_before_insert_defaults_tg on public.ros_hazard_categories;
create trigger ros_hazard_categories_before_insert_defaults_tg
  before insert on public.ros_hazard_categories
  for each row execute function public.ros_hazard_categories_before_insert_defaults();

create or replace function public.ros_templates_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and auth.uid() is not null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists ros_templates_before_insert_defaults_tg on public.ros_templates;
create trigger ros_templates_before_insert_defaults_tg
  before insert on public.ros_templates
  for each row execute function public.ros_templates_before_insert_defaults();

-- ── 5. Seed system hazard categories (organization_id = NULL) ─────────────────
insert into public.ros_hazard_categories (organization_id, code, label, description, sort_order)
select null, x.code, x.label, x.description, x.sort_order
from (values
  ('sys_physical', 'Fysisk', 'Støy, vibrasjon, temperatur, stråling', 10),
  ('sys_chemical_bio', 'Kjemisk og biologisk', 'Eksponering for kjemikalier og biologiske agenser', 20),
  ('sys_ergonomic', 'Ergonomisk', 'Arbeidsstillinger, repetitive bevegelser, løft', 30),
  ('sys_psych_org', 'Psykososialt og organisatorisk', 'Arbeidsbelastning, vold/trusler, organisering', 40),
  ('sys_machinery', 'Arbeidsutstyr og maskiner', 'Klem, kutt, trekk, maskinsikkerhet', 50),
  ('sys_accidents_external', 'Ulykker og ytre hendelser', 'Fall, sammenstøt, vær, tredjepart', 60)
) as x(code, label, description, sort_order)
where not exists (
  select 1 from public.ros_hazard_categories h
  where h.organization_id is null and h.code = x.code and h.deleted_at is null
);

-- ── 6. Seed system templates ─────────────────────────────────────────────────
do $$
declare
  v_general jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object('description', 'Løse kabler og rot i gangsoner', 'category_code', 'sys_physical', 'law_domain', 'AML', 'existing_controls', null),
      jsonb_build_object('description', 'Inneklima og ventilasjon på arbeidsplassen', 'category_code', 'sys_physical', 'law_domain', 'AML', 'existing_controls', null),
      jsonb_build_object('description', 'Skjermarbeid uten pauser og variasjon', 'category_code', 'sys_ergonomic', 'law_domain', 'AML', 'existing_controls', null)
    )
  );
  v_height jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object('description', 'Fall fra høyde ved arbeid på stige eller stillas', 'category_code', 'sys_accidents_external', 'law_domain', 'AML', 'existing_controls', null),
      jsonb_build_object('description', 'Verktøy eller materialer som kan falle ned', 'category_code', 'sys_machinery', 'law_domain', 'AML', 'existing_controls', null)
    )
  );
  v_chem jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object('description', 'Eksponering for etsende eller giftige kjemikalier', 'category_code', 'sys_chemical_bio', 'law_domain', 'AML', 'existing_controls', null),
      jsonb_build_object('description', 'Manglende eller utdaterte sikkerhetsdatablad', 'category_code', 'sys_chemical_bio', 'law_domain', 'AML', 'existing_controls', null)
    )
  );
  v_solo jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object('description', 'Alenearbeid uten oppfølging ved kritisk oppgave', 'category_code', 'sys_psych_org', 'law_domain', 'AML', 'existing_controls', null),
      jsonb_build_object('description', 'Manglende nødprosedyre ved alenearbeid', 'category_code', 'sys_psych_org', 'law_domain', 'AML', 'existing_controls', null)
    )
  );
begin
  if not exists (select 1 from public.ros_templates where organization_id is null and name = 'Generell vernerunde / Kontormiljø') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Generell vernerunde / Kontormiljø', v_general, true);
  end if;
  if not exists (select 1 from public.ros_templates where organization_id is null and name = 'Arbeid i høyden') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Arbeid i høyden', v_height, true);
  end if;
  if not exists (select 1 from public.ros_templates where organization_id is null and name = 'Håndtering av kjemikalier') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Håndtering av kjemikalier', v_chem, true);
  end if;
  if not exists (select 1 from public.ros_templates where organization_id is null and name = 'Alenearbeid') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Alenearbeid', v_solo, true);
  end if;
end;
$$;
