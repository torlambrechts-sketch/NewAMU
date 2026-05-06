-- Compliance archive workflow (gap F from the audit-trail review).
--
-- Scope C dropped 'archived' from the status enum to keep the prototype
-- lean. As customers accumulate signed executions over years, they need
-- a way to hide old ones from operational lists without compromising
-- retention. This migration introduces a soft-archive flag on signed
-- executions that:
--   - Cannot un-archive (one-way state).
--   - Cannot precede sign (only signed rows can be archived).
--   - Does not alter any signed-evidence field, so the sign_checksum
--     remains valid (archive is metadata, not evidence).
--   - Does not bypass retention — archived rows are still delete-blocked
--     by the existing BEFORE DELETE trigger via signed_at.
--
-- Why a flag instead of a new enum value: the executions.status column
-- uses public.inspection_round_status which is shared with the
-- inspection module. Adding 'archived' to that enum would affect
-- inspection_rounds too. A separate flag keeps compliance archive
-- semantics local.

alter table public.compliance_checklist_executions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

-- Only signed rows can be archived; archived_by is non-null iff
-- archived_at is non-null.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'compliance_checklist_executions_archive_integrity'
  ) then
    alter table public.compliance_checklist_executions
      add constraint compliance_checklist_executions_archive_integrity
        check (
          (archived_at is null and archived_by is null)
          or (archived_at is not null and signed_at is not null)
        );
  end if;
end $$;

create index if not exists compliance_checklist_executions_archived_idx
  on public.compliance_checklist_executions (organization_id, archived_at)
  where archived_at is not null;

-- ── Update sign trigger to permit archive transition on signed rows ────

create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def jsonb;
  v_pack_requires boolean;
  v_responses_blob text;
begin
  -- Once signed, only the archive transition is permitted; all other
  -- fields must remain identical.
  if old.status = 'signed' then
    -- Allowed change: archived_at goes from NULL → non-NULL, every
    -- evidence field unchanged. Setting archived_by is allowed in the
    -- same UPDATE; if absent we stamp it from auth.uid().
    if old.archived_at is null
       and new.archived_at is not null
       and new.status              = old.status
       and new.pack                = old.pack
       and new.template_id         = old.template_id
       and new.title               = old.title
       and new.signed_at           = old.signed_at
       and new.signed_by           is not distinct from old.signed_by
       and new.definition_snapshot is not distinct from old.definition_snapshot
       and new.sign_checksum       is not distinct from old.sign_checksum
       and new.summary             is not distinct from old.summary
    then
      if new.archived_by is null then
        new.archived_by := auth.uid();
      end if;
      return new;
    end if;

    -- Already-archived rows cannot be un-archived or otherwise modified.
    if old.archived_at is not null then
      raise exception 'Execution % is archived; further updates not permitted', old.id
        using errcode = 'check_violation';
    end if;

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
