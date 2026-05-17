-- Transaction-safety net for the _125100 chain_key backfill.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritet — mutasjons-
--   triggerne MÅ være aktive ellers er append-only-garantien for
--   workflow_run_evidence brutt) + AML § 3-1 (sporbar dokumentasjon —
--   et delvis kjørt _125100 etterlater triggerne disabled og åpner
--   en silent-write-vindu inntil neste deploy).

set local search_path = public, pg_catalog;

-- 1. Re-enable both triggers unconditionally. `alter trigger ... enable`
--    is idempotent (no error if already enabled) and a no-op if the table
--    doesn't exist on a brand-new install where _125100 hasn't run.
do $$
begin
  if to_regclass('public.workflow_run_evidence') is not null then
    alter table public.workflow_run_evidence
      enable trigger workflow_run_evidence_deny_update;
  end if;
  if to_regclass('public.workflow_evidence_anchors') is not null then
    alter table public.workflow_evidence_anchors
      enable trigger workflow_evidence_anchors_immutable;
  end if;
end
$$;

-- 2. Assertion: confirm both triggers are enabled ('O' = origin, i.e.
--    fires on local writes). 'D' = disabled. We raise if either is still
--    disabled so a partial _125100 failure surfaces at migration-apply
--    time rather than as a silent integrity gap.
do $$
declare
  v_evidence_state    "char";
  v_anchor_state      "char";
begin
  select t.tgenabled into v_evidence_state
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relname = 'workflow_run_evidence'
     and t.tgname = 'workflow_run_evidence_deny_update';

  select t.tgenabled into v_anchor_state
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relname = 'workflow_evidence_anchors'
     and t.tgname = 'workflow_evidence_anchors_immutable';

  if v_evidence_state is not null and v_evidence_state <> 'O' then
    raise exception
      'workflow_run_evidence_deny_update trigger is in state % (expected O = enabled). _125100 likely failed mid-run.',
      v_evidence_state;
  end if;
  if v_anchor_state is not null and v_anchor_state <> 'O' then
    raise exception
      'workflow_evidence_anchors_immutable trigger is in state % (expected O = enabled). _125100 likely failed mid-run.',
      v_anchor_state;
  end if;
end
$$;

-- 3. View exposing the trigger state so operators / advisors can poll
--    without spelunking through pg_trigger.
create or replace view public.workflow_evidence_trigger_state as
  select c.relname     as table_name,
         t.tgname      as trigger_name,
         t.tgenabled   as state,
         case t.tgenabled
           when 'O' then 'enabled (origin)'
           when 'D' then 'disabled'
           when 'R' then 'enabled (replica)'
           when 'A' then 'enabled (always)'
           else 'unknown'
         end as state_label
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relname in ('workflow_run_evidence', 'workflow_evidence_anchors')
     and t.tgname in (
       'workflow_run_evidence_deny_update',
       'workflow_evidence_anchors_immutable'
     );

comment on view public.workflow_evidence_trigger_state is
  'Read-only view over pg_trigger for the two append-only/immutability triggers on workflow_run_evidence and workflow_evidence_anchors. tgenabled = ''O'' means enabled. Any other value indicates a partially-run maintenance migration left them disabled — see comment on workflow_run_evidence for the safe-pattern requirement.';

-- 4. Documentation comment on workflow_run_evidence — any future
--    migration that disables these triggers MUST wrap the body in a
--    do-block with exception handler that re-enables them and re-raises.
comment on table public.workflow_run_evidence is
  'Append-only evidence chain for workflow_runs. UPDATE/DELETE denied via workflow_run_evidence_deny_update. CRITICAL: any maintenance migration disabling this trigger MUST wrap the body in `do $$ begin ...; exception when others then alter trigger workflow_run_evidence_deny_update on public.workflow_run_evidence enable; alter trigger workflow_evidence_anchors_immutable on public.workflow_evidence_anchors enable; raise; end $$;` — otherwise a mid-statement failure leaves the table mutable. _125500 adds an assertion + view (public.workflow_evidence_trigger_state) so operators can verify state.';
