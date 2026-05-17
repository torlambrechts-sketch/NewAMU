-- Partner Console — stale auto_session clock sweeper.
--
-- When a consultant closes their browser tab mid-session, the
-- beforeunload-handler best-effort RPC frequently doesn't reach Postgres
-- and the partner_time_entries row stays ended_at=NULL forever. The
-- invoice generator skips ended_at=null so the time just disappears.
--
-- This migration adds a SECURITY DEFINER sweeper that closes auto_session
-- rows older than 12h (the realistic max consultant session) at
-- min(started_at + 12h, now()), and tags them metadata->>'sweeper'='1'
-- so the analytics layer can distinguish "user-closed" from "server-
-- closed" entries.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: IK-f § 5 nr. 7 — dokumentasjonsplikt på
--   utført HMS-arbeid. Tidsregistreringer som forsvinner i "open" er
--   et integritetsbrudd: enten fakturerbart arbeid uten artefakt, eller
--   "alltid pågående" status som forfalsker time-aggregater. AML § 14-6
--   (lønnsspesifikasjon) — bestilt timetall må kunne reproduseres.
--   Restrisiko deferred: 12h er en hard truncation. Hvis en konsulent
--   bevisst lar en sesjon stå (åpen workspace over natten) får hen
--   maks 12h kreditert. Aksept: edge case, og v0.2-fix er en eksplisitt
--   "fortsett sesjon"-knapp som extender ended_at.

set local search_path = public, pg_catalog;

-- ── 1. Add metadata column for sweep marking (additive, idempotent) ─────
alter table public.partner_time_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.partner_time_entries.metadata is
  'Free-form metadata bag. Reserved keys: ''sweeper''=''1'' marks rows closed by partner_sweep_stale_clocks; analytics use this to distinguish honest sessions from auto-cleaned ones.';

-- ── 2. Sweeper function ─────────────────────────────────────────────────
create or replace function public.partner_sweep_stale_clocks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with closed as (
    update public.partner_time_entries
       set ended_at = least(started_at + interval '12 hours', now()),
           metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('sweeper', '1',
                                            'sweeper_closed_at', now())
     where source = 'auto_session'
       and ended_at is null
       and started_at < now() - interval '12 hours'
    returning 1
  )
  select count(*) into v_count from closed;

  if v_count > 0 then
    raise notice 'partner_sweep_stale_clocks: closed % stale auto_session row(s)', v_count;
  end if;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.partner_sweep_stale_clocks() from public;
grant execute on function public.partner_sweep_stale_clocks() to service_role;

comment on function public.partner_sweep_stale_clocks() is
  'Closes partner_time_entries auto_session rows older than 12h. Sets ended_at = least(started_at+12h, now()), stamps metadata.sweeper=1. Run every 30 minutes via pg_cron (see workflow_partner_clock_sweep_tick job).';

-- ── 3. pg_cron schedule ─────────────────────────────────────────────────
-- Unschedule existing job first (idempotent re-run safe).
do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (
      select jobid from cron.job
       where jobname = 'partner_consultant_clock_sweep'
    ) loop
      perform cron.unschedule(r.jobid);
    end loop;
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
      'partner_consultant_clock_sweep',
      '*/30 * * * *',
      $cmd$select public.partner_sweep_stale_clocks();$cmd$
    );
    raise notice 'partner_consultant_clock_sweep: pg_cron job scheduled (*/30)';
  else
    raise notice 'partner_consultant_clock_sweep: pg_cron not installed — invoke partner_sweep_stale_clocks() from external scheduler';
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;
