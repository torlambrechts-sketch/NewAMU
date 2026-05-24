-- Harden the two highest-blast-radius RPCs.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 7-2 (5) taushetsplikt — confidential meetings must never leak
--     via an external-token link. RPC now refuses to redeem tokens for
--     restricted/confidential meetings unless explicit access_level='vote'.
--   * GDPR Art. 32(1)(b) integrity — external tokens are now single-use:
--     once `used_at` is stamped, subsequent redemptions are refused.
--     A new table `meeting_external_token_attempts` records every redemption
--     for rate-limit / abuse monitoring. The audit insert is performed by
--     a separate recorder RPC (see _120200) so it survives the rollback
--     when the redeem RPC raises an exception.
--   * GDPR Art. 5(1)(f) confidentiality — sign-RPC now asserts the
--     caller's current_org_id() matches the meeting's organization_id
--     AND that the caller can manage the meeting (chair/secretary/manage).
--     Previously relied on SECURITY INVOKER + downstream RLS; explicit
--     guard prevents a future relax-RLS regression from being exploitable.

set local search_path = public, pg_catalog;

-- ============================================================
-- 1. meetings_sign_protocol_v1 — explicit org + manage assertion
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

-- ============================================================
-- 2. External-token attempt log (rate-limit + abuse signals)
-- ============================================================
create table if not exists public.meeting_external_token_attempts (
  id              uuid primary key default gen_random_uuid(),
  attempted_at    timestamptz not null default now(),
  token_prefix    text not null,
  outcome         text not null,
  client_ip       text,
  user_agent      text,
  meeting_id      uuid
);

create index if not exists meeting_external_token_attempts_ip_time_idx
  on public.meeting_external_token_attempts (client_ip, attempted_at desc);

create index if not exists meeting_external_token_attempts_prefix_time_idx
  on public.meeting_external_token_attempts (token_prefix, attempted_at desc);

alter table public.meeting_external_token_attempts enable row level security;

drop policy if exists meeting_external_token_attempts_block_all on public.meeting_external_token_attempts;
create policy meeting_external_token_attempts_block_all
  on public.meeting_external_token_attempts for all
  to authenticated
  using (false)
  with check (false);

-- ============================================================
-- 3. meetings_external_redeem_token — confidentiality + single-use guards
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
begin
  if p_token is null then
    raise exception 'invalid_token' using errcode = 'check_violation';
  end if;

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

comment on function public.meetings_external_redeem_token(text, text, text) is
  'Redeem an external-invitee token. Single-use, confidentiality-gated, '
  'rate-limited at 20 failed attempts per IP per 5 minutes. Use the '
  'companion meetings_external_token_record_attempt RPC to log each call.';

create or replace function public.meetings_external_redeem_token(p_token text)
returns jsonb
language sql
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select public.meetings_external_redeem_token(p_token, null, null);
$$;

grant execute on function public.meetings_external_redeem_token(text) to anon, authenticated;
grant execute on function public.meetings_external_redeem_token(text, text, text) to anon, authenticated;
