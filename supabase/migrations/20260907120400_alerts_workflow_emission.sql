-- Alerts (Varslinger) → workflow engine event emission (P0 fix #4).
--
-- Arbeidstilsynet / Datatilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 femte ledd (taushetsplikt om
--   varsel — konfidensialitet håndheves nå strukturelt på workflow_runs),
--   GDPR Art. 33 (1) (72-timersfrist for melding av personvernbrudd via
--   ON_GDPR_BREACH_REPORTED-broen som Phase-E reminder scheduler henter).
--   Restrisiko: payloads inneholder *aldri* fritekst-beskrivelse — kun
--   en SHA-256 hash for tamper-deteksjon. Identitetsbærende felt
--   (reporter_user_id, reporter_contact, reporter_display_name) er
--   eksplisitt utelatt fra payload uansett. Anonyme varsler får
--   payload uten author.
--
-- Pre-state: modules/alerts/ shipped 2026-09-11 with /varslinger UI,
-- but the table emits zero workflow events — there is no scope file
-- registered in src/lib/workflows/registerScopes.ts and no DB trigger
-- on alert_cases. The legacy system rule aml-2a-7-whistleblower-
-- confidential (keyed on ON_SURVEY_RESPONSE_SUBMITTED for the old
-- survey-route varslingsutvalg form) never fires for /varslinger
-- submissions. This migration closes the gap by:
--   1. Adding confidentiality_level to workflow_system_rules + patching
--      workflow_fire_rule and the system-rule branch of
--      workflow_dispatch_db_event to propagate the level into
--      workflow_runs.confidentiality_level. A session GUC
--      (app.workflow_confidentiality) takes precedence so callers can
--      force 'confidential' regardless of rule-level config — this is
--      what the alert triggers below set.
--   2. Trigger on alert_cases INSERT emitting ON_ALERT_SUBMITTED with
--      a PII-stripped payload. For GDPR-breach kind the same trigger
--      ALSO emits ON_GDPR_BREACH_REPORTED so the Phase-E 72h reminder
--      scheduler picks it up.
--   3. Trigger on alert_cases UPDATE for status transitions →
--      ON_ALERT_TRIAGED / ON_ALERT_ESCALATED / ON_ALERT_CLOSED.
--   4. Seed a parallel workflow_system_rules row keyed on alerts /
--      ON_ALERT_SUBMITTED so the AML § 2A-7 confidential triage
--      task fires for the new route (the legacy survey-route rule
--      stays in place for backwards compatibility during transition).
--
-- IMPORTANT: this migration's basename (20260907120400) sorts BEFORE
-- 20260911120000_alerts_module_core.sql. On a fresh-DB apply via
-- scripts/apply-migrations.sh the alert_cases table does not yet
-- exist when this file runs — trigger creation is therefore wrapped
-- in `do $migrate$ ... to_regclass('public.alert_cases') is null`
-- guards and is *deferred* to the post-apply hook. If you apply
-- migrations sequentially against an existing DB where alert_cases
-- already exists (the common path), the triggers wire up at apply
-- time as expected. A follow-up migration after _20260911120000 can
-- re-run the do-block content if necessary; the function definitions
-- and seed row above the guard always apply.

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 0. workflow_system_rules.confidentiality_level (idempotent)             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.workflow_system_rules
  add column if not exists confidentiality_level text not null default 'standard'
    check (confidentiality_level in ('standard','restricted','confidential'));

comment on column public.workflow_system_rules.confidentiality_level is
  'Propagates into workflow_runs.confidentiality_level when the system rule fires. Mirrors workflow_rules.confidentiality_level.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Patch workflow_fire_rule to propagate confidentiality                │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Original workflow_fire_rule (archive/_20260618150000) inserts workflow_runs
-- with the default confidentiality_level = 'standard'. We re-define it here
-- to read workflow_rules.confidentiality_level, with a session-GUC override
-- (app.workflow_confidentiality) that takes precedence. The GUC mechanism is
-- the cleanest way for a table trigger (alert_cases below) to force
-- 'confidential' regardless of which rule fires.

create or replace function public.workflow_fire_rule(
  p_rule_id   uuid,
  p_org_id    uuid,
  p_event     text,
  p_context   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step  record;
  v_rule  record;
  v_level text;
  v_guc   text;
begin
  select confidentiality_level into v_rule
    from public.workflow_rules
    where id = p_rule_id;

  v_level := coalesce(v_rule.confidentiality_level, 'standard');

  -- Session-GUC override (caller can force 'confidential'). Tolerant of
  -- unset / invalid values.
  v_guc := nullif(current_setting('app.workflow_confidentiality', true), '');
  if v_guc in ('standard', 'restricted', 'confidential') then
    -- Take the strictest of (rule-level, caller-override). Ordering:
    -- standard < restricted < confidential.
    if (v_guc = 'confidential')
       or (v_guc = 'restricted' and v_level = 'standard') then
      v_level := v_guc;
    end if;
  end if;

  insert into public.workflow_runs
    (organization_id, rule_id, source_module, event, status, detail,
     confidentiality_level, input_snapshot)
  values (
    p_org_id, p_rule_id,
    coalesce(p_context->>'module', 'inspection'),
    'db_event',
    'completed',
    jsonb_build_object('event', p_event, 'context', p_context),
    v_level,
    p_context
  );

  for v_step in
    select * from public.workflow_steps
    where rule_id = p_rule_id
    order by step_order
  loop
    if v_step.delay_minutes = 0 then
      perform public.workflow_execute_step(
        p_org_id, p_rule_id, v_step.id,
        v_step.step_type, v_step.config_json, p_context
      );
    else
      insert into public.workflow_action_queue
        (organization_id, rule_id, step_id, step_type,
         config_json, context_json, execute_after, status)
      values (
        p_org_id, p_rule_id, v_step.id, v_step.step_type,
        v_step.config_json, p_context,
        now() + (v_step.delay_minutes || ' minutes')::interval,
        'pending'
      );
    end if;
  end loop;
end;
$$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Patch workflow_dispatch_db_event system-rule branch                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Re-define workflow_dispatch_db_event so the (B) branch propagates
-- v_sys.confidentiality_level into workflow_runs, with the same session-GUC
-- override semantics. Body is otherwise identical to _20260905122100.

create or replace function public.workflow_dispatch_db_event(
  p_org_id    uuid,
  p_module    text,
  p_event     text,
  p_row       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule      record;
  v_sys       record;
  v_ctx       jsonb;
  v_emp_count int;
  v_level     text;
  v_guc       text;
begin
  v_ctx := jsonb_build_object(
    'module',    p_module,
    'eventName', p_event,
    'rowId',     p_row->>'id',
    'row',       p_row
  );

  v_guc := nullif(current_setting('app.workflow_confidentiality', true), '');

  -- (A) Per-org workflow_rules
  for v_rule in
    select id
    from public.workflow_rules
    where organization_id = p_org_id
      and trigger_type      = 'db_event'
      and trigger_event_name = p_event
      and is_active          = true
      and public.workflow_row_matches_condition(condition_json, p_row)
  loop
    perform public.workflow_fire_rule(v_rule.id, p_org_id, p_event, v_ctx);
  end loop;

  -- (B) Platform-owned workflow_system_rules
  if exists (select 1 from public.workflow_system_rules
              where enabled = true and source_module = p_module
                and trigger_event_name = p_event) then

    select count(*) into v_emp_count
      from public.profiles
     where organization_id = p_org_id;

    for v_sys in
      select *
        from public.workflow_system_rules
       where enabled = true
         and source_module = p_module
         and trigger_event_name = p_event
         and (applies_if_employee_count_gte is null
              or v_emp_count >= applies_if_employee_count_gte)
         and public.workflow_row_matches_condition(condition_json, p_row)
    loop
      v_level := coalesce(v_sys.confidentiality_level, 'standard');
      if v_guc in ('standard', 'restricted', 'confidential') then
        if (v_guc = 'confidential')
           or (v_guc = 'restricted' and v_level = 'standard') then
          v_level := v_guc;
        end if;
      end if;

      begin
        perform public.workflow_execute_actions(
          p_org_id, null::uuid, v_sys.actions_json,
          v_ctx || jsonb_build_object('system_rule_slug', v_sys.slug,
                                      'system_rule_framework', v_sys.framework,
                                      'system_rule_law_refs', to_jsonb(v_sys.law_refs))
        );
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail,
          input_snapshot, confidentiality_level
        ) values (
          p_org_id, null, p_module, 'db_event', 'completed',
          jsonb_build_object('system_rule_slug', v_sys.slug,
                             'framework', v_sys.framework,
                             'subcategory', v_sys.subcategory,
                             'law_refs', to_jsonb(v_sys.law_refs)),
          p_row,
          v_level
        );
      exception when others then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail,
          confidentiality_level
        ) values (
          p_org_id, null, p_module, 'db_event', 'failed',
          jsonb_build_object('system_rule_slug', v_sys.slug, 'error', sqlerrm),
          v_level
        );
      end;
    end loop;
  end if;
end;
$$;

comment on function public.workflow_dispatch_db_event(uuid, text, text, jsonb) is
  'Master DB-event dispatcher. Iterates per-org workflow_rules + platform-owned workflow_system_rules. Propagates rule-level confidentiality_level into workflow_runs; honours app.workflow_confidentiality session GUC as a strictest-wins override.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Helper: SHA-256 hash of varsel-fritekst (tamper-detection)           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alerts_text_fingerprint(p_text text)
returns text
language sql
immutable
as $$
  select case
    when p_text is null or p_text = '' then null
    else encode(public.digest(p_text, 'sha256'), 'hex')
  end;
$$;

comment on function public.alerts_text_fingerprint(text) is
  'SHA-256 hex over varsel-fritekst. Lets downstream rules detect tampering without ever seeing the body (AML § 2A-7 / GDPR Art. 32 need-to-know).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. alert_cases triggers (deferred behind to_regclass guard)             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

do $migrate$
begin
  if to_regclass('public.alert_cases') is null then
    raise notice 'alert_cases not present yet (apply order: this migration sorts before _20260911120000_alerts_module_core). Re-run after alerts module-core lands, or apply a follow-up migration that re-executes the trigger-creation block. Functions and system-rule seed above this guard already applied.';
    return;
  end if;

  -- ── 4.1 Trigger: AFTER INSERT → ON_ALERT_SUBMITTED ────────────────────
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
      -- Force confidential dispatch for the duration of this trigger.
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
        'description_sha256', public.alerts_text_fingerprint(new.description),
        'title_sha256',       public.alerts_text_fingerprint(new.title),
        'breach_type',        new.breach_type,
        'investigation_due_at', new.investigation_due_at
      );

      -- DELIBERATELY OMITTED FROM PAYLOAD (AML § 2A-7 / GDPR Art. 32):
      --   * description / title raw text
      --   * reporter_user_id, reporter_contact, reporter_display_name
      --   * submission_user_agent, submission_locale
      -- Downstream rules that need them must read alert_cases directly,
      -- subject to RLS (workflows.view_confidential or alerts.committee_*).

      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'alerts', 'ON_ALERT_SUBMITTED', v_payload
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;

      -- GDPR breach bridge → drives the 72h reminder scheduler in Phase E.
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

  -- ── 4.2 Trigger: AFTER UPDATE → status transitions ────────────────────
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

  execute 'drop trigger if exists alert_cases_workflow_emit_submitted_tg on public.alert_cases';
  execute 'create trigger alert_cases_workflow_emit_submitted_tg
           after insert on public.alert_cases
           for each row execute function public.trg_alert_cases_workflow_emit_submitted()';

  execute 'drop trigger if exists alert_cases_workflow_emit_status_tg on public.alert_cases';
  execute 'create trigger alert_cases_workflow_emit_status_tg
           after update of status on public.alert_cases
           for each row execute function public.trg_alert_cases_workflow_emit_status()';

  raise notice 'alert_cases workflow emission triggers wired up.';
end
$migrate$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. System rule: parallel ON_ALERT_SUBMITTED handler for /varslinger     │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- The legacy aml-2a-7-whistleblower-confidential rule (seeded in
-- _20260905122200) keys on source_module='survey' /
-- trigger_event_name='ON_SURVEY_RESPONSE_SUBMITTED' and condition
-- surveySlug='varslingsutvalg'. /varslinger submissions never satisfy
-- that filter. This row mirrors the same intent for the new route.
-- Idempotent via slug unique-constraint.

insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  description, rationale, source_module, trigger_type, trigger_event_name,
  schedule_cron, trigger_on, condition_json, actions_json, law_refs,
  frameworks, pdca_phase, applies_if_employee_count_gte, enabled,
  confidentiality_level, notes
) values (
  'aml-2a-7-alerts-confidential',
  'AML', 'Kap. 2A — Varsling', 2, 'AML § 2A-7 — Konfidensiell håndtering av varsel (alerts-modul)',
  'Varsel via /varslinger-rute (modules/alerts) → konfidensiell triage-oppgave til varslingsutvalg innen 1 virkedag.',
  'AML § 2A-7 femte ledd taushetsplikt — speil av aml-2a-7-whistleblower-confidential men keyet på den nye alerts-modulen (ON_ALERT_SUBMITTED) i tillegg til den legacy survey-ruten.',
  'alerts', 'db_event', 'ON_ALERT_SUBMITTED', null, 'insert',
  '{"match":"field_eq","field":"kind","value":"whistleblowing"}'::jsonb,
  '[
    {"type":"create_task","title":"[KONFIDENSIELT] Triage varslersak","description":"AML § 2A-7 (5) — sak skal behandles konfidensielt. Kun varslingsutvalg.","assignee":"Varslingsmottak","ownerRole":"varslingsutvalg","dueInDays":1,"module":"alerts","sourceType":"varsel_2a7"}
  ]'::jsonb,
  ARRAY['AML § 2A-7'], ARRAY['aml-amu'], 'do', null, true,
  'confidential',
  'Speil av aml-2a-7-whistleblower-confidential for den nye alerts-modulen. Confidentiality_level forced regardless of payload.'
)
on conflict (slug) do update set
  description           = excluded.description,
  rationale             = excluded.rationale,
  source_module         = excluded.source_module,
  trigger_event_name    = excluded.trigger_event_name,
  condition_json        = excluded.condition_json,
  actions_json          = excluded.actions_json,
  law_refs              = excluded.law_refs,
  frameworks            = excluded.frameworks,
  enabled               = excluded.enabled,
  confidentiality_level = excluded.confidentiality_level,
  notes                 = excluded.notes,
  updated_at            = now();
