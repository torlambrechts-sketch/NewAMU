-- Compliance Requirements — taxonomy of legal / standard clauses, plus
-- a junction linking templates to the requirements they satisfy.
--
-- Two ownership lanes for requirements:
--   organization_id IS NULL  → system row (shipped via migrations).
--                              Customers cannot modify these from the app
--                              (RLS write policy denies); platform ships
--                              updates via new migrations.
--   organization_id NOT NULL → org-defined custom requirement (e.g. an
--                              internal HMS policy clause). Editable by
--                              the owning org's admins.
--
-- Templates carry the regulation pack they belong to; requirements carry
-- the same pack. The junction lets one template satisfy multiple clauses
-- (the standard case for a vernerunde or an ISO audit).

create table if not exists public.compliance_requirements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  pack            public.compliance_pack not null,
  slug            text not null,
  code            text not null,
  title           text not null,
  description     text,
  is_system       boolean not null default false,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Slug uniqueness scoped by ownership lane.
create unique index if not exists compliance_requirements_org_pack_slug_idx
  on public.compliance_requirements (organization_id, pack, slug)
  where organization_id is not null;

create unique index if not exists compliance_requirements_system_pack_slug_idx
  on public.compliance_requirements (pack, slug)
  where organization_id is null;

create index if not exists compliance_requirements_pack_active_idx
  on public.compliance_requirements (pack, is_active);

alter table public.compliance_requirements enable row level security;

-- SELECT: org rows for current org, plus all system rows.
drop policy if exists compliance_requirements_select on public.compliance_requirements;
create policy compliance_requirements_select
  on public.compliance_requirements for select
  using (
    organization_id = public.current_org_id()
    or organization_id is null
  );

-- WRITE: only org-scoped rows. System rows are managed via migrations.
drop policy if exists compliance_requirements_write_org on public.compliance_requirements;
create policy compliance_requirements_write_org
  on public.compliance_requirements for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.compliance_requirements_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and not new.is_system then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_requirements_before_insert_defaults_tg on public.compliance_requirements;
create trigger compliance_requirements_before_insert_defaults_tg
  before insert on public.compliance_requirements
  for each row execute function public.compliance_requirements_before_insert_defaults();

drop trigger if exists compliance_requirements_set_updated_at on public.compliance_requirements;
create trigger compliance_requirements_set_updated_at
  before update on public.compliance_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists compliance_requirements_audit_tg on public.compliance_requirements;
create trigger compliance_requirements_audit_tg
  after insert or update or delete on public.compliance_requirements
  for each row execute function public.hse_audit_trigger();

-- ── Junction: template ↔ requirement ────────────────────────────────────────

create table if not exists public.compliance_template_requirements (
  template_id     uuid not null references public.compliance_checklist_templates (id) on delete cascade,
  requirement_id  uuid not null references public.compliance_requirements (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (template_id, requirement_id)
);

create index if not exists compliance_template_requirements_org_req_idx
  on public.compliance_template_requirements (organization_id, requirement_id);

create index if not exists compliance_template_requirements_template_idx
  on public.compliance_template_requirements (template_id);

alter table public.compliance_template_requirements enable row level security;

drop policy if exists compliance_template_requirements_select_org on public.compliance_template_requirements;
create policy compliance_template_requirements_select_org
  on public.compliance_template_requirements for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_template_requirements_write_org on public.compliance_template_requirements;
create policy compliance_template_requirements_write_org
  on public.compliance_template_requirements for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- Derive organization_id from the parent template + stamp created_by.
create or replace function public.compliance_template_requirements_before_insert()
returns trigger
language plpgsql
as $$
declare
  v_template_org uuid;
  v_template_pack public.compliance_pack;
  v_req_pack public.compliance_pack;
  v_req_org uuid;
begin
  select organization_id, pack
  into v_template_org, v_template_pack
  from public.compliance_checklist_templates
  where id = new.template_id;

  if v_template_org is null then
    raise exception 'Template % not found for compliance_template_requirements insert', new.template_id;
  end if;

  select organization_id, pack
  into v_req_org, v_req_pack
  from public.compliance_requirements
  where id = new.requirement_id;

  if v_req_pack is null then
    raise exception 'Requirement % not found for compliance_template_requirements insert', new.requirement_id;
  end if;

  -- A requirement can be linked to a template iff: requirement is system
  -- (org_id NULL) or owned by the same org as the template, AND packs match.
  if v_req_org is not null and v_req_org <> v_template_org then
    raise exception 'Requirement % belongs to a different organization', new.requirement_id;
  end if;
  if v_req_pack <> v_template_pack then
    raise exception 'Requirement pack (%) does not match template pack (%)',
      v_req_pack, v_template_pack;
  end if;

  new.organization_id := v_template_org;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_template_requirements_before_insert_tg on public.compliance_template_requirements;
create trigger compliance_template_requirements_before_insert_tg
  before insert on public.compliance_template_requirements
  for each row execute function public.compliance_template_requirements_before_insert();

drop trigger if exists compliance_template_requirements_audit_tg on public.compliance_template_requirements;
create trigger compliance_template_requirements_audit_tg
  after insert or update or delete on public.compliance_template_requirements
  for each row execute function public.hse_audit_trigger();
