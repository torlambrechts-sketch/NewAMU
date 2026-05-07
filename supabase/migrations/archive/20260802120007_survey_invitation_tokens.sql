-- Personal invitation links: opaque token per invitation row + RPC to attach response after insert.

alter table public.survey_invitations
  add column if not exists access_token text;

create unique index if not exists survey_invitations_access_token_uidx
  on public.survey_invitations (access_token)
  where access_token is not null;

comment on column public.survey_invitations.access_token is 'Opaque secret for /survey-respond/:surveyId?invite= — set when invitations are generated';

create or replace function public.survey_complete_invitation_for_response(
  p_response_id uuid,
  p_access_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  resp record;
  survey_anon boolean;
begin
  if p_access_token is null or length(trim(p_access_token)) < 16 then
    return false;
  end if;

  select id, survey_id, organization_id, profile_id, status
  into inv
  from public.survey_invitations
  where access_token = trim(p_access_token)
    and status = 'pending';

  if inv.id is null then
    return false;
  end if;

  select id, survey_id, organization_id, user_id
  into resp
  from public.org_survey_responses
  where id = p_response_id;

  if resp.id is null then
    return false;
  end if;

  if resp.survey_id <> inv.survey_id or resp.organization_id <> inv.organization_id then
    return false;
  end if;

  select coalesce(is_anonymous, false)
  into survey_anon
  from public.surveys
  where id = resp.survey_id;

  if survey_anon then
    if resp.user_id is not null then
      return false;
    end if;
  else
    if resp.user_id is null or resp.user_id <> inv.profile_id then
      return false;
    end if;
  end if;

  update public.survey_invitations
  set status = 'completed',
      response_id = p_response_id,
      updated_at = now()
  where id = inv.id;

  return true;
end;
$$;

grant execute on function public.survey_complete_invitation_for_response(uuid, text) to authenticated;
grant execute on function public.survey_complete_invitation_for_response(uuid, text) to anon;

select pg_notify('pgrst', 'reload schema');
