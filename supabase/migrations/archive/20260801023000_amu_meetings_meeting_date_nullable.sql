-- Allow meetings keyed by scheduled_at; meeting_date remains for legacy rows
alter table public.amu_meetings
  alter column meeting_date drop not null;
