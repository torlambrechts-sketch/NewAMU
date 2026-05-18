-- Meetings · external-invitee token-redeem RPC (§8.33).
--
-- Why
--   `meeting_external_invitees` ships with a 128-bit secure_token, but
--   the public route /meetings/external/<token> needs a SECURITY DEFINER
--   helper that:
--     1. Validates the token + expiry
--     2. Stamps used_at on first redemption (audit trail)
--     3. Returns the minimum meeting payload (title, time, location,
--        agenda titles + descriptions, attendance + decisions) for the
--        invitee's access_level
--     4. Hides minutes/votes from observers; lets speak/vote see more
--
-- Security
--   SECURITY DEFINER required because the caller is *unauthenticated*
--   (token-only access). The function owns the access decision and is
--   responsible for filtering by access_level. revoke from public/anon
--   then explicit grant to anon (so the public route can call it).

set local search_path = public, pg_catalog;

create or replace function public.meetings_external_redeem_token(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_invitee public.meeting_external_invitees;
  v_meeting public.meetings;
  v_payload jsonb;
begin
  if p_token is null or length(p_token) < 24 then
    raise exception 'invalid_token' using errcode = 'check_violation';
  end if;

  select * into v_invitee
    from public.meeting_external_invitees
   where secure_token = p_token;

  if v_invitee.id is null then
    raise exception 'invite_not_found' using errcode = 'no_data_found';
  end if;

  if v_invitee.expires_at is not null and v_invitee.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'check_violation';
  end if;

  -- Stamp first redemption
  if v_invitee.used_at is null then
    update public.meeting_external_invitees
       set used_at = now()
     where id = v_invitee.id;
  end if;

  select * into v_meeting
    from public.meetings
   where id = v_invitee.meeting_id;
  if v_meeting.id is null then
    raise exception 'meeting_not_found' using errcode = 'no_data_found';
  end if;

  -- Build payload per access_level
  v_payload := jsonb_build_object(
    'invitee', jsonb_build_object(
      'name', v_invitee.name,
      'role', v_invitee.role,
      'access_level', v_invitee.access_level,
      'org_affiliation', v_invitee.org_affiliation
    ),
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'description', v_meeting.description,
      'status', v_meeting.status,
      'scheduled_at', v_meeting.scheduled_at,
      'ends_at', v_meeting.ends_at,
      'location_label', v_meeting.location_label,
      'confidentiality_level', v_meeting.confidentiality_level
    ),
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', i.position,
        'title', i.title,
        'description', i.description,
        -- Observers see structure only; speak/vote also see minutes + decisions
        'minutes_summary', case when v_invitee.access_level in ('speak','vote') then i.minutes_summary end,
        'decision_text', case when v_invitee.access_level in ('speak','vote') then i.decision_text end,
        'decision_status', case when v_invitee.access_level in ('speak','vote') then i.decision_status end
      ) order by i.position, i.id)
      from public.meeting_agenda_items i
      where i.meeting_id = v_meeting.id
    ), '[]'::jsonb),
    'protocol_signed_at', v_meeting.protocol_signed_at,
    'redeemed_at', now()
  );

  return v_payload;
end;
$$;

revoke all on function public.meetings_external_redeem_token(text) from public;
-- anon role is what unauthenticated requests use in Supabase
grant execute on function public.meetings_external_redeem_token(text) to anon, authenticated;

comment on function public.meetings_external_redeem_token(text) is
  'Public token-gated read of a meeting for an external invitee. Stamps used_at on first redemption and returns a payload scoped by the invitee''s access_level (observer | speak | vote). SECURITY DEFINER because the caller is unauthenticated.';
