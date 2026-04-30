-- Extend survey analytics RPCs: multi_select token split, numeric stats for k-anonymity (C3).

alter table public.surveys
  add column if not exists anonymity_threshold int not null default 5
    check (anonymity_threshold > 0);

create or replace function public.survey_question_choice_counts_for_org(
  p_survey_id uuid,
  p_question_id uuid,
  p_min_completed int default 5
)
returns table (choice_label text, cnt bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_threshold int;
  v_completed bigint;
  v_qtype text;
begin
  select s.organization_id, greatest(coalesce(s.anonymity_threshold, p_min_completed), p_min_completed)
  into v_org, v_threshold
  from public.surveys s
  where s.id = p_survey_id
    and s.organization_id = public.current_org_id();

  if v_org is null then
    return;
  end if;

  select count(*)::bigint into v_completed
  from public.org_survey_responses r
  where r.survey_id = p_survey_id
    and r.organization_id = v_org;

  if v_completed < v_threshold then
    return;
  end if;

  select q.question_type into v_qtype
  from public.org_survey_questions q
  where q.id = p_question_id
    and q.survey_id = p_survey_id
    and q.organization_id = v_org;

  if v_qtype is null then
    return;
  end if;

  if v_qtype = 'multi_select' then
    return query
      select trim(both from t.token) as choice_label, count(*)::bigint as cnt
      from public.org_survey_answers a
      cross join lateral regexp_split_to_table(coalesce(a.answer_text, ''), '\|') as t(token)
      join public.org_survey_responses r on r.id = a.response_id
      where a.question_id = p_question_id
        and a.organization_id = v_org
        and r.survey_id = p_survey_id
        and trim(both from t.token) <> ''
      group by 1
      order by 2 desc;
    return;
  end if;

  return query
    select trim(coalesce(a.answer_text, '')) as choice_label, count(*)::bigint as cnt
    from public.org_survey_answers a
    join public.org_survey_responses r on r.id = a.response_id
    where a.question_id = p_question_id
      and a.organization_id = v_org
      and r.survey_id = p_survey_id
      and trim(coalesce(a.answer_text, '')) <> ''
    group by 1
    order by 2 desc;
end;
$$;

grant execute on function public.survey_question_choice_counts_for_org(uuid, uuid, int) to authenticated;

create or replace function public.survey_question_numeric_stats_for_org(
  p_survey_id uuid,
  p_question_id uuid,
  p_min_completed int default 5
)
returns table (avg_val numeric, n bigint, min_val numeric, max_val numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_threshold int;
  v_completed bigint;
begin
  select s.organization_id, greatest(coalesce(s.anonymity_threshold, p_min_completed), p_min_completed)
  into v_org, v_threshold
  from public.surveys s
  where s.id = p_survey_id
    and s.organization_id = public.current_org_id();

  if v_org is null then
    return;
  end if;

  select count(*)::bigint into v_completed
  from public.org_survey_responses r
  where r.survey_id = p_survey_id
    and r.organization_id = v_org;

  if v_completed < v_threshold then
    return;
  end if;

  return query
  select
    avg(v.x)::numeric,
    count(*)::bigint,
    min(v.x)::numeric,
    max(v.x)::numeric
  from (
    select coalesce(
      a.answer_value::numeric,
      case
        when trim(coalesce(a.answer_text, '')) = '' then null
        else trim(a.answer_text)::numeric
      end
    ) as x
    from public.org_survey_answers a
    join public.org_survey_responses r on r.id = a.response_id
    where a.question_id = p_question_id
      and a.organization_id = v_org
      and r.survey_id = p_survey_id
  ) v
  where v.x is not null;
end;
$$;

grant execute on function public.survey_question_numeric_stats_for_org(uuid, uuid, int) to authenticated;

comment on function public.survey_question_numeric_stats_for_org is
  'Mean/min/max/count for numeric answers when survey response count meets anonymity_threshold (serverside gate).';

notify pgrst, 'reload schema';
