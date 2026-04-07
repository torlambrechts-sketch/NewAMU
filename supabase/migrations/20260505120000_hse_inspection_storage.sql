-- Private bucket for HMS inspection photos and official external PDF reports.

insert into storage.buckets (id, name, public)
values ('hse_inspection_files', 'hse_inspection_files', false)
on conflict (id) do nothing;

create policy "hse_inspection_files_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'hse_inspection_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "hse_inspection_files_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hse_inspection_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "hse_inspection_files_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'hse_inspection_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
