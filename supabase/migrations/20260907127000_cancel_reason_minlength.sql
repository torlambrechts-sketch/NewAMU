-- gov_outbox_cancel + amu_backlog_dismiss — standardize reason ≥10 chars.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 + AML § 7-2 (sporbarhet på
--   avvist saksbehandling). The two RPCs used different minimum-length
--   gates ("non-empty" vs "non-empty after btrim"), and the UIs were
--   stricter still (≥3 chars). A 10-character floor matches the planner-
--   side audit expectation that a dismissal reason is at least a short
--   sentence — "duplikat" alone (8 chars) was previously accepted.
--   Restrisiko deferred: free-form free-text — a future structured-reason
--   enum (sprint+1) will tighten this further.

set local search_path = public, pg_catalog;

-- ── 1. gov_outbox_cancel — re-issue with ≥10-char validation ──────────────

create or replace function public.gov_outbox_cancel(
  p_id     uuid,
  p_reason text
)
returns public.gov_notifications_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row     public.gov_notifications_outbox;
  v_status  text;
  v_actor   uuid := auth.uid();
  v_payload jsonb;
begin
  if v_actor is null then
    raise exception 'gov_outbox_cancel: not authenticated';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'cancellation reason must be ≥10 characters'
      using errcode = '22023';
  end if;

  select * into v_row
    from public.gov_notifications_outbox
   where id = p_id
   for update;
  if not found then
    raise exception 'gov_outbox_cancel: outbox row % not found', p_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'gov_outbox_cancel: org mismatch';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('gov.outbox_triage')) then
    raise exception 'gov_outbox_cancel: missing permission gov.outbox_triage';
  end if;

  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  v_status  := coalesce(v_payload ->> 'status', '');
  if v_row.resolved_at is not null then
    raise exception 'gov_outbox_cancel: row % is already resolved', p_id;
  end if;
  if v_status not in ('awaiting_human', '', 'pending') then
    raise exception 'gov_outbox_cancel: row % is not cancellable (status=%)', p_id, v_status;
  end if;

  update public.gov_notifications_outbox
     set resolved_at = now(),
         payload     = v_payload
                        || jsonb_build_object('status', 'cancelled')
                        || jsonb_build_object('cancellation', jsonb_build_object(
                              'reason',       p_reason,
                              'cancelled_by', v_actor::text,
                              'cancelled_at', now()
                           ))
   where id = p_id
  returning * into v_row;

  insert into public.gov_outbox_triage_log (
    outbox_id, organization_id, action, actor, at, payload_snapshot, reason
  ) values (
    p_id, v_row.organization_id, 'cancelled', v_actor, now(), v_payload, p_reason
  );

  return v_row;
end;
$$;

revoke all on function public.gov_outbox_cancel(uuid, text) from public;
grant execute on function public.gov_outbox_cancel(uuid, text) to authenticated;

comment on function public.gov_outbox_cancel(uuid, text) is
  'Human triage: cancels a pending or awaiting_human outbox row. Reason is required (≥10 characters; tightened from non-empty in _127000) and logged to gov_outbox_triage_log. Requires gov.outbox_triage permission.';

-- ── 2. amu_backlog_dismiss — re-issue with ≥10-char validation ────────────

create or replace function public.amu_backlog_dismiss(
  p_id     uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_backlog public.amu_agenda_backlog;
  v_reason  text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if length(v_reason) < 10 then
    raise exception 'cancellation reason must be ≥10 characters'
      using errcode = '22023';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('meetings.manage')) then
    raise exception 'forbidden: meetings.manage required';
  end if;

  select * into v_backlog
    from public.amu_agenda_backlog
   where id = p_id
   for update;

  if not found then
    raise exception 'backlog_not_found: %', p_id;
  end if;

  if v_backlog.organization_id is distinct from public.current_org_id() then
    raise exception 'cross_org_dismiss_denied';
  end if;

  insert into public.amu_backlog_dismissal_log (
    organization_id, backlog_id, dismissed_by, reason, snapshot
  ) values (
    v_backlog.organization_id,
    v_backlog.id,
    v_uid,
    v_reason,
    jsonb_build_object(
      'id',              v_backlog.id,
      'organization_id', v_backlog.organization_id,
      'meeting_type',    v_backlog.meeting_type,
      'title',           v_backlog.title,
      'description',     v_backlog.description,
      'source_module',   v_backlog.source_module,
      'source_id',       v_backlog.source_id,
      'priority',        v_backlog.priority,
      'drained_at',      v_backlog.drained_at,
      'drained_into',    v_backlog.drained_into,
      'created_at',      v_backlog.created_at
    )
  );

  delete from public.amu_agenda_backlog where id = v_backlog.id;
end;
$fn$;

revoke all on function public.amu_backlog_dismiss(uuid, text) from public, anon;
grant execute on function public.amu_backlog_dismiss(uuid, text) to authenticated;

comment on function public.amu_backlog_dismiss(uuid, text) is
  'Admin RPC — dismisses a single amu_agenda_backlog row by appending the full snapshot to amu_backlog_dismissal_log (append-only) and deleting the backlog row. Requires meetings.manage + reason of ≥10 characters (tightened from non-empty in _127000). AML § 7-2 + IK-f § 5 nr. 8 sporbarhet.';

do $$
begin
  raise notice 'gov_outbox_cancel + amu_backlog_dismiss re-issued with ≥10-char reason floor.';
end
$$;
