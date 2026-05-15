-- Alerts module — private storage bucket for case attachments.
--
-- Self-audit: bucket is private (public = false). No public read policy.
-- Reads happen via signed URLs only (60s TTL — UI layer enforces). RLS on
-- storage.objects gates writes to authenticated session inside the user's
-- org; reads gated to alerts.committee+ via case row visibility (§4.1 T6).
--
-- Idempotent.

set local search_path = public, pg_catalog;

-- Create the bucket if missing
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alert-attachments',
  'alert-attachments',
  false,
  20 * 1024 * 1024,                  -- 20 MB cap per file
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png','image/jpeg','image/gif','image/webp',
    'text/plain','text/csv','text/markdown',
    'application/zip','application/x-zip-compressed',
    'audio/mpeg','audio/wav','audio/ogg',
    'video/mp4','video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read policy: bucket objects readable only by users who can see the
-- corresponding case (via alert_case_attachments RLS join).
drop policy if exists alert_attachments_read on storage.objects;
create policy alert_attachments_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'alert-attachments'
    and exists (
      select 1
      from public.alert_case_attachments a
      where a.storage_bucket = 'alert-attachments'
        and a.storage_path = storage.objects.name
        and a.is_redacted = false
    )
  );

-- Insert policy: authenticated users (committee or reporter) can upload to a
-- path prefixed with their org id; the storage path convention enforced at
-- the application layer is `<org_id>/<case_id>/<random_uuid>-<filename>`.
drop policy if exists alert_attachments_write on storage.objects;
create policy alert_attachments_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'alert-attachments'
    and split_part(name, '/', 1) = public.current_org_id()::text
  );

-- Delete policy: committee only (purge function uses service_role and bypasses).
drop policy if exists alert_attachments_delete on storage.objects;
create policy alert_attachments_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'alert-attachments'
    and split_part(name, '/', 1) = public.current_org_id()::text
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
    )
  );

-- Anonymous public-form attachment upload path: the captcha Edge Function
-- uses the service_role key to insert directly (bypasses RLS). No policy
-- needed for that path.
