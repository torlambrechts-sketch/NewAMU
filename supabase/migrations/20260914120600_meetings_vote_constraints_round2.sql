-- Meetings · external-review round 2 — close real findings.
--
-- Closes
--   #1/#5  Anonymous vote NULL unique-key collision: member_id is now
--          NOT NULL on meeting_votes. Anonymous voting is a display-time
--          concern (UI hides voter identity in the rendered result); it
--          is NOT a NULL-member_id pattern. NULL on a unique key allows
--          unlimited duplicates in PG, which would corrupt tallies.
--   #8     Schema CHECK on meeting_votes.side tightened: 'observer'
--          excluded from voting. Observers can attend but not vote.
--   #4     Token entropy upgrade is in client code (16 hex chars
--          from a single UUID was 64 bits; now we use 32 hex chars
--          from full UUID + extra randomness, ~128 bits).

set local search_path = public, pg_catalog;

-- ── 1. meeting_votes.member_id NOT NULL ─────────────────────────────────────

-- Delete any existing orphan rows with null member_id (should be zero in
-- production; the column was added empty in this session's earlier work).
delete from public.meeting_votes where member_id is null;

alter table public.meeting_votes
  alter column member_id set not null;

-- The unique constraint is already (agenda_item_id, member_id); making
-- member_id NOT NULL converts it from "allows infinite NULL collisions"
-- into "one ballot per voter per agenda item" — the intended invariant.

-- ── 2. Tighten side CHECK to exclude 'observer' from votes ──────────────────

-- Postgres doesn't let us alter a CHECK constraint in place; drop + recreate.
alter table public.meeting_votes
  drop constraint if exists meeting_votes_side_check;

alter table public.meeting_votes
  add constraint meeting_votes_side_check
  check (side is null or side in ('employer','employee','bht','external'));

comment on column public.meeting_votes.side is
  'Side for parity tally (AML § 7-1 (2)): employer/employee/bht/external. Observers do not vote; the CHECK excludes them.';
