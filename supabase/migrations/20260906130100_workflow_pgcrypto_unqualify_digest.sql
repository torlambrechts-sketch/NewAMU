-- The previous migration (20260906130000) set search_path = public, extensions,
-- pg_catalog on the four workflow functions, but the bodies still call
-- public.digest(...) / public.gen_random_bytes(...) with an explicit schema
-- qualifier. Explicit schema qualification bypasses search_path entirely, so
-- the functions still fail with "function public.digest(text, unknown) does not
-- exist" because pgcrypto lives in the extensions schema on Supabase, not public.
--
-- Fix: restate each body replacing public.digest / public.gen_random_bytes with
-- the unqualified names so search_path (which now includes extensions) resolves
-- them correctly. search_path is retained on all four functions.

create or replace function public.trg_workflow_runs_seal()
returns trigger
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_canon text;
begin
  v_canon := coalesce(new.organization_id::text, '') || '|'
          || coalesce(new.rule_id::text, '')        || '|'
          || coalesce(new.source_module, '')        || '|'
          || coalesce(new.event, '')                || '|'
          || coalesce(new.created_at::text, now()::text) || '|'
          || coalesce(new.input_snapshot::text, '{}');
  new.input_checksum := encode(digest(v_canon, 'sha256'::text), 'hex');
  return new;
end;
$$;

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
set search_path = public, extensions, pg_catalog
as $$
declare
  v_prev   text;
  v_root   text;
  v_id     uuid;
begin
  select chain_root_checksum
    into v_prev
    from public.workflow_run_evidence
   where rule_id = p_rule_id
   order by created_at desc
   limit 1;

  if p_sha256_checksum is null then
    raise exception 'workflow_record_evidence: sha256_checksum is required';
  end if;

  v_root := encode(digest(coalesce(v_prev, '') || p_sha256_checksum, 'sha256'::text), 'hex');

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

create or replace function public.workflow_mint_auditor_token(
  p_organization_id uuid,
  p_label           text,
  p_scope_filter    jsonb default '{}'::jsonb,
  p_expires_in_days int   default 30
)
returns table (
  id    uuid,
  token text
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_token  text;
  v_hash   text;
  v_id     uuid;
begin
  if not (public.is_org_admin() or public.user_has_permission('workflows.manage')) then
    raise exception 'workflow_mint_auditor_token: org_admin or workflows.manage required';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id then
    raise exception 'cross-org token mint denied';
  end if;

  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := translate(v_token, '+/=', '-_');
  v_hash  := encode(digest(v_token, 'sha256'::text), 'hex');

  insert into public.workflow_auditor_tokens
    (organization_id, token_hash, label, scope_filter, expires_at, created_by)
  values
    (p_organization_id, v_hash, p_label, coalesce(p_scope_filter, '{}'::jsonb),
     now() + make_interval(days => p_expires_in_days), auth.uid())
  returning workflow_auditor_tokens.id into v_id;

  id := v_id;
  token := v_token;
  return next;
end;
$$;

grant execute on function public.workflow_mint_auditor_token(uuid, text, jsonb, int) to authenticated;

create or replace function public.workflow_verify_auditor_token(p_token text)
returns table (
  id              uuid,
  organization_id uuid,
  label           text,
  scope_filter    jsonb,
  expires_at      timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_hash text;
begin
  if current_user not in ('service_role','supabase_admin','postgres') then
    raise exception 'workflow_verify_auditor_token: caller must be service_role';
  end if;
  v_hash := encode(digest(p_token, 'sha256'::text), 'hex');

  update public.workflow_auditor_tokens
     set last_used_at = now(),
         use_count = use_count + 1
   where token_hash = v_hash
     and revoked_at is null
     and expires_at > now()
   returning
     workflow_auditor_tokens.id,
     workflow_auditor_tokens.organization_id,
     workflow_auditor_tokens.label,
     workflow_auditor_tokens.scope_filter,
     workflow_auditor_tokens.expires_at
   into id, organization_id, label, scope_filter, expires_at;

  if id is null then
    return;
  end if;
  return next;
end;
$$;

revoke all on function public.workflow_verify_auditor_token(text) from public;
grant execute on function public.workflow_verify_auditor_token(text) to service_role;
