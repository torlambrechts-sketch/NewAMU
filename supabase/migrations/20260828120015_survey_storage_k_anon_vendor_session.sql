-- Survey batch: private storage for response files, anonymous session dedupe,
-- RPC for aggregation counts under k-anonymity, vendor/external invite gate helper.

-- ── 1) Respondent session token (anonymous dedupe — C6) ───────────────────────

alter table public.org_survey_responses
  add column if not exists respondent_session_token text;

comment on column public.org_survey_responses.respondent_session_token is
  'Opaque client token per browser/session for anonymous surveys — prevents duplicate submits';

create unique index if not exists org_survey_responses_survey_session_uidx
  on public.org_survey_responses (survey_id, respondent_session_token)
  where respondent_session_token is not null;

-- ── 2) Private bucket for survey uploads (path = org / response / question / file) ─

insert into storage.buckets (id, name, public)
values ('survey_response_files', 'survey_response_files', false)
on conflict (id) do nothing;

drop policy if exists survey_response_files_insert_anon on storage.objects;
create policy survey_response_files_insert_anon
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'survey_response_files'
    and exists (
      select 1
      from public.org_survey_responses r
      join public.surveys s on s.id = r.survey_id
      where r.organization_id::text = (storage.foldername(name))[1]
        and r.id::text = (storage.foldername(name))[2]
        and r.survey_id = s.id
        and s.status = 'active'
    )
  );

drop policy if exists survey_response_files_insert_auth on storage.objects;
create policy survey_response_files_insert_auth
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'survey_response_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and exists (
      select 1
      from public.org_survey_responses r
      where r.organization_id = public.current_org_id()
        and r.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists survey_response_files_select_org on storage.objects;
create policy survey_response_files_select_org
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'survey_response_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists survey_response_files_delete_org on storage.objects;
create policy survey_response_files_delete_org
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'survey_response_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (
      public.is_org_admin()
      or public.user_has_permission('survey.manage')
    )
  );

-- ── 3) K-anonymity: aggregate counts only when enough completed responses (C3) ─

create or replace function public.survey_question_choice_counts_for_org(
  p_survey_id uuid,
  p_question_id uuid,
  p_min_completed int default 5
)
returns table (choice_label text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $$
  with surv as (
    select s.id, s.organization_id, s.anonymity_threshold
    from public.surveys s
    where s.id = p_survey_id
      and s.organization_id = public.current_org_id()
  ),
  completed as (
    select count(*)::bigint as n
    from public.org_survey_responses r, surv sv
    where r.survey_id = sv.id
      and r.organization_id = sv.organization_id
  ),
  threshold as (
    select greatest(coalesce((select anonymity_threshold from surv), p_min_completed), p_min_completed) as t
  ),
  raw_counts as (
    select trim(coalesce(a.answer_text, '')) as lbl, count(*)::bigint as c
    from public.org_survey_answers a
    join public.org_survey_responses r on r.id = a.response_id
    join surv sv on sv.id = r.survey_id
    where a.question_id = p_question_id
      and a.organization_id = sv.organization_id
      and trim(coalesce(a.answer_text, '')) <> ''
    group by 1
  )
  select lbl as choice_label, c as cnt
  from raw_counts, completed, threshold
  where (select n from completed) >= (select t from threshold)
    and lbl is not null;
$$;

grant execute on function public.survey_question_choice_counts_for_org(uuid, uuid, int) to authenticated;

comment on function public.survey_question_choice_counts_for_org is
  'Returns per-option counts only when completed response count meets survey anonymity_threshold (serverside k-anonymity gate).';

-- ── 4) Strict invitation requirement for vendor / external surveys (C4 helper) ─

create or replace function public.survey_external_requires_personal_link(p_survey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.survey_type, 'internal') <> 'internal'
    or length(trim(coalesce(s.vendor_name, ''))) > 0
  from public.surveys s
  where s.id = p_survey_id;
$$;

grant execute on function public.survey_external_requires_personal_link(uuid) to anon;
grant execute on function public.survey_external_requires_personal_link(uuid) to authenticated;

notify pgrst, 'reload schema';
