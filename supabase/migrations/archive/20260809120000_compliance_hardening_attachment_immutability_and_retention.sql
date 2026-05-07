-- Compliance hardening — gaps A + B from the audit-trail review.
--
-- Gap A: photo attachments could be deleted (or overwritten via upsert)
-- behind a signed execution because Storage RLS only checked org
-- ownership, not whether the file was referenced by a signed response.
-- A privileged user could swap evidence out from under a tamper-locked
-- execution.
--
-- Gap B: the BEFORE UPDATE triggers prevent edits on signed executions
-- and their responses, but BEFORE DELETE was uncovered. Service-role or
-- direct-DB access could DELETE FROM compliance_checklist_executions
-- (or responses) and leave only an audit-log entry of the delete; the
-- original signed evidence would be gone.
--
-- This migration adds:
--   1. compliance_attachment_is_frozen(name) — helper that returns true
--      if a Storage path is referenced by any response on a signed
--      execution.
--   2. Updated DELETE policy on storage.objects in compliance_checklist_files
--      that denies delete when the file is frozen.
--   3. BEFORE DELETE trigger on compliance_checklist_executions blocking
--      hard-delete of any execution with signed_at IS NOT NULL.
--   4. BEFORE DELETE trigger on compliance_checklist_responses blocking
--      delete when the parent execution is signed.
--
-- All four are additive — no schema changes, no breaking changes for
-- non-signed data flows.

-- ── Gap A: frozen-attachment helper + Storage policy ───────────────────

create or replace function public.compliance_attachment_is_frozen(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.compliance_checklist_responses r
    join public.compliance_checklist_executions e on e.id = r.execution_id
    where e.status = 'signed'
      and r.value ? 'urls'
      and r.value->'urls' @> to_jsonb(array[p_object_name])
  );
$$;

revoke all on function public.compliance_attachment_is_frozen(text) from public, anon;
grant execute on function public.compliance_attachment_is_frozen(text)
  to authenticated, service_role;

-- Replace the DELETE policy from 20260807140000_compliance_checklist_files_storage
-- with a stricter version that also rejects when the path is frozen.
drop policy if exists "compliance_checklist_files_delete_org" on storage.objects;
create policy "compliance_checklist_files_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'compliance_checklist_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and not public.compliance_attachment_is_frozen(name)
  );

-- INSERT policy gets the same guard — Supabase Storage upsert routes
-- through INSERT-on-conflict, which would let an upload overwrite a
-- frozen path. Explicitly reject.
drop policy if exists "compliance_checklist_files_insert_org" on storage.objects;
create policy "compliance_checklist_files_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'compliance_checklist_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and not public.compliance_attachment_is_frozen(name)
  );

-- ── Gap B: block hard-delete of signed executions + their responses ────

create or replace function public.compliance_checklist_executions_block_delete_signed()
returns trigger
language plpgsql
as $$
begin
  if old.signed_at is not null then
    raise exception
      'Signed execution % cannot be deleted (retention enforcement). Soft-delete via deleted_at is permitted only via a future archival workflow.',
      old.id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists compliance_checklist_executions_block_delete_signed_tg
  on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_block_delete_signed_tg
  before delete on public.compliance_checklist_executions
  for each row execute function public.compliance_checklist_executions_block_delete_signed();

create or replace function public.compliance_checklist_responses_block_delete_when_signed()
returns trigger
language plpgsql
as $$
declare
  v_status public.inspection_round_status;
begin
  select e.status into v_status
  from public.compliance_checklist_executions e
  where e.id = old.execution_id;

  -- If the execution row is gone (CASCADE from above), allow the cascade
  -- delete to proceed. The execution-level block already prevents the
  -- cascade chain from starting on signed executions.
  if v_status is null then
    return old;
  end if;

  if v_status = 'signed' then
    raise exception
      'Cannot delete responses on signed execution % (retention enforcement).',
      old.execution_id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists compliance_checklist_responses_block_delete_when_signed_tg
  on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_block_delete_when_signed_tg
  before delete on public.compliance_checklist_responses
  for each row execute function public.compliance_checklist_responses_block_delete_when_signed();
