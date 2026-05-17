-- Partner Console — clock hardening (cross-tab dup, employee-as-consultant).
--
-- Two leak paths in _123300_partner_console_v0:
--   (C-7) The auto_session-dedup in partner_start_time_entry only closes
--   open rows for the SAME (user, org). A consultant with multiple tabs
--   pointing at different customer orgs can rack up parallel timers —
--   double-bills the partner firm.
--   (C-8) Nothing stops a consultant who is also an employee of an org
--   from clocking time against their own home org. Operational fraud
--   risk (free over-time disguised as customer work).
--
-- Fix: re-issue partner_start_time_entry with:
--   - close ALL open auto_session rows for the user across ALL orgs at
--     start (capped duration 12h, matching the sweeper),
--   - refuse to start when caller's profiles.organization_id matches
--     the target customer org.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: IK-f § 5 nr. 7 (integritet i timeregistre-
--   ringer), AML § 14-6 (korrekt lønns-/fakturasporbar timeoversikt),
--   bokføringsloven § 5 (sporbar dokumentasjon av tjenesteleveranse).
--   Restrisiko deferred: konsulenten kan fortsatt manuelt skrive en
--   time-entry mot egen org via source='manual'. Aksept: manuell stamp
--   er en bevisst handling og kan korrigeres av partner-manager. Sweeper
--   tar bare auto_session.

set local search_path = public, pg_catalog;

create or replace function public.partner_start_time_entry(
  p_org_id uuid,
  p_description text default null,
  p_source text default 'auto_session'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_partner   uuid;
  v_rate      numeric(10, 2);
  v_id        uuid;
  v_user_org  uuid;
begin
  if v_user is null then
    raise exception 'auth required';
  end if;
  if p_source not in ('manual', 'auto_session', 'workflow_action') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- Employee-as-consultant guard: the caller's own home org cannot be
  -- billed as consultant work. Returns null so the UI silently skips
  -- clocking (callers must already cope with null from "no membership").
  select organization_id into v_user_org
    from public.profiles
   where id = v_user;
  if v_user_org is not null and v_user_org = p_org_id then
    return null;
  end if;

  v_partner := public.partner_resolve_active_partner(p_org_id, v_user);
  if v_partner is null then
    raise exception 'no active partner membership for user % in org %', v_user, p_org_id;
  end if;

  select coalesce(m.hourly_rate_override, po.default_hourly_rate)
    into v_rate
  from public.partner_memberships m
    join public.partner_organizations po on po.id = m.partner_id
  where m.partner_id = v_partner
    and m.organization_id = p_org_id
    and m.user_id = v_user
    and m.active = true
  limit 1;

  if v_rate is null then v_rate := 1350.00; end if;

  -- Cross-tab dup defense: close EVERY open auto_session for this user,
  -- regardless of which org/partner the prior session targeted. Capped
  -- at 12h to match the partner_sweep_stale_clocks behaviour.
  if p_source = 'auto_session' then
    update public.partner_time_entries
       set ended_at = least(started_at + interval '12 hours', now()),
           metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('cross_tab_close', '1',
                                            'cross_tab_closed_at', now())
     where user_id = v_user
       and source = 'auto_session'
       and ended_at is null;
  end if;

  insert into public.partner_time_entries (
    partner_id, organization_id, user_id, started_at, description, source, hourly_rate, billable
  ) values (
    v_partner, p_org_id, v_user, now(), p_description, p_source, v_rate, true
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.partner_start_time_entry(uuid, text, text) from public;
grant execute on function public.partner_start_time_entry(uuid, text, text) to authenticated;

comment on function public.partner_start_time_entry(uuid, text, text) is
  'Open a time entry. (1) Refuses when caller.profiles.organization_id = p_org_id (employee-as-consultant). (2) For auto_session, closes ALL prior open auto_session rows for the user across ALL orgs (cross-tab dup defense), capped at 12h.';
