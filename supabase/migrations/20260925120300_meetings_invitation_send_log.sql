-- Per-meeting send-log table for the send-meeting-invites edge function's
-- 3-per-10-min rate limit. Lightweight: insert-only, no updates.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 7-2 (5) taushetsplikt — the chair must not be able to spam
--     email to participants of confidential meetings. Cap at 3 sends per
--     10 minutes per meeting prevents both accidental and deliberate
--     email-bomb scenarios.

set local search_path = public, pg_catalog;

create table if not exists public.meetings_invitation_send_log (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  mode         text not null check (mode in ('initial', 'reminder')),
  sent         integer not null default 0,
  failed       integer not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);

create index if not exists meetings_invitation_send_log_meeting_time_idx
  on public.meetings_invitation_send_log (meeting_id, created_at desc);

alter table public.meetings_invitation_send_log enable row level security;

drop policy if exists meetings_invitation_send_log_select on public.meetings_invitation_send_log;
create policy meetings_invitation_send_log_select
  on public.meetings_invitation_send_log for select
  using (public.meetings_user_can_manage(meeting_id));

drop policy if exists meetings_invitation_send_log_insert on public.meetings_invitation_send_log;
create policy meetings_invitation_send_log_insert
  on public.meetings_invitation_send_log for insert
  with check (public.meetings_user_can_manage(meeting_id));
