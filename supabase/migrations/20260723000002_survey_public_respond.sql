-- Anonymous survey response: read questions + open campaign; insert responses (no auth)
-- Requires 20260723000000_survey_module_core.sql (creates survey_* tables). Apply migrations
-- in filename order, or run the core migration before this file in the SQL editor.
do $survey_public_prereq$
begin
  if to_regclass('public.survey_questions') is null then
    raise exception
      'public.survey_questions does not exist. Run migration 20260723000000_survey_module_core.sql first (survey tables must exist before anonymous policies).';
  end if;
end
$survey_public_prereq$;

grant usage on schema public to anon;

grant select on public.survey_questions to anon;
grant select on public.survey_campaigns to anon;
grant insert on public.survey_responses to anon;

drop policy if exists survey_questions_select_anon on public.survey_questions;
create policy survey_questions_select_anon on public.survey_questions
  for select to anon
  using (
    deleted_at is null
    and exists (
      select 1 from public.survey_campaigns c
      where c.id = survey_questions.campaign_id
        and c.status = 'open'
        and (c.opens_at is null or c.opens_at <= now())
        and (c.closes_at is null or c.closes_at >= now())
    )
  );

drop policy if exists survey_campaigns_select_anon on public.survey_campaigns;
create policy survey_campaigns_select_anon on public.survey_campaigns
  for select to anon
  using (
    status = 'open'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  );

drop policy if exists survey_responses_insert_anon on public.survey_responses;
create policy survey_responses_insert_anon on public.survey_responses
  for insert to anon
  with check (
    exists (
      select 1 from public.survey_campaigns sc
      where sc.id = survey_responses.campaign_id
        and sc.status = 'open'
        and sc.organization_id = survey_responses.organization_id
        and (sc.opens_at is null or sc.opens_at <= now())
        and (sc.closes_at is null or sc.closes_at >= now())
    )
    and exists (
      select 1 from public.survey_questions q
      where q.id = survey_responses.question_id
        and q.campaign_id = survey_responses.campaign_id
        and q.organization_id = survey_responses.organization_id
        and q.deleted_at is null
    )
  );
