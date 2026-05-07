-- Track outbound invitation emails + RPC gate for Edge Function (caller JWT).

alter table public.survey_invitations
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_send_error text;

comment on column public.survey_invitations.email_sent_at is 'When survey invite email was sent (Resend / Edge)';
comment on column public.survey_invitations.email_send_error is 'Last send failure message if delivery failed';

create or replace function public.survey_check_distribution_send_access(
  p_distribution_id uuid,
  p_survey_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select s.organization_id into v_org
  from public.survey_distributions d
  join public.surveys s on s.id = d.survey_id
  where d.id = p_distribution_id
    and d.survey_id = p_survey_id
    and d.organization_id = s.organization_id;

  if v_org is null then
    raise exception 'Not found';
  end if;

  if (select organization_id from public.profiles where id = auth.uid()) is distinct from v_org then
    raise exception 'Forbidden';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('survey.manage')) then
    raise exception 'Forbidden';
  end if;
end;
$$;

grant execute on function public.survey_check_distribution_send_access(uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
