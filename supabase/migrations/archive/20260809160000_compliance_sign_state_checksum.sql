-- Compliance sign-state checksum (gap E from the audit-trail review).
--
-- A signed execution's evidence is the tuple (definition_snapshot,
-- responses, signed_at, signed_by). The existing immutability triggers
-- prevent app-channel edits to any of these; the audit log records
-- pre-sign changes. But a privileged actor with both DB and audit-log
-- write access could in principle alter the state in lockstep — a
-- separate hash makes such tampering visible because re-computing the
-- digest from current rows would no longer match the stored value.
--
-- This migration:
--   1. Ensures pgcrypto is available (Supabase default).
--   2. Adds compliance_checklist_executions.sign_checksum text column.
--   3. Updates the sign trigger to compute a deterministic SHA-256 of
--      the canonical signed state and store it on the row at sign time.
--   4. Adds a verification helper that re-derives the digest from
--      current rows and returns true iff it matches the stored value.

create extension if not exists pgcrypto with schema public;

alter table public.compliance_checklist_executions
  add column if not exists sign_checksum text;

create index if not exists compliance_checklist_executions_sign_checksum_idx
  on public.compliance_checklist_executions (sign_checksum)
  where sign_checksum is not null;

-- ── Update sign trigger to populate sign_checksum ──────────────────────

create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def jsonb;
  v_pack_requires boolean;
  v_responses_blob text;
begin
  -- Once signed, the row is permanently locked.
  if old.status = 'signed' then
    raise exception 'Execution % is signed; updates not permitted', old.id
      using errcode = 'check_violation';
  end if;

  if new.pack <> old.pack then
    raise exception 'pack is immutable on compliance_checklist_executions';
  end if;
  if new.template_id <> old.template_id then
    raise exception 'template_id is immutable on compliance_checklist_executions';
  end if;

  if new.status = 'signed' and old.status <> 'signed' then
    if new.signed_at is null then
      new.signed_at := now();
    end if;
    if new.signed_by is null then
      new.signed_by := auth.uid();
    end if;
    if new.definition_snapshot is null then
      select definition into v_def
      from public.compliance_checklist_templates
      where id = new.template_id;
      new.definition_snapshot := v_def;
    end if;

    -- Verneombud-role gate (gap C, AML §6-2)
    select coalesce(p.requires_verneombud_signing, false)
    into v_pack_requires
    from public.compliance_packs p
    where p.organization_id = new.organization_id
      and p.slug = new.pack;

    if v_pack_requires
       and not public.compliance_user_has_verneombud_role(
                  new.signed_by, new.organization_id
                )
    then
      raise exception
        'Pakke "%" krever at signering utføres av en bruker med verneombud-rolle (AML §6-2). Tildel rollen via RBAC-administrasjon før signering.',
        new.pack
        using errcode = 'check_violation';
    end if;

    -- Sign-state SHA-256: deterministic digest of definition_snapshot,
    -- the response set (ordered by item_key), and the signer metadata.
    -- Stored on the row; can be re-derived later via
    -- compliance_checklist_verify_sign_checksum().
    select coalesce(
      string_agg(
        r.item_key
          || '=' || r.value::text
          || coalesce(',sev=' || r.severity::text, '')
          || coalesce(',c=' || r.comment, ''),
        '||' order by r.item_key
      ),
      ''
    )
    into v_responses_blob
    from public.compliance_checklist_responses r
    where r.execution_id = new.id;

    new.sign_checksum := encode(
      digest(
        'def=' || coalesce(new.definition_snapshot::text, '')
          || '|responses=' || v_responses_blob
          || '|signed_at=' || coalesce(new.signed_at::text, '')
          || '|signed_by=' || coalesce(new.signed_by::text, ''),
        'sha256'
      ),
      'hex'
    );
  end if;

  return new;
end;
$$;

-- ── Verification helper for tamper-evident integrity checks ─────────────

create or replace function public.compliance_checklist_verify_sign_checksum(
  p_execution_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exec record;
  v_responses_blob text;
  v_recomputed text;
begin
  select id, definition_snapshot, signed_at, signed_by, sign_checksum, status
  into v_exec
  from public.compliance_checklist_executions
  where id = p_execution_id;

  -- Unsigned executions have no checksum to verify; treat as "not
  -- applicable" → return null.
  if v_exec.id is null or v_exec.status <> 'signed' or v_exec.sign_checksum is null then
    return null;
  end if;

  select coalesce(
    string_agg(
      r.item_key
        || '=' || r.value::text
        || coalesce(',sev=' || r.severity::text, '')
        || coalesce(',c=' || r.comment, ''),
      '||' order by r.item_key
    ),
    ''
  )
  into v_responses_blob
  from public.compliance_checklist_responses r
  where r.execution_id = p_execution_id;

  v_recomputed := encode(
    digest(
      'def=' || coalesce(v_exec.definition_snapshot::text, '')
        || '|responses=' || v_responses_blob
        || '|signed_at=' || coalesce(v_exec.signed_at::text, '')
        || '|signed_by=' || coalesce(v_exec.signed_by::text, ''),
      'sha256'
    ),
    'hex'
  );

  return v_recomputed = v_exec.sign_checksum;
end;
$$;

revoke all on function public.compliance_checklist_verify_sign_checksum(uuid)
  from public, anon;
grant execute on function public.compliance_checklist_verify_sign_checksum(uuid)
  to authenticated, service_role;
