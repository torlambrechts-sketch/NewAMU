-- Ensure survey distribution columns expected by the app / PostgREST exist.
-- Safe if 20260802120010 already ran (IF NOT EXISTS).

alter table public.survey_distributions
  add column if not exists scheduled_initial_send_at timestamptz,
  add column if not exists initial_send_started_at timestamptz,
  add column if not exists audience_location_ids uuid[] default '{}'::uuid[];

comment on column public.survey_distributions.scheduled_initial_send_at is 'When set, auto-send initial invites at or after this time (Edge cron)';
comment on column public.survey_distributions.initial_send_started_at is 'Set when automated initial send batch has run';

select pg_notify('pgrst', 'reload schema');
