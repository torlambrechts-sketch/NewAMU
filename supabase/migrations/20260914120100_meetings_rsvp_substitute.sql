-- Meetings · RSVP flow + substitute (vara) auto-activation (L4).
--
-- Why
--   Current meeting_attendees has flat invited/present/excused/digital.
--   No state machine for accepted/declined/tentative/no_response, no
--   record of WHY a member declined, and no link from a substitute
--   row back to the principal it covers. Result: AMU meetings can fail
--   quorum or parity silently when an arbeidsgiver-side member declines
--   and we don''t auto-pull a vara of the same side.
--
--   Adds rsvp_status + rsvp_reason + rsvp_responded_at + side + the
--   substitute relation. side is denormalised here (also derivable
--   from organization_members.metadata) so RLS and parity-check
--   queries don''t need a join into the directory.
--
-- Self-audit (Arbeidstilsynet POV)
--   Closes the quorum/parity-tracking gap explicit in AML § 7-1 (2).

set local search_path = public, pg_catalog;

alter table public.meeting_attendees
  add column if not exists rsvp_status text
    not null default 'no_response'
    check (rsvp_status in ('no_response','accepted','declined','tentative'));

alter table public.meeting_attendees
  add column if not exists rsvp_reason text;

alter table public.meeting_attendees
  add column if not exists rsvp_responded_at timestamptz;

alter table public.meeting_attendees
  add column if not exists side text
    check (side in ('employer','employee','bht','external','observer'));

-- Substitute (vara) — points at the principal member this row covers.
-- Activation timestamps make it audit-explicit when the substitute
-- entered the seat.
alter table public.meeting_attendees
  add column if not exists substitute_for_member_id uuid
    references public.organization_members(id) on delete set null;

alter table public.meeting_attendees
  add column if not exists substitute_activated_at timestamptz;

comment on column public.meeting_attendees.rsvp_status is
  'RSVP state machine: no_response (default) / accepted / declined / tentative.';
comment on column public.meeting_attendees.side is
  'Side for parity tracking (AML § 7-1 (2)): employer / employee / bht / external / observer. Denormalised from organization_members; the chair may override per meeting.';
comment on column public.meeting_attendees.substitute_for_member_id is
  'When set, this attendee is the vara for that principal. substitute_activated_at marks when they took the seat.';

create index if not exists meeting_attendees_rsvp_idx
  on public.meeting_attendees (meeting_id, rsvp_status);

-- ── Helper: parity & quorum check for a meeting ────────────────────────────

create or replace function public.meeting_parity_check(p_meeting_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_emp int := 0;
  v_at  int := 0;
  v_bht int := 0;
  v_present int := 0;
  v_quorum_min int;
  v_quorum_rule text;
  v_parity_ok boolean;
  v_quorum_ok boolean;
begin
  -- Count counts attendees who are either present or accepted-but-not-yet-marked
  -- (planned meetings) so the check works pre-meeting too.
  select
    count(*) filter (where side = 'employer' and rsvp_status in ('accepted','tentative')
                     or (side = 'employer' and present is true)),
    count(*) filter (where side = 'employee' and rsvp_status in ('accepted','tentative')
                     or (side = 'employee' and present is true)),
    count(*) filter (where side = 'bht' and rsvp_status in ('accepted','tentative')
                     or (side = 'bht' and present is true)),
    count(*) filter (where rsvp_status in ('accepted','tentative') or present is true)
  into v_emp, v_at, v_bht, v_present
  from public.meeting_attendees
  where meeting_id = p_meeting_id;

  -- Quorum lives in the template's definition_snapshot.minimumQuorum.
  select
    coalesce((definition_snapshot->'minimumQuorum'->>'value')::int, 0),
    coalesce(definition_snapshot->'minimumQuorum'->>'kind', 'count')
  into v_quorum_min, v_quorum_rule
  from public.meetings
  where id = p_meeting_id;

  v_parity_ok := v_emp = v_at;
  v_quorum_ok := v_present >= coalesce(v_quorum_min, 0);

  return jsonb_build_object(
    'employer_count', v_emp,
    'employee_count', v_at,
    'bht_count', v_bht,
    'total_present_or_accepted', v_present,
    'parity_ok', v_parity_ok,
    'quorum_min', v_quorum_min,
    'quorum_ok', v_quorum_ok
  );
end;
$$;

comment on function public.meeting_parity_check(uuid) is
  'Returns parity + quorum status for a meeting: employer/employee/bht counts of present-or-accepted attendees, parity_ok (emp == at), quorum_min from template, quorum_ok.';

grant execute on function public.meeting_parity_check(uuid) to authenticated;
