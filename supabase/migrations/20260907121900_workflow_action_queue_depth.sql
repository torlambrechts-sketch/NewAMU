-- Cap workflow recursion at 5 via a queue-row column (not session state).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — det skal være sporbart at
--   automatiske kjeder ikke kan løpe løpsk. _120800 lagrer dybde i
--   `app.workflow_depth` via set_config(..., true) som er økt-lokalt;
--   det dør i samme øyeblikk en kø-handling plukkes opp av workeren i en
--   annen forbindelse, så `A → oppgave → B → A` over kø var i praksis
--   ubegrenset.
--   Restrisiko deferred: legacy trigger-banen beholder set_config-vakten
--   som belte-og-seler. Per-regel-dybdekonfig er en Phase C-utvidelse.
--
-- Idempotency notes:
--   * columns are added in _121800 with `add column if not exists`; this
--     migration only enforces the CHECK constraint + supporting index.
--   * Existing in-flight rows default to depth=0 (safe — they get a fresh
--     budget on resume) and parent_queue_id=null (no tracing for legacy
--     rows; new ones carry the chain).

-- Add the columns idempotently here too, in case this migration ever
-- runs before _121800 (basename order says _121800 first, but the
-- applier sorts globally and other branches may interleave).
alter table public.workflow_action_queue
  add column if not exists depth int not null default 0;

alter table public.workflow_action_queue
  add column if not exists parent_queue_id uuid
    references public.workflow_action_queue (id) on delete set null;

-- Cap depth at 5. We allow 0..5 inclusive; the worker fails any row that
-- reaches 5 before executing, but the column itself accepts 5 so the
-- evidence row can be inserted before the worker marks it failed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workflow_action_queue_depth_chk'
  ) then
    alter table public.workflow_action_queue
      add constraint workflow_action_queue_depth_chk
      check (depth between 0 and 5);
  end if;
end$$;

create index if not exists workflow_action_queue_parent_idx
  on public.workflow_action_queue (parent_queue_id)
  where parent_queue_id is not null;

comment on column public.workflow_action_queue.depth is
  'Recursion depth for this queued action (0 = enqueued by a trigger / cron; N = enqueued by an action at depth N-1). Capped at 5 by workflow_action_queue_depth_chk; worker rejects rows where depth >= 5 with WORKFLOW_DEPTH_EXCEEDED.';
comment on column public.workflow_action_queue.parent_queue_id is
  'When an action was enqueued by another queued action (parallel branch, on_error sibling, …), this points at the parent row so the chain can be traced end-to-end. Null for top-level rows.';

-- Helper RPC: worker calls this when it picks a row at the cap so the
-- "skipped" entry lands in workflow_runs with a stable detail shape.
create or replace function public.workflow_record_depth_exceeded(
  p_queue_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select id, organization_id, rule_id, action_type, depth, payload
    into v_row
    from public.workflow_action_queue
   where id = p_queue_id;
  if not found then
    return;
  end if;

  insert into public.workflow_runs (
    organization_id, rule_id, source_module, event, status, detail
  ) values (
    v_row.organization_id,
    v_row.rule_id,
    coalesce(v_row.payload->>'module', 'workflow_queue'),
    'db_event',
    'skipped',
    jsonb_build_object(
      'reason', 'WORKFLOW_DEPTH_EXCEEDED',
      'depth',  v_row.depth,
      'queue_id', v_row.id,
      'action_type', v_row.action_type
    )
  );

  update public.workflow_action_queue
     set status     = 'failed',
         last_error = 'WORKFLOW_DEPTH_EXCEEDED:depth=' || v_row.depth::text,
         updated_at = now()
   where id = p_queue_id
     and status in ('pending', 'processing');
end;
$$;

grant execute on function public.workflow_record_depth_exceeded(uuid) to service_role;

comment on function public.workflow_record_depth_exceeded(uuid) is
  'Worker hook: when a leased queue row is at the depth cap (>= 5), this writes a workflow_runs row with status=skipped + detail.reason=WORKFLOW_DEPTH_EXCEEDED and marks the queue row failed. Belt-and-braces above the column CHECK and the legacy session-scoped guard in _120800.';
