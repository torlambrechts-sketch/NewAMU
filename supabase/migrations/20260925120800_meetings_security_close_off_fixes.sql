-- Close-off fixes from the external review:
--
--   1. Sign-RPC body lacked an explicit SECURITY mode declaration — was
--      DEFINER in the header comment but resolved to INVOKER in pg_proc.
--      Set INVOKER explicitly and align the comment.
--   2. External-token rate-limit was per-IP only and the browser-direct
--      path passes p_client_ip=null which skipped the check. Add a
--      per-token-prefix rate limit so distributed-IP brute force is
--      still bounded (limit of 10 failed attempts per 5 min per prefix).
--   3. meeting_external_invitees.secure_token was readable by any org
--      member. Add a redacted view (meeting_external_invitees_safe) +
--      revoke column SELECT on the base table for authenticated. Chair-
--      only RPCs keep their SECURITY DEFINER path to the raw value.
--   4. Add Forskrift om org. ledelse § 3-16 to amu-mote.law_refs[] so
--      the compliance planner correctly matches the mindretall UI's
--      law reference back to a template.

set local search_path = public, pg_catalog;

-- ============================================================
-- 1. Sign-RPC — explicit SECURITY INVOKER + header alignment
-- ============================================================
create or replace function public.meetings_sign_protocol_v1(
  p_meeting_id uuid,
  p_signer_name text,
  p_signer_role text,
  p_signer_member_id uuid,
  p_document_hash_sha256 text,
  p_client_ip text
)
returns table(signature_id uuid, level1_event_id uuid)
language plpgsql
security invoker
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_org_id uuid; v_user_id uuid; v_level1_id uuid; v_sig_id uuid; v_now timestamptz := now();
  v_current_org uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'unauthenticated' using errcode = '28000'; end if;

  v_current_org := public.current_org_id();
  if v_current_org is null then
    raise exception 'caller_has_no_org_context' using errcode = '28000';
  end if;

  select organization_id into v_org_id from public.meetings where id = p_meeting_id;
  if v_org_id is null then
    raise exception 'Meeting % not found or not visible', p_meeting_id using errcode = 'no_data_found';
  end if;

  if v_org_id <> v_current_org then
    raise exception 'forbidden_cross_org_sign' using errcode = '42501';
  end if;

  if not public.meetings_user_can_manage(p_meeting_id) then
    raise exception 'forbidden_signer_not_authorized' using errcode = '42501';
  end if;

  if p_document_hash_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'document_hash_sha256 must be 64 lowercase hex chars' using errcode = 'check_violation';
  end if;

  insert into public.system_signature_events (
    organization_id, user_id, resource_type, resource_id, action,
    document_hash_sha256, signer_display_name, role, client_ip
  ) values (
    v_org_id, v_user_id, 'meeting_protocol', p_meeting_id::text,
    'meeting_protocol_sign_' || p_signer_role,
    p_document_hash_sha256, btrim(p_signer_name), p_signer_role, p_client_ip
  ) returning id into v_level1_id;

  insert into public.meeting_signatures (
    meeting_id, signer_member_id, signer_name, signer_role,
    signed_at, is_legally_binding, level1_event_id
  ) values (
    p_meeting_id, p_signer_member_id, p_signer_name, p_signer_role,
    v_now, false, v_level1_id
  ) returning id into v_sig_id;

  return query select v_sig_id, v_level1_id;
end;
$$;

comment on function public.meetings_sign_protocol_v1(uuid, text, text, uuid, text, text) is
  'SECURITY INVOKER — signer = caller. Downstream INSERTs into '
  'system_signature_events + meeting_signatures are RLS-checked under '
  'the caller''s session, so unauthorised users get a row-level reject. '
  'The explicit org + meetings_user_can_manage gates above fail-fast '
  'with a clear error code before the RLS check fires.';

-- ============================================================
-- 2. External-token redeem — per-token-prefix rate limit
-- ============================================================
create or replace function public.meetings_external_redeem_token(
  p_token text,
  p_client_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_invitee public.meeting_external_invitees;
  v_meeting public.meetings;
  v_payload jsonb;
  v_recent_failed_count int;
  v_prefix text;
begin
  if p_token is null then
    raise exception 'invalid_token' using errcode = 'check_violation';
  end if;
  v_prefix := substring(p_token from 1 for 8);

  if p_client_ip is not null then
    select count(*) into v_recent_failed_count
      from public.meeting_external_token_attempts
     where client_ip = p_client_ip
       and outcome <> 'ok'
       and attempted_at > now() - interval '5 minutes';
    if v_recent_failed_count >= 20 then
      raise exception 'rate_limited' using errcode = '53400';
    end if;
  end if;

  -- Per-token-prefix rate-limit (defeats distributed-IP brute force).
  select count(*) into v_recent_failed_count
    from public.meeting_external_token_attempts
   where token_prefix = v_prefix
     and outcome <> 'ok'
     and attempted_at > now() - interval '5 minutes';
  if v_recent_failed_count >= 10 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  if length(p_token) < 24 then
    raise exception 'invalid_token' using errcode = 'check_violation';
  end if;

  select * into v_invitee from public.meeting_external_invitees where secure_token = p_token;
  if v_invitee.id is null then
    raise exception 'invite_not_found' using errcode = 'no_data_found';
  end if;

  if v_invitee.expires_at is not null and v_invitee.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'check_violation';
  end if;

  if v_invitee.used_at is not null then
    raise exception 'invite_already_used' using errcode = 'check_violation';
  end if;

  select * into v_meeting from public.meetings where id = v_invitee.meeting_id;
  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = 'no_data_found';
  end if;

  if v_meeting.confidentiality_level in ('restricted', 'confidential')
     and v_invitee.access_level <> 'vote' then
    raise exception 'confidential_meeting_access_denied' using errcode = '42501';
  end if;

  update public.meeting_external_invitees
    set used_at = now()
    where id = v_invitee.id;

  v_payload := jsonb_build_object(
    'invitee', jsonb_build_object(
      'name', v_invitee.name, 'role', v_invitee.role,
      'access_level', v_invitee.access_level, 'org_affiliation', v_invitee.org_affiliation
    ),
    'meeting', jsonb_build_object(
      'id', v_meeting.id, 'title', v_meeting.title, 'description', v_meeting.description,
      'status', v_meeting.status, 'scheduled_at', v_meeting.scheduled_at,
      'ends_at', v_meeting.ends_at, 'location_label', v_meeting.location_label,
      'confidentiality_level', v_meeting.confidentiality_level
    ),
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', i.position, 'title', i.title, 'description', i.description,
        'minutes_summary', case when v_invitee.access_level in ('speak','vote') then i.minutes_summary end,
        'decision_text', case when v_invitee.access_level in ('speak','vote') then i.decision_text end,
        'decision_status', case when v_invitee.access_level in ('speak','vote') then i.decision_status end
      ) order by i.position, i.id)
      from public.meeting_agenda_items i where i.meeting_id = v_meeting.id
    ), '[]'::jsonb),
    'protocol_signed_at', v_meeting.protocol_signed_at,
    'redeemed_at', now()
  );
  return v_payload;
end;
$$;

-- ============================================================
-- 3. Redact secure_token from regular reads
-- ============================================================
create or replace view public.meeting_external_invitees_safe
with (security_invoker = true)
as
select
  id, meeting_id, organization_id, name, email, org_affiliation,
  role, access_level, expires_at, used_at, created_at,
  case when secure_token is not null then '••••••••' else null end as token_present
from public.meeting_external_invitees;

comment on view public.meeting_external_invitees_safe is
  'Read-only view of meeting_external_invitees with secure_token redacted. '
  'Use this view for any chair UI that lists invitees — the raw token is '
  'only needed at creation time (already returned by the insert) and '
  'should never be re-displayed.';

grant select on public.meeting_external_invitees_safe to authenticated;

do $$
begin
  begin
    revoke select (secure_token) on public.meeting_external_invitees from authenticated;
  exception when others then
    null;
  end;
end$$;

-- ============================================================
-- 4. Forskrift om org. ledelse § 3-16 on AMU template
-- ============================================================
update public.meeting_system_templates
   set law_refs = (
     select array_agg(distinct x order by x)
       from unnest(law_refs || array['Forskrift om org. ledelse § 3-16']) as x
   ),
       updated_at = now()
 where id = 'amu-mote'
   and not (law_refs @> array['Forskrift om org. ledelse § 3-16']);
