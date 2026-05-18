-- Meetings · auto-compute meeting_protocol_exports.payload_sha256
-- when protocol_signed_at transitions null → not-null.
--
-- Why
--   The H12 audit-evidence table `meeting_protocol_exports`
--   (archive/20260903120001) was designed for client-side fill but no
--   client code ever called the promised `meetings.computeAndStore-
--   ProtocolChecksum(meetingId)` helper. Result: the tamper-evidence
--   trail is empty.
--
--   Server-side compute is more reliable: the trigger fires inside the
--   sign transaction, so a successful sign always leaves an export row
--   regardless of which client kicked it off (UI, edge function, RPC,
--   pg_dump replay). The canonical JSON is built from meeting + child
--   tables at trigger time; pgcrypto's digest() computes the SHA-256
--   hex over the UTF-8 bytes. RLS append-only contract preserved.
--
-- Idempotence: drop+create trigger; the table itself already exists.
--
-- Self-audit (Arbeidstilsynet POV)
--   Closes a P1 audit gap. The hash now exists on disk for every signed
--   meeting; an inspector can re-render the protocol and verify the
--   SHA-256 matches without trusting that the client wrote the row.

set local search_path = public, pg_catalog;

create or replace function public.meeting_compute_protocol_export()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_payload jsonb;
  v_hash text;
  v_canonical text;
begin
  -- Build canonical jsonb. jsonb_agg(... order by ...) gives sort-stable
  -- ordering. We project explicit columns rather than to_jsonb(row) so
  -- accidental column additions don't silently shift the hash.
  select jsonb_build_object(
    'meeting', jsonb_build_object(
      'id',                     new.id,
      'organization_id',        new.organization_id,
      'title',                  new.title,
      'description',            new.description,
      'status',                 new.status,
      'scheduled_at',           new.scheduled_at,
      'ends_at',                new.ends_at,
      'completed_at',           new.completed_at,
      'confidentiality_level',  new.confidentiality_level,
      'location_label',         new.location_label,
      'location_id',            new.location_id,
      'department_id',          new.department_id,
      'team_id',                new.team_id,
      'participant_member_ids', new.participant_member_ids,
      'reporting_period_start', new.reporting_period_start,
      'reporting_period_end',   new.reporting_period_end,
      'reporting_period_label', new.reporting_period_label,
      'protocol_signed_at',     new.protocol_signed_at,
      'protocol_signed_by',     new.protocol_signed_by,
      'system_template_id',     new.system_template_id,
      'org_template_id',        new.org_template_id
    ),
    'agenda_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    i.id,
        'position',              i.position,
        'title',                 i.title,
        'description',           i.description,
        'law_ref',               i.law_ref,
        'is_mandatory',          i.is_mandatory,
        'minutes_summary',       i.minutes_summary,
        'decision_text',         i.decision_text,
        'decision_status',       i.decision_status,
        'vote_for',              i.vote_for,
        'vote_against',          i.vote_against,
        'vote_abstain',          i.vote_abstain,
        'minority_dissent_text', i.minority_dissent_text
      ) order by i.position, i.id)
      from public.meeting_agenda_items i
      where i.meeting_id = new.id
    ), '[]'::jsonb),
    'attendees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'member_id', a.member_id,
        'role',      a.role,
        'present',   a.present,
        'excused',   a.excused,
        'digital',   a.digital
      ) order by a.member_id)
      from public.meeting_attendees a
      where a.meeting_id = new.id
    ), '[]'::jsonb),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',               d.id,
        'agenda_item_id',   d.agenda_item_id,
        'decision_text',    d.decision_text,
        'status',           d.status,
        'decision_at',      d.decision_at,
        'follow_up_task_id', d.follow_up_task_id
      ) order by d.id)
      from public.meeting_decisions d
      where d.meeting_id = new.id
    ), '[]'::jsonb),
    'action_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                    ai.id,
        'agenda_item_id',        ai.agenda_item_id,
        'description',           ai.description,
        'responsible_member_id', ai.responsible_member_id,
        'due_date',              ai.due_date,
        'task_id',               ai.task_id,
        'status',                ai.status
      ) order by ai.id)
      from public.meeting_action_items ai
      where ai.meeting_id = new.id
    ), '[]'::jsonb),
    'signatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',               s.id,
        'signer_member_id', s.signer_member_id,
        'signer_name',      s.signer_name,
        'signer_role',      s.signer_role,
        'signed_at',        s.signed_at,
        'level1_event_id',  s.level1_event_id
      ) order by s.signed_at, s.id)
      from public.meeting_signatures s
      where s.meeting_id = new.id
    ), '[]'::jsonb)
  ) into v_payload;

  -- Stable hash: Postgres' jsonb→text cast uses canonical output
  -- (object keys in stable order — see PostgreSQL docs §8.14.2 "jsonb
  -- Type" and the `jsonb_build_object` documentation). Whitespace is
  -- omitted. This is guaranteed within a major Postgres version; an
  -- inspector who needs to re-verify a hash should run the same SELECT
  -- on the same major version that signed the protocol. If we later
  -- upgrade across major versions and the canonical form shifts, the
  -- existing hashes remain valid as historical evidence — they just
  -- can't be regenerated bit-identical without a snapshot of the
  -- prior major's output. Document this in the audit-evidence runbook.
  v_canonical := v_payload::text;
  v_hash := encode(digest(v_canonical::bytea, 'sha256'), 'hex');

  insert into public.meeting_protocol_exports (
    meeting_id,
    payload,
    payload_sha256,
    computed_at,
    computed_by,
    sign_checksum_at_write
  )
  values (
    new.id,
    v_payload,
    v_hash,
    now(),
    new.protocol_signed_by,
    new.sign_checksum
  )
  on conflict (meeting_id) do nothing;

  return new;
end;
$$;

comment on function public.meeting_compute_protocol_export() is
  'AFTER UPDATE trigger on meetings: when protocol_signed_at transitions null→not-null, computes canonical jsonb of meeting + child tables, SHA-256-hashes it via pgcrypto, and inserts one immutable row in meeting_protocol_exports.';

drop trigger if exists meeting_compute_protocol_export_tg on public.meetings;
create trigger meeting_compute_protocol_export_tg
  after update of protocol_signed_at on public.meetings
  for each row
  when (old.protocol_signed_at is null and new.protocol_signed_at is not null)
  execute function public.meeting_compute_protocol_export();

-- Trigger-only SECURITY DEFINER func — revoke direct EXECUTE so the
-- function can only run via the trigger. Postgres still invokes it as
-- the function owner when meetings.protocol_signed_at transitions.
revoke execute on function public.meeting_compute_protocol_export() from public, anon, authenticated;

-- Backfill for any already-signed meetings that never got an export row.
-- Safe via on-conflict-do-nothing; a re-run is a no-op.
do $$
declare
  v_row record;
  v_payload jsonb;
  v_hash text;
begin
  for v_row in
    select m.id, m.organization_id, m.title, m.description, m.status,
           m.scheduled_at, m.ends_at, m.completed_at, m.confidentiality_level,
           m.location_label, m.location_id, m.department_id, m.team_id,
           m.participant_member_ids, m.reporting_period_start,
           m.reporting_period_end, m.reporting_period_label,
           m.protocol_signed_at, m.protocol_signed_by, m.system_template_id,
           m.org_template_id, m.sign_checksum
    from public.meetings m
    left join public.meeting_protocol_exports e on e.meeting_id = m.id
    where m.protocol_signed_at is not null
      and e.id is null
  loop
    select jsonb_build_object(
      'meeting', jsonb_build_object(
        'id',                     v_row.id,
        'organization_id',        v_row.organization_id,
        'title',                  v_row.title,
        'description',            v_row.description,
        'status',                 v_row.status,
        'scheduled_at',           v_row.scheduled_at,
        'ends_at',                v_row.ends_at,
        'completed_at',           v_row.completed_at,
        'confidentiality_level',  v_row.confidentiality_level,
        'location_label',         v_row.location_label,
        'location_id',            v_row.location_id,
        'department_id',          v_row.department_id,
        'team_id',                v_row.team_id,
        'participant_member_ids', v_row.participant_member_ids,
        'reporting_period_start', v_row.reporting_period_start,
        'reporting_period_end',   v_row.reporting_period_end,
        'reporting_period_label', v_row.reporting_period_label,
        'protocol_signed_at',     v_row.protocol_signed_at,
        'protocol_signed_by',     v_row.protocol_signed_by,
        'system_template_id',     v_row.system_template_id,
        'org_template_id',        v_row.org_template_id
      ),
      'agenda_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'position', i.position, 'title', i.title,
          'description', i.description, 'law_ref', i.law_ref,
          'is_mandatory', i.is_mandatory, 'minutes_summary', i.minutes_summary,
          'decision_text', i.decision_text, 'decision_status', i.decision_status,
          'vote_for', i.vote_for, 'vote_against', i.vote_against,
          'vote_abstain', i.vote_abstain,
          'minority_dissent_text', i.minority_dissent_text
        ) order by i.position, i.id)
        from public.meeting_agenda_items i where i.meeting_id = v_row.id
      ), '[]'::jsonb),
      'attendees', coalesce((
        select jsonb_agg(jsonb_build_object(
          'member_id', a.member_id, 'role', a.role, 'present', a.present,
          'excused', a.excused, 'digital', a.digital
        ) order by a.member_id)
        from public.meeting_attendees a where a.meeting_id = v_row.id
      ), '[]'::jsonb),
      'decisions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'agenda_item_id', d.agenda_item_id,
          'decision_text', d.decision_text, 'status', d.status,
          'decision_at', d.decision_at, 'follow_up_task_id', d.follow_up_task_id
        ) order by d.id)
        from public.meeting_decisions d where d.meeting_id = v_row.id
      ), '[]'::jsonb),
      'action_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ai.id, 'agenda_item_id', ai.agenda_item_id,
          'description', ai.description, 'responsible_member_id', ai.responsible_member_id,
          'due_date', ai.due_date, 'task_id', ai.task_id, 'status', ai.status
        ) order by ai.id)
        from public.meeting_action_items ai where ai.meeting_id = v_row.id
      ), '[]'::jsonb),
      'signatures', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'signer_member_id', s.signer_member_id,
          'signer_name', s.signer_name, 'signer_role', s.signer_role,
          'signed_at', s.signed_at, 'level1_event_id', s.level1_event_id
        ) order by s.signed_at, s.id)
        from public.meeting_signatures s where s.meeting_id = v_row.id
      ), '[]'::jsonb)
    ) into v_payload;

    v_hash := encode(digest(v_payload::text::bytea, 'sha256'), 'hex');

    insert into public.meeting_protocol_exports (
      meeting_id, payload, payload_sha256,
      computed_at, computed_by, sign_checksum_at_write
    )
    values (
      v_row.id, v_payload, v_hash,
      now(), v_row.protocol_signed_by, v_row.sign_checksum
    )
    on conflict (meeting_id) do nothing;
  end loop;
end $$;
