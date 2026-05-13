-- pg_cron job for the gov-outbox-worker edge function.
--
-- Drains compliance_notifications rows of kinds:
--   * datatilsynet_breach
--   * nav_sykefravar_outbox
--   * ldo_export_pending
-- every 5 minutes. Pattern mirrors workflow_queue_worker_tick.
--
-- Defensive checks: if pg_net or pg_cron isn't installed we log a
-- notice and an external scheduler must invoke the worker.

create or replace function public.workflow_gov_outbox_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  begin
    v_url := current_setting('app.supabase_url', true);
  exception when others then v_url := null; end;
  begin
    v_key := current_setting('app.supabase_service_role_key', true);
  exception when others then v_key := null; end;

  if v_url is null or v_key is null then
    raise notice 'workflow_gov_outbox_tick: app.supabase_url / app.supabase_service_role_key not set — external scheduler must invoke the worker.';
    return;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := v_url || '/functions/v1/gov-outbox-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  else
    raise notice 'workflow_gov_outbox_tick: pg_net not installed.';
  end if;
end;
$$;

grant execute on function public.workflow_gov_outbox_tick() to service_role;

do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_gov_outbox_tick')
    loop perform cron.unschedule(r.jobid); end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_gov_outbox_tick',
      '*/5 * * * *',
      $cmd$select public.workflow_gov_outbox_tick();$cmd$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;
