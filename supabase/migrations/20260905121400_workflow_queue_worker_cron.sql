-- workflow_queue_lease + pg_cron HTTP invoker for the queue worker.
--
-- The queue worker (supabase/functions/workflow-queue-worker) needs a
-- way to lease N rows atomically. SQL's FOR UPDATE SKIP LOCKED handles
-- the concurrency story; this function wraps it so the edge function
-- gets a single RPC call.
--
-- Then we register a pg_cron job that POSTs to the worker every minute
-- using the pg_net extension. If pg_net isn't installed (some Supabase
-- tiers), the cron job still exists and logs a notice — admins can swap
-- in an external scheduler hitting the same URL.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiserte tiltak må
--   faktisk iverksettes for å være sporbare. Tidligere har køen vært
--   stille — ingen drainer.
--   Restrisiko deferred: per-org-rate-limiting per regulator (Phase E
--   sprint-2). Default-budsjettet er 6 statlige meldinger pr min pr
--   org; vi håndhever ikke det enda.

-- ── 1. Lease function ──────────────────────────────────────────────────

create or replace function public.workflow_queue_lease(
  p_batch_size int default 25
)
returns table (
  id uuid,
  organization_id uuid,
  rule_id uuid,
  action_type text,
  step_type text,
  payload jsonb,
  config_json jsonb,
  context_json jsonb,
  attempt_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.workflow_action_queue q
     set status = 'processing',
         updated_at = now()
   where q.id in (
     select q2.id
       from public.workflow_action_queue q2
      where q2.status = 'pending'
        and q2.execute_after <= now()
      order by q2.execute_after
      limit p_batch_size
      for update skip locked
   )
  returning q.id, q.organization_id, q.rule_id, q.action_type, q.step_type,
            q.payload, q.config_json, q.context_json, q.attempt_count;
end;
$$;

grant execute on function public.workflow_queue_lease(int) to service_role;

comment on function public.workflow_queue_lease(int) is
  'Atomic batch-leaser for workflow_action_queue. Marks rows status=processing and returns them. Worker is expected to flip to done / failed / pending(with backoff). FOR UPDATE SKIP LOCKED makes concurrent invocations safe.';

-- ── 2. pg_cron job invoking the worker via pg_net ─────────────────────

do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_queue_worker_tick')
    loop perform cron.unschedule(r.jobid); end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

-- The worker is invoked via pg_net.http_post if available. The function
-- below wraps that so the cron job stays declarative. We read the
-- service-role key + URL from current_setting() which Supabase sets on
-- the cluster.
create or replace function public.workflow_queue_worker_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Read from supabase_admin schema if available (Supabase Cloud). For
  -- self-hosted, set these via ALTER DATABASE ... SET app.<key> = ....
  begin
    v_url := current_setting('app.supabase_url', true);
  exception when others then v_url := null; end;
  begin
    v_key := current_setting('app.supabase_service_role_key', true);
  exception when others then v_key := null; end;

  if v_url is null or v_key is null then
    raise notice 'workflow_queue_worker_tick: app.supabase_url / app.supabase_service_role_key not set — external scheduler must invoke the worker.';
    return;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := v_url || '/functions/v1/workflow-queue-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  else
    raise notice 'workflow_queue_worker_tick: pg_net not installed — install or use an external scheduler.';
  end if;
end;
$$;

grant execute on function public.workflow_queue_worker_tick() to service_role;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_queue_worker_tick',
      '* * * * *',
      $cmd$select public.workflow_queue_worker_tick();$cmd$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

comment on function public.workflow_queue_worker_tick() is
  'pg_cron-driven invoker that POSTs to the workflow-queue-worker edge function via pg_net. Falls back to a notice when either extension is unavailable.';
