-- Private bucket for external training proof files (PDF/images).

insert into storage.buckets (id, name, public)
values ('learning_external_certs', 'learning_external_certs', false)
on conflict (id) do nothing;

create policy "learning_ext_cert_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'learning_external_certs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "learning_ext_cert_read_own"
  on storage.objects for select
  using (
    bucket_id = 'learning_external_certs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
