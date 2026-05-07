-- Compliance Packs — per-org regulation pack configuration.
--
-- One row per (organization_id, pack_slug). The row carries the *display*
-- content (labels, banner copy, KPI labels, severity labels) so customers
-- can re-skin a pack without code changes.
--
-- Licensing: a pack is "available" to an org iff a row exists with
-- is_active = true. To disable a pack, set is_active = false (don't delete —
-- existing executions still reference the slug via the compliance_pack enum).
-- This separates pack *content* from pack *availability* without a second table.

create table if not exists public.compliance_packs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            public.compliance_pack not null,
  short_name      text not null,
  plural_label    text not null,
  cta_label       text not null,
  description     text not null default '',
  -- Banner content rendered by ModuleLegalBanner. Curated subset; the full
  -- requirement taxonomy lives in compliance_requirements (next migration).
  legal_references jsonb not null default '[]'::jsonb,    -- [{code, text}]
  -- KPI tile labels: {open, critical, ytd}.
  kpi_labels      jsonb not null default '{}'::jsonb,
  -- Auditor-readable severity labels: {critical, high, medium, low}.
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

create index if not exists compliance_packs_org_active_idx
  on public.compliance_packs (organization_id, is_active, position);

alter table public.compliance_packs enable row level security;

drop policy if exists compliance_packs_select_org on public.compliance_packs;
create policy compliance_packs_select_org
  on public.compliance_packs for select
  using (organization_id = public.current_org_id());

-- WRITE policy: org-scoped. Finer-grained 'checklist.manage' permission is
-- enforced in the application (hook gate); RLS is the org isolation layer.
drop policy if exists compliance_packs_write_org on public.compliance_packs;
create policy compliance_packs_write_org
  on public.compliance_packs for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.compliance_packs_before_insert_defaults()
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

drop trigger if exists compliance_packs_before_insert_defaults_tg on public.compliance_packs;
create trigger compliance_packs_before_insert_defaults_tg
  before insert on public.compliance_packs
  for each row execute function public.compliance_packs_before_insert_defaults();

drop trigger if exists compliance_packs_set_updated_at on public.compliance_packs;
create trigger compliance_packs_set_updated_at
  before update on public.compliance_packs
  for each row execute function public.set_updated_at();

drop trigger if exists compliance_packs_audit_tg on public.compliance_packs;
create trigger compliance_packs_audit_tg
  after insert or update or delete on public.compliance_packs
  for each row execute function public.hse_audit_trigger();
