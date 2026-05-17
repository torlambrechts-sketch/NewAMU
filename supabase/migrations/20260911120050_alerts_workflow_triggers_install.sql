-- Fix-up: install the alert_cases workflow-emission triggers AFTER the
-- alert_cases table is created. _20260907120400_alerts_workflow_emission.sql
-- sorts BEFORE _20260911120000_alerts_module_core.sql, so on a fresh-DB
-- apply the trigger-creation do-block in _120400 sees `to_regclass(...)
-- is null` and silently exits. Same problem repeats in
-- _20260907121600_alerts_fingerprint_hmac.sql (which re-issues the
-- emit-submitted trigger function with the new per-org HMAC signature
-- but only inside a to_regclass guard).
--
-- This migration runs AFTER alert_cases exists. It:
--   1. Re-issues both trigger functions so a fresh DB picks up the
--      _121600 HMAC signature.
--   2. Installs the two trigger bindings (drop-create idempotent).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 (varslings-flyt må emisjonere fra
--   dag 1 — uten denne migrasjonen mangler hele alerts→workflow-broen
--   på fersk DB), GDPR Art. 33 (72-timersfrist for personvernbrudd —
--   broen via ON_GDPR_BREACH_REPORTED må være koblet før første rapport
--   mottas), IK-f § 5 nr. 8.
--   Restrisiko deferred: orgs som submittet alerts FØR denne migrasjonen
--   på en fersk DB emisjonerte aldri workflow-events. Re-emisjon for
--   historiske rader er ikke automatisert.

set local search_path = public, pg_catalog;

do $migrate$
begin
  if to_regclass('public.alert_cases') is null then
    raise notice 'alert_cases still not present — _20260911120000_alerts_module_core.sql has not run. This should not happen given the sort order; re-run apply.';
    return;
  end if;

  -- ── (1) Re-issue trg_alert_cases_workflow_emit_submitted with the
  --        per-org HMAC fingerprint signature from _121600. (On a fresh
  --        DB, _121600's own re-issue was skipped by to_regclass.)
  execute $fn$
    create or replace function public.trg_alert_cases_workflow_emit_submitted()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_payload jsonb;
      v_is_breach boolean;
    begin
      perform set_config('app.workflow_confidentiality', 'confidential', true);

      v_payload := jsonb_build_object(
        'id',                new.id,
        'rowId',             new.id,
        'organization_id',   new.organization_id,
        'kind',              new.kind,
        'category',          new.category,
        'category_id',       new.category_id,
        'severity',          new.severity,
        'status',            new.status,
        'anonymous',         new.is_anonymous,
        'is_anonymous',      new.is_anonymous,
        'aware_at',          new.received_at,
        'received_at',       new.received_at,
        'confidentiality_level', new.confidentiality_level,
        'system_template_id', new.system_template_id,
        'description_sha256', public.alerts_text_fingerprint(new.organization_id, new.description),
        'title_sha256',       public.alerts_text_fingerprint(new.organization_id, new.title),
        'breach_type',        new.breach_type,
        'investigation_due_at', new.investigation_due_at
      );

      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'alerts', 'ON_ALERT_SUBMITTED', v_payload
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;

      v_is_breach := (new.kind = 'gdpr_breach')
        or (new.category in ('personvernbrudd', 'gdpr-brudd', 'gdpr_breach'));

      if v_is_breach then
        begin
          perform public.workflow_dispatch_db_event(
            new.organization_id, 'alerts', 'ON_GDPR_BREACH_REPORTED',
            v_payload || jsonb_build_object(
              'gdpr_aware_at',       new.received_at,
              'gdpr_72h_deadline_at',
                coalesce(new.investigation_due_at, new.received_at + interval '72 hours')
            )
          );
        exception
          when undefined_function then null;
          when undefined_table    then null;
          when others             then null;
        end;
      end if;

      return new;
    end;
    $body$;
  $fn$;

  -- ── (2) Re-issue trg_alert_cases_workflow_emit_status (body verbatim
  --        from _120400 lines 369-432; no fingerprint dependency, so
  --        identical content — just ensures fresh DBs have it).
  execute $fn$
    create or replace function public.trg_alert_cases_workflow_emit_status()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_event   text;
      v_payload jsonb;
    begin
      if new.status is not distinct from old.status then
        return new;
      end if;

      v_event := case new.status
        when 'triage'          then 'ON_ALERT_TRIAGED'
        when 'investigation'   then 'ON_ALERT_TRIAGED'
        when 'internal_review' then 'ON_ALERT_ESCALATED'
        when 'escalated'       then 'ON_ALERT_ESCALATED'
        when 'closed'          then 'ON_ALERT_CLOSED'
        when 'dismissed'       then 'ON_ALERT_CLOSED'
        else null
      end;

      if v_event is null then
        return new;
      end if;

      perform set_config('app.workflow_confidentiality', 'confidential', true);

      v_payload := jsonb_build_object(
        'id',                new.id,
        'rowId',             new.id,
        'organization_id',   new.organization_id,
        'kind',              new.kind,
        'category',          new.category,
        'severity',          new.severity,
        'status',            new.status,
        'old_status',        old.status,
        'anonymous',         new.is_anonymous,
        'is_anonymous',      new.is_anonymous,
        'aware_at',          new.received_at,
        'received_at',       new.received_at,
        'confidentiality_level', new.confidentiality_level,
        'system_template_id', new.system_template_id,
        'acknowledged_at',   new.acknowledged_at,
        'closed_at',         new.closed_at,
        'closing_outcome',   new.closing_outcome
      );

      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'alerts', v_event, v_payload
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;

      return new;
    end;
    $body$;
  $fn$;

  -- ── (3) Install the trigger bindings. drop-create idempotent.
  execute 'drop trigger if exists alert_cases_workflow_emit_submitted_tg on public.alert_cases';
  execute 'create trigger alert_cases_workflow_emit_submitted_tg
           after insert on public.alert_cases
           for each row execute function public.trg_alert_cases_workflow_emit_submitted()';

  execute 'drop trigger if exists alert_cases_workflow_emit_status_tg on public.alert_cases';
  execute 'create trigger alert_cases_workflow_emit_status_tg
           after update of status on public.alert_cases
           for each row execute function public.trg_alert_cases_workflow_emit_status()';

  raise notice 'alert_cases workflow emission triggers installed (catch-up after _20260911120000_alerts_module_core).';
end
$migrate$;
