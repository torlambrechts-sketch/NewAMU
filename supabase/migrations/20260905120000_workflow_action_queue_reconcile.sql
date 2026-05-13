-- Reconcile workflow_action_queue column drift.
--
-- Two earlier migrations defined incompatible writers for the same table:
--   archive/20260618150000_workflow_db_events.sql   inserts (step_type, config_json, context_json)
--   archive/20260829120011_workflow_new_action_types.sql inserts (action_type, payload)
-- The 2026-08-29 migration also dropped `not null` from no column, so any
-- gov / email / webhook stub that fired via execute_workflow_action() would
-- have raised "column action_type/payload does not exist".
--
-- This migration adds the missing columns idempotently, relaxes the
-- not-null on step_type, adds a check that at least one of the dialects is
-- populated, and adds a helper view that normalises both shapes for the
-- queue worker. No data is lost; either writer keeps working.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiserte tiltak må logges
--   pålitelig. Tidligere kunne handlinger feile uten å lande i kø, og
--   restrisiko var at ingen fikk avvik (tiltaket "skjedde aldri").
--   Restrisiko deferred: full backfill av kjørte-handlinger pre-fix; kun
--   nye handlinger fra og med denne migrasjonen er garantert sporbare.

alter table public.workflow_action_queue
  add column if not exists action_type text,
  add column if not exists payload     jsonb;

-- Relax step_type so writers that only use action_type don't crash.
alter table public.workflow_action_queue
  alter column step_type drop not null;

-- One-of constraint: at least one dialect must be populated.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workflow_action_queue_dialect_chk'
  ) then
    alter table public.workflow_action_queue
      add constraint workflow_action_queue_dialect_chk
      check (step_type is not null or action_type is not null);
  end if;
end$$;

comment on column public.workflow_action_queue.step_type is
  'Legacy dialect from _20260618150000 (workflow_steps-driven). Paired with config_json + context_json.';
comment on column public.workflow_action_queue.action_type is
  'Newer dialect from _20260829120011 (execute_workflow_action). Paired with payload (merged action+context).';
comment on column public.workflow_action_queue.payload is
  'Merged action+context envelope for action_type-dialect rows. Null when step_type is used.';

-- Helper view: normalises both dialects so the queue worker can read one shape.
create or replace view public.workflow_action_queue_normalized as
  select
    q.id,
    q.organization_id,
    q.rule_id,
    q.step_id,
    coalesce(q.action_type, q.step_type) as effective_action_type,
    coalesce(q.payload, q.config_json || coalesce(q.context_json, '{}'::jsonb)) as effective_payload,
    q.status,
    q.attempt_count,
    q.last_error,
    q.execute_after,
    q.created_at,
    q.updated_at
  from public.workflow_action_queue q;

grant select on public.workflow_action_queue_normalized to authenticated;

-- Queue worker uses workflow_action_queue_pending_idx from _20260618150000
-- which already covers (status, execute_after) where status = 'pending'.
-- The approvals migration (_20260905120700) extends the status enum and adds
-- a broader index covering awaiting_approval / awaiting_schedule.
