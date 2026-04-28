-- Teams as audience + reminder tracking on invitations.

alter table public.survey_distributions
  drop constraint if exists survey_distributions_audience_type_check;

alter table public.survey_distributions
  add constraint survey_distributions_audience_type_check
  check (audience_type in ('all', 'departments', 'teams'));

alter table public.survey_distributions
  add column if not exists audience_team_ids uuid[] default '{}'::uuid[];

comment on column public.survey_distributions.audience_team_ids is 'When audience_type = teams: organization_members.team_id in this set, matched to profiles by email';

alter table public.survey_invitations
  add column if not exists reminder_sent_at timestamptz;

comment on column public.survey_invitations.reminder_sent_at is 'Last reminder email sent (initial invite uses email_sent_at)';

select pg_notify('pgrst', 'reload schema');
