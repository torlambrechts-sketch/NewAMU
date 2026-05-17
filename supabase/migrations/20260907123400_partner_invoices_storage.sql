-- Partner Console v0 — private Storage bucket for invoice CSV exports.
--
-- The partner-invoice-csv edge function writes a CSV at
-- `<partner_id>/<invoice_id>.csv` and returns a signed URL with a short
-- TTL. The bucket is private; no public read policy. Per-partner
-- isolation enforced by checking the path's first segment against the
-- caller's partner_memberships.
--
-- Self-audit: faktura-CSV inneholder ansatt-navn, beskrivelse av
-- arbeid og timepris — det utgjør identifiserbare personopplysninger
-- om konsulenten samt forretningssensitiv kunde-info. GDPR Art. 32
-- krever konfidensialitet; derfor private bucket + RLS-prefiks-sjekk
-- + edge-function-mediert nedlasting via signert URL.
--
-- Idempotent.

set local search_path = public, pg_catalog;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-invoices',
  'partner-invoices',
  false,
  10 * 1024 * 1024,
  array['text/csv', 'application/pdf', 'application/zip']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: only members of the partner firm whose id is the first
-- path segment.
drop policy if exists partner_invoices_storage_read on storage.objects;
create policy partner_invoices_storage_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'partner-invoices'
    and public.is_partner_member_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

-- Write: manager/admin only. The edge function uses the service_role
-- key and bypasses this policy, but the policy still guards any
-- accidental direct uploads from the client.
drop policy if exists partner_invoices_storage_write on storage.objects;
create policy partner_invoices_storage_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'partner-invoices'
    and public.is_partner_manager_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

drop policy if exists partner_invoices_storage_update on storage.objects;
create policy partner_invoices_storage_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'partner-invoices'
    and public.is_partner_manager_of(
      nullif(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

-- Delete: admin only (managers cannot purge billing trail).
drop policy if exists partner_invoices_storage_delete on storage.objects;
create policy partner_invoices_storage_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'partner-invoices'
    and exists (
      select 1 from public.partner_memberships m
      where m.partner_id = nullif(split_part(storage.objects.name, '/', 1), '')::uuid
        and m.user_id = auth.uid()
        and m.active = true
        and m.role = 'admin'
    )
  );
