-- Backfill workflow_run_evidence.chain_key for pre-P0-fix rows that the
-- initial partition migration (_121700) collapsed into the coarse
-- 'system:legacy' bucket. For each affected row, look up the parent
-- workflow_runs row to recover (source_module, event) and re-stamp
-- chain_key as 'system:<module>:<event>'. Then re-walk the chain per
-- (organization_id, chain_key) partition and re-anchor
-- chain_root_checksum. Existing TSA anchors whose period spans any
-- re-chained 'system:%' row are flipped back to 'pending' so the next
-- cron tick re-signs them — the legacy 'system:legacy' bucket was a
-- coarser partition than what we ship now, so prior anchors over it
-- would mismatch on verify regardless.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritet — Merkle-kjeden
--   må være meningsfullt verifiserbar per partisjon), AML § 3-1 (sporbar
--   dokumentasjon — kvittering-kjeden må kunne deles per regel/system-
--   event uten kollisjon), IK-f § 5 nr. 7 (autentisitet og sporbarhet av
--   dokumentasjon over tid).
--   Restrisiko deferred: parent workflow_runs-rader som mangler både
--   source_module og event havner i 'system:unknown:unknown'-partisjon
--   inntil en operatør kategoriserer dem — backfillet er konservativt og
--   låser ikke ut nye writes.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 0. Disable mutation triggers for the duration of this transaction.
--    workflow_run_evidence is normally append-only (UPDATE denied by the
--    immutability trigger); same for workflow_evidence_anchors once they
--    leave 'pending'. This migration is the sanctioned one-off re-anchor
--    of the legacy bucket, so we disable both for the session.
-- ---------------------------------------------------------------------------
alter table public.workflow_run_evidence
  disable trigger workflow_run_evidence_deny_update;
alter table public.workflow_evidence_anchors
  disable trigger workflow_evidence_anchors_immutable;

-- ---------------------------------------------------------------------------
-- 1. Backfill chain_key: 'system:legacy' (or NULL, belt-and-braces) →
--    'system:<source_module>:<event>' from the parent workflow_runs row.
--    Done in batches of 500 to avoid lock contention on busy tenants.
-- ---------------------------------------------------------------------------
do $bf$
declare
  v_batch     int;
  v_total     int := 0;
begin
  loop
    with cte as (
      select e.id
        from public.workflow_run_evidence e
       where e.chain_key is null
          or e.chain_key = 'system:legacy'
       limit 500
       for update skip locked
    )
    update public.workflow_run_evidence e
       set chain_key = coalesce(
             e.rule_id::text,
             'system:'
               || coalesce(r.source_module, 'unknown')
               || ':'
               || coalesce(r.event, 'unknown')
           )
      from cte
      left join public.workflow_runs r on r.id = e.run_id
     where e.id = cte.id;

    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    exit when v_batch = 0;
  end loop;

  -- Stash the count for the closing notice via a temp setting.
  perform set_config('app.chain_key_backfill_count', v_total::text, true);
end
$bf$;

-- ---------------------------------------------------------------------------
-- 2. Re-walk the chain per (organization_id, chain_key) partition and
--    recompute chain_root_checksum from the new chain order. Only touch
--    partitions that contain at least one re-stamped 'system:%' row — a
--    pure rule_id::text partition's chain was already correct (the
--    partition boundary never changed for those rows).
--
--    The partition boundary is handled correctly because:
--      a) ALL system:legacy rows are now re-partitioned into one or more
--         disjoint 'system:<module>:<event>' partitions before this step
--         runs; the backfill above already committed in its CTE.
--      b) We re-walk EVERY 'system:%' partition for orgs that had any
--         legacy rows — this is conservative and ensures that, even if a
--         post-P0-fix row landed in a 'system:<m>:<e>' partition between
--         the original migration and now, its chain head is correctly
--         re-anchored against the now-prepended legacy rows.
-- ---------------------------------------------------------------------------
do $rc$
declare
  v_part        record;
  v_row         record;
  v_prev_root   text;
  v_new_root    text;
begin
  for v_part in
    select distinct e.organization_id, e.chain_key
      from public.workflow_run_evidence e
     where e.chain_key like 'system:%'
  loop
    v_prev_root := null;
    for v_row in
      select id, sha256_checksum, chain_root_checksum
        from public.workflow_run_evidence
       where organization_id = v_part.organization_id
         and chain_key       = v_part.chain_key
       order by created_at asc, id asc
       for update
    loop
      v_new_root := encode(
        public.digest(coalesce(v_prev_root, '') || v_row.sha256_checksum, 'sha256'),
        'hex'
      );
      if v_row.chain_root_checksum is distinct from v_new_root
         or coalesce(v_row.chain_root_checksum, '') = '' then
        update public.workflow_run_evidence
           set prev_checksum       = v_prev_root,
               chain_root_checksum = v_new_root
         where id = v_row.id;
      end if;
      v_prev_root := v_new_root;
    end loop;
  end loop;
end
$rc$;

-- ---------------------------------------------------------------------------
-- 3. Re-flag affected TSA anchors as 'pending' so the next cron tick
--    re-signs them. We touch any anchor in {signed, verified} whose
--    period overlaps the now re-chained 'system:%' rows.
--    Period overlap (not just containment) — an anchor that partially
--    overlaps the legacy window is still invalidated because its
--    merkle_root_sha256 baked in the old chain_root_checksum values.
-- ---------------------------------------------------------------------------
do $af$
declare
  v_count          int := 0;
  v_did_backfill   int := coalesce(current_setting('app.chain_key_backfill_count', true), '0')::int;
begin
  -- Idempotency: only re-flag anchors when this run actually re-partitioned
  -- rows. On re-runs (v_did_backfill = 0) every chain root is already
  -- correct, so prior anchors should NOT be invalidated again.
  if v_did_backfill > 0 then
    update public.workflow_evidence_anchors a
       set status         = 'pending',
           tsa_provider   = null,
           tsa_token      = null,
           tsa_token_storage_path = null,
           tsa_signed_at  = null,
           tsa_serial_number = null,
           failure_reason = 'Re-anchored after chain_key backfill ('
             || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             || '): legacy system-rule bucket was re-partitioned; prior signature would mismatch on verify.',
           updated_at     = now()
     where a.status in ('signed', 'verified')
       and exists (
         select 1
           from public.workflow_run_evidence e
          where (a.organization_id is null or e.organization_id = a.organization_id)
            and e.created_at >= a.period_start
            and e.created_at <  a.period_end
            and e.chain_key like 'system:%'
       );

    get diagnostics v_count = row_count;

    -- Append a build-log row per re-flagged anchor so audit can trace the
    -- transition without spelunking through this migration.
    insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
    select a.id, 'compose', 'success',
           jsonb_build_object(
             'reason', 'chain_key_backfill_re_anchor',
             'migration', '20260907125100_workflow_evidence_chain_key_backfill',
             'previous_status', 'signed_or_verified',
             'new_status', 'pending',
             'period_start', a.period_start,
             'period_end',   a.period_end
           )
      from public.workflow_evidence_anchors a
     where a.status = 'pending'
       and a.failure_reason like '%chain_key backfill%'
       and not exists (
         select 1 from public.workflow_evidence_anchor_builds b
          where b.anchor_id = a.id
            and b.detail->>'migration' = '20260907125100_workflow_evidence_chain_key_backfill'
       );
  end if;

  perform set_config('app.chain_key_anchor_flag_count', v_count::text, true);
end
$af$;

-- ---------------------------------------------------------------------------
-- 4. Re-enable mutation triggers.
-- ---------------------------------------------------------------------------
alter table public.workflow_run_evidence
  enable trigger workflow_run_evidence_deny_update;
alter table public.workflow_evidence_anchors
  enable trigger workflow_evidence_anchors_immutable;

-- ---------------------------------------------------------------------------
-- 5. Counters.
-- ---------------------------------------------------------------------------
do $rep$
declare
  v_rows    text := coalesce(current_setting('app.chain_key_backfill_count', true), '0');
  v_anchors text := coalesce(current_setting('app.chain_key_anchor_flag_count', true), '0');
begin
  raise notice 'workflow_run_evidence chain_key backfill: % rows re-partitioned, % anchors flipped to pending for re-signing.',
    v_rows, v_anchors;
end
$rep$;
