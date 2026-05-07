-- Add attendees + relax sign trigger for amendable metadata.
--
-- Two related changes:
--
-- 1) New `attendees text[]` column on compliance_checklist_executions.
--    Free-form list of names recorded as the people who participated in
--    the checklist (e.g. AMU members at the round, the verneombud, etc.).
--    Defaults to '{}' so existing rows pick up an empty array.
--
-- 2) Relax the BEFORE UPDATE trigger so signed rows can still amend a
--    narrow set of "non-canonical" metadata columns: title, summary,
--    attendees, assigned_to, scheduled_for, archived_at, archived_by.
--    The sign_checksum digests definition_snapshot + responses + signed_at
--    + signed_by — none of the amendable columns feed into it, so
--    amendments do not invalidate the integrity check.
--
--    Anything else (pack, template_id, definition_snapshot, signed_at,
--    signed_by, sign_checksum, status outside the archive flow) remains
--    locked. Status can move from 'signed' → 'signed' (no-op) but cannot
--    flip back to draft/active.

set local search_path = public, pg_catalog;

alter table public.compliance_checklist_executions
  add column if not exists attendees text[] not null default '{}'::text[];

-- ── Replace the BEFORE UPDATE trigger ───────────────────────────────────

create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def jsonb;
  v_pack_requires boolean;
  v_responses_blob text;
begin
  -- Immutable structural fields, regardless of status.
  if new.pack <> old.pack then
    raise exception 'pack is immutable on compliance_checklist_executions';
  end if;
  if new.template_id <> old.template_id then
    raise exception 'template_id is immutable on compliance_checklist_executions';
  end if;

  -- Post-sign lock: when the row is already signed, only specific
  -- "amendment" columns may change. Any change to canonical signed
  -- state (definition_snapshot, signed_at, signed_by, sign_checksum,
  -- status going back from signed) is rejected.
  if old.status = 'signed' then
    if new.status is distinct from old.status
       and not (new.status = 'signed') then
      raise exception 'Execution % is signed; status cannot revert', old.id
        using errcode = 'check_violation';
    end if;
    if new.definition_snapshot is distinct from old.definition_snapshot then
      raise exception 'Execution % is signed; definition_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.signed_at is distinct from old.signed_at then
      raise exception 'Execution % is signed; signed_at is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.signed_by is distinct from old.signed_by then
      raise exception 'Execution % is signed; signed_by is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.sign_checksum is distinct from old.sign_checksum then
      raise exception 'Execution % is signed; sign_checksum is locked', old.id
        using errcode = 'check_violation';
    end if;
    -- title, summary, attendees, assigned_to, scheduled_for, archived_at,
    -- archived_by, updated_at, deleted_at may all flow through.
    return new;
  end if;

  -- Sign transition: snapshot definition + stamp signer + compute checksum.
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

    -- Sign-state SHA-256 over definition_snapshot + responses + signer.
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
