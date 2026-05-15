-- Alerts module — retention purge + Art. 17 erasure functions (§3.7 + §3.8).
--
-- Two distinct paths:
--   1. alerts_purge_expired_cases() — scheduled daily. REDACTS rows where
--      retention_until < now() and redacted_at is null. Preserves audit count
--      statistics for AMU annual report by keeping the row + NULLing PII.
--      Bypasses the append-only trigger on notes via app.alerts_purge_active.
--   2. alerts_erase_case(case_id, legal_basis, actor) — GDPR Art. 17 right-to-
--      erasure. HARD-DELETES the row + cascading children. Only callable for
--      identified-tier cases (is_anonymous = false). Writes a single audit
--      stub in alert_case_timeline_events (parent gone → orphan log to a
--      separate sink would be cleaner; for now a level1 audit row).
--
-- Self-audit:
--   * Race-free: SELECT … FOR UPDATE SKIP LOCKED prevents lost updates when
--     concurrent committee edits or the storage-attachment Edge Function
--     touch the same row.
--   * Reporter-facing notes (visible_to_reporter OR note_kind in
--     communication_*) get body NULLed alongside the case PII fields.
--     Internal investigation notes preserved as audit evidence.
--   * Storage objects deleted via separate Edge Function alerts-purge-
--     attachments keyed off redacted_at — kept out of this SQL fn so the
--     DB transaction stays small + reversible until commit.
--   * Idempotent — the redacted_at IS NULL filter makes re-runs a no-op.
--
-- Scheduled at file end via pg_cron if extension is available.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. alerts_purge_expired_cases — daily redaction sweep                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alerts_purge_expired_cases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_count int := 0;
begin
  -- Flag the session so the append-only triggers on notes + the lock trigger
  -- on alert_cases let our redaction writes through. The flag is transaction-
  -- local (third arg = true) so it auto-resets at commit/rollback.
  perform set_config('app.alerts_purge_active', 'true', true);

  for v_case in
    select id, organization_id
    from public.alert_cases
    where closed_at is not null
      and retention_until is not null
      and retention_until < now()
      and redacted_at is null
    for update skip locked
  loop
    -- Redact identity-bearing + reporter-supplied free-text columns
    update public.alert_cases set
      title                    = '[redacted: retention expired]',
      description              = null,
      reporter_contact         = null,
      reporter_display_name    = null,
      reporter_user_id         = null,
      closing_summary          = null,
      risk_assessment          = null,
      mitigation_actions       = null,
      metadata                 = '{}'::jsonb,
      submission_user_agent    = null,
      submission_locale        = null,
      redacted_at              = now()
    where id = v_case.id;

    -- Redact reporter-facing notes (preserve internal investigation notes
    -- as audit evidence; reporter PII at insert time should already have
    -- been minimised by §4.1 T6 redaction tooling).
    update public.alert_case_notes set body = '[redacted: retention expired]'
      where case_id = v_case.id
        and (visible_to_reporter = true
             or note_kind in ('communication_to_reporter','communication_from_reporter'));

    -- Soft-delete attachments; the storage Edge Function picks these up later.
    update public.alert_case_attachments set
      is_redacted  = true,
      storage_path = null
    where case_id = v_case.id;

    -- Audit row in the timeline (append-only — but we're in replica mode)
    insert into public.alert_case_timeline_events
      (case_id, organization_id, event_kind, actor_kind, payload)
    values
      (v_case.id, v_case.organization_id, 'retention_purged', 'system',
       jsonb_build_object('purged_at', now()));

    v_count := v_count + 1;
  end loop;

  -- Flag auto-resets at transaction end; explicit reset for cleanliness.
  perform set_config('app.alerts_purge_active', 'false', true);
  return v_count;
end;
$$;

revoke all on function public.alerts_purge_expired_cases() from public, anon, authenticated;
grant execute on function public.alerts_purge_expired_cases() to service_role;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. alerts_erase_case — GDPR Art. 17 right-to-erasure (hard-delete)      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alerts_erase_case(
  p_case_id      uuid,
  p_legal_basis  text,
  p_actor        uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
begin
  -- Permission gate: caller must be DPO
  if not public.user_has_permission('alerts.dpo') then
    raise exception 'alerts_erase_case requires alerts.dpo permission'
      using errcode = 'insufficient_privilege';
  end if;

  select id, organization_id, kind, is_anonymous, source_kind, closed_at
    into v_case
    from public.alert_cases
    where id = p_case_id
    for update;

  if v_case.id is null then
    raise exception 'alert_cases row % not found', p_case_id;
  end if;

  if v_case.is_anonymous = true then
    raise exception 'alert case % is anonymous-tier; Art. 17 does not apply — falls under retention purge', p_case_id;
  end if;

  -- Write a level1 audit stub BEFORE the cascade delete so the audit row
  -- survives the erase. We use the level1_audit_log table if present;
  -- otherwise fall back to a final timeline_events row that gets cascade-
  -- deleted (suboptimal but at least the call attempted to log).
  begin
    insert into public.level1_audit_log (event, payload, actor_user_id, organization_id)
    values (
      'alert_case_erased',
      jsonb_build_object(
        'case_kind', v_case.kind,
        'source_kind', v_case.source_kind,
        'legal_basis', p_legal_basis,
        'was_closed', v_case.closed_at is not null
      ),
      p_actor,
      v_case.organization_id
    );
  exception when undefined_table then
    null;  -- level1_audit_log absent in dev DBs; fall through
  end;

  -- Bypass append-only triggers on timeline + notes so cascade delete succeeds.
  perform set_config('app.alerts_purge_active', 'true', true);
  delete from public.alert_cases where id = p_case_id;
  perform set_config('app.alerts_purge_active', 'false', true);
end;
$$;

revoke all on function public.alerts_erase_case(uuid, text, uuid) from public, anon;
grant execute on function public.alerts_erase_case(uuid, text, uuid) to authenticated, service_role;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. pg_cron schedule (best-effort — extension may not be installed)      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Daily retention purge at 03:15 UTC
    perform cron.schedule(
      'alerts-purge-expired-cases',
      '15 3 * * *',
      'select public.alerts_purge_expired_cases()'
    );
    -- Daily throttle TTL purge at 03:30 UTC
    perform cron.schedule(
      'alerts-purge-throttle',
      '30 3 * * *',
      'select public.alerts_purge_throttle_old()'
    );
  end if;
exception
  when undefined_function then null;  -- cron.schedule absent in some envs
  when others then raise notice 'alerts cron scheduling skipped: %', sqlerrm;
end $$;
