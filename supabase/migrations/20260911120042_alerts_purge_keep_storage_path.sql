-- Update alerts_purge_expired_cases so it keeps alert_case_attachments.storage_path
-- intact when marking is_redacted=true. The alerts-purge-attachments Edge
-- Function (deployed separately) reads the redacted-with-path rows, deletes
-- the underlying storage objects, then nulls storage_path.
--
-- This sequencing means PII bytes are removed from storage even though the
-- row stays around long enough for the EF to find it. Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.alerts_purge_expired_cases() returns integer language plpgsql security definer set search_path = public as $$
declare v_case record; v_count int := 0;
begin
  perform set_config('app.alerts_purge_active', 'true', true);
  for v_case in
    select id, organization_id from public.alert_cases
    where closed_at is not null and retention_until is not null and retention_until < now() and redacted_at is null
    for update skip locked
  loop
    update public.alert_cases set
      title = '[redacted: retention expired]',
      description = null, reporter_contact = null, reporter_display_name = null,
      reporter_user_id = null, closing_summary = null, risk_assessment = null,
      mitigation_actions = null, metadata = '{}'::jsonb,
      submission_user_agent = null, submission_locale = null,
      redacted_at = now()
    where id = v_case.id;
    update public.alert_case_notes set body = '[redacted: retention expired]'
      where case_id = v_case.id
        and (visible_to_reporter = true or note_kind in ('communication_to_reporter','communication_from_reporter'));
    update public.alert_case_attachments set is_redacted = true where case_id = v_case.id;
    insert into public.alert_case_timeline_events (case_id, organization_id, event_kind, actor_kind, payload)
      values (v_case.id, v_case.organization_id, 'retention_purged', 'system', jsonb_build_object('purged_at', now()));
    v_count := v_count + 1;
  end loop;
  perform set_config('app.alerts_purge_active', 'false', true);
  return v_count;
end;
$$;
