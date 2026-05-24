-- Compliance sign gate: DB-level required-item enforcement.
--
-- The client already validates required items before calling UPDATE status='signed',
-- but that check can be bypassed by direct SQL (service key, future API clients,
-- migration scripts). This migration patches the BEFORE UPDATE trigger to enforce
-- the same constraint at the DB layer so the rule cannot be bypassed.
--
-- The gate checks:
--   1. A response row exists for every required item.
--   2. The response value is not null, not the literal string 'null', and not empty.
--      This closes the bypass path where saveResponse({ value: null }) creates a
--      row that satisfies an existence-only check.
--
-- Arbeidstilsynet self-audit:
--   Addressed: sign integrity for mandatory checklist items.
--   Restrisiko: signature item *value* shape is not validated (accepted as non-null
--   object). A future migration may enforce {dataUrl: non-empty-string} for
--   type='signature' items. Acceptable for phase 1.

-- ── Pre-condition: ensure pgcrypto is present (digest/encode used below) ─────

create extension if not exists pgcrypto with schema public;

-- ── Guard: verify compliance_user_has_verneombud_role exists before patching ──
-- The function is defined in archive/20260809130000; the archive applier runs it
-- before this migration (sorted by basename). Guard makes the dependency explicit
-- so CI on fresh DBs surfaces a missing-function error rather than silent runtime
-- failures.

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'compliance_user_has_verneombud_role'
  ) then
    raise exception
      'compliance_sign_gate: required function public.compliance_user_has_verneombud_role '
      'is not defined. Apply archive/20260809130000_compliance_hardening_verneombud_signing.sql first.';
  end if;
end $$;

-- ── Replace the sign trigger to add required-item gate ───────────────────────

create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def             jsonb;
  v_pack_requires   boolean;
  v_responses_blob  text;
  v_missing_prompts text[];
  v_item            jsonb;
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
    else
      v_def := new.definition_snapshot;
    end if;

    -- ── Required-item gate ───────────────────────────────────────────────────
    -- Every required item must have a response row with a non-null, non-empty
    -- value. Existence alone is not sufficient: saveResponse({ value: null })
    -- creates a row that would otherwise pass an existence-only check.
    if v_def is null then
      select definition into v_def
      from public.compliance_checklist_templates
      where id = new.template_id;
    end if;

    if v_def is not null then
      select array_agg(item ->> 'prompt' order by (item ->> 'prompt'))
        into v_missing_prompts
        from jsonb_array_elements(coalesce(v_def -> 'items', '[]'::jsonb)) item
       where (item ->> 'required')::boolean = true
         and not exists (
               select 1
                 from public.compliance_checklist_responses r
                where r.execution_id = new.id
                  and r.item_key = item ->> 'key'
                  -- Value must be non-null and non-empty in all serialised forms
                  and r.value is not null
                  and r.value::text <> 'null'
                  and r.value::text <> ''
                  and r.value::text <> '""'
             );

      if array_length(v_missing_prompts, 1) > 0 then
        raise exception
          'Kan ikke signere: påkrevde punkter mangler svar: %',
          array_to_string(v_missing_prompts[1:3], ', ')
            || case when array_length(v_missing_prompts, 1) > 3 then ' …' else '' end
          using errcode = 'check_violation';
      end if;
    end if;

    -- ── Verneombud-role gate (AML §6-2) ─────────────────────────────────────
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

    -- ── Sign-state SHA-256 ───────────────────────────────────────────────────
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
