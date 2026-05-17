-- Restore SELECT on storage.objects for partner-branding bucket.
-- Regnskapsloven § 10 krever at faktura-PDF kan rendre konsulentens
-- logo; authenticated `storage.from('partner-branding').list/.download`
-- må returnere rader selv om bucket er public for CDN-proxy.
-- Idempotent.

set local search_path = public, pg_catalog;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'partner_branding_storage_read'
  ) then
    create policy partner_branding_storage_read
      on storage.objects for select
      to authenticated, anon
      using (bucket_id = 'partner-branding');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'partner_branding_storage_read'
  ) then
    raise exception
      'partner_branding_storage_read policy missing after migration';
  else
    raise notice
      'partner_branding_storage_read policy verified on storage.objects';
  end if;
end$$;
