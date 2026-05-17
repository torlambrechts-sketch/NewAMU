-- workflow_dispatch_notification + role/permission-aware recipient resolution.
--
-- The workflow_queue_worker (supabase/functions/workflow-queue-worker) was
-- inserting raw rows into compliance_notifications with columns the table
-- never had (kind, payload); every send_email / send_notification / escalate
-- action silently failed at the last mile. Wire a proper RPC so the §5-2
-- 24h-chain, eskaleringer og varslings-fanout faktisk leverer.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 5-2 (24t-melding krever sporbar varsling
--   til daglig leder + HMS), IK-f § 5 nr. 7 (overvåking og handling — uten
--   levering ingen handling). GDPR Art. 5(1)(f) — konfidensielle løp må
--   ikke lekke til mottakere uten workflows.view_confidential.
--   Restrisiko deferred: e-post-transport ligger fortsatt utenfor (egen
--   relay-funksjon henter rader merket workflow_email). LDO-eksporten
--   bruker fortsatt gov_notifications_outbox direkte.

set local search_path = public, pg_catalog;

-- ── 1. Extend compliance_notifications.category check constraint ────────
--
-- Existing values (from _20260904120100):
--   requirement_assigned, requirement_due_soon, requirement_overdue,
--   breach_active, breach_overdue, subject_request_due_soon,
--   subject_request_overdue, general
-- New values (workflow-emitted):
--   workflow_email, workflow_in_app, workflow_escalation, workflow_gov_action

do $$
declare
  v_constraint_name text;
begin
  -- Drop by name first (the original name), fall back to scanning if absent.
  select c.conname into v_constraint_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'compliance_notifications'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%category%requirement_assigned%';
  if v_constraint_name is not null then
    execute format('alter table public.compliance_notifications drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.compliance_notifications
  add constraint compliance_notifications_category_check
  check (category in (
    'requirement_assigned',
    'requirement_due_soon',
    'requirement_overdue',
    'breach_active',
    'breach_overdue',
    'subject_request_due_soon',
    'subject_request_overdue',
    'general',
    -- Workflow-emitted (see workflow_dispatch_notification)
    'workflow_email',
    'workflow_in_app',
    'workflow_escalation',
    'workflow_gov_action'
  ));

-- ── 2. Add workflow-source columns + filter index ───────────────────────

alter table public.compliance_notifications
  add column if not exists payload jsonb,
  add column if not exists rule_id uuid references public.workflow_rules(id) on delete set null,
  add column if not exists run_id  uuid references public.workflow_runs(id)  on delete set null,
  add column if not exists queue_id uuid;

comment on column public.compliance_notifications.payload is
  'Free-form workflow payload (toRole, toUserId, subject, body, ruleId, etc.). NULL for compliance scanner-emitted rows.';
comment on column public.compliance_notifications.rule_id is
  'When emitted by workflow-queue-worker: the rule that fired. NULL for compliance scanner rows.';
comment on column public.compliance_notifications.run_id is
  'When emitted by workflow-queue-worker: the workflow_runs id whose context produced this notification.';
comment on column public.compliance_notifications.queue_id is
  'workflow_action_queue.id this row was produced from. No FK — queue rows can be hard-deleted.';

create index if not exists cn_workflow_source_idx
  on public.compliance_notifications (organization_id, created_at desc)
  where rule_id is not null;

-- ── 3. Recipient resolver ───────────────────────────────────────────────
--
-- p_role_or_user can be:
--   * a uuid string  → returned as-is after org_functional_role_assignments
--                      membership check (any active assignment for the org)
--                      OR an organizations-membership check via profiles
--   * a functional-role slug (`daglig_leder`, `verneombud`, `dpo`, …) →
--     all active assignees
--   * a workflow-approval alias used across the catalog: `hms_leder` maps
--     to `hms_koordinator` (the functional_roles seed slug); `amu_leder`
--     and `daglig_leder` already match directly; `varslingsutvalg` maps
--     to `varslings_mottak`; `personvernombud` and `hr` map to `dpo` /
--     `hr_leder`. `arbeidsgiver` falls through to daglig_leder.
--
-- If p_min_permission is provided, recipients are further filtered to
-- users with that permission via public.user_has_permission.

create or replace function public.resolve_workflow_notification_recipients(
  p_org_id          uuid,
  p_role_or_user    text,
  p_payload         jsonb default '{}'::jsonb,
  p_min_permission  text default null
)
returns setof uuid
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_uuid uuid;
  v_slug text;
begin
  if p_org_id is null or p_role_or_user is null or btrim(p_role_or_user) = '' then
    return;
  end if;

  -- (a) uuid-style → single recipient, must belong to the org (via profiles).
  begin
    v_uuid := p_role_or_user::uuid;
    return query
      select p.id
        from public.profiles p
       where p.id = v_uuid
         and p.organization_id = p_org_id
         and (
               p_min_permission is null
            or public.user_has_permission(p_min_permission, p.id)
         );
    return;
  exception when invalid_text_representation then
    -- not a uuid → fall through to slug resolution
    null;
  end;

  -- (b) Slug aliasing — match the strings sprinkled across workflow_catalog
  -- (`hms_leder`, `varslingsutvalg`) to the seeded functional_roles slugs.
  v_slug := case lower(p_role_or_user)
              when 'hms_leder'         then 'hms_koordinator'
              when 'hms-leder'         then 'hms_koordinator'
              when 'varslingsutvalg'   then 'varslings_mottak'
              when 'personvernombud'   then 'dpo'
              when 'hr'                then 'hr_leder'
              when 'arbeidsgiver'      then 'daglig_leder'
              else lower(p_role_or_user)
            end;

  return query
    select distinct a.user_id
      from public.org_functional_role_assignments a
     where a.organization_id = p_org_id
       and a.role_slug = v_slug
       and (a.valid_to is null or a.valid_to >= current_date)
       and a.valid_from <= current_date
       and (
             p_min_permission is null
          or public.user_has_permission(p_min_permission, a.user_id)
       );
end;
$$;

revoke all on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) from public;
grant execute on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) to service_role;

comment on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) is
  'Resolve a workflow recipient spec (uuid OR role-slug, with catalog aliases) to a set of profile ids. p_min_permission filters recipients to those with the given permission via user_has_permission. Empty result = no eligible recipient — caller logs.';

-- ── 4. workflow_dispatch_notification — fan-out + idempotent insert ─────

create or replace function public.workflow_dispatch_notification(
  p_org             uuid,
  p_category        text,
  p_payload         jsonb,
  p_role_or_user    text,
  p_severity        text default 'medium',
  p_rule_id         uuid default null,
  p_run_id          uuid default null,
  p_queue_id        uuid default null,
  p_min_permission  text default null
)
returns int
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_count    int := 0;
  v_recipient uuid;
  v_title    text;
  v_body     text;
  v_link     text;
  v_key      text;
  v_severity text;
begin
  if p_org is null or p_category is null then
    raise exception 'workflow_dispatch_notification: org_id and category are required';
  end if;

  -- Severity normalisation — the table check is low/medium/high/critical.
  v_severity := case lower(coalesce(p_severity, 'medium'))
                  when 'info'    then 'low'
                  when 'warning' then 'high'
                  when 'error'   then 'critical'
                  when 'low'     then 'low'
                  when 'medium'  then 'medium'
                  when 'high'    then 'high'
                  when 'critical' then 'critical'
                  else 'medium'
                end;

  v_title := coalesce(
               nullif(p_payload->>'title', ''),
               nullif(p_payload->>'subject', ''),
               case p_category
                 when 'workflow_email'      then 'Varsel fra arbeidsflyt'
                 when 'workflow_in_app'     then 'Varsel fra arbeidsflyt'
                 when 'workflow_escalation' then 'Eskalering fra arbeidsflyt'
                 when 'workflow_gov_action' then 'Statlig melding fra arbeidsflyt'
                 else 'Varsel'
               end
             );
  v_body  := coalesce(
               nullif(p_payload->>'body', ''),
               nullif(p_payload->>'note', ''),
               nullif(p_payload->>'message', ''),
               null
             );
  v_link  := nullif(p_payload->>'link_url', '');

  for v_recipient in
    select * from public.resolve_workflow_notification_recipients(
      p_org, p_role_or_user, coalesce(p_payload, '{}'::jsonb), p_min_permission
    )
  loop
    v_key := encode(
      public.digest(
        coalesce(p_run_id::text, '') || ':' ||
        coalesce(p_queue_id::text, '') || ':' ||
        coalesce(p_rule_id::text, '') || ':' ||
        p_category || ':' ||
        v_recipient::text,
        'sha256'
      ),
      'hex'
    );

    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key,
      payload, rule_id, run_id, queue_id
    ) values (
      p_org, v_recipient, p_category, v_severity,
      v_title, v_body, v_link, 'wf:' || v_key,
      coalesce(p_payload, '{}'::jsonb), p_rule_id, p_run_id, p_queue_id
    )
    on conflict (recipient_user_id, notification_key) do nothing;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    -- No new table: caller decides what to do with zero. We surface this
    -- via a NOTICE so the worker log shows up in supabase logs, and
    -- return 0 so the worker can treat it as a soft success (the action
    -- was dispatched against an unstaffed role — orgs without a DPO are
    -- common). The audit-trail-of-record is still workflow_runs.
    raise notice 'workflow_dispatch_notification: no recipients for org=% role=% category=% (queue_id=%, run_id=%)',
      p_org, p_role_or_user, p_category, p_queue_id, p_run_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.workflow_dispatch_notification(uuid, text, jsonb, text, text, uuid, uuid, uuid, text) from public;
grant execute on function public.workflow_dispatch_notification(uuid, text, jsonb, text, text, uuid, uuid, uuid, text) to service_role;

comment on function public.workflow_dispatch_notification(uuid, text, jsonb, text, text, uuid, uuid, uuid, text) is
  'Workflow worker entry point: resolves a recipient spec (uuid or role-slug with catalog aliases), filters by optional minimum permission, and idempotently inserts one compliance_notifications row per recipient. notification_key = sha256(run_id|queue_id|rule_id|category|recipient) so worker retries do not double-fanout. Returns the number of recipients notified (0 = soft success with a NOTICE, caller logs).';
