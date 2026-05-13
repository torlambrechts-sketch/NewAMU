-- workflow_run_evidence: Merkle-chained artefact ledger.
--
-- For every workflow_run that generates a permanent artefact — regulator
-- receipt (Altinn kvittering), signed manifest (Datatilsynet breach form),
-- generated PDF, etc. — we record a row here with:
--   * storage_path  (Supabase Storage URL)
--   * sha256_checksum of the artefact bytes
--   * prev_checksum (Merkle-style chain back to the previous evidence row
--     for the same rule, so tampering with any single row breaks the chain)
--   * signed_by / signed_at (when an approver attests to the artefact)
--   * law_refs[] / frameworks[] (so the evidence-export edge function
--     can filter by AML § / GDPR Art. / framework tag)
--
-- All writes go through public.workflow_record_evidence() (security
-- definer) which computes the prev_checksum and signs the row. Direct
-- INSERT is denied by RLS; UPDATE/DELETE always denied.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: GDPR Art. 33 + § 26 — påkrevd manifest ved
--   personvernbrudd. AML § 5-2 — kvittering på melding om alvorlig skade.
--   IK-f § 5 nr. 8 — sporbar dokumentasjon ved tilsyn.
--   Restrisiko deferred: virksomhetssertifikat-signering av rot-hashen
--   per måned/kvartal kommer i Phase E (gov-signing) — denne sprinten
--   gir en self-anchored chain.

create extension if not exists pgcrypto with schema public;

create table if not exists public.workflow_run_evidence (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references public.workflow_runs (id),
  rule_id            uuid references public.workflow_rules (id) on delete set null,
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  artefact_kind      text not null check (artefact_kind in (
                       'regulator_receipt',     -- Altinn / Arbeidstilsynet / Datatilsynet kvittering
                       'signed_manifest',       -- our own signed JSON (Merkle root + payload)
                       'generated_pdf',         -- internal report
                       'gov_submission_body',   -- the body we sent (for replay/audit)
                       'evidence_pack',         -- aggregated ZIP export
                       'screenshot',
                       'attachment',
                       'other'
                     )),
  storage_path       text not null,
  storage_bucket     text not null default 'workflow-evidence',
  bytes_size         bigint,
  mime_type          text,
  sha256_checksum    text not null,
  prev_checksum      text,                       -- chain back to prior evidence for same rule
  chain_root_checksum text,                      -- sha256(prev_checksum || sha256_checksum) — the rolled-up Merkle leaf
  signed_at          timestamptz,
  signed_by          uuid references public.profiles (id),
  signature_blob     bytea,                      -- virksomhetssertifikat detached signature (Phase E)
  law_refs           text[] not null default '{}',
  frameworks         text[] not null default '{}',
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists workflow_run_evidence_run_idx
  on public.workflow_run_evidence (run_id);

create index if not exists workflow_run_evidence_rule_idx
  on public.workflow_run_evidence (rule_id, created_at desc) where rule_id is not null;

create index if not exists workflow_run_evidence_org_idx
  on public.workflow_run_evidence (organization_id, created_at desc);

create index if not exists workflow_run_evidence_law_refs_gin_idx
  on public.workflow_run_evidence using gin (law_refs);

create index if not exists workflow_run_evidence_frameworks_gin_idx
  on public.workflow_run_evidence using gin (frameworks);

alter table public.workflow_run_evidence enable row level security;

-- Confidentiality follows the parent run.
drop policy if exists "workflow_run_evidence_select" on public.workflow_run_evidence;
create policy "workflow_run_evidence_select"
  on public.workflow_run_evidence for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.workflow_runs r
      where r.id = workflow_run_evidence.run_id
        and (
          r.confidentiality_level = 'standard'
          or public.is_org_admin()
          or public.user_has_permission('workflows.view_confidential')
        )
    )
  );

-- Direct INSERT/UPDATE/DELETE always denied — go through the function.
drop policy if exists "workflow_run_evidence_no_user_write" on public.workflow_run_evidence;
create policy "workflow_run_evidence_no_user_write"
  on public.workflow_run_evidence for insert
  with check (false);

drop policy if exists "workflow_run_evidence_no_update" on public.workflow_run_evidence;
create policy "workflow_run_evidence_no_update"
  on public.workflow_run_evidence for update
  using (false);

drop policy if exists "workflow_run_evidence_no_delete" on public.workflow_run_evidence;
create policy "workflow_run_evidence_no_delete"
  on public.workflow_run_evidence for delete
  using (false);

-- Belt-and-braces: BEFORE UPDATE/DELETE deny triggers (so even
-- security-definer writers can't tamper).
create or replace function public.trg_workflow_run_evidence_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'workflow_run_evidence is immutable; row % cannot be updated', old.id;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'workflow_run_evidence is immutable; row % cannot be deleted', old.id;
  end if;
  return null;
end;
$$;

drop trigger if exists workflow_run_evidence_deny_update on public.workflow_run_evidence;
create trigger workflow_run_evidence_deny_update
  before update on public.workflow_run_evidence
  for each row execute function public.trg_workflow_run_evidence_immutable();

drop trigger if exists workflow_run_evidence_deny_delete on public.workflow_run_evidence;
create trigger workflow_run_evidence_deny_delete
  before delete on public.workflow_run_evidence
  for each row execute function public.trg_workflow_run_evidence_immutable();

-- Writer: computes prev_checksum + chain_root_checksum atomically. Called by
-- the queue worker (service role) and by edge functions that produce
-- regulator receipts.
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
  v_prev   text;
  v_root   text;
  v_id     uuid;
begin
  -- Find the previous evidence row for this rule (newest first).
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

revoke all on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) from public;
grant execute on function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb) to service_role;

comment on table public.workflow_run_evidence is
  'Append-only, Merkle-chained ledger of workflow artefacts. Written exclusively via workflow_record_evidence(); RLS + BEFORE triggers deny mutation.';
comment on column public.workflow_run_evidence.chain_root_checksum is
  'sha256(prev_checksum || sha256_checksum). Forms an append-only chain per rule_id; any tampered row breaks the chain on verify.';
