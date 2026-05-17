-- workflow_record_evidence: enforce that the supplied organization_id matches
-- the parent run (and, where present, the parent rule). Closes a GDPR Art. 32
-- integrity gap where a compromised edge function or buggy caller could have
-- written evidence to the wrong tenant. Also covers AML §3-1 documentation-
-- trail integrity and IK-f §5 nr. 7 (sporbar dokumentasjon).

-- ---------------------------------------------------------------------------
-- Replace workflow_record_evidence with the same signature defined in
-- _20260905120500_workflow_run_evidence.sql:139-194. The body adds an org-
-- consistency check at the top, before the existing chain/insert logic.
-- Signature, RLS, immutability triggers, and grants remain unchanged.
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
  v_run_org  uuid;
  v_rule_org uuid;
  v_prev     text;
  v_root     text;
  v_id       uuid;
begin
  -- ---------------------------------------------------------------------
  -- Org-consistency guard. Runs first so that we never compute a Merkle
  -- leaf or otherwise leak chain state for a cross-tenant write attempt.
  -- ---------------------------------------------------------------------
  if p_run_id is not null then
    select organization_id into v_run_org
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
    -- system-rule path (workflow_system_rules) has rule_org IS NULL — fine;
    -- only mismatching tenant-rules are rejected.
    if v_rule_org is not null and v_rule_org <> p_organization_id then
      raise exception 'workflow_record_evidence: rule_org=% p_org=%',
        v_rule_org, p_organization_id using errcode = '42501';
    end if;
  end if;

  -- ---------------------------------------------------------------------
  -- Existing chain + insert logic (unchanged from _120500).
  -- ---------------------------------------------------------------------
  select chain_root_checksum
    into v_prev
    from public.workflow_run_evidence
   where rule_id = p_rule_id
   order by created_at desc
   limit 1;

  if p_sha256_checksum is null then
    raise exception 'workflow_record_evidence: sha256_checksum is required';
  end if;

  v_root := encode(public.digest(coalesce(v_prev, '') || p_sha256_checksum, 'sha256'), 'hex');

  insert into public.workflow_run_evidence (
    run_id, rule_id, organization_id,
    artefact_kind, storage_path, storage_bucket, bytes_size, mime_type,
    sha256_checksum, prev_checksum, chain_root_checksum,
    law_refs, frameworks, metadata
  ) values (
    p_run_id, p_rule_id, p_organization_id,
    p_artefact_kind, p_storage_path, p_storage_bucket, p_bytes_size, p_mime_type,
    p_sha256_checksum, v_prev, v_root,
    coalesce(p_law_refs, '{}'),
    coalesce(p_frameworks, '{}'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Grants are unchanged; re-issue defensively so the function comes out of
-- this migration with exactly the same exposure as the original.
revoke all on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) from public;
grant execute on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) to service_role;

comment on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) is
  'Writer for workflow_run_evidence. Validates that p_organization_id matches the parent run (and, when set, the parent rule) before computing the Merkle leaf — GDPR Art. 32 integrity, AML §3-1, IK-f §5 nr. 7.';

do $$
begin
  raise notice 'workflow_record_evidence org validation enabled';
end
$$;
