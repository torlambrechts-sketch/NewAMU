-- Quarterly re-verify cron over workflow_evidence_anchors.
--
-- _20260907123500 wires workflow_verify_anchor(anchor_id) and a monthly
-- compose-cron, but nothing re-walks already-signed anchors. An anchor
-- signed in januar then untouched is a silent drift window: tampering
-- introduced in februar would not surface before someone manually opens
-- the AnchorStatusCard. This migration schedules a 1. jan/april/juli/
-- oktober 04:00 UTC pass that re-verifies any anchor whose last verify
-- is older than 85 days and emits a critical notification + db_event on
-- mismatch so subscribed rules (e.g. "stopp tilsynsbrev-eksport") fire.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritetskontroll må være
--   periodisk og dokumenterbar — engangs-signering uten re-verifisering
--   tilfredsstiller ikke kravet til løpende kontroll), Arkivforskriften
--   § 7 (autentisitet/integritet av elektronisk arkivverdig materiale
--   over tid forutsetter aktiv overvåking, ikke bare initial signering).
--   Restrisiko deferred: vendor TSA-token-revalidering (RFC 3161
--   verifisering mot leverandørens chain) krever utgående HTTPS fra
--   edge-laget; her gjenkomputerer vi kun Merkle-roten lokalt.

set local search_path = public, pg_catalog;

-- ─── 1. Re-verify tracking columns ────────────────────────────────────────

alter table public.workflow_evidence_anchors
  add column if not exists last_verified_at  timestamptz,
  add column if not exists last_verify_result text;

comment on column public.workflow_evidence_anchors.last_verified_at is
  'Timestamp of the most recent workflow_verify_anchor pass (manual UI button or quarterly cron). NULL = never re-verified post-signing.';

comment on column public.workflow_evidence_anchors.last_verify_result is
  'Free text: ''ok'', ''TAMPER:<reason>'', ''verify_error:<sqlerrm>''. Read by AnchorStatusCard to render the "sist verifisert" badge.';

create index if not exists workflow_evidence_anchors_reverify_idx
  on public.workflow_evidence_anchors (status, last_verified_at)
  where status in ('signed', 'verified');

-- ─── 2. workflow_verify_all_anchors_tick ──────────────────────────────────
-- Iterates signed/verified anchors whose last verify is older than 85d
-- (or never) and re-walks them via workflow_verify_anchor. Uses
-- "for update skip locked" so overlapping cron invocations don't race.
-- Returns {verified, tampered, skipped} as jsonb.
--
-- Note: workflow_verify_anchor already does its own critical fan-out on
-- mismatch (direct insert into compliance_notifications, see
-- _20260907123500 §9). We additionally:
--   * Record last_verified_at / last_verify_result on every pass.
--   * On tamper, emit a workflow_dispatch_notification (category
--     workflow_gov_action, severity critical) — this picks up the
--     role-aware resolver (daglig_leder / hms_koordinator / dpo) which
--     the direct fan-out in _123500 misses (it only targets is_org_admin
--     profiles). The on-conflict (recipient_user_id, notification_key)
--     constraint dedupes against the direct insert.
--   * Fire workflow_dispatch_db_event ON_EVIDENCE_TAMPER_DETECTED so
--     subscribed workflow_rules can react (emergency stopp-rules).

create or replace function public.workflow_verify_all_anchors_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_anchor      record;
  v_ok          boolean;
  v_verified    int := 0;
  v_tampered    int := 0;
  v_skipped     int := 0;
  v_errmsg      text;
  v_payload     jsonb;
begin
  for v_anchor in
    select id, organization_id, chain_key, period_start, period_end,
           merkle_root_sha256, status
      from public.workflow_evidence_anchors
     where status in ('signed', 'verified')
       and (last_verified_at is null
            or last_verified_at < now() - interval '85 days')
     for update skip locked
  loop
    begin
      v_ok := public.workflow_verify_anchor(v_anchor.id);
    exception when others then
      v_errmsg := sqlerrm;
      -- workflow_verify_anchor raised before deciding match/mismatch.
      -- Record the error result but don't flip status — the anchor row
      -- itself is untouched in this branch (verify-fn never reached the
      -- update). Operator can re-run via UI.
      update public.workflow_evidence_anchors
         set last_verified_at   = now(),
             last_verify_result = 'verify_error:' || left(coalesce(v_errmsg, 'unknown'), 240)
       where id = v_anchor.id;
      v_skipped := v_skipped + 1;
      raise notice 'workflow_verify_all_anchors_tick: anchor % verify raised: %',
        v_anchor.id, v_errmsg;
      continue;
    end;

    if v_ok then
      update public.workflow_evidence_anchors
         set last_verified_at   = now(),
             last_verify_result = 'ok'
       where id = v_anchor.id;
      v_verified := v_verified + 1;
    else
      -- TAMPER: workflow_verify_anchor has already flipped status →
      -- 'failed' and set failure_reason; we mirror that on the verify
      -- tracking columns, fan out via the role-aware dispatcher, and
      -- emit the db_event so emergency stopp-rules can subscribe.
      v_errmsg := (
        select coalesce(failure_reason, 'merkle_root_mismatch')
          from public.workflow_evidence_anchors
         where id = v_anchor.id
      );

      update public.workflow_evidence_anchors
         set last_verified_at   = now(),
             last_verify_result = 'TAMPER:' || left(coalesce(v_errmsg, 'merkle_root_mismatch'), 240)
       where id = v_anchor.id;

      v_payload := jsonb_build_object(
        'anchor_id', v_anchor.id,
        'organization_id', v_anchor.organization_id,
        'chain_key', v_anchor.chain_key,
        'period_start', v_anchor.period_start,
        'period_end', v_anchor.period_end,
        'merkle_root_sha256', v_anchor.merkle_root_sha256,
        'failure_reason', v_errmsg,
        'detected_at', now(),
        'detector', 'workflow_verify_all_anchors_tick',
        'title', 'Bevis-anker tukling oppdaget (kvartalsvis verifisering)',
        'body', format(
          'Kvartalsvis re-verifisering av TSA-anker %s (periode %s–%s) feilet. Merkle-roten samsvarer ikke med signert verdi. Grunn: %s. Subscribe ON_EVIDENCE_TAMPER_DETECTED for å reagere automatisk.',
          v_anchor.id, v_anchor.period_start, v_anchor.period_end, v_errmsg
        )
      );

      -- (a) Role-aware fan-out via the dispatcher (org-scoped anchors).
      -- For platform-global anchors (organization_id is null) the direct
      -- fan-out in workflow_verify_anchor already notified platform_admins
      -- — we skip the dispatcher here because it requires a non-null org.
      if v_anchor.organization_id is not null then
        begin
          perform public.workflow_dispatch_notification(
            v_anchor.organization_id,
            'workflow_gov_action',
            v_payload,
            'daglig_leder',
            'critical'
          );
          -- Also reach HMS-koordinator + DPO since tamper detection is
          -- both an HMS-compliance and a personvern-integritet event.
          perform public.workflow_dispatch_notification(
            v_anchor.organization_id,
            'workflow_gov_action',
            v_payload,
            'hms_koordinator',
            'critical'
          );
          perform public.workflow_dispatch_notification(
            v_anchor.organization_id,
            'workflow_gov_action',
            v_payload,
            'dpo',
            'critical'
          );
        exception when others then
          raise notice 'workflow_verify_all_anchors_tick: dispatch_notification failed for anchor %: %',
            v_anchor.id, sqlerrm;
        end;

        -- (b) db_event so subscribed workflow_rules trigger
        --     (e.g. emergency "stopp tilsynsbrev-eksport"-rule).
        begin
          perform public.workflow_dispatch_db_event(
            v_anchor.organization_id,
            'workflow',
            'ON_EVIDENCE_TAMPER_DETECTED',
            v_payload
          );
        exception when others then
          raise notice 'workflow_verify_all_anchors_tick: dispatch_db_event failed for anchor %: %',
            v_anchor.id, sqlerrm;
        end;
      end if;

      v_tampered := v_tampered + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'verified', v_verified,
    'tampered', v_tampered,
    'skipped',  v_skipped,
    'ran_at',   now()
  );
end;
$$;

revoke all on function public.workflow_verify_all_anchors_tick() from public;
grant execute on function public.workflow_verify_all_anchors_tick() to service_role;

comment on function public.workflow_verify_all_anchors_tick() is
  'Quarterly re-verify pass over workflow_evidence_anchors. Re-walks any signed/verified anchor whose last_verified_at is null or older than 85 days, records last_verify_result, fans out a critical workflow_gov_action notification to daglig_leder/hms_koordinator/dpo + emits ON_EVIDENCE_TAMPER_DETECTED db_event on tamper. Uses for-update-skip-locked so overlapping cron invocations are safe. Returns jsonb {verified, tampered, skipped, ran_at}.';

-- ─── 3. pg_cron — 04:00 UTC on the 1st of jan/april/juli/oktober ─────────

do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_verify_all_anchors_tick')
    loop perform cron.unschedule(r.jobid); end loop;
    perform cron.schedule(
      'workflow_verify_all_anchors_tick',
      '0 4 1 1,4,7,10 *',
      $cmd$select public.workflow_verify_all_anchors_tick();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule public.workflow_verify_all_anchors_tick() externally (kvartalsvis 1. jan/april/juli/oktober 04:00 UTC)';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule public.workflow_verify_all_anchors_tick() externally';
end
$cron$;

-- ─── 4. Verification block ───────────────────────────────────────────────

do $$
declare
  v_pending_first_verify int;
  v_total_signed         int;
  v_scheduled            text;
begin
  select count(*) into v_pending_first_verify
    from public.workflow_evidence_anchors
   where status in ('signed', 'verified')
     and last_verified_at is null;

  select count(*) into v_total_signed
    from public.workflow_evidence_anchors
   where status in ('signed', 'verified');

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select 'pg_cron job workflow_verify_all_anchors_tick @ 0 4 1 1,4,7,10 * (UTC)'
      into v_scheduled;
  else
    v_scheduled := 'pg_cron NOT installed — external scheduler required';
  end if;

  raise notice 'workflow_anchor_quarterly_verify installed.';
  raise notice '  Schedule: %', v_scheduled;
  raise notice '  Anchors pending first-time verify: % (of % signed/verified total)',
    v_pending_first_verify, v_total_signed;
end
$$;
