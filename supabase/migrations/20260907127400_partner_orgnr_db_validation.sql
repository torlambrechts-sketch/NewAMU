-- Server-side validation of Norwegian orgnr on partner_organizations.
-- Regnskapsloven § 10 + bokføringsforskriften § 5-1-1 krever korrekt
-- selger-orgnr på faktura — DB-invariant slik at en misbehaving klient
-- ikke kan persistere garbage. Mod-11 sjekksum med vekter
-- [3,2,7,6,5,4,3,2] mot første 8 sifre (samme som klient-validatoren
-- i src/lib/validation/orgnr.ts).
-- Idempotent.

set local search_path = public, pg_catalog;

-- ───────────────────────────────────────────────────────────────────
-- 1. Helper: public.is_valid_norwegian_orgnr(text) -> boolean
-- ───────────────────────────────────────────────────────────────────

create or replace function public.is_valid_norwegian_orgnr(p_orgnr text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_digits   text;
  v_sum      int := 0;
  v_remain   int;
  v_expected int;
  v_weights  constant int[] := array[3,2,7,6,5,4,3,2];
  i          int;
begin
  if p_orgnr is null then
    return false;
  end if;

  -- Strip whitespace and dashes; any other non-digit means invalid.
  v_digits := regexp_replace(p_orgnr, '[\s-]', '', 'g');
  if v_digits !~ '^[0-9]{9}$' then
    return false;
  end if;

  for i in 1..8 loop
    v_sum := v_sum + (substr(v_digits, i, 1))::int * v_weights[i];
  end loop;

  v_remain := v_sum % 11;
  if v_remain = 1 then
    -- No representable check digit; orgnr invalid by definition.
    return false;
  end if;
  v_expected := case when v_remain = 0 then 0 else 11 - v_remain end;
  return v_expected = (substr(v_digits, 9, 1))::int;
end;
$$;

comment on function public.is_valid_norwegian_orgnr(text) is
  'Returns true iff `p_orgnr` is a 9-digit Brønnøysund orgnr with a valid mod-11 check digit (weights 3,2,7,6,5,4,3,2). Whitespace and dashes are stripped before checking. Mirrors src/lib/validation/orgnr.ts.';

-- ───────────────────────────────────────────────────────────────────
-- 2. Re-issue partner_update_branding with server-side orgnr guard
-- ───────────────────────────────────────────────────────────────────
--
-- Signature preserved exactly from _127100. Added: raise on invalid
-- orgnr so RPC fails fast with errcode 22023 (invalid_parameter_value).

create or replace function public.partner_update_branding(
  p_partner_id uuid,
  p_brand_primary_color text default null,
  p_brand_secondary_color text default null,
  p_brand_text_on_primary text default null,
  p_brand_logo_url text default null,
  p_invoice_sender_name text default null,
  p_invoice_sender_orgnr text default null,
  p_invoice_footer_text text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_partner_manager_of(p_partner_id, auth.uid()) then
    raise exception 'partner manager/admin required' using errcode = '42501';
  end if;

  if p_invoice_sender_orgnr is not null
     and p_invoice_sender_orgnr <> ''
     and not public.is_valid_norwegian_orgnr(p_invoice_sender_orgnr) then
    raise exception 'invalid Norwegian orgnr: %', p_invoice_sender_orgnr
      using errcode = '22023';
  end if;

  update public.partner_organizations
  set brand_primary_color   = coalesce(p_brand_primary_color, brand_primary_color),
      brand_secondary_color = coalesce(p_brand_secondary_color, brand_secondary_color),
      brand_text_on_primary = coalesce(p_brand_text_on_primary, brand_text_on_primary),
      brand_logo_url        = coalesce(p_brand_logo_url, brand_logo_url),
      invoice_sender_name   = coalesce(p_invoice_sender_name, invoice_sender_name),
      invoice_sender_orgnr  = coalesce(p_invoice_sender_orgnr, invoice_sender_orgnr),
      invoice_footer_text   = coalesce(p_invoice_footer_text, invoice_footer_text),
      updated_at            = now()
  where id = p_partner_id;
end;
$$;

grant execute on function public.partner_update_branding(
  uuid, text, text, text, text, text, text, text
) to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 3. CHECK constraint — defense in depth against direct table writes
-- ───────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_org_orgnr_valid_chk'
  ) then
    alter table public.partner_organizations
      add constraint partner_org_orgnr_valid_chk
      check (
        invoice_sender_orgnr is null
        or invoice_sender_orgnr = ''
        or public.is_valid_norwegian_orgnr(invoice_sender_orgnr)
      );
  end if;
end$$;
