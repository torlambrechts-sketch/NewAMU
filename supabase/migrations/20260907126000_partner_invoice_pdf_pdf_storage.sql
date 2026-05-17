-- Partner Console v0 — PDF artefact + customer-facing invoice number + VAT inputs.
-- Closes the Partner Console v0 final-review gap: faktura må kunne sendes
-- som PDF (regnskapsloven § 6 dokumentasjonskrav + bokføringsforskriften § 5-1-1)
-- og må bære et persistent fakturanummer (mval § 5-1-1 nr. 1).
-- Adds VAT-rate + bank-account + payment-terms inputs on the partner firm so
-- the PDF renderer can render alle pliktige fakturafelter uten per-invoice metadata.

set local search_path = public, pg_catalog;

-- ───────────────────────────────────────────────────────────────────
-- 1. partner_invoices: PDF artefact + customer-facing invoice number
-- ───────────────────────────────────────────────────────────────────

alter table public.partner_invoices
  add column if not exists pdf_storage_path text;

alter table public.partner_invoices
  add column if not exists pdf_generated_at timestamptz;

alter table public.partner_invoices
  add column if not exists invoice_number text;

-- Customer-facing invoice number must be unique per partner firm so the
-- HMS-konsulent can hand a number out to Visma/Tripletex / kunde without
-- collisions. The constraint is partial — null is allowed because the
-- number is minted lazily on first PDF generation.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'partner_invoices_invoice_number_unique'
  ) then
    create unique index partner_invoices_invoice_number_unique
      on public.partner_invoices (partner_id, invoice_number)
      where invoice_number is not null;
  end if;
end$$;

comment on column public.partner_invoices.pdf_storage_path is
  'Path inside the `partner-invoices` Storage bucket where the most recent PDF render lives. Stamped by the partner-invoice-pdf edge function.';
comment on column public.partner_invoices.pdf_generated_at is
  'When the PDF was last (re)rendered. Distinct from generated_at which marks invoice-row creation.';
comment on column public.partner_invoices.invoice_number is
  'Customer-facing sequential invoice number scoped to partner_id, format `<year>-<NNNN>` (mval § 5-1-1 nr. 1). Minted by partner_invoice_assign_number on first PDF render.';

-- ───────────────────────────────────────────────────────────────────
-- 2. partner_organizations: VAT + bank + payment terms
-- ───────────────────────────────────────────────────────────────────

alter table public.partner_organizations
  add column if not exists vat_rate numeric(5, 4) not null default 0.2500;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_organizations_vat_rate_range'
  ) then
    alter table public.partner_organizations
      add constraint partner_organizations_vat_rate_range
      check (vat_rate >= 0 and vat_rate <= 1);
  end if;
end$$;

alter table public.partner_organizations
  add column if not exists bank_account_number text;

alter table public.partner_organizations
  add column if not exists payment_terms_days int not null default 14;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_organizations_payment_terms_range'
  ) then
    alter table public.partner_organizations
      add constraint partner_organizations_payment_terms_range
      check (payment_terms_days >= 1 and payment_terms_days <= 90);
  end if;
end$$;

comment on column public.partner_organizations.vat_rate is
  'Default MVA rate applied by the partner-invoice-pdf renderer. Norwegian standard 0.2500. v1 may add per-customer overrides.';
comment on column public.partner_organizations.bank_account_number is
  'Norwegian 11-digit bank-account string (formatted free-text; no validation here). Rendered in the PDF footer for kunde payment.';
comment on column public.partner_organizations.payment_terms_days is
  'Default days from fakturadato to forfallsdato. 14 days is the SMB norm in NO.';

-- ───────────────────────────────────────────────────────────────────
-- 3. partner_invoice_sequences: per-partner per-year counter
-- ───────────────────────────────────────────────────────────────────

create table if not exists public.partner_invoice_sequences (
  partner_id uuid not null references public.partner_organizations (id) on delete cascade,
  year int not null check (year between 2000 and 2999),
  last_seq int not null default 0 check (last_seq >= 0),
  updated_at timestamptz not null default now(),
  primary key (partner_id, year)
);

comment on table public.partner_invoice_sequences is
  'Per-partner per-year monotonic counter. Mutated only by partner_invoice_assign_number to guarantee gapless customer-facing numbering.';

alter table public.partner_invoice_sequences enable row level security;

-- Read: partner manager/admin only — consultants do not need the raw
-- counter. The mutation goes through a SECURITY DEFINER RPC.
drop policy if exists partner_invoice_sequences_select on public.partner_invoice_sequences;
create policy partner_invoice_sequences_select
  on public.partner_invoice_sequences for select
  to authenticated
  using (public.is_partner_manager_of(partner_id, auth.uid()));

-- No direct writes — only the RPC bumps the counter.
drop policy if exists partner_invoice_sequences_no_user_write on public.partner_invoice_sequences;
create policy partner_invoice_sequences_no_user_write
  on public.partner_invoice_sequences for all
  to authenticated
  using (false)
  with check (false);

-- ───────────────────────────────────────────────────────────────────
-- 4. partner_invoice_assign_number — idempotent number minting
-- ───────────────────────────────────────────────────────────────────

create or replace function public.partner_invoice_assign_number(
  p_invoice_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_partner uuid;
  v_existing text;
  v_year int;
  v_next int;
  v_number text;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;

  select partner_id, invoice_number, extract(year from generated_at)::int
    into v_partner, v_existing, v_year
  from public.partner_invoices
  where id = p_invoice_id;

  if v_partner is null then
    raise exception 'invoice % not found', p_invoice_id;
  end if;

  if not public.is_partner_manager_of(v_partner, v_user) then
    raise exception 'only partner manager/admin can assign invoice numbers';
  end if;

  -- Idempotent: hand back the stable number on repeat calls.
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.partner_invoice_sequences (partner_id, year, last_seq)
  values (v_partner, v_year, 1)
  on conflict (partner_id, year)
    do update set last_seq = public.partner_invoice_sequences.last_seq + 1,
                  updated_at = now()
  returning last_seq into v_next;

  v_number := v_year::text || '-' || lpad(v_next::text, 4, '0');

  update public.partner_invoices
     set invoice_number = v_number
   where id = p_invoice_id
     and invoice_number is null;

  return v_number;
end;
$$;

revoke all on function public.partner_invoice_assign_number(uuid) from public;
grant execute on function public.partner_invoice_assign_number(uuid)
  to authenticated, service_role;

comment on function public.partner_invoice_assign_number(uuid) is
  'Mints (or returns the existing) customer-facing invoice number for a partner_invoices row. Format `<year>-<NNNN>`, scoped to partner_id, gapless within a year.';
