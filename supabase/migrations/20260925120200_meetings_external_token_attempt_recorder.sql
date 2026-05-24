-- Recorder RPC for external-token redemption attempts.
--
-- Background: meetings_external_redeem_token() raises on every failure
-- (invalid token, expired, used, etc). Those raises roll back the
-- transaction, so any audit INSERT done inside the same call would be
-- lost. The recorder lives in a separate transaction (called after
-- catching the exception in the edge function / client) and is the
-- authoritative writer of meeting_external_token_attempts.
--
-- Caller contract:
--   - On success: call with outcome='ok' and meeting_id from the payload.
--   - On exception: parse the SQLERRM, map it to one of the canonical
--     outcomes, and call with the same token_prefix + client_ip.

set local search_path = public, pg_catalog;

create or replace function public.meetings_external_token_record_attempt(
  p_token_prefix text,
  p_outcome text,
  p_client_ip text default null,
  p_user_agent text default null,
  p_meeting_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if p_token_prefix is null or length(p_token_prefix) <> 8 then
    p_token_prefix := substring(coalesce(p_token_prefix, '') from 1 for 8);
  end if;
  if p_outcome is null or p_outcome not in (
    'ok', 'not_found', 'expired', 'used',
    'confidential_blocked', 'invalid_format', 'rate_limited'
  ) then
    p_outcome := 'invalid_format';
  end if;
  insert into public.meeting_external_token_attempts (
    token_prefix, outcome, client_ip, user_agent, meeting_id
  ) values (
    p_token_prefix, p_outcome, p_client_ip, p_user_agent, p_meeting_id
  );
end;
$$;

comment on function public.meetings_external_token_record_attempt(text, text, text, text, uuid) is
  'Inserts a single row into meeting_external_token_attempts. Designed to '
  'be called by the edge function / external viewer after each token-redemption '
  'attempt — this preserves the audit trail across exceptions raised by '
  'meetings_external_redeem_token (which rolls back inside its own raise).';

grant execute on function public.meetings_external_token_record_attempt(text, text, text, text, uuid)
  to anon, authenticated;
