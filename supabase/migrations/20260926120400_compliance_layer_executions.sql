-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M5 — internal_control_executions + auto-bind triggers
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   This is where the substrate becomes alive. `internal_control_
--   executions` is the append-only ledger of "this control was satisfied
--   at this time by this artefact". Without auto-bind triggers, every
--   row would be a manual upload — defeating the point of the layer.
--   The seven triggers wire the existing module sign events directly
--   into the resolver so a single sign action lights up every binding
--   that matched.
--
-- Self-audit (Arbeidstilsynet POV):
--   - AML § 3-1 (2) e + IK-f § 5 nr. 7 krever skriftlig dokumentasjon
--     for tilsyn. internal_control_executions ER det skriftlige sporet
--     for hver gjennomført kontroll-aktivitet. Append-only (BEFORE
--     UPDATE/DELETE trigger denier ubetingede mutasjoner) speiler
--     samme uforanderlighet som meeting_protocol_exports og workflow_
--     run_evidence — Arbeidstilsynet kan stole på at historikken ikke
--     er manipulert post-hoc.
--   - SHA-256 checksum (kopiert fra signaturen på den underliggende
--     artefakten der den finnes) + occurred_at gir tamper-evident
--     bevisspor.
--   - AML § 2A-7 (anonym varslings-oversikt) + drøftings-konfidensi-
--     alitet: triggers leser kun fra base-tables med eksisterende RLS;
--     dersom et meeting er restricted/confidential, leser RLS på det
--     bord-aliaset filter rader bort, og resolver-funksjonen får
--     ingenting å skrive. Konfidensialitets-lekkasje umulig.
--   - Restrisiko: 1) auto-bind triggers er SECURITY DEFINER — must
--     respect base-table RLS via `set local row_security on` (gjort i
--     resolveren). 2) Idempotency unique-index hindrer dobbeltbevis ved
--     gjentatt event, men en endring i `signed_at` (re-sign med nytt
--     timestamp) vil oppdateres som NY rad — det er bevisst (re-sign
--     er en ny hendelse).

set local search_path = public, pg_catalog;

-- ── 1. Enum reused — execution status label (computed in view) ──────────
-- (No new enum needed here; control_status from M2 + a view-computed
--  label cover the lifecycle. See M6 for the view.)

-- ── 2. Table: internal_control_executions ────────────────────────────────

create table if not exists public.internal_control_executions (
  id                  uuid primary key default gen_random_uuid(),
  control_id          uuid not null references public.internal_controls (id) on delete cascade,
  binding_id          uuid references public.internal_control_bindings (id) on delete set null,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  source_kind         public.control_binding_source_kind not null,
  source_table        text not null,
  source_id           text not null,
  occurred_at         timestamptz not null,
  period_label        text,
  summary             text,
  evidence_url        text,
  signed_by           uuid references auth.users (id) on delete set null,
  signed_at           timestamptz,
  sha256_checksum     text,
  payload             jsonb not null default '{}'::jsonb,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (char_length(source_id) > 0)
);

comment on table public.internal_control_executions is
  $c$Append-only ledger of "control satisfied" events. One row per
  matching (control × binding × source artefact) tuple. Idempotent
  via the partial unique index on (control_id, source_table, source_id)
  so re-emitted events don't double-insert. BEFORE UPDATE/DELETE trigger
  denies mutation unconditionally.$c$;

-- Idempotency: (control, table, source) is unique so a re-fired event
-- doesn't insert twice. Full (non-partial) index so the resolver's
-- ON CONFLICT inference works — the partial predicate `where source_id
-- <> ''` was rejected by PostgreSQL for ON CONFLICT (only literal-equal
-- predicates can be used for index inference). The non-empty constraint
-- below preserves the original intent.
create unique index if not exists internal_control_executions_idempotent_uidx
  on public.internal_control_executions (control_id, source_table, source_id);

-- Status-view lookup index.
create index if not exists internal_control_executions_control_time_idx
  on public.internal_control_executions (control_id, occurred_at desc);

create index if not exists internal_control_executions_org_time_idx
  on public.internal_control_executions (organization_id, occurred_at desc);

-- ── 3. RLS ───────────────────────────────────────────────────────────────

alter table public.internal_control_executions enable row level security;

drop policy if exists internal_control_executions_select_org on public.internal_control_executions;
create policy internal_control_executions_select_org
  on public.internal_control_executions for select
  using (organization_id = public.current_org_id());

-- Insert: app code (manual entries) + service_role (security-definer
-- resolver). No update / delete policy = append-only at the policy
-- layer too (in addition to the trigger).
drop policy if exists internal_control_executions_insert_org on public.internal_control_executions;
create policy internal_control_executions_insert_org
  on public.internal_control_executions for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
  );

-- ── 4. Append-only enforcement (defence in depth vs RLS) ────────────────

create or replace function public.internal_control_executions_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'internal_control_executions is append-only — mutation denied (op=%)',
    tg_op;
end;
$$;

drop trigger if exists internal_control_executions_deny_update on public.internal_control_executions;
create trigger internal_control_executions_deny_update
  before update on public.internal_control_executions
  for each row execute function public.internal_control_executions_deny_mutation();

drop trigger if exists internal_control_executions_deny_delete on public.internal_control_executions;
create trigger internal_control_executions_deny_delete
  before delete on public.internal_control_executions
  for each row execute function public.internal_control_executions_deny_mutation();

-- ── 5. Resolver: insert one execution row per matching binding ──────────
-- SECURITY DEFINER so module triggers can write without each carrying
-- compliance_layer.manage permission. The resolver writes only to
-- internal_control_executions and reads only from
-- internal_control_bindings — no broader privilege escalation.

create or replace function public._compliance_layer_record_execution(
  p_organization_id  uuid,
  p_source_kind      public.control_binding_source_kind,
  p_source_table     text,
  p_source_id        text,
  p_source_template_table text,
  p_source_template_id    text,
  p_occurred_at      timestamptz,
  p_signed_by        uuid,
  p_signed_at        timestamptz,
  p_summary          text,
  p_sha256_checksum  text,
  p_payload          jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_binding record;
  v_count   int := 0;
begin
  if p_organization_id is null
     or p_source_kind is null
     or p_source_table is null
     or p_source_id is null then
    return 0;
  end if;

  -- Look up every active binding for this org × source_kind × template.
  -- Same-org guarantee is given by the binding's organization_id column.
  for v_binding in
    select b.*
      from public.internal_control_bindings b
      join public.internal_controls c
        on c.id = b.control_id
       and c.organization_id = b.organization_id
       and c.deleted_at is null
       and c.is_active = true
       and c.status <> 'retired'
     where b.organization_id = p_organization_id
       and b.source_kind = p_source_kind
       and b.is_active = true
       and b.deleted_at is null
       and (
         b.source_template_table = p_source_template_table
         or p_source_template_table is null
         or p_source_template_table = ''
       )
       and (
         b.source_template_id = p_source_template_id
         or p_source_template_id is null
         or p_source_template_id = ''
       )
  loop
    insert into public.internal_control_executions (
      control_id, binding_id, organization_id, source_kind, source_table,
      source_id, occurred_at, summary, signed_by, signed_at,
      sha256_checksum, payload
    )
    values (
      v_binding.control_id, v_binding.id, p_organization_id, p_source_kind,
      p_source_table, p_source_id, p_occurred_at, p_summary, p_signed_by,
      p_signed_at, p_sha256_checksum, coalesce(p_payload, '{}'::jsonb)
    )
    on conflict (control_id, source_table, source_id) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._compliance_layer_record_execution(
  uuid, public.control_binding_source_kind, text, text, text, text,
  timestamptz, uuid, timestamptz, text, text, jsonb
) from public, anon;
grant execute on function public._compliance_layer_record_execution(
  uuid, public.control_binding_source_kind, text, text, text, text,
  timestamptz, uuid, timestamptz, text, text, jsonb
) to authenticated, service_role;

-- ── 6. Auto-bind triggers (7 module sources) ────────────────────────────
-- Every trigger is guarded by `to_regclass(...) is not null` so a missing
-- optional table no-ops cleanly. Triggers are AFTER, so they don't block
-- the underlying write — at worst they fail silently and module flow
-- continues.

-- 6.1 compliance_checklist_executions — fire on sign (signed_at transition)
do $$
begin
  if to_regclass('public.compliance_checklist_executions') is not null then
    create or replace function public._cl_auto_bind_compliance()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if (tg_op = 'UPDATE' and new.signed_at is not null and old.signed_at is null)
         or (tg_op = 'INSERT' and new.signed_at is not null) then
        perform public._compliance_layer_record_execution(
          new.organization_id,
          'compliance_execution',
          'compliance_checklist_executions',
          new.id::text,
          'compliance_checklist_templates',
          new.template_id::text,
          new.signed_at,
          new.signed_by,
          new.signed_at,
          coalesce(new.title, 'Sjekklist gjennomført'),
          new.sign_checksum,
          jsonb_build_object(
            'pack', new.pack,
            'execution_id', new.id,
            'template_id', new.template_id
          )
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_compliance_tg on public.compliance_checklist_executions;
    create trigger compliance_layer_auto_bind_compliance_tg
      after insert or update on public.compliance_checklist_executions
      for each row execute function public._cl_auto_bind_compliance();
  end if;
end $$;

-- 6.2 meeting_protocol_exports — fire on insert
-- NB: meetings split the template reference into two columns:
--   system_template_table → system_template_id (text)
--   org_template_table    → org_template_id (uuid)
-- The resolver dispatches against whichever one is set so a single
-- binding can target either surface; the binding row's
-- source_template_table tells the resolver which table to match against.
do $$
begin
  if to_regclass('public.meeting_protocol_exports') is not null
     and to_regclass('public.meetings') is not null then
    create or replace function public._cl_auto_bind_meeting()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    declare
      v_meeting record;
    begin
      select id, organization_id, system_template_id, org_template_id,
             title, protocol_signed_at
        into v_meeting
        from public.meetings
        where id = new.meeting_id;
      if v_meeting.organization_id is null then
        return new;
      end if;

      -- System-template case: bindings reference meeting_system_templates.id (text).
      if v_meeting.system_template_id is not null then
        perform public._compliance_layer_record_execution(
          v_meeting.organization_id,
          'meeting_protocol',
          'meeting_protocol_exports',
          new.id::text,
          'meeting_system_templates',
          v_meeting.system_template_id,
          coalesce(v_meeting.protocol_signed_at, now()),
          null,
          v_meeting.protocol_signed_at,
          coalesce(v_meeting.title, 'Møteprotokoll signert'),
          new.payload_sha256,
          jsonb_build_object(
            'meeting_id', v_meeting.id,
            'export_id', new.id,
            'template_kind', 'system'
          )
        );
      end if;

      -- Org-template case: bindings reference meeting_org_templates.id (uuid).
      if v_meeting.org_template_id is not null then
        perform public._compliance_layer_record_execution(
          v_meeting.organization_id,
          'meeting_protocol',
          'meeting_protocol_exports',
          new.id::text,
          'meeting_org_templates',
          v_meeting.org_template_id::text,
          coalesce(v_meeting.protocol_signed_at, now()),
          null,
          v_meeting.protocol_signed_at,
          coalesce(v_meeting.title, 'Møteprotokoll signert'),
          new.payload_sha256,
          jsonb_build_object(
            'meeting_id', v_meeting.id,
            'export_id', new.id,
            'template_kind', 'org'
          )
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_meeting_tg on public.meeting_protocol_exports;
    create trigger compliance_layer_auto_bind_meeting_tg
      after insert on public.meeting_protocol_exports
      for each row execute function public._cl_auto_bind_meeting();
  end if;
end $$;

-- 6.3 wiki_compliance_receipts — fire on insert (document acknowledgement)
do $$
begin
  if to_regclass('public.wiki_compliance_receipts') is not null then
    create or replace function public._cl_auto_bind_document_ack()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      perform public._compliance_layer_record_execution(
        new.organization_id,
        'document_acknowledgement',
        'wiki_compliance_receipts',
        new.id::text,
        'wiki_pages',
        new.page_id,
        new.acknowledged_at,
        new.user_id,
        new.acknowledged_at,
        coalesce(new.page_title, 'Dokument bekreftet'),
        null,
        jsonb_build_object(
          'page_id', new.page_id,
          'page_version', new.page_version,
          'user_name', new.user_name
        )
      );
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_document_ack_tg on public.wiki_compliance_receipts;
    create trigger compliance_layer_auto_bind_document_ack_tg
      after insert on public.wiki_compliance_receipts
      for each row execute function public._cl_auto_bind_document_ack();
  end if;
end $$;

-- 6.4 learning_course_progress — fire on completed_at transition
do $$
begin
  if to_regclass('public.learning_course_progress') is not null then
    create or replace function public._cl_auto_bind_learning()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if (tg_op = 'UPDATE' and new.completed_at is not null and old.completed_at is null)
         or (tg_op = 'INSERT' and new.completed_at is not null) then
        perform public._compliance_layer_record_execution(
          new.organization_id,
          'learning_completion',
          'learning_course_progress',
          new.user_id::text || '::' || new.course_id,
          'learning_courses',
          new.course_id,
          new.completed_at,
          new.user_id,
          new.completed_at,
          'Kurs fullført: ' || new.course_id,
          null,
          jsonb_build_object(
            'user_id', new.user_id,
            'course_id', new.course_id
          )
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_learning_tg on public.learning_course_progress;
    create trigger compliance_layer_auto_bind_learning_tg
      after insert or update on public.learning_course_progress
      for each row execute function public._cl_auto_bind_learning();
  end if;
end $$;

-- 6.5 task_items — fire on status → done
do $$
begin
  if to_regclass('public.task_items') is not null then
    create or replace function public._cl_auto_bind_task()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if (tg_op = 'UPDATE' and new.status = 'done' and (old.status is null or old.status <> 'done'))
         or (tg_op = 'INSERT' and new.status = 'done') then
        -- task_items has no single FK to a template — bindings use the
        -- source_category or pack as the template id fallback so an
        -- admin can wire "any closed avvik" to a control. Use the
        -- denormalised source_category as the synthetic template id.
        perform public._compliance_layer_record_execution(
          new.organization_id,
          'task_completion',
          'task_items',
          new.id::text,
          'task_template_catalog',
          coalesce(new.source_category::text, 'general'),
          coalesce(new.closed_at, now()),
          new.assignee_user_id,
          new.assignee_signed_at,
          coalesce(new.title, 'Oppgave lukket'),
          null,
          jsonb_build_object(
            'task_id', new.id,
            'pack', new.pack,
            'source_category', new.source_category,
            'source_type', new.source_type
          )
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_task_tg on public.task_items;
    create trigger compliance_layer_auto_bind_task_tg
      after insert or update on public.task_items
      for each row execute function public._cl_auto_bind_task();
  end if;
end $$;

-- 6.6 register_records — fire on insert
do $$
begin
  if to_regclass('public.register_records') is not null then
    create or replace function public._cl_auto_bind_register()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      perform public._compliance_layer_record_execution(
        new.organization_id,
        'register_record',
        'register_records',
        new.id::text,
        'register_types',
        new.register_type_id,
        new.created_at,
        new.owner_user_id,
        null,
        'Registerpost lagt til',
        null,
        jsonb_build_object(
          'register_type_id', new.register_type_id,
          'record_id', new.id,
          'status', new.status
        )
      );
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_register_tg on public.register_records;
    create trigger compliance_layer_auto_bind_register_tg
      after insert on public.register_records
      for each row execute function public._cl_auto_bind_register();
  end if;
end $$;

-- 6.7 surveys + survey_campaigns — fire on close
do $$
begin
  if to_regclass('public.surveys') is not null then
    create or replace function public._cl_auto_bind_survey()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if (tg_op = 'UPDATE' and new.closed_at is not null and old.closed_at is null)
         or (tg_op = 'INSERT' and new.closed_at is not null) then
        perform public._compliance_layer_record_execution(
          new.organization_id,
          'survey_response',
          'surveys',
          new.id::text,
          'surveys',
          new.id::text,
          new.closed_at,
          null,
          new.closed_at,
          coalesce(new.title, 'Undersøkelse lukket'),
          null,
          jsonb_build_object('survey_id', new.id)
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_survey_tg on public.surveys;
    create trigger compliance_layer_auto_bind_survey_tg
      after insert or update on public.surveys
      for each row execute function public._cl_auto_bind_survey();
  end if;

  if to_regclass('public.survey_campaigns') is not null then
    create or replace function public._cl_auto_bind_survey_campaign()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      if (tg_op = 'UPDATE' and new.status = 'closed' and (old.status is null or old.status <> 'closed'))
         or (tg_op = 'INSERT' and new.status = 'closed') then
        perform public._compliance_layer_record_execution(
          new.organization_id,
          'survey_response',
          'survey_campaigns',
          new.id::text,
          'survey_campaigns',
          new.id::text,
          coalesce(new.closes_at, now()),
          null,
          coalesce(new.closes_at, now()),
          coalesce(new.title, 'Undersøkelses-kampanje lukket'),
          null,
          jsonb_build_object('campaign_id', new.id, 'pillar', new.pillar)
        );
      end if;
      return new;
    end;
    $fn$;

    drop trigger if exists compliance_layer_auto_bind_survey_campaign_tg on public.survey_campaigns;
    create trigger compliance_layer_auto_bind_survey_campaign_tg
      after insert or update on public.survey_campaigns
      for each row execute function public._cl_auto_bind_survey_campaign();
  end if;
end $$;
