-- Meetings · GDPR Art. 15 (portability) + Art. 17 (pseudonymisation) helpers.
--
-- Why
--   The new meeting tables (meeting_votes, meeting_attendees,
--   meeting_signatures, meeting_speaker_queue, meeting_action_items)
--   contain personal references via member_id / cast_by_user_id /
--   signer_name. When a data subject invokes Art. 15 (access) or Art. 17
--   (erasure), the org needs a deterministic helper.
--
--   Audit-bound vs deletable
--   --------------------------
--   AMU/board meeting protocols are LEGALLY REQUIRED record under AML
--   § 7-2 (6) and Forskrift om org. ledelse § 3-16 (referatkrav). Deletion
--   of vote rows or signature rows would corrupt the legal record. The
--   appropriate response to Art. 17 is therefore PSEUDONYMISATION rather
--   than deletion:
--     - signer_name → '[Anonymisert]'
--     - rsvp_reason / notes (free-text personal data) → null
--     - member_id stays intact as an opaque ID (no longer linkable to
--       a living user once organization_members.id is also redacted)
--
--   The export helper returns a jsonb dump of every row across the
--   meeting tables that references the subject — used for Art. 15
--   subject-access requests.

set local search_path = public, pg_catalog;

-- ── 1. Pseudonymise a member's personal data across meeting tables ────────

create or replace function public.meetings_gdpr_pseudonymize_member(
  p_member_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_signatures int := 0;
  v_attendees int := 0;
  v_actions int := 0;
  v_speakers int := 0;
  v_decisions int := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage_confidential')) then
    raise exception 'forbidden: meetings.manage_confidential or org-admin required';
  end if;

  select organization_id into v_org_id
    from public.organization_members where id = p_member_id;

  if v_org_id is null then
    raise exception 'member_not_found: %', p_member_id using errcode = 'no_data_found';
  end if;

  -- meeting_signatures: redact name but keep the row (audit-bound)
  update public.meeting_signatures s
     set signer_name = '[Anonymisert]'
   where s.signer_member_id = p_member_id
     and exists (select 1 from public.meetings m where m.id = s.meeting_id and m.organization_id = v_org_id);
  get diagnostics v_signatures = row_count;

  -- meeting_attendees: redact free-text fields, keep RSVP state for parity audit
  update public.meeting_attendees a
     set notes = null,
         rsvp_reason = null
   where a.member_id = p_member_id
     and exists (select 1 from public.meetings m where m.id = a.meeting_id and m.organization_id = v_org_id);
  get diagnostics v_attendees = row_count;

  -- meeting_action_items: keep description (operational) but null out
  -- responsible_member_id so the task can be re-assigned
  update public.meeting_action_items ai
     set responsible_member_id = null
   where ai.responsible_member_id = p_member_id
     and exists (select 1 from public.meetings m where m.id = ai.meeting_id and m.organization_id = v_org_id);
  get diagnostics v_actions = row_count;

  -- meeting_speaker_queue: anonymise topic + null member_id
  update public.meeting_speaker_queue q
     set member_id = null,
         topic = null
   where q.member_id = p_member_id
     and exists (select 1 from public.meetings m where m.id = q.meeting_id and m.organization_id = v_org_id);
  get diagnostics v_speakers = row_count;

  -- meeting_decisions: nothing personal stored directly; follow_up_task_id
  -- is handled by tasks module's GDPR pass
  v_decisions := 0;

  -- meeting_votes intentionally NOT touched: ballots are part of the
  -- legal vote tally. Anonymisation here would corrupt counts. The
  -- member_id link becomes opaque once organization_members.id is also
  -- redacted by the org-level GDPR pass.

  return jsonb_build_object(
    'subject_member_id', p_member_id,
    'pseudonymized_at', now(),
    'rows_affected', jsonb_build_object(
      'meeting_signatures', v_signatures,
      'meeting_attendees', v_attendees,
      'meeting_action_items', v_actions,
      'meeting_speaker_queue', v_speakers,
      'meeting_decisions', v_decisions
    ),
    'note', 'meeting_votes preserved as legal vote tally (Forskrift om org. ledelse § 3-16). Member_id link becomes opaque after organization_members anonymisation.'
  );
end;
$$;

revoke all on function public.meetings_gdpr_pseudonymize_member(uuid) from public, anon;
grant execute on function public.meetings_gdpr_pseudonymize_member(uuid) to authenticated;

comment on function public.meetings_gdpr_pseudonymize_member(uuid) is
  'GDPR Art. 17 helper for meetings tables. Redacts personal data (signer_name, notes, rsvp_reason, topic) and nulls responsible_member_id while preserving audit-bound vote tallies. Requires meetings.manage_confidential or org-admin.';

-- ── 2. Export all meeting-related data for a member (Art. 15) ─────────────

create or replace function public.meetings_gdpr_export_member(
  p_member_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage_confidential')) then
    raise exception 'forbidden: meetings.manage_confidential or org-admin required';
  end if;

  select organization_id into v_org_id
    from public.organization_members where id = p_member_id;

  if v_org_id is null then
    raise exception 'member_not_found: %', p_member_id using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'subject_member_id', p_member_id,
    'exported_at', now(),
    'attendees', coalesce((
      select jsonb_agg(to_jsonb(a))
      from public.meeting_attendees a
      join public.meetings m on m.id = a.meeting_id and m.organization_id = v_org_id
      where a.member_id = p_member_id
    ), '[]'::jsonb),
    'signatures', coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.meeting_signatures s
      join public.meetings m on m.id = s.meeting_id and m.organization_id = v_org_id
      where s.signer_member_id = p_member_id
    ), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(to_jsonb(v))
      from public.meeting_votes v
      where v.member_id = p_member_id
        and v.organization_id = v_org_id
    ), '[]'::jsonb),
    'action_items', coalesce((
      select jsonb_agg(to_jsonb(ai))
      from public.meeting_action_items ai
      join public.meetings m on m.id = ai.meeting_id and m.organization_id = v_org_id
      where ai.responsible_member_id = p_member_id
    ), '[]'::jsonb),
    'speaker_queue', coalesce((
      select jsonb_agg(to_jsonb(q))
      from public.meeting_speaker_queue q
      where q.member_id = p_member_id
        and q.organization_id = v_org_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.meetings_gdpr_export_member(uuid) from public, anon;
grant execute on function public.meetings_gdpr_export_member(uuid) to authenticated;

comment on function public.meetings_gdpr_export_member(uuid) is
  'GDPR Art. 15 helper for meetings tables. Returns jsonb dump of every row across attendees/signatures/votes/action-items/speaker-queue that references the subject. Requires meetings.manage_confidential or org-admin.';
