-- Vendors master table + survey_invitations recipient refactor.
--
-- Decision 2C from GLOBAL_SURVEY_PLAN.md §2.3: build the vendors table
-- correctly now rather than the lighter "email-only invitation" path.
-- Customer eventually wants vendor-level reporting (open / completed /
-- overdue surveys per vendor); that requires a stable vendor identifier.
--
-- The refactor of survey_invitations is the moderate-risk migration the
-- plan flags in §8 — staged so existing rows remain valid throughout:
--   step 1: add vendor_id + recipient_email columns (nullable).
--   step 2: drop NOT NULL on profile_id (existing rows already non-null;
--           future vendor rows will be NULL on profile_id).
--   step 3: add XOR check that exactly one of (profile_id, vendor_id)
--           is set. Existing employee-invitation rows trivially satisfy
--           because profile_id is non-null and vendor_id is null.
--   step 4: add a partial unique index for vendor-scoped uniqueness
--           per distribution.
--
-- The original UNIQUE (distribution_id, profile_id) constraint stays.
-- Postgres treats NULLs as distinct in unique indexes by default, so the
-- vendor-only rows (profile_id NULL) don't conflict with that constraint.

-- ── 1. vendors table ───────────────────────────────────────────────────────

create table if not exists public.vendors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name    text not null,
  org_number      text,                                                -- BRREG nine-digit; nullable for foreign vendors
  primary_email   text,
  contact_name    text,
  status          text not null default 'active'
    check (status in ('active', 'inactive', 'offboarded')),
  metadata        jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, org_number)                                  -- BRREG unique per tenant; NULLs treated as distinct
);

create index if not exists vendors_org_active_idx
  on public.vendors (organization_id, is_active)
  where deleted_at is null;

create index if not exists vendors_org_search_idx
  on public.vendors using gin (organization_id, to_tsvector('simple', display_name));

alter table public.vendors enable row level security;

drop policy if exists vendors_select_org on public.vendors;
create policy vendors_select_org
  on public.vendors for select
  using (organization_id = public.current_org_id());

drop policy if exists vendors_write_org on public.vendors;
create policy vendors_write_org
  on public.vendors for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.vendors_before_insert_defaults()
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

drop trigger if exists vendors_before_insert_defaults_tg on public.vendors;
create trigger vendors_before_insert_defaults_tg
  before insert on public.vendors
  for each row execute function public.vendors_before_insert_defaults();

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists vendors_audit_tg on public.vendors;
create trigger vendors_audit_tg
  after insert or update or delete on public.vendors
  for each row execute function public.hse_audit_trigger();

-- ── 2. survey_invitations refactor ─────────────────────────────────────────

-- Step 2a: add new columns. recipient_email is the canonical send-time
-- email going forward; the original email_snapshot is preserved for
-- backward compatibility with existing rows and survey_complete_invitation_*
-- RPCs that may reference it.
alter table public.survey_invitations
  add column if not exists vendor_id       uuid references public.vendors (id) on delete set null,
  add column if not exists recipient_email text;

-- Step 2b: drop NOT NULL on profile_id so vendor-only invitations can
-- omit it. Existing rows are unaffected (they already have profile_id
-- non-null).
alter table public.survey_invitations
  alter column profile_id drop not null;

-- Step 2c: XOR check — exactly one of (profile_id, vendor_id) is set.
-- This is added separately from the column declarations so it can
-- reference both new and existing columns. Use DO block to make the
-- ADD CONSTRAINT idempotent (PostgreSQL has no IF NOT EXISTS for it).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'survey_invitations_recipient_xor'
  ) then
    alter table public.survey_invitations
      add constraint survey_invitations_recipient_xor
        check (
          (profile_id is not null)::int + (vendor_id is not null)::int = 1
        );
  end if;
end $$;

-- Step 2d: prevent duplicate vendor invitations within a single
-- distribution. The existing UNIQUE (distribution_id, profile_id) handles
-- employee invitations; this partial index handles vendor invitations.
create unique index if not exists survey_invitations_distribution_vendor_uidx
  on public.survey_invitations (distribution_id, vendor_id)
  where vendor_id is not null;

-- Step 2e: index for vendor-scoped invitation lookups (vendor's own
-- pending invitations across all distributions/surveys).
create index if not exists survey_invitations_vendor_status_idx
  on public.survey_invitations (vendor_id, status)
  where vendor_id is not null;
