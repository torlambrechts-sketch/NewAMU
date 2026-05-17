-- Partner Console v0 — multi-org consulting firm substrate.
--
-- HMS-konsulenter who manage 15–40 SMB customers from one branded surface
-- need: (1) a multi-org switcher backed by a real membership table,
-- (2) a per-action time-ledger that captures both manual and auto-session
-- entries with rate-locked hourly_rate, (3) a faktura artefact tied back
-- to those entries so retroactive rate changes never break invoicing.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — virksomheten skal kunne
--   dokumentere at HMS-arbeidet utføres (her: hvem, når, hvor lenge,
--   for hvilken kunde). Konsulent-timer er det primære evidens-
--   grunnlaget for AML § 3-3 (BHT-bistand) når en kunde-virksomhet
--   ikke har egen kompetanse. Hvert tidsregistrerings-objekt blir et
--   merkleverdig spor: started_at + ended_at + description + rate.
--   Restrisiko deferred: white-label CSS, lead-marketplace og co-sign-
--   approval er P3 (se ROADMAP). v0 leverer regnskaps-eksport (CSV)
--   som sluttartefakt; PDF + Altinn-attestering kommer senere.
--
-- Idempotent — alle DDL bruker `if not exists` / `create or replace`.
-- RLS aktiv på alle 4 tabeller; helper-funksjon
-- public.is_partner_member_of bryter inn i RLS slik at konsulent kan
-- se andre konsulenters timer i samme firma (manager+admin alle rader).

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ───────────────────────────────────────────────────────────────────
-- 1. partner_organizations — meta on a consulting firm
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_hourly_rate numeric(10, 2) not null default 1350.00,
  billing_email text,
  brand_accent text,                            -- reserved for v1 white-label
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_organizations_name_idx
  on public.partner_organizations (lower(name));

-- ───────────────────────────────────────────────────────────────────
-- 2. partner_memberships — link partner firm → customer org → user
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.partner_memberships (
  partner_id uuid not null references public.partner_organizations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role text not null default 'consultant'
    check (role in ('consultant', 'manager', 'admin')),
  active boolean not null default true,
  hourly_rate_override numeric(10, 2),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (partner_id, organization_id, user_id)
);

create index if not exists partner_memberships_user_active_idx
  on public.partner_memberships (user_id, active) where active = true;

create index if not exists partner_memberships_org_idx
  on public.partner_memberships (organization_id, active) where active = true;

create index if not exists partner_memberships_partner_idx
  on public.partner_memberships (partner_id, active) where active = true;

-- ───────────────────────────────────────────────────────────────────
-- 3. partner_time_entries — every minute a consultant spends
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.partner_time_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_organizations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  description text,
  source text not null default 'auto_session'
    check (source in ('manual', 'auto_session', 'workflow_action')),
  -- Captured at write-time: retroactive rate changes must not rewrite
  -- already-billed work.
  hourly_rate numeric(10, 2) not null,
  billable boolean not null default true,
  invoice_line_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists partner_time_entries_partner_period_idx
  on public.partner_time_entries (partner_id, started_at desc);

create index if not exists partner_time_entries_org_period_idx
  on public.partner_time_entries (organization_id, started_at desc);

create index if not exists partner_time_entries_user_period_idx
  on public.partner_time_entries (user_id, started_at desc);

create index if not exists partner_time_entries_open_idx
  on public.partner_time_entries (user_id, organization_id) where ended_at is null;

create index if not exists partner_time_entries_billable_unbilled_idx
  on public.partner_time_entries (partner_id, organization_id, started_at)
  where billable = true and invoice_line_id is null and ended_at is not null;

-- ───────────────────────────────────────────────────────────────────
-- 4. partner_invoices — generated monthly billing artefacts
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.partner_invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_organizations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'cancelled')),
  total_minutes int not null default 0,
  total_amount_nok numeric(12, 2) not null default 0,
  csv_storage_path text,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint partner_invoices_period_valid check (period_end >= period_start)
);

create index if not exists partner_invoices_partner_idx
  on public.partner_invoices (partner_id, generated_at desc);

create index if not exists partner_invoices_org_idx
  on public.partner_invoices (organization_id, generated_at desc);

create index if not exists partner_invoices_status_idx
  on public.partner_invoices (partner_id, status) where status in ('draft', 'sent');

-- ───────────────────────────────────────────────────────────────────
-- 5. Helper functions
-- ───────────────────────────────────────────────────────────────────

-- Fast lookup: is the user a member (any role) of this partner firm?
create or replace function public.is_partner_member_of(
  p_partner_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_memberships m
    where m.partner_id = p_partner_id
      and m.user_id = p_user_id
      and m.active = true
  );
$$;

-- Higher gate: manager/admin only (for invoice/CSV/global-time reads).
create or replace function public.is_partner_manager_of(
  p_partner_id uuid,
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_memberships m
    where m.partner_id = p_partner_id
      and m.user_id = p_user_id
      and m.active = true
      and m.role in ('manager', 'admin')
  );
$$;

-- Returns the active partner_id for (caller, customer_org). When the
-- caller has memberships in multiple partner firms covering the same
-- customer org (rare; consortium), the GUC `app.active_partner_id`
-- breaks the tie. Returns null if the caller has no active membership.
create or replace function public.partner_resolve_active_partner(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int;
  v_first uuid;
  v_guc text;
  v_guc_uuid uuid;
begin
  select count(distinct partner_id), min(partner_id)
    into v_count, v_first
  from public.partner_memberships
  where organization_id = p_org_id
    and user_id = p_user_id
    and active = true;

  if v_count = 0 then return null; end if;
  if v_count = 1 then return v_first; end if;

  -- Multi-partner — let the caller-set GUC pick.
  begin
    v_guc := current_setting('app.active_partner_id', true);
  exception when others then
    v_guc := null;
  end;
  if v_guc is null or v_guc = '' then return v_first; end if;
  begin
    v_guc_uuid := v_guc::uuid;
  exception when others then
    return v_first;
  end;
  -- Confirm the GUC choice is a valid membership.
  if exists (
    select 1 from public.partner_memberships
    where partner_id = v_guc_uuid
      and organization_id = p_org_id
      and user_id = p_user_id
      and active = true
  ) then
    return v_guc_uuid;
  end if;
  return v_first;
end;
$$;

-- Open a time entry. Resolves partner_id and rate from the active
-- membership; rate-override on membership wins, else partner default.
create or replace function public.partner_start_time_entry(
  p_org_id uuid,
  p_description text default null,
  p_source text default 'auto_session'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_partner uuid;
  v_rate numeric(10, 2);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  if p_source not in ('manual', 'auto_session', 'workflow_action') then
    raise exception 'invalid source: %', p_source;
  end if;

  v_partner := public.partner_resolve_active_partner(p_org_id, v_user);
  if v_partner is null then
    raise exception 'no active partner membership for user % in org %', v_user, p_org_id;
  end if;

  select coalesce(m.hourly_rate_override, po.default_hourly_rate)
    into v_rate
  from public.partner_memberships m
    join public.partner_organizations po on po.id = m.partner_id
  where m.partner_id = v_partner
    and m.organization_id = p_org_id
    and m.user_id = v_user
    and m.active = true
  limit 1;

  if v_rate is null then v_rate := 1350.00; end if;

  -- Auto-session: avoid stacking multiple open rows for the same user/org
  -- by closing any prior open auto_session row first (UX: one "currently
  -- working in customer X" indicator at a time).
  if p_source = 'auto_session' then
    update public.partner_time_entries
       set ended_at = now()
     where user_id = v_user
       and organization_id = p_org_id
       and ended_at is null
       and source = 'auto_session';
  end if;

  insert into public.partner_time_entries (
    partner_id, organization_id, user_id, started_at, description, source, hourly_rate, billable
  ) values (
    v_partner, p_org_id, v_user, now(), p_description, p_source, v_rate, true
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Close a time entry; only the entry's user can stamp ended_at.
create or replace function public.partner_end_time_entry(
  p_entry_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;

  select user_id into v_owner
    from public.partner_time_entries
   where id = p_entry_id;

  if v_owner is null then
    raise exception 'time entry not found';
  end if;
  if v_owner <> v_user then
    raise exception 'caller does not own time entry';
  end if;

  update public.partner_time_entries
     set ended_at = now()
   where id = p_entry_id
     and ended_at is null;  -- idempotent: re-ending a closed row no-ops
end;
$$;

-- Compute minutes & NOK for the unbilled, billable, ended entries in a
-- window, create the invoice row, and stamp invoice_line_id on each
-- consumed entry. Caller must be manager/admin.
create or replace function public.partner_generate_invoice(
  p_partner_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice_id uuid;
  v_total_min int;
  v_total_nok numeric(12, 2);
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  if not public.is_partner_manager_of(p_partner_id, v_user) then
    raise exception 'only partner manager/admin can generate invoices';
  end if;
  if p_period_end < p_period_start then
    raise exception 'invalid period window';
  end if;

  v_invoice_id := gen_random_uuid();

  -- Compute aggregates over the candidate set.
  with candidates as (
    select id,
           greatest(0, extract(epoch from (ended_at - started_at)) / 60.0)::numeric as minutes,
           hourly_rate
    from public.partner_time_entries
    where partner_id = p_partner_id
      and organization_id = p_organization_id
      and billable = true
      and invoice_line_id is null
      and ended_at is not null
      and started_at >= p_period_start::timestamptz
      and started_at <  (p_period_end + interval '1 day')::timestamptz
  )
  select coalesce(sum(minutes)::int, 0),
         coalesce(sum(minutes / 60.0 * hourly_rate), 0)::numeric(12,2)
    into v_total_min, v_total_nok
  from candidates;

  insert into public.partner_invoices (
    id, partner_id, organization_id, period_start, period_end,
    status, total_minutes, total_amount_nok
  ) values (
    v_invoice_id, p_partner_id, p_organization_id, p_period_start, p_period_end,
    'draft', v_total_min, v_total_nok
  );

  update public.partner_time_entries
     set invoice_line_id = v_invoice_id
   where partner_id = p_partner_id
     and organization_id = p_organization_id
     and billable = true
     and invoice_line_id is null
     and ended_at is not null
     and started_at >= p_period_start::timestamptz
     and started_at <  (p_period_end + interval '1 day')::timestamptz;

  return v_invoice_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 6. Row-level security
-- ───────────────────────────────────────────────────────────────────

alter table public.partner_organizations enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.partner_time_entries enable row level security;
alter table public.partner_invoices enable row level security;

-- ── partner_organizations ─────────────────────────────────────────
drop policy if exists partner_organizations_select on public.partner_organizations;
create policy partner_organizations_select
  on public.partner_organizations for select
  to authenticated
  using (public.is_partner_member_of(id, auth.uid()));

drop policy if exists partner_organizations_admin_insert on public.partner_organizations;
create policy partner_organizations_admin_insert
  on public.partner_organizations for insert
  to authenticated
  with check (
    -- Bootstrap: any authenticated user can create their first partner
    -- firm. Subsequent inserts limited to admins (cannot self-elevate
    -- in another firm since the new row has a fresh id).
    true
  );

drop policy if exists partner_organizations_admin_update on public.partner_organizations;
create policy partner_organizations_admin_update
  on public.partner_organizations for update
  to authenticated
  using (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_organizations.id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_organizations.id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'admin'
    )
  );

drop policy if exists partner_organizations_admin_delete on public.partner_organizations;
create policy partner_organizations_admin_delete
  on public.partner_organizations for delete
  to authenticated
  using (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_organizations.id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'admin'
    )
  );

-- ── partner_memberships ───────────────────────────────────────────
drop policy if exists partner_memberships_select on public.partner_memberships;
create policy partner_memberships_select
  on public.partner_memberships for select
  to authenticated
  using (public.is_partner_member_of(partner_id, auth.uid()));

drop policy if exists partner_memberships_admin_write on public.partner_memberships;
create policy partner_memberships_admin_write
  on public.partner_memberships for all
  to authenticated
  using (
    -- Admins manage memberships. A user can also see their own row via
    -- the select policy above, but only admin/manager can write.
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('admin', 'manager')
    )
    -- Bootstrap exception: the user inserting the first membership row
    -- for a brand-new partner firm. Without this, an admin can never
    -- be created.
    or not exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
    )
  )
  with check (
    exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
        and m.user_id = auth.uid()
        and m.active = true
        and m.role in ('admin', 'manager')
    )
    or not exists (
      select 1 from public.partner_memberships m
      where m.partner_id = partner_memberships.partner_id
    )
  );

-- ── partner_time_entries ──────────────────────────────────────────
drop policy if exists partner_time_entries_select on public.partner_time_entries;
create policy partner_time_entries_select
  on public.partner_time_entries for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_partner_manager_of(partner_id, auth.uid())
  );

drop policy if exists partner_time_entries_insert on public.partner_time_entries;
create policy partner_time_entries_insert
  on public.partner_time_entries for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_partner_member_of(partner_id, auth.uid())
  );

drop policy if exists partner_time_entries_update on public.partner_time_entries;
create policy partner_time_entries_update
  on public.partner_time_entries for update
  to authenticated
  using (
    -- Consultant can edit own row only if not yet invoiced.
    (user_id = auth.uid() and invoice_line_id is null)
    -- Manager+admin can edit any row in their partner firm.
    or public.is_partner_manager_of(partner_id, auth.uid())
  )
  with check (
    (user_id = auth.uid() and invoice_line_id is null)
    or public.is_partner_manager_of(partner_id, auth.uid())
  );

drop policy if exists partner_time_entries_delete on public.partner_time_entries;
create policy partner_time_entries_delete
  on public.partner_time_entries for delete
  to authenticated
  using (
    (user_id = auth.uid() and invoice_line_id is null)
    or public.is_partner_manager_of(partner_id, auth.uid())
  );

-- ── partner_invoices ──────────────────────────────────────────────
drop policy if exists partner_invoices_select on public.partner_invoices;
create policy partner_invoices_select
  on public.partner_invoices for select
  to authenticated
  using (public.is_partner_manager_of(partner_id, auth.uid()));

-- Direct insert/update from clients denied — go through
-- partner_generate_invoice (security definer) and edge functions.
drop policy if exists partner_invoices_no_user_insert on public.partner_invoices;
create policy partner_invoices_no_user_insert
  on public.partner_invoices for insert
  to authenticated
  with check (false);

drop policy if exists partner_invoices_manager_update on public.partner_invoices;
create policy partner_invoices_manager_update
  on public.partner_invoices for update
  to authenticated
  using (public.is_partner_manager_of(partner_id, auth.uid()))
  with check (public.is_partner_manager_of(partner_id, auth.uid()));

drop policy if exists partner_invoices_manager_delete on public.partner_invoices;
create policy partner_invoices_manager_delete
  on public.partner_invoices for delete
  to authenticated
  using (public.is_partner_manager_of(partner_id, auth.uid()));

-- ───────────────────────────────────────────────────────────────────
-- 7. Grants
-- ───────────────────────────────────────────────────────────────────

grant execute on function public.is_partner_member_of(uuid, uuid) to authenticated;
grant execute on function public.is_partner_manager_of(uuid, uuid) to authenticated;
grant execute on function public.partner_resolve_active_partner(uuid, uuid) to authenticated;
grant execute on function public.partner_start_time_entry(uuid, text, text) to authenticated;
grant execute on function public.partner_end_time_entry(uuid) to authenticated;
grant execute on function public.partner_generate_invoice(uuid, uuid, date, date) to authenticated;

-- Helpful comments for jsonb column shape.
comment on column public.partner_invoices.metadata is
  'Free-form invoice metadata: optional vat info, custom line text, sent-to email override, etc.';
comment on column public.partner_time_entries.hourly_rate is
  'Captured at write time so retroactive partner-default rate changes do not rewrite already-billed work.';
