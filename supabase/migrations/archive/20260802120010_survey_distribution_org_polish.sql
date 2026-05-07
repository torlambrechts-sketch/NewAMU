-- Org directory ↔ auth user; distribution scheduling & locations; invitation email tracking.

-- 1) Optional link from directory row to login user (preferred over email-only match for surveys/teams)
alter table public.organization_members
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists organization_members_user_idx
  on public.organization_members (user_id)
  where user_id is not null;

comment on column public.organization_members.user_id is 'Optional link to auth user when directory row matches a profile login';

-- 2) Scheduled bulk send + location audience
alter table public.survey_distributions
  add column if not exists scheduled_initial_send_at timestamptz,
  add column if not exists initial_send_started_at timestamptz,
  add column if not exists audience_location_ids uuid[] default '{}'::uuid[];

comment on column public.survey_distributions.scheduled_initial_send_at is 'When set, auto-send initial invites at or after this time (Edge cron)';
comment on column public.survey_distributions.initial_send_started_at is 'Set when automated initial send batch has run';

alter table public.survey_distributions
  drop constraint if exists survey_distributions_audience_type_check;

alter table public.survey_distributions
  add constraint survey_distributions_audience_type_check
  check (audience_type in ('all', 'departments', 'teams', 'locations'));

-- 3) Resend / reminder counters
alter table public.survey_invitations
  add column if not exists resend_email_id text,
  add column if not exists reminder_count int not null default 0,
  add column if not exists email_delivery_status text;

comment on column public.survey_invitations.resend_email_id is 'Last Resend email id (for webhook correlation)';
comment on column public.survey_invitations.reminder_count is 'Number of reminder emails sent';

-- 4) When all invitations for a survey have completed, emit workflow event once per survey (idempotent via not exists pending)
create or replace function public.trg_survey_invitations_all_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey uuid;
  v_org uuid;
  v_pending int;
begin
  if TG_OP <> 'UPDATE' then
    return new;
  end if;
  if new.status is distinct from 'completed' then
    return new;
  end if;

  v_survey := new.survey_id;
  select organization_id into v_org from public.surveys where id = v_survey;
  if v_org is null then
    return new;
  end if;

  select count(*)::int into v_pending
  from public.survey_invitations
  where survey_id = v_survey
    and organization_id = v_org
    and status = 'pending';

  if v_pending > 0 then
    return new;
  end if;

  perform public.workflow_dispatch_db_event(
    v_org,
    'survey',
    'ON_SURVEY_ALL_INVITATIONS_COMPLETED',
    jsonb_build_object(
      'id', v_survey::text,
      'survey_id', v_survey,
      'organization_id', v_org,
      'event', 'ON_SURVEY_ALL_INVITATIONS_COMPLETED'
    )
  );

  return new;
end;
$$;

drop trigger if exists survey_invitations_all_completed_tg on public.survey_invitations;
create trigger survey_invitations_all_completed_tg
  after update of status on public.survey_invitations
  for each row
  when (new.status = 'completed')
  execute function public.trg_survey_invitations_all_completed();

drop policy if exists survey_invitations_select_self on public.survey_invitations;
create policy survey_invitations_select_self
  on public.survey_invitations for select to authenticated
  using (profile_id = auth.uid());

create or replace function public.survey_get_org_settings(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id then
    raise exception 'Forbidden';
  end if;
  select p.payload into v_payload
  from public.org_module_payloads p
  where p.organization_id = p_organization_id
    and p.module_key = 'survey_settings'
  limit 1;
  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

grant execute on function public.survey_get_org_settings(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
