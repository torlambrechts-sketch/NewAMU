-- Close two GDPR Art. 33 (5) gaps in alert_cases lock trigger that the
-- external review caught: datatilsynet_reference + data_subjects_notified_at
-- were editable post-close, letting a committee member rewrite the
-- Datatilsynet correspondence trail after the case was signed off.
-- Spec §3.4 requires both fields immutable.
--
-- Idempotent (CREATE OR REPLACE).

set local search_path = public, pg_catalog;

create or replace function public.alert_cases_before_update_defaults() returns trigger language plpgsql as $$
begin
  if new.organization_id is distinct from old.organization_id then raise exception 'organization_id is immutable on alert_cases'; end if;
  if new.access_key is distinct from old.access_key then raise exception 'access_key is immutable on alert_cases'; end if;
  if new.kind is distinct from old.kind then raise exception 'kind is immutable on alert_cases'; end if;
  if new.source_kind is distinct from old.source_kind then raise exception 'source_kind is immutable on alert_cases'; end if;
  if new.system_template_id is distinct from old.system_template_id then raise exception 'system_template_id is immutable on alert_cases'; end if;
  if new.org_template_id is distinct from old.org_template_id then raise exception 'org_template_id is immutable on alert_cases'; end if;
  if new.received_at is distinct from old.received_at then raise exception 'received_at is immutable on alert_cases'; end if;
  if (coalesce(current_setting('app.alerts_purge_active', true), 'false') <> 'true') then
    if new.is_anonymous is distinct from old.is_anonymous then raise exception 'is_anonymous is immutable on alert_cases' using errcode = 'check_violation'; end if;
    if new.reporter_user_id is distinct from old.reporter_user_id then raise exception 'reporter_user_id is immutable on alert_cases' using errcode = 'check_violation'; end if;
    if new.reporter_contact is distinct from old.reporter_contact then raise exception 'reporter_contact is immutable on alert_cases' using errcode = 'check_violation'; end if;
    if new.reporter_display_name is distinct from old.reporter_display_name then raise exception 'reporter_display_name is immutable on alert_cases' using errcode = 'check_violation'; end if;
    if new.confidentiality_level is distinct from old.confidentiality_level then raise exception 'confidentiality_level is immutable on alert_cases' using errcode = 'check_violation'; end if;
    if new.acknowledgement_due_at is distinct from old.acknowledgement_due_at then raise exception 'acknowledgement_due_at is immutable on alert_cases' using errcode = 'check_violation'; end if;
  end if;
  if old.closed_at is not null and coalesce(current_setting('app.alerts_purge_active', true), 'false') <> 'true' then
    if new.title is distinct from old.title then raise exception 'alert_cases.title is immutable post-close' using errcode = 'check_violation'; end if;
    if new.description is distinct from old.description then raise exception 'alert_cases.description is immutable post-close' using errcode = 'check_violation'; end if;
    if new.closed_at is null then raise exception 'closed_at cannot revert to null on alert_cases' using errcode = 'check_violation'; end if;
    if new.closing_summary is distinct from old.closing_summary then raise exception 'closing_summary is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.closing_outcome is distinct from old.closing_outcome then raise exception 'closing_outcome is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.status not in ('closed','dismissed') then raise exception 'status cannot revert from closed state on alert_cases' using errcode = 'check_violation'; end if;
    if new.severity is distinct from old.severity then raise exception 'severity is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.breach_type is distinct from old.breach_type then raise exception 'breach_type is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.affected_subjects_actual is distinct from old.affected_subjects_actual then raise exception 'affected_subjects_actual is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.datatilsynet_reported_at is distinct from old.datatilsynet_reported_at then raise exception 'datatilsynet_reported_at is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.datatilsynet_reference is distinct from old.datatilsynet_reference then raise exception 'datatilsynet_reference is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
    if new.data_subjects_notified_at is distinct from old.data_subjects_notified_at then raise exception 'data_subjects_notified_at is immutable post-close on alert_cases' using errcode = 'check_violation'; end if;
  end if;
  if old.closed_at is null and new.closed_at is not null and new.retention_until is null then
    new.retention_until := new.closed_at + ((coalesce(
      (select coalesce(s.override_retention_years, t.default_retention_years) from public.alert_system_templates t left join public.alert_org_template_settings s on s.organization_id = new.organization_id and s.system_template_id = t.id where t.id = new.system_template_id),
      (select default_retention_years from public.alert_org_templates where id = new.org_template_id),
      5))::text || ' years')::interval;
  end if;
  return new;
end;
$$;
