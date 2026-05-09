-- Surveys: response_count + invitation_count cached aggregates.
--
-- The /survey/analyse page declares survey_kpi_summary.responses and
-- responseRatePct datasets, but the page can't compute them today
-- because we don't load per-response data on the analyse list view —
-- responses tile renders 0. Two cached counts on the surveys row fix
-- this without adding a join on every list query.
--
-- response_count    — count of org_survey_responses rows.
-- invitation_count  — count of survey_invitations rows. Pair with
-- response_count to compute response rate (responses / invitations).
--
-- Both are maintained by AFTER INSERT/DELETE triggers on the source
-- tables. Backfill at the end. Idempotent: re-running this migration
-- on a fully-applied DB just recomputes the counts (no-op on values).

set local search_path = public, pg_catalog;

alter table public.surveys
  add column if not exists response_count    integer not null default 0,
  add column if not exists invitation_count  integer not null default 0;

-- ── Triggers: bump cached counts on response insert / delete ──────────────

create or replace function public.surveys_bump_response_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_delta     integer;
begin
  if (tg_op = 'INSERT') then
    v_survey_id := new.survey_id;
    v_delta := 1;
  elsif (tg_op = 'DELETE') then
    v_survey_id := old.survey_id;
    v_delta := -1;
  else
    return null;
  end if;

  update public.surveys
     set response_count = greatest(0, response_count + v_delta)
   where id = v_survey_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists org_survey_responses_bump_count_ai_tg on public.org_survey_responses;
create trigger org_survey_responses_bump_count_ai_tg
  after insert on public.org_survey_responses
  for each row execute function public.surveys_bump_response_count();

drop trigger if exists org_survey_responses_bump_count_ad_tg on public.org_survey_responses;
create trigger org_survey_responses_bump_count_ad_tg
  after delete on public.org_survey_responses
  for each row execute function public.surveys_bump_response_count();

-- ── Triggers: bump cached counts on invitation insert / delete ────────────

create or replace function public.surveys_bump_invitation_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_delta     integer;
begin
  if (tg_op = 'INSERT') then
    v_survey_id := new.survey_id;
    v_delta := 1;
  elsif (tg_op = 'DELETE') then
    v_survey_id := old.survey_id;
    v_delta := -1;
  else
    return null;
  end if;

  update public.surveys
     set invitation_count = greatest(0, invitation_count + v_delta)
   where id = v_survey_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists survey_invitations_bump_count_ai_tg on public.survey_invitations;
create trigger survey_invitations_bump_count_ai_tg
  after insert on public.survey_invitations
  for each row execute function public.surveys_bump_invitation_count();

drop trigger if exists survey_invitations_bump_count_ad_tg on public.survey_invitations;
create trigger survey_invitations_bump_count_ad_tg
  after delete on public.survey_invitations
  for each row execute function public.surveys_bump_invitation_count();

-- ── Backfill from current data ─────────────────────────────────────────────

update public.surveys s
   set response_count = coalesce(c.cnt, 0)
  from (
    select survey_id, count(*) as cnt
      from public.org_survey_responses
     group by survey_id
  ) c
 where c.survey_id = s.id
   and s.response_count is distinct from coalesce(c.cnt, 0);

update public.surveys s
   set invitation_count = coalesce(c.cnt, 0)
  from (
    select survey_id, count(*) as cnt
      from public.survey_invitations
     group by survey_id
  ) c
 where c.survey_id = s.id
   and s.invitation_count is distinct from coalesce(c.cnt, 0);
