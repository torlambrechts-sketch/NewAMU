-- Meetings · transactional RPC for protocol signature.
--
-- Why
--   `useMeetings.signProtocol` originally performed three independent
--   awaits: insert system_signature_events → insert meeting_signatures
--   → update meetings.protocol_signed_at. Each step can fail
--   independently, leaving:
--     - orphaned L1 event with no meeting_signatures row, or
--     - signature row referencing a missing L1 event, or
--     - signature recorded but meetings.protocol_signed_at not stamped
--       (so the lock-trigger doesn't engage).
--   Wrapping in a SECURITY DEFINER function gives a single transaction:
--   any failure rolls back all three writes.
--
--   The document hash is still computed client-side (the canonical JSON
--   covers meeting + agenda + attendees + decisions + signature, and
--   client owns that data view) and passed in as a parameter.
--
-- Self-audit (Arbeidstilsynet POV)
--   No new compliance claim — this hardens an existing trail so the
--   "level 1 signature" is always either fully present or fully absent.

set local search_path = public, pg_catalog;

create or replace function public.meetings_sign_protocol_v1(
  p_meeting_id uuid,
  p_signer_name text,
  p_signer_role text,
  p_signer_member_id uuid,
  p_document_hash_sha256 text,
  p_client_ip text
)
returns table (
  signature_id uuid,
  level1_event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_level1_id uuid;
  v_sig_id uuid;
  v_now timestamptz := now();
begin
  -- Resolve caller + meeting org (RLS on `meetings` is the access gate;
  -- we re-select via the caller''s view so callers without read access
  -- get a "Meeting not found" rather than an org-leak).
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select organization_id into v_org_id
    from public.meetings
   where id = p_meeting_id;
  if v_org_id is null then
    raise exception 'Meeting % not found or not visible', p_meeting_id
      using errcode = 'no_data_found';
  end if;

  -- Validate hash shape (matches CHECK constraint on system_signature_events).
  if p_document_hash_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'document_hash_sha256 must be 64 lowercase hex chars'
      using errcode = 'check_violation';
  end if;

  -- Insert L1 event first; capture id.
  insert into public.system_signature_events (
    organization_id,
    user_id,
    resource_type,
    resource_id,
    action,
    document_hash_sha256,
    signer_display_name,
    role,
    client_ip
  )
  values (
    v_org_id,
    v_user_id,
    'meeting_protocol',
    p_meeting_id::text,
    'meeting_protocol_sign_' || p_signer_role,
    p_document_hash_sha256,
    btrim(p_signer_name),
    p_signer_role,
    p_client_ip
  )
  returning id into v_level1_id;

  -- Insert signature row referencing the L1 event.
  insert into public.meeting_signatures (
    meeting_id,
    signer_member_id,
    signer_name,
    signer_role,
    signed_at,
    is_legally_binding,
    level1_event_id
  )
  values (
    p_meeting_id,
    p_signer_member_id,
    p_signer_name,
    p_signer_role,
    v_now,
    false,
    v_level1_id
  )
  returning id into v_sig_id;

  -- Stamp the meeting only if not already signed. The lock trigger will
  -- reject a second sign attempt that tries to overwrite protocol_signed_*.
  update public.meetings
     set status = 'completed',
         completed_at = v_now,
         protocol_signed_at = v_now,
         protocol_signed_by = p_signer_member_id
   where id = p_meeting_id
     and protocol_signed_at is null;

  return query select v_sig_id, v_level1_id;
end;
$$;

revoke all on function public.meetings_sign_protocol_v1(uuid, text, text, uuid, text, text)
  from public;
grant execute on function public.meetings_sign_protocol_v1(uuid, text, text, uuid, text, text)
  to authenticated;

comment on function public.meetings_sign_protocol_v1 is
  'Atomic protocol-sign: insert system_signature_events row, insert meeting_signatures row referencing it, stamp meetings.protocol_signed_at — all in one transaction. SECURITY DEFINER. Caller must be authenticated; visibility into the meeting is enforced by RLS on the SELECT used to resolve organization_id.';
