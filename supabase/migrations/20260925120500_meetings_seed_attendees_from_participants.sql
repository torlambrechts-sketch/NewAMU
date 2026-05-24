-- Backfill meeting_attendees from meetings.participant_member_ids.
--
-- Existing seeded meetings had planned participants but no attendee rows,
-- so the quorum/RSVP/parity features rendered "0 of 0". This backfill
-- populates attendees with role='member' + rsvp_status='no_response' for
-- every participant. Chair/secretary roles can be set via the UI.
--
-- Idempotent: skips existing (meeting_id, member_id) tuples.

set local search_path = public, pg_catalog;

insert into public.meeting_attendees (
  meeting_id, member_id, role, invited, present, excused, digital, rsvp_status, notes
)
select
  m.id as meeting_id,
  member_id,
  'member' as role,
  true as invited,
  null::boolean as present,
  false as excused,
  false as digital,
  'no_response' as rsvp_status,
  null as notes
from public.meetings m,
     lateral unnest(coalesce(m.participant_member_ids, '{}'::uuid[])) as member_id
where not exists (
  select 1 from public.meeting_attendees a
  where a.meeting_id = m.id and a.member_id = member_id
)
on conflict (meeting_id, member_id) do nothing;
