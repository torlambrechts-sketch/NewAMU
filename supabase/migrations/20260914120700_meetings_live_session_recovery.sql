-- Meetings · live-session recovery for chair-disconnect zombie state (§8.35).
--
-- Why
--   If a chair closes the browser mid-meeting without clicking "Avslutt
--   møte", meeting_live_sessions.ended_at stays null. The session is
--   effectively zombie: appears live in the index, no one can re-enter
--   without manual SQL. We add an authenticated RPC the chair (or any
--   user with meetings.manage) can call to force-end the session.
--
--   Defensive guards: function must run as SECURITY INVOKER so the
--   caller's RLS dictates which meeting_live_sessions row they can write.
--   Additional permission check inside ensures the caller has either
--   org-admin or meetings.manage.

set local search_path = public, pg_catalog;

create or replace function public.meetings_recover_live_session(
  p_meeting_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage')) then
    raise exception 'forbidden: meetings.manage or org-admin required';
  end if;

  -- RLS-filtered update — if the user can't see the session, nothing
  -- happens. We return whether the row actually transitioned.
  update public.meeting_live_sessions
     set ended_at = now()
   where meeting_id = p_meeting_id
     and ended_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.meetings_recover_live_session(uuid) from public, anon;
grant execute on function public.meetings_recover_live_session(uuid) to authenticated;

comment on function public.meetings_recover_live_session(uuid) is
  'Force-end a zombie live-meeting session. Requires meetings.manage or org-admin. Returns true if a row was updated, false otherwise (already ended or RLS-hidden).';
