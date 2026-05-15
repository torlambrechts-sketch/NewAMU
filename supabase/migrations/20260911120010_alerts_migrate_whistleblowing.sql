-- Phase B1 — migrate whistleblowing_cases → alert_cases.
--
-- Mapping:
--   category (legacy text) → system_template_id:
--     'aml'         → 'aml-varsel-generell'
--     'corruption'  → 'aml-varsel-okonomisk-misbruk'
--     'financial'   → 'aml-varsel-okonomisk-misbruk'
--     'harassment'  → 'aml-varsel-trakassering'
--     'hms'         → 'aml-varsel-hms-fare'
--     'environment' → 'aml-varsel-miljo'
--     'privacy'     → 'gdpr-brudd-konfidensialitet'  (kind also flips to gdpr_breach)
--     'ethics'      → 'etisk-bekymring'              (kind also flips to ethical_concern)
--     other         → 'aml-varsel-generell'
--
-- Other columns:
--   access_key, title, description, occurred_at_text, is_anonymous,
--   reporter_contact, reporter_user_id, status, received_at,
--   acknowledgement_due_at, closed_at, closing_summary copy 1:1.
--   attachment_paths → reified as alert_case_attachments rows (one per path).
--   who_what_where  → concatenated into description (legacy form had it as
--                     a separate field; new schema folds it under metadata
--                     for non-template-bound forms).
--   category text → preserved in alert_cases.category column for traceability.
--
-- Uses app.alerts_purge_active='true' to bypass lock trigger (we're
-- legitimately setting reporter_user_id + acknowledgement_due_at +
-- confidentiality_level at insert from legacy data, which the trigger
-- would otherwise wall off via the immutability check on INSERT-via-UPDATE
-- pattern — but on plain INSERT the trigger doesn't fire, so we don't
-- strictly need the bypass. Kept here defensively.)
--
-- Idempotent: skips rows already present in alert_cases by access_key match.

set local search_path = public, pg_catalog;

do $$
declare
  v_row record;
  v_template_id text;
  v_kind text;
  v_committee_kind text;
  v_inserted int := 0;
  v_skipped int := 0;
begin
  for v_row in
    select * from public.whistleblowing_cases
    where access_key not in (select access_key from public.alert_cases)
  loop
    -- Map category to template + kind
    case lower(trim(v_row.category))
      when 'aml'         then v_template_id := 'aml-varsel-generell';        v_kind := 'whistleblowing';
      when 'corruption'  then v_template_id := 'aml-varsel-okonomisk-misbruk'; v_kind := 'whistleblowing';
      when 'financial'   then v_template_id := 'aml-varsel-okonomisk-misbruk'; v_kind := 'whistleblowing';
      when 'harassment'  then v_template_id := 'aml-varsel-trakassering';    v_kind := 'whistleblowing';
      when 'hms'         then v_template_id := 'aml-varsel-hms-fare';         v_kind := 'whistleblowing';
      when 'environment' then v_template_id := 'aml-varsel-miljo';            v_kind := 'whistleblowing';
      when 'privacy'     then v_template_id := 'gdpr-brudd-konfidensialitet'; v_kind := 'gdpr_breach';
      when 'ethics'      then v_template_id := 'etisk-bekymring';             v_kind := 'ethical_concern';
      else                    v_template_id := 'aml-varsel-generell';         v_kind := 'whistleblowing';
    end case;

    -- Insert. The before-insert trigger pulls defaults from the template
    -- (acknowledgement_due_at, retention, confidentiality, snapshots, kind).
    -- We pass explicit columns for everything that came from legacy.
    insert into public.alert_cases (
      id, organization_id, access_key, kind, source_kind, system_template_id,
      title, description,
      category,
      occurred_at_text, is_anonymous, reporter_contact, reporter_user_id,
      status, received_at, acknowledgement_due_at, closed_at, closing_summary,
      created_at, updated_at
    ) values (
      v_row.id, v_row.organization_id, v_row.access_key, v_kind, 'system', v_template_id,
      v_row.title,
      case
        when coalesce(trim(v_row.who_what_where), '') = '' then coalesce(v_row.description, '')
        else coalesce(v_row.description, '') || E'\n\n--- Hvem, hva, hvor ---\n' || v_row.who_what_where
      end,
      v_row.category,
      v_row.occurred_at_text, v_row.is_anonymous,
      case when v_row.is_anonymous then null else v_row.reporter_contact end,
      v_row.reporter_user_id,
      coalesce(v_row.status, 'received'),
      v_row.received_at, v_row.acknowledgement_due_at, v_row.closed_at, v_row.closing_summary,
      v_row.created_at, v_row.updated_at
    );

    -- Reify attachment_paths into alert_case_attachments rows
    if v_row.attachment_paths is not null and array_length(v_row.attachment_paths, 1) > 0 then
      insert into public.alert_case_attachments
        (case_id, organization_id, storage_bucket, storage_path, filename, created_at)
      select
        v_row.id, v_row.organization_id, 'alert-attachments', p,
        regexp_replace(p, '^.*/', ''), v_row.received_at
      from unnest(v_row.attachment_paths) as p;
    end if;

    v_inserted := v_inserted + 1;
  end loop;

  select count(*) into v_skipped
    from public.whistleblowing_cases
    where access_key in (select access_key from public.alert_cases);

  raise notice 'whistleblowing migration: % new rows inserted, % already-present skipped',
    v_inserted, v_skipped - v_inserted;
end $$;
