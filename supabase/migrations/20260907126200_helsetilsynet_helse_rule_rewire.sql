-- Rewire helsesektor-rules til den nye `meld_helsetilsynet` action-type'en
-- som workflow-queue-worker dispatcher mot helsetilsynet-build-melding
-- edge-funksjonen. Forutsetter migrasjon _126100 (org_integrations.kind
-- utvidet med 'helsetilsynet'/'ukom' + outbox.kind utvidet med
-- manual_helsetilsynet_submission/manual_ukom_submission).
--
-- Self-audit (helsetilsyn + UKOM):
--   Pålegg-grunn addressed: spes.helsetjl. § 3-3 + hol. § 12-3 a — varsel
--   til Helsetilsynet/UKOM er nå strukturert (auto-genert PDF + outbox-rad
--   med kontakt-info), ikke kun en task-påminnelse. Faganasvarlig kan
--   handle direkte fra triage-UI uten å bytte til e-post-klient.
--   Restrisiko deferred: regulator-API finnes fortsatt ikke — wizard +
--   triage er det vi kan automatisere uten å bryte konfidensialitet
--   (helsepers.l. § 21). Auto-UKOM-rad som søsken til § 3-3-melding er
--   skissert i action-array men leveres som separat handlingstype `meld_ukom`
--   i en senere sprint (se TODO i header).
--
-- Anti-pattern note (CLAUDE.md): vi endrer IKKE _123000 in-place — det er
-- en shipped migration. Vi skriver en forward-migration som upsert'er de
-- påvirkede slug'ene med oppdatert actions_json.

set local search_path = public, pg_catalog;

-- ── 1. Patch action-type unionen i workflow_execute_actions ──────────────
-- v_gov_types-arrayet i _121800 må vite at `meld_helsetilsynet` skal
-- queues på samme måte som de andre gov-action-typene. CREATE OR REPLACE
-- bevarer signaturen — vi legger kun til ett element i arrayet og lar
-- alt annet stå.

create or replace function public.workflow_execute_actions(
  p_org_id  uuid,
  p_rule_id uuid,
  p_actions jsonb,
  p_context jsonb,
  p_parent_depth int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  v_branch jsonb;
  v_type text;
  v_run_id uuid;
  v_delay_seconds int;
  v_execute_at timestamptz;
  v_queue_id uuid;
  v_approval_role text;
  v_on_error jsonb;
  v_child_depth int := least(coalesce(p_parent_depth, 0) + 1, 5);
  v_anchor timestamptz;
  v_role_or_user text;
  -- Government action types that always queue for the edge worker.
  -- _126200: added `meld_helsetilsynet` for the new helse-sektor flow.
  v_gov_types text[] := array[
    'rapporter_alvorlig_skade_arbeidstilsynet',
    'meld_personvernbrudd_datatilsynet',
    'varsel_ldo_export',
    'nav_sykefravar_oppfolging',
    'altinn_send_melding',
    'meld_helsetilsynet'
  ];
  v_external_types text[] := array[
    'send_email',
    'send_notification',
    'call_webhook'
  ];
begin
  v_run_id := (p_context->>'run_id')::uuid;

  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_type := a->>'type';
    v_on_error := case
      when jsonb_typeof(a->'onError') = 'array' then a->'onError'
      when jsonb_typeof(a->'on_error') = 'array' then a->'on_error'
      else null
    end;

    if v_type = 'create_task' then
      perform public.workflow_append_task(p_org_id, jsonb_build_object(
        'id', coalesce(a->>'id', gen_random_uuid()::text),
        'title', coalesce(a->>'title', 'Arbeidsflyt-oppgave'),
        'description', coalesce(a->>'description', ''),
        'status', 'todo',
        'assignee', coalesce(a->>'assignee', 'Ansvarlig'),
        'ownerRole', coalesce(a->>'ownerRole', 'HMS'),
        'dueDate', (current_date + (coalesce((a->>'dueInDays')::int, 7) || ' days')::interval)::date::text,
        'createdAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'module', coalesce(a->>'module', 'hse'),
        'sourceType', coalesce(a->>'sourceType', 'hse_incident'),
        'sourceId', p_context->>'sourceId',
        'sourceLabel', coalesce(a->>'sourceLabel', 'Arbeidsflyt'),
        'requiresManagementSignOff', coalesce((a->>'requiresManagementSignOff')::boolean, false)
      ));
    elsif v_type = 'log_only' then
      null;
    elsif v_type = 'wait_until' then
      v_delay_seconds := case
        when a->'delay'->>'unit' = 'minutes' then (a->'delay'->>'amount')::int * 60
        when a->'delay'->>'unit' = 'hours'   then (a->'delay'->>'amount')::int * 3600
        when a->'delay'->>'unit' = 'days'    then (a->'delay'->>'amount')::int * 86400
        when a->'delay'->>'unit' = 'weeks'   then (a->'delay'->>'amount')::int * 604800
        else 0
      end;
      v_execute_at := case
        when a->>'at' is not null then (a->>'at')::timestamptz
        else now() + make_interval(secs => v_delay_seconds)
      end;
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'wait_until',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', v_execute_at,
         v_on_error, v_child_depth);
    elsif v_type = 'request_approval' then
      v_approval_role := coalesce(a->>'approverRole', 'hms_leder');
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'request_approval',
         a || coalesce(p_context, '{}'::jsonb),
         'awaiting_approval', now(),
         v_on_error, v_child_depth)
      returning id into v_queue_id;
      insert into public.workflow_approvals
        (organization_id, rule_id, run_id, queue_id, requested_at,
         approver_role, approver_user_id, status, escalate_after, metadata)
      values
        (p_org_id, p_rule_id, v_run_id, v_queue_id, now(),
         v_approval_role,
         nullif(a->>'approverUserId','')::uuid,
         'pending',
         case when a ? 'escalateAfterHours'
              then make_interval(hours => (a->>'escalateAfterHours')::int)
              else null end,
         jsonb_build_object(
           'message', a->>'message',
           'escalateToRole', a->>'escalateToRole'
         ));
    elsif v_type = 'escalate' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'escalate',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    elsif v_type = 'parallel' then
      for v_branch in select jsonb_array_elements(coalesce(a->'branches', '[]'::jsonb))
      loop
        perform public.workflow_execute_actions(
          p_org_id, p_rule_id,
          coalesce(v_branch->'actions', '[]'::jsonb),
          p_context,
          p_parent_depth
        );
      end loop;
    elsif v_type = 'on_error' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'on_error',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    elsif v_type = any(v_gov_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb) || jsonb_build_object('run_id', v_run_id),
         'pending', now(),
         v_on_error, v_child_depth);

      if (a ? 'reminderHoursBeforeDeadline') and (a ? 'deadlineHours') then
        v_anchor := coalesce(
          nullif(a->>'awareAt','')::timestamptz,
          nullif(a->>'eventAt','')::timestamptz,
          nullif(p_context->>'awareAt','')::timestamptz,
          nullif(p_context->>'eventAt','')::timestamptz,
          now()
        );
        v_role_or_user := coalesce(
          a->>'toRole',
          a->>'melderRolle',
          'hms_leder'
        );
        perform public.workflow_schedule_reminders(
          p_org_id, v_run_id, p_rule_id, a, v_anchor, v_role_or_user
        );
      end if;
    elsif v_type = any(v_external_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    else
      perform public.execute_workflow_action(
        a,
        coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
          'organization_id', p_org_id,
          'rule_id', p_rule_id,
          'run_id', v_run_id
        )
      );
    end if;
  end loop;
end;
$$;

comment on function public.workflow_execute_actions(uuid, uuid, jsonb, jsonb, int) is
  'Master action dispatcher. _126200: added `meld_helsetilsynet` to v_gov_types so workflow-queue-worker can dispatch helsesektor-meldinger til helsetilsynet-build-melding edge-fn.';

-- ── 2. Oppdater helse-rule slug'ene som tidligere kun stolte på log_only-
--      påminnelse + create_task. Begge får nå en `meld_helsetilsynet`-
--      handling som genererer outbox-rad med PDF + struktur-felter. Vi
--      bevarer create_task + send_notification (HMS-kjede synliggjøring)
--      siden disse er en del av confidentiality-flyten. ──────────────────

update public.workflow_system_rules
   set actions_json = '[
        {"type":"create_task","title":"[KONFIDENSIELT] Helsetilsynet § 3-3 — vurder og send pasienthendelse-melding","description":"Spesialisthelsetjenesteloven § 3-3 + helsepersonelloven § 17. PDF-mal er allerede generert til utboksen — last ned og send via melde.no eller e-post. Loggfør kvittering her.","assignee":"Fagansvarlig","ownerRole":"fagansvarlig","dueInDays":3,"module":"inspection","sourceType":"helse-§3-3","lawRefs":["Spesialisthelsetjenesteloven § 3-3","Helsepersonelloven § 17"]},
        {"type":"meld_helsetilsynet","target":"helsetilsynet","kategori":"Pasienthendelse — § 3-3","beskrivelse":"{{event.description}}","hendelsesdato":"{{event.occurredAt}}","kontaktperson":{"rolle":"fagansvarlig"},"lawRefs":["Spesialisthelsetjenesteloven § 3-3","Helsepersonelloven § 17"]},
        {"type":"send_notification","title":"Pasienthendelse meldt — § 3-3","body":"Statens helsetilsyn skal varsles. PDF-mal ligger i utboksen. Konfidensiell behandling iht. taushetsplikt.","category":"compliance","toRole":"fagansvarlig"}
      ]'::jsonb,
       updated_at = now()
 where slug = 'helse-avvik-spesialisthelsetjenesteloven-16';

update public.workflow_system_rules
   set actions_json = '[
        {"type":"create_task","title":"[KONFIDENSIELT] UKOM-varsling — alvorlig pasienthendelse","description":"Helse- og omsorgstjenesteloven § 12-3 a + spesialisthelsetjenesteloven § 3-3 a. UKOM-PDF er klar i utboksen. Husk: parallell-leg til § 3-3-melding til Helsetilsynet — IKKE alternativ.","assignee":"Fagansvarlig","ownerRole":"fagansvarlig","dueInDays":1,"module":"inspection","sourceType":"helse-§12-3-a","lawRefs":["Helse- og omsorgstjenesteloven § 12-3 a","Spesialisthelsetjenesteloven § 3-3 a"]},
        {"type":"meld_helsetilsynet","target":"ukom","kategori":"Alvorlig pasienthendelse — UKOM","beskrivelse":"{{event.description}}","hendelsesdato":"{{event.occurredAt}}","lawRefs":["Helse- og omsorgstjenesteloven § 12-3 a","Spesialisthelsetjenesteloven § 3-3 a"]},
        {"type":"request_approval","approverRole":"daglig_leder","message":"Bekreft UKOM-varsling og parallell § 3-3-melding til Helsetilsynet er sendt.","escalateAfterHours":24,"escalateToRole":"hms_leder"},
        {"type":"send_notification","title":"UKOM-frist løper","body":"Alvorlig pasienthendelse — UKOM må varsles. PDF i utboksen. Konfidensiell behandling.","category":"compliance","toRole":"fagansvarlig"}
      ]'::jsonb,
       updated_at = now()
 where slug = 'helse-ukom-alvorlig-pasienthendelse';

-- TODO (next sprint): auto-emit en søsken-outbox-rad for UKOM samtidig som
-- § 3-3-regelen fyrer, slik at fagansvarlig får to PDF-er i utboksen i ett
-- klikk. Krever en `meld_helsetilsynet`-variant som tar `targets: ['helse­tilsynet','ukom']`
-- (eller en egen `meld_ukom`-handling), pluss en seed-oppdatering av helse-
-- avvik-spesialisthelsetjenesteloven-16 til å emit'e begge.
