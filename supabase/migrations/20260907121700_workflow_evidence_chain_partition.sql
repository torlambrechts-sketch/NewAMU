-- Fix-up: workflow_record_evidence chained by rule_id alone. For
-- system-rule emissions (rule_id IS NULL, source_module + event_name
-- carry the identity instead), the chain head selection
-- `where rule_id = NULL` returned no rows AND any later system-rule
-- emission for an unrelated system rule used the same NULL key — so
-- ALL system-rule evidence rows across ALL system rules aggregated
-- into one undifferentiated chain. Tampering with one rule's evidence
-- would still leave the global "system-rule" chain root valid, and
-- two unrelated system rules' evidence rows would interleave their
-- Merkle history.
--
-- Fix: add a generated `chain_key` column that combines rule_id and
-- (for system rules) source_module + event_name, and rewrite
-- workflow_record_evidence to chain by chain_key.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritet — Merkle-kjede må
--   partisjoneres per regel/system-regel for å være meningsfullt
--   verifiserbar), AML § 5-2 (kvittering-spor må kunne følges per
--   melde-flyt), IK-f § 5 nr. 7 (sporbar dokumentasjon).
--   Restrisiko deferred: historiske evidence-rader får chain_key =
--   'system:legacy' via backfill og kan ikke individuelt kjedes med ny
--   per-event partisjonering. Det aksepteres siden alle nye writes
--   bruker den korrekte partisjonen — fremtidig revisjons-flagging av
--   gamle rader er en separat oppgave.

set local search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Add chain_key. We need a STABLE expression — generated columns can't
--    reference other rows, but they CAN coalesce columns on the same row.
--    For the system-rule path we use source_module + event from the parent
--    run; for rule-id path we just use rule_id::text. Since neither
--    rule_id, run_id, nor the parent-run fields can be referenced from a
--    GENERATED column directly (no subqueries), we instead populate this
--    via a BEFORE-INSERT trigger and a CHECK that it's never null.
-- ---------------------------------------------------------------------------
alter table public.workflow_run_evidence
  add column if not exists chain_key text;

create index if not exists workflow_run_evidence_chain_key_idx
  on public.workflow_run_evidence (organization_id, chain_key, created_at desc)
  where chain_key is not null;

comment on column public.workflow_run_evidence.chain_key is
  'Partition key for the Merkle chain. rule_id::text when present, else "system:" || source_module || ":" || event_name from the parent run. Stamped by trg_workflow_run_evidence_set_chain_key before insert; workflow_record_evidence chains by this key not by rule_id directly.';

-- BEFORE-INSERT trigger to stamp chain_key. Runs first so the row is
-- always written with a non-null partition. workflow_record_evidence
-- still overrides if the writer pre-computed it.
create or replace function public.trg_workflow_run_evidence_set_chain_key()
returns trigger
language plpgsql
as $$
declare
  v_module text;
  v_event  text;
begin
  if new.chain_key is not null and new.chain_key <> '' then
    return new;
  end if;

  if new.rule_id is not null then
    new.chain_key := new.rule_id::text;
  else
    -- Pull source_module + event from the parent run.
    select coalesce(r.source_module, 'workflow'),
           coalesce(r.event, 'unknown')
      into v_module, v_event
      from public.workflow_runs r
     where r.id = new.run_id;
    new.chain_key := 'system:' || coalesce(v_module, 'workflow') || ':' || coalesce(v_event, 'unknown');
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_run_evidence_set_chain_key on public.workflow_run_evidence;
create trigger workflow_run_evidence_set_chain_key
  before insert on public.workflow_run_evidence
  for each row execute function public.trg_workflow_run_evidence_set_chain_key();

-- ---------------------------------------------------------------------------
-- 2. Backfill chain_key for existing rows.
--    rule_id present → rule_id::text
--    rule_id null    → 'system:legacy'   (we can't reliably recover the
--                                          original module+event for old
--                                          rows; the legacy bucket is
--                                          documented in the audit header)
-- ---------------------------------------------------------------------------
update public.workflow_run_evidence e
   set chain_key = coalesce(
         e.rule_id::text,
         'system:legacy'
       )
 where e.chain_key is null;

-- Once backfilled, lock it in: chain_key never null going forward.
do $nn$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'workflow_run_evidence'
       and column_name  = 'chain_key'
       and is_nullable  = 'YES'
  ) then
    if not exists (
      select 1 from public.workflow_run_evidence where chain_key is null
    ) then
      alter table public.workflow_run_evidence
        alter column chain_key set not null;
    end if;
  end if;
end
$nn$;

-- ---------------------------------------------------------------------------
-- 3. Re-create workflow_record_evidence to chain by chain_key, not
--    rule_id. Body otherwise identical to _120700 (which extends _120500)
--    — same signature, same org-validation guard, same grants.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_record_evidence(
  p_run_id          uuid,
  p_rule_id         uuid,
  p_organization_id uuid,
  p_artefact_kind   text,
  p_storage_path    text,
  p_storage_bucket  text default 'workflow-evidence',
  p_bytes_size      bigint default null,
  p_mime_type       text default null,
  p_sha256_checksum text default null,
  p_law_refs        text[] default '{}',
  p_frameworks      text[] default '{}',
  p_metadata        jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_org   uuid;
  v_rule_org  uuid;
  v_module    text;
  v_event     text;
  v_chain_key text;
  v_prev      text;
  v_root      text;
  v_id        uuid;
begin
  -- Org-consistency guard (verbatim from _120700).
  if p_run_id is not null then
    select organization_id, source_module, event
      into v_run_org, v_module, v_event
      from public.workflow_runs
     where id = p_run_id;
    if v_run_org is null then
      raise exception 'workflow_record_evidence: unknown run_id %', p_run_id
        using errcode = '42704';
    end if;
    if v_run_org <> p_organization_id then
      raise exception 'workflow_record_evidence: org mismatch run_org=% p_org=%',
        v_run_org, p_organization_id using errcode = '42501';
    end if;
  end if;

  if p_rule_id is not null then
    select organization_id into v_rule_org
      from public.workflow_rules
     where id = p_rule_id;
    if v_rule_org is not null and v_rule_org <> p_organization_id then
      raise exception 'workflow_record_evidence: rule_org=% p_org=%',
        v_rule_org, p_organization_id using errcode = '42501';
    end if;
  end if;

  -- Chain partition: rule_id::text when present, else 'system:<module>:<event>'.
  if p_rule_id is not null then
    v_chain_key := p_rule_id::text;
  else
    v_chain_key := 'system:' || coalesce(v_module, 'workflow') || ':' || coalesce(v_event, 'unknown');
  end if;

  if p_sha256_checksum is null then
    raise exception 'workflow_record_evidence: sha256_checksum is required';
  end if;

  -- Chain head: previous row in this PARTITION + org. Strictly per
  -- (organization_id, chain_key) so a tamper in one rule's history
  -- cannot mask another rule's chain.
  select chain_root_checksum
    into v_prev
    from public.workflow_run_evidence
   where organization_id = p_organization_id
     and chain_key = v_chain_key
   order by created_at desc
   limit 1;

  v_root := encode(public.digest(coalesce(v_prev, '') || p_sha256_checksum, 'sha256'), 'hex');

  insert into public.workflow_run_evidence (
    run_id, rule_id, organization_id,
    artefact_kind, storage_path, storage_bucket, bytes_size, mime_type,
    sha256_checksum, prev_checksum, chain_root_checksum,
    law_refs, frameworks, metadata, chain_key
  ) values (
    p_run_id, p_rule_id, p_organization_id,
    p_artefact_kind, p_storage_path, p_storage_bucket, p_bytes_size, p_mime_type,
    p_sha256_checksum, v_prev, v_root,
    coalesce(p_law_refs, '{}'),
    coalesce(p_frameworks, '{}'),
    coalesce(p_metadata, '{}'::jsonb),
    v_chain_key
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) from public;
grant execute on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) to service_role;

comment on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) is
  'Writer for workflow_run_evidence. Chains by chain_key (rule_id::text or system:<module>:<event>) so system-rule emissions partition cleanly per (org, rule, event). Validates p_organization_id matches the parent run + rule. GDPR Art. 32, AML §3-1, IK-f §5 nr. 7.';

do $$
begin
  raise notice 'workflow_run_evidence chain partitioned by chain_key; system-rule chains no longer alias across unrelated rules.';
end
$$;
