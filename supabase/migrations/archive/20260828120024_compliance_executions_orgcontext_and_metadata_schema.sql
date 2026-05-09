-- Compliance executions — org context (location / department / team /
-- participants) + extensible per-template metadata schema.
--
-- Why this shape:
--   - Universal-and-queryable concepts (location, department, team,
--     participants) get typed FK columns so analytics can filter by
--     them without JSON path arithmetic.
--   - Template-specific extras (e.g. "weather", "shift", "asset id")
--     land in the new `metadata jsonb` column. Templates declare what
--     fields they expose via compliance_checklist_templates.metadata_schema;
--     the execution editor reads it and renders accordingly.
--   - Existing `attendees text[]` is kept for free-form / one-off
--     attendees that aren't tracked organization_members.
--
-- The BEFORE UPDATE trigger that locks signed rows is updated to allow
-- this whole metadata cluster to flow through post-sign — none of these
-- fields feeds the sign_checksum digest, so amendments don't invalidate
-- the integrity check.

set local search_path = public, pg_catalog;

-- ── 1. Org-context FKs + metadata jsonb on executions ────────────────────

alter table public.compliance_checklist_executions
  add column if not exists location_id uuid
    references public.locations (id) on delete set null,
  add column if not exists department_id uuid
    references public.departments (id) on delete set null,
  add column if not exists team_id uuid
    references public.teams (id) on delete set null,
  add column if not exists participant_member_ids uuid[] not null
    default '{}'::uuid[],
  add column if not exists metadata jsonb not null
    default '{}'::jsonb;

create index if not exists compliance_checklist_executions_location_idx
  on public.compliance_checklist_executions (location_id)
  where location_id is not null and deleted_at is null;

create index if not exists compliance_checklist_executions_department_idx
  on public.compliance_checklist_executions (department_id)
  where department_id is not null and deleted_at is null;

create index if not exists compliance_checklist_executions_team_idx
  on public.compliance_checklist_executions (team_id)
  where team_id is not null and deleted_at is null;

create index if not exists compliance_checklist_executions_participants_idx
  on public.compliance_checklist_executions
  using gin (participant_member_ids);

-- ── 2. metadata_schema on templates ──────────────────────────────────────

alter table public.compliance_checklist_templates
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

comment on column public.compliance_checklist_templates.metadata_schema is
  $c$Field declarations driving the execution metadata editor.
  Shape: { "fields": [ { "key": "location", "kind": "location", "required": true, "label"?: "..." }, ... ] }.
  Built-in kinds (bind to typed FK columns):
    - "location"     -> location_id
    - "department"   -> department_id
    - "team"         -> team_id
    - "participants" -> participant_member_ids
  Free-form kinds (land in metadata jsonb under their key):
    - "text", "number", "select" (with `options: [{id, label}]`)
  Required is enforced client-side; the DB doesn't gate.$c$;

-- ── 3. Allow the metadata cluster to mutate after sign ────────────────────
-- Mirrors the relaxation we did for attendees / title / summary in
-- 20260828120021. Sign-checksum-protected fields stay locked.

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

  -- Post-sign lock: only canonical sign-state fields are protected;
  -- title/summary/attendees + the new org-context cluster + metadata
  -- jsonb may all flow through.
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
