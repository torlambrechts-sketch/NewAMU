-- Fix-up: workflow_retention_purge_tick must be atomic and the archive
-- tables need a real primary key. The original _120900 did:
--   1) INSERT into archive
--   2) SEPARATE DELETE FROM live WHERE id IN (... lookup back into archive)
-- A failure between steps 1 and 2 leaves an archived row whose live twin
-- is still present (double-counted + permanent orphan). And `like ...
-- including defaults including constraints` does NOT copy the primary
-- key, so the archive tables had no PK at all — any future bug that
-- double-inserts would silently duplicate audit rows.
--
-- Also drops the `for all using (false)` "no_write" policies from
-- _120900 — Postgres RLS without a policy already defaults to deny, and
-- the policy fires for SELECT/INSERT/UPDATE/DELETE so it effectively
-- shadowed the genuine SELECT policy in some PG versions (C-8).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: Arkivloven § 6 (bevaring — orphans = manglende
--   bevaring), GDPR Art. 5(1)(e) (lagringsbegrensning — utelukket-fra-live
--   må også være utelukket-fra-arkiv-duplikat), AML § 3-1 (sporbar dokumen-
--   tasjon — primærnøkkel kreves for revisjons-spor), IK-f § 5 nr. 7.
--   Restrisiko deferred: PK = (id, archived_at) støtter hypotetisk re-arki-
--   vering om en evidence-rad noensinne skulle re-purges (skal ikke skje).
--   Den eksplisitte valgte fram for silent duplikat-skygging.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Add composite primary keys to the archive tables. Use a do-block so
--    add-constraint is idempotent (no "add constraint if not exists" in PG).
-- ---------------------------------------------------------------------------
do $pk$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.workflow_runs_archive'::regclass
       and contype  = 'p'
  ) then
    alter table public.workflow_runs_archive
      add constraint workflow_runs_archive_pk primary key (id, archived_at);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.workflow_run_evidence_archive'::regclass
       and contype  = 'p'
  ) then
    alter table public.workflow_run_evidence_archive
      add constraint workflow_run_evidence_archive_pk primary key (id, archived_at);
  end if;
end
$pk$;

-- ---------------------------------------------------------------------------
-- 2. Drop the overzealous _no_write policies. RLS without a policy denies
--    by default; the explicit `for all using (false)` policy fires for
--    SELECT too and shadows the intended SELECT policy on some PG versions.
-- ---------------------------------------------------------------------------
drop policy if exists "workflow_runs_archive_no_write" on public.workflow_runs_archive;
drop policy if exists "workflow_run_evidence_archive_no_write" on public.workflow_run_evidence_archive;

-- ---------------------------------------------------------------------------
-- 3. Re-create workflow_retention_purge_tick with single-CTE atomic flow.
--    Each iteration: SELECT expired (FOR UPDATE SKIP LOCKED) → INSERT into
--    archive RETURNING id → DELETE from live WHERE id IN (...). All three
--    CTEs in the same statement so the writer is atomic — a crash between
--    archive + delete is impossible.
--
--    Wider exception handler: we always restore session_replication_role
--    on the error path (the immutability trigger on workflow_run_evidence
--    is bypassed for the duration of the DELETE).
-- ---------------------------------------------------------------------------
create or replace function public.workflow_retention_purge_tick(
  p_batch_size int default 500
)
returns table (
  archived_runs     bigint,
  archived_evidence bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs_count     bigint := 0;
  v_evidence_count bigint := 0;
begin
  -- (a) Evidence: atomic insert+delete via CTE. The immutability trigger
  --     on workflow_run_evidence rejects DELETE, so flip
  --     session_replication_role to 'replica' for the duration; restore
  --     in BOTH success and failure paths.
  perform set_config('session_replication_role', 'replica', true);
  begin
    with expired_evidence as (
      select e.*
        from public.workflow_run_evidence e
       where (
         e.retain_until is not null and e.retain_until < now()
       )
       or e.run_id in (
         select id from public.workflow_runs
          where retain_until is not null and retain_until < now()
       )
       limit p_batch_size
       for update skip locked
    ),
    archived_evidence as (
      insert into public.workflow_run_evidence_archive
        select e.*, now() as archived_at from expired_evidence e
      returning id
    ),
    deleted_evidence as (
      delete from public.workflow_run_evidence
       where id in (select id from archived_evidence)
      returning id
    )
    select count(*) into v_evidence_count from deleted_evidence;
  exception when others then
    -- Restore role and re-raise so the caller sees the failure.
    perform set_config('session_replication_role', 'origin', true);
    raise;
  end;
  perform set_config('session_replication_role', 'origin', true);

  -- (b) Runs: same atomic pattern. Runs have no immutability trigger.
  with expired_runs as (
    select r.*
      from public.workflow_runs r
     where r.retain_until is not null and r.retain_until < now()
     limit p_batch_size
     for update skip locked
  ),
  archived_runs_cte as (
    insert into public.workflow_runs_archive
      select r.*, now() as archived_at from expired_runs r
    returning id
  ),
  deleted_runs as (
    delete from public.workflow_runs
     where id in (select id from archived_runs_cte)
    returning id
  )
  select count(*) into v_runs_count from deleted_runs;

  archived_runs     := v_runs_count;
  archived_evidence := v_evidence_count;
  return next;
end;
$$;

revoke all on function public.workflow_retention_purge_tick(int) from public;
grant execute on function public.workflow_retention_purge_tick(int) to service_role;

comment on function public.workflow_retention_purge_tick(int) is
  'Archives + deletes workflow_runs/evidence past retain_until. ATOMIC: each INSERT-RETURNING feeds a DELETE in the same CTE — failure between archive + delete is no longer possible. session_replication_role flip is restored in the exception path so a crash never leaves the role in replica mode. Run by pg_cron quarterly; manual invocation requires service_role.';

do $$
begin
  raise notice 'workflow_retention_purge_tick rebuilt atomic; archive tables now have composite primary key (id, archived_at).';
end
$$;
