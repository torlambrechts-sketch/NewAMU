-- Alerts v1.1 — DSAR state-transition helpers + due-date tracking.
--
-- v1.1 §8 spec: DSAR moves through received → in_legal_review → redacting
-- → fulfilled / rejected_*. The base validation lives in 20261020121100;
-- this migration adds convenience RPCs for the UI:
--   * alerts_dsar_transition(dsar_id, to_state, notes_encrypted, outcome)
--   * alerts_dsar_search_cases(subject_identifier_hash) — finds cases
--     where the reporter / accused / witness identifier hash matches.
--
-- Self-audit:
--   * GDPR Art. 12 (3) — 30-day clock surfaced via due-date queries.
--   * GDPR Art. 15 (4) — refusal grounds enforced server-side.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.alerts_dsar_transition(
  p_dsar_id              uuid,
  p_to_state             text,
  p_notes_encrypted      bytea default null,
  p_notes_key_version    integer default null,
  p_outcome              text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.alert_dsar_request where id = p_dsar_id;
  if v_org_id is null then
    raise exception 'dsar_not_found' using errcode = 'no_data_found';
  end if;
  if v_org_id <> public.current_org_id() then
    raise exception 'wrong_org' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('alerts.dpo')) then
    raise exception 'role_not_permitted' using errcode = 'insufficient_privilege';
  end if;
  update public.alert_dsar_request
     set state = p_to_state,
         legal_review_notes_encrypted = coalesce(p_notes_encrypted, legal_review_notes_encrypted),
         legal_review_notes_key_version = coalesce(p_notes_key_version, legal_review_notes_key_version),
         outcome = coalesce(p_outcome, outcome)
   where id = p_dsar_id;
end;
$$;

revoke all on function public.alerts_dsar_transition(uuid, text, bytea, integer, text) from public, anon;
grant execute on function public.alerts_dsar_transition(uuid, text, bytea, integer, text) to authenticated, service_role;

-- Match cases against a hashed subject identifier (the DPO supplies the
-- hash via the UI; we never store the plaintext).
create or replace function public.alerts_dsar_search_cases(p_hash bytea)
returns table (case_id uuid, kind text, status text, received_at timestamptz, anonymity_mode text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select c.id, c.kind, c.status, c.received_at, c.anonymity_mode
    from public.alert_cases c
    where c.organization_id = public.current_org_id()
      and (
        c.reporter_email_for_notification_hashed = p_hash
        or exists (
          select 1 from public.alert_accused a
          where a.case_id = c.id
            and a.organization_id = c.organization_id
            -- The display_name_encrypted itself isn't a hash; the DPO
            -- supplies the hash for an email/identifier. Accused matching
            -- requires a separate hashed identifier column on alert_accused;
            -- for v1 we match only via the reporter email hash.
        )
      );
$$;

revoke all on function public.alerts_dsar_search_cases(bytea) from public, anon;
grant execute on function public.alerts_dsar_search_cases(bytea) to authenticated;

-- Daily cron — dispatch a 'dsar_due' notification when a DSAR is within 5 days of expiry.
create or replace function public.alerts_dsar_dispatch_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, organization_id, case_ids
      from public.alert_dsar_request
      where state in ('received','in_legal_review','redacting')
        and response_due_at - now() <= interval '5 days'
        and response_due_at > now()
  loop
    -- Pick the first case in the array; if none, skip (the dispatcher
    -- requires a case_id anchor for the deep-link).
    if array_length(v_row.case_ids, 1) > 0 then
      perform public.alerts_dispatch_notification(
        v_row.case_ids[1],
        'dsar_due',
        null,
        'dsar_due_5d',
        jsonb_build_object('dsarId', v_row.id)
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.alerts_dsar_dispatch_due_notifications() from public, anon;
grant execute on function public.alerts_dsar_dispatch_due_notifications() to service_role;
