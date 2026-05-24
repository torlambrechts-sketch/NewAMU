-- Compliance sign gate: DB-level required-item enforcement.
--
-- The client already validates required items before calling UPDATE status='signed',
-- but that check can be bypassed by direct SQL (service key, future API clients,
-- migration scripts). This migration patches the BEFORE UPDATE trigger to enforce
-- the same constraint at the DB layer so the rule cannot be bypassed.
--
-- Arbeidstilsynet self-audit:
--   Addressed: sign integrity for mandatory checklist items.
--   The trigger raises check_violation so the client sees a clear error.
--   Restrisiko: items with type='signature' are validated like any other item
--   (response row must exist); whether the signature *value* is valid is
--   still client-side only (acceptable tradeoff for phase 1).

-- ── Replace the sign trigger to add required-item gate ───────────────────

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

    -- ── Required-item gate ───────────────────────────────────────────────
    -- Every item with required=true must have at least one response row.
    -- Compares the template's item keys against existing responses.
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
             );

      if array_length(v_missing_prompts, 1) > 0 then
        raise exception
          'Kan ikke signere: påkrevde punkter mangler svar: %',
          array_to_string(v_missing_prompts[1:3], ', ')
            || case when array_length(v_missing_prompts, 1) > 3 then ' …' else '' end
          using errcode = 'check_violation';
      end if;
    end if;

    -- ── Verneombud-role gate (AML §6-2) ─────────────────────────────────
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

    -- ── Sign-state SHA-256 ───────────────────────────────────────────────
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
