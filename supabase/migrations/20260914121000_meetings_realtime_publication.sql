-- Meetings · enable Supabase Realtime publication for live-page tables (§8.32).
--
-- The MeetingLivePage subscribes via `supabase.channel(...).on('postgres_changes',
-- ...)` to push updates of votes, speaker queue, live session state, and
-- attendee RSVPs. Each table must be in the supabase_realtime publication for
-- the broadcast to fire.
--
-- Idempotent: each `alter publication ... add table` is wrapped in a DO block
-- that checks pg_publication_rel first, since `add table` errors when the
-- table is already a member.

set local search_path = public, pg_catalog;

do $$
declare
  v_oid oid;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication missing; skipping realtime registration.';
    return;
  end if;

  -- meeting_votes
  select c.oid into v_oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'meeting_votes';
  if v_oid is not null and not exists (
    select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = v_oid
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_votes';
  end if;

  -- meeting_speaker_queue
  select c.oid into v_oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'meeting_speaker_queue';
  if v_oid is not null and not exists (
    select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = v_oid
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_speaker_queue';
  end if;

  -- meeting_live_sessions
  select c.oid into v_oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'meeting_live_sessions';
  if v_oid is not null and not exists (
    select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = v_oid
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_live_sessions';
  end if;

  -- meeting_attendees (RSVP changes need to reflect in parity panel)
  select c.oid into v_oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'meeting_attendees';
  if v_oid is not null and not exists (
    select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = v_oid
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_attendees';
  end if;
end $$;
