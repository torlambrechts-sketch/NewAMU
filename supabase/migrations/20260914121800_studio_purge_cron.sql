-- Studio Builder — pg_cron registration for purge_revoked_studio_drafts.
--
-- Task 3.4 shipped the purge function but left scheduling deferred.
-- This migration registers a daily 03:15 UTC cron when pg_cron is
-- available (Supabase production has it on by default; local dev does
-- not). On environments without pg_cron, the function still exists
-- and can be invoked manually or by an external scheduler.
--
-- Idempotent: cron.schedule's overload that takes a job name dedupes
-- by name.

set local search_path = public, pg_catalog;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- cron.schedule returns the job id; cron.unschedule by name first
    -- so re-running this migration replaces the schedule rather than
    -- creating a duplicate.
    perform cron.unschedule(jobid) from cron.job where jobname = 'studio_purge_revoked_drafts';
    perform cron.schedule(
      'studio_purge_revoked_drafts',
      '15 3 * * *',           -- 03:15 UTC daily
      $cmd$ select public.purge_revoked_studio_drafts(); $cmd$
    );
  else
    raise notice '[studio_purge_cron] pg_cron extension missing — call public.purge_revoked_studio_drafts() from an external scheduler.';
  end if;
end
$do$;
