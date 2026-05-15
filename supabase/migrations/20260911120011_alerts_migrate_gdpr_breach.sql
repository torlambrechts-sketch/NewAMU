-- Phase B2 — migrate gdpr_breach_incidents → alert_cases (kind=gdpr_breach).
--
-- Mapping:
--   breach_type (legacy) → system_template_id:
--     'confidentiality' → 'gdpr-brudd-konfidensialitet'
--     'integrity'       → 'gdpr-brudd-integritet'
--     'availability'    → 'gdpr-brudd-tilgjengelighet'
--     'combined'        → 'gdpr-brudd-konfidensialitet' (safest default)
--
-- Column mapping:
--   detected_at        → received_at
--   deadline_at        → investigation_due_at (the 72h Datatilsynet clock)
--   reported_to_datatilsynet_at → datatilsynet_reported_at
--   reported_to_subjects_at    → data_subjects_notified_at
--   resolved_at        → closed_at
--   severity           → severity
--   breach_type        → breach_type
--   title, description, affected_categories, affected_subjects_estimate,
--   affected_subjects_actual, risk_assessment, mitigation_actions,
--   datatilsynet_reference, status, created_at, updated_at — copy 1:1.
--   dpo_user_id        → reported into metadata since alert_cases has no dpo column
--   reporter_user_id   → mapped through; identified-tier case.
--
-- Status mapping:
--   'detected'      → 'received'
--   'investigating' → 'investigation'
--   'reported'      → 'internal_review'
--   'resolved'      → 'closed'
--   'dismissed'     → 'dismissed'
--
-- Idempotent: skips rows whose id is already in alert_cases.

set local search_path = public, pg_catalog;

do $$
declare
  v_row record;
  v_template_id text;
  v_new_status text;
  v_acknowledgement_due timestamptz;
  v_inserted int := 0;
begin
  for v_row in
    select * from public.gdpr_breach_incidents
    where id not in (select id from public.alert_cases)
  loop
    case lower(coalesce(v_row.breach_type, 'confidentiality'))
      when 'confidentiality' then v_template_id := 'gdpr-brudd-konfidensialitet';
      when 'integrity'       then v_template_id := 'gdpr-brudd-integritet';
      when 'availability'    then v_template_id := 'gdpr-brudd-tilgjengelighet';
      when 'combined'        then v_template_id := 'gdpr-brudd-konfidensialitet';
      else                        v_template_id := 'gdpr-brudd-konfidensialitet';
    end case;

    case coalesce(v_row.status, 'detected')
      when 'detected'      then v_new_status := 'received';
      when 'investigating' then v_new_status := 'investigation';
      when 'reported'      then v_new_status := 'internal_review';
      when 'resolved'      then v_new_status := 'closed';
      when 'dismissed'     then v_new_status := 'dismissed';
      else                     v_new_status := 'received';
    end case;

    -- DPO has 1 business day to acknowledge per template; for legacy rows
    -- with no explicit ack timestamp, use detected_at + 1 calendar day.
    v_acknowledgement_due := coalesce(v_row.detected_at, now()) + interval '1 day';

    insert into public.alert_cases (
      id, organization_id, kind, source_kind, system_template_id,
      title, description,
      is_anonymous, reporter_user_id,
      status, severity, breach_type,
      affected_categories, affected_subjects_estimate, affected_subjects_actual,
      risk_assessment, mitigation_actions,
      received_at, acknowledgement_due_at, investigation_due_at,
      datatilsynet_reported_at, datatilsynet_reference, data_subjects_notified_at,
      closed_at,
      metadata,
      created_at, updated_at
    ) values (
      v_row.id, v_row.organization_id, 'gdpr_breach', 'system', v_template_id,
      v_row.title, coalesce(v_row.description, ''),
      false,                                   -- DPO-submitted, never anonymous
      v_row.reporter_user_id,
      v_new_status,
      coalesce(v_row.severity, 'medium'),
      v_row.breach_type,
      v_row.affected_categories,
      v_row.affected_subjects_estimate, v_row.affected_subjects_actual,
      v_row.risk_assessment, v_row.mitigation_actions,
      coalesce(v_row.detected_at, v_row.created_at),
      v_acknowledgement_due,
      v_row.deadline_at,
      v_row.reported_to_datatilsynet_at, v_row.datatilsynet_reference,
      v_row.reported_to_subjects_at,
      v_row.resolved_at,
      jsonb_strip_nulls(jsonb_build_object('legacy_dpo_user_id', v_row.dpo_user_id)),
      v_row.created_at, v_row.updated_at
    );

    v_inserted := v_inserted + 1;
  end loop;

  raise notice 'gdpr_breach migration: % new rows inserted', v_inserted;
end $$;
