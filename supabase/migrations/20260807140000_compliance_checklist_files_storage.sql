-- Private storage bucket for compliance checklist attachments (photos +
-- signature data when promoted from base64 in jsonb to file uploads).
--
-- Path convention enforced by RLS:
--   {org_id}/{execution_id}/{item_key}/{uuid-prefixed-filename}
--
-- The first path segment is the organization id, which the policies read
-- via storage.foldername(name)[1]. This isolates files by org without a
-- bespoke metadata join — a user from org A cannot read, write, or delete
-- objects under any path that doesn't start with their own org id.
--
-- Mirrors archive/20260505120000_hse_inspection_storage.sql exactly.

insert into storage.buckets (id, name, public)
values ('compliance_checklist_files', 'compliance_checklist_files', false)
on conflict (id) do nothing;

drop policy if exists "compliance_checklist_files_insert_org" on storage.objects;
create policy "compliance_checklist_files_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'compliance_checklist_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "compliance_checklist_files_select_org" on storage.objects;
create policy "compliance_checklist_files_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance_checklist_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "compliance_checklist_files_delete_org" on storage.objects;
create policy "compliance_checklist_files_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'compliance_checklist_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
