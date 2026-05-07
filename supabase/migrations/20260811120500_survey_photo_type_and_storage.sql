-- Photo question type for surveys + Storage bucket with org-prefix RLS.
--
-- Mirrors the compliance pattern from
-- 20260807140000_compliance_checklist_files_storage.sql +
-- 20260809120000_compliance_hardening_attachment_immutability_and_retention.sql:
-- private bucket, three policies (insert/select/delete) gated by
-- (storage.foldername(name))[1] = current_org_id()::text, plus a
-- frozen-attachment guard that prevents delete or overwrite of files
-- referenced by responses to a published+locked survey.
--
-- Storage path convention enforced by RLS:
--   {org_id}/{survey_id}/{question_id}/{uuid-prefixed-filename}
--
-- Photo answers store the storage path in org_survey_answers.answer_text.
-- Single photo per answer in v1; multi-photo arrays land in a follow-up
-- if needed (the bucket + RLS pattern accommodates either by changing
-- the answer storage format, not the bucket policies).

-- ── 1. survey_question_type enum: add 'photo' ──────────────────────────────

alter type public.survey_question_type add value if not exists 'photo';

-- ── 2. Storage bucket ──────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('survey_files', 'survey_files', false)
on conflict (id) do nothing;

-- ── 3. Frozen-attachment helper ────────────────────────────────────────────
-- Returns true when the Storage path is referenced by an answer on a
-- response to a survey with published_definition_locked=true. The lock
-- gates compliance + vendor packs (Commit 6). Other packs' photos
-- remain replaceable.

create or replace function public.survey_attachment_is_frozen(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_survey_answers a
    join public.org_survey_responses r on r.id = a.response_id
    join public.surveys s on s.id = r.survey_id
    where a.answer_text = p_object_name
      and s.published_definition_locked = true
  );
$$;

revoke all on function public.survey_attachment_is_frozen(text) from public, anon;
grant execute on function public.survey_attachment_is_frozen(text)
  to authenticated, service_role;

-- ── 4. Storage policies on the new bucket ──────────────────────────────────

drop policy if exists "survey_files_insert_org" on storage.objects;
create policy "survey_files_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'survey_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and not public.survey_attachment_is_frozen(name)
  );

drop policy if exists "survey_files_select_org" on storage.objects;
create policy "survey_files_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'survey_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "survey_files_delete_org" on storage.objects;
create policy "survey_files_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'survey_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and not public.survey_attachment_is_frozen(name)
  );
