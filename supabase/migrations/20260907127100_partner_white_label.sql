-- Partner Console v0 → P3-#9 white-label: bounded brand customization.
--
-- Regnskapsloven § 10 + bokføringsforskriften § 5-1-1 krever at faktura
-- viser selgers navn + orgnr + tydelig avsender. Konsulent-firmaet er
-- selger, ikke kunden — derfor må PDF/e-post bære KONSULENTENS branding.
-- P3-#9 leverer minimum-viable hvit-merking: logo + 3 farger + faktura-
-- avsenderblokk. INGEN fri CSS-injeksjon (XSS-vektor); kun begrensede
-- design-tokens som dashbord/PDF/e-post-templates kan lese.
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- ───────────────────────────────────────────────────────────────────
-- 1. partner_organizations — extend with bounded brand tokens
-- ───────────────────────────────────────────────────────────────────

alter table public.partner_organizations
  add column if not exists brand_logo_url text;

alter table public.partner_organizations
  add column if not exists brand_primary_color text default '#1a3d32';

alter table public.partner_organizations
  add column if not exists brand_secondary_color text default '#0b6b5b';

alter table public.partner_organizations
  add column if not exists brand_text_on_primary text default '#ffffff';

alter table public.partner_organizations
  add column if not exists invoice_sender_name text;

alter table public.partner_organizations
  add column if not exists invoice_sender_orgnr text;

alter table public.partner_organizations
  add column if not exists invoice_footer_text text;

-- Hex-constraints (idempotent via do-block). A check constraint with a
-- regex enforces format at the DB layer so PDF / email rendering can
-- trust the value blindly (no XSS-prone CSS string).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_organizations_brand_primary_color_hex'
  ) then
    alter table public.partner_organizations
      add constraint partner_organizations_brand_primary_color_hex
      check (brand_primary_color is null or brand_primary_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_organizations_brand_secondary_color_hex'
  ) then
    alter table public.partner_organizations
      add constraint partner_organizations_brand_secondary_color_hex
      check (brand_secondary_color is null or brand_secondary_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_organizations_brand_text_on_primary_hex'
  ) then
    alter table public.partner_organizations
      add constraint partner_organizations_brand_text_on_primary_hex
      check (brand_text_on_primary is null or brand_text_on_primary ~ '^#[0-9a-fA-F]{6}$');
  end if;
end$$;

comment on column public.partner_organizations.brand_logo_url is
  'Storage path inside the partner-branding bucket, e.g. `<partner_id>/logo.png` or `<partner_id>/logo.svg`. Public read by RLS.';
comment on column public.partner_organizations.brand_primary_color is
  'Hex (#rrggbb). Primary brand color for PDF header bar and email accents.';
comment on column public.partner_organizations.brand_secondary_color is
  'Hex (#rrggbb). Secondary accent (used for section headings in branded surfaces).';
comment on column public.partner_organizations.brand_text_on_primary is
  'Hex (#rrggbb). Text color rendered on top of brand_primary_color (contrast pair).';
comment on column public.partner_organizations.invoice_sender_name is
  'Faktura sender label. Falls back to partner_organizations.name when null.';
comment on column public.partner_organizations.invoice_sender_orgnr is
  'Selger orgnr (9 digits, mod-11 verified client-side). Required by regnskapsloven § 10.';
comment on column public.partner_organizations.invoice_footer_text is
  '1-2 line legal footer rendered at the bottom of every faktura PDF.';

-- ───────────────────────────────────────────────────────────────────
-- 2. Storage bucket — partner-branding (public read for logo embed)
-- ───────────────────────────────────────────────────────────────────
--
-- Public read so the same URL can be embedded in plain HTML emails and
-- in PDFs without signed-URL choreography. The bucket only contains
-- logo files chosen by the partner-admin; nothing sensitive.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-branding',
  'partner-branding',
  true,
  200 * 1024,
  array['image/png', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: anyone (bucket is public). Drop legacy if it exists.
drop policy if exists partner_branding_storage_read on storage.objects;

-- Write: manager/admin only. Path's first segment must equal partner_id.
drop policy if exists partner_branding_storage_write on storage.objects;
create policy partner_branding_storage_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'partner-branding'
    and public.is_partner_manager_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

drop policy if exists partner_branding_storage_update on storage.objects;
create policy partner_branding_storage_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'partner-branding'
    and public.is_partner_manager_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

drop policy if exists partner_branding_storage_delete on storage.objects;
create policy partner_branding_storage_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'partner-branding'
    and public.is_partner_manager_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────
-- 3. RPC — partner_update_branding
-- ───────────────────────────────────────────────────────────────────
--
-- Single security-definer entry point so the editor never needs direct
-- update on partner_organizations (which is admin-only by RLS). Each
-- arg is optional and coalesced — callers can patch any subset.

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
