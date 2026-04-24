-- Private bucket for HMS incident evidence (skadested / utstyr — unngå identifiserende personbilder).
--
-- Merk: Hendelser lagres i dag i org_module_payloads (JSON). Tilgang filtreres i app etter
-- createdByUserId, melder og valgt nærmeste leder. Streng rad-nivå RLS per hendelse krever
-- egen incidents-tabell med foreign keys.

insert into storage.buckets (id, name, public)
values ('hse_incident_files', 'hse_incident_files', false)
on conflict (id) do nothing;

create policy "hse_incident_files_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'hse_incident_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "hse_incident_files_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hse_incident_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "hse_incident_files_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'hse_incident_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
