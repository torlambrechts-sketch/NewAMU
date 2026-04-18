-- ═══════════════════════════════════════════════════════════════════════════
-- SURVEY MODULE — Row-level security (membership + grants)
-- Membership is based on public.profiles.organization_id. The spec referenced
-- organization_members.user_id, which is not present in this repo’s org schema.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: is caller a member of the row's organization? (see profiles, not org chart rows)
create or replace function public.survey_is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = org_id
  );
$$;

alter table public.survey_campaigns enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_results_cache enable row level security;
alter table public.survey_action_plans enable row level security;
alter table public.survey_amu_reviews enable row level security;

-- strip previous policies (from 20260723000000_survey_module_core)
drop policy if exists survey_campaigns_select on public.survey_campaigns;
drop policy if exists survey_campaigns_insert on public.survey_campaigns;
drop policy if exists survey_campaigns_update on public.survey_campaigns;
drop policy if exists survey_campaigns_delete on public.survey_campaigns;

drop policy if exists survey_questions_select on public.survey_questions;
drop policy if exists survey_questions_all on public.survey_questions;

drop policy if exists survey_responses_select on public.survey_responses;
drop policy if exists survey_responses_insert on public.survey_responses;
drop policy if exists survey_responses_update on public.survey_responses;
drop policy if exists survey_responses_delete on public.survey_responses;

drop policy if exists survey_results_cache_select on public.survey_results_cache;
drop policy if exists survey_results_cache_write on public.survey_results_cache;

drop policy if exists survey_action_plans_select on public.survey_action_plans;
drop policy if exists survey_action_plans_write on public.survey_action_plans;

drop policy if exists survey_amu_reviews_select on public.survey_amu_reviews;
drop policy if exists survey_amu_reviews_write on public.survey_amu_reviews;

-- survey_campaigns
create policy "survey_campaigns_select" on public.survey_campaigns
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

create policy "survey_campaigns_insert" on public.survey_campaigns
  for insert to authenticated
  with check (public.survey_is_org_member(organization_id));

create policy "survey_campaigns_update" on public.survey_campaigns
  for update to authenticated
  using (
    public.survey_is_org_member(organization_id)
    and status is distinct from 'archived'
  )
  with check (public.survey_is_org_member(organization_id));

-- survey_questions
create policy "survey_questions_select" on public.survey_questions
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

create policy "survey_questions_write" on public.survey_questions
  for all to authenticated
  using (public.survey_is_org_member(organization_id))
  with check (public.survey_is_org_member(organization_id));

-- survey_responses: anonymous insert (after trigger sets org from question); org members can read
create policy "survey_responses_insert" on public.survey_responses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.survey_campaigns sc
      where sc.id = survey_responses.campaign_id
        and sc.status = 'open'
        and sc.organization_id = survey_responses.organization_id
        and (sc.opens_at is null or sc.opens_at <= now())
        and (sc.closes_at is null or sc.closes_at >= now())
    )
  );

create policy "survey_responses_select" on public.survey_responses
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

-- survey_results_cache
create policy "survey_results_select" on public.survey_results_cache
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

create policy "survey_results_write" on public.survey_results_cache
  for all to authenticated
  using (public.survey_is_org_member(organization_id))
  with check (public.survey_is_org_member(organization_id));

-- survey_action_plans
create policy "survey_actions_select" on public.survey_action_plans
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

create policy "survey_actions_write" on public.survey_action_plans
  for all to authenticated
  using (public.survey_is_org_member(organization_id))
  with check (public.survey_is_org_member(organization_id));

-- survey_amu_reviews
create policy "survey_amu_select" on public.survey_amu_reviews
  for select to authenticated
  using (public.survey_is_org_member(organization_id));

create policy "survey_amu_write" on public.survey_amu_reviews
  for all to authenticated
  using (public.survey_is_org_member(organization_id))
  with check (public.survey_is_org_member(organization_id));

-- Grants (narrower than 20260723000000: no delete on campaigns, action plans, AMU; no update/delete on responses)
revoke all on public.survey_campaigns from authenticated;
revoke all on public.survey_questions from authenticated;
revoke all on public.survey_responses from authenticated;
revoke all on public.survey_results_cache from authenticated;
revoke all on public.survey_action_plans from authenticated;
revoke all on public.survey_amu_reviews from authenticated;

grant select, insert, update on public.survey_campaigns to authenticated;
grant select, insert, update, delete on public.survey_questions to authenticated;
grant select, insert on public.survey_responses to authenticated;
grant select, insert, update, delete on public.survey_results_cache to authenticated;
grant select, insert, update on public.survey_action_plans to authenticated;
grant select, insert, update on public.survey_amu_reviews to authenticated;

-- BEFORE INSERT: org + created_by (replaces per-table helpers from core migration)
create or replace function public.survey_fill_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    select p.organization_id into new.organization_id
    from public.profiles p
    where p.id = auth.uid();
  end if;
  if TG_TABLE_NAME in ('survey_campaigns', 'survey_action_plans', 'survey_amu_reviews') then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_campaigns_before_insert_tg on public.survey_campaigns;
create trigger survey_campaigns_fill_org
  before insert on public.survey_campaigns
  for each row execute function public.survey_fill_org_id();

drop trigger if exists survey_action_plans_before_insert_tg on public.survey_action_plans;
create trigger survey_action_plans_fill_org
  before insert on public.survey_action_plans
  for each row execute function public.survey_fill_org_id();

drop trigger if exists survey_amu_reviews_before_insert_tg on public.survey_amu_reviews;
create trigger survey_amu_reviews_fill_org
  before insert on public.survey_amu_reviews
  for each row execute function public.survey_fill_org_id();

-- Remove superseded before-insert functions (triggers were dropped above)
drop function if exists public.survey_campaigns_before_insert();
drop function if exists public.survey_action_plans_before_insert();
drop function if exists public.survey_amu_reviews_before_insert();
