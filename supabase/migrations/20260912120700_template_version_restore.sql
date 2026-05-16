-- restore_<source>_template_version — copy a snapshot back into the
-- live row. SECURITY INVOKER on purpose: the user must have SELECT
-- on the versions table (RLS-scoped to their org) AND UPDATE on the
-- live template table (whichever permission gate that table enforces).
-- Bypassing either via SECURITY DEFINER would weaken the audit story.
--
-- The snapshot trigger on the live table will fire as a result of the
-- update, capturing the post-restore state as a new version row with
-- the caller as `changed_by`. The history modal therefore shows the
-- restore event itself («restored to version X at time T by user U»)
-- without needing a separate audit log.
--
-- Self-audit: closes the «kan dere rulle tilbake en endring som ble
-- gjort på en mal i forrige måned?» gap. Restrisiko: concurrent
-- restores aren't serialised — the last one wins. Acceptable since
-- the next snapshot trigger fire captures whichever ended up live.

-- ── Compliance ────────────────────────────────────────────────────────────

create or replace function public.restore_compliance_template_version(p_version_id uuid)
returns text
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_template_id text;
begin
  select snapshot, template_id
    into v_snapshot, v_template_id
    from public.compliance_template_versions
    where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id
      using errcode = 'P0002';
  end if;
  update public.compliance_checklist_templates set
    name = v_snapshot->>'name',
    description = v_snapshot->>'description',
    definition = coalesce(v_snapshot->'definition', '{"items":[]}'::jsonb),
    metadata_schema = coalesce(v_snapshot->'metadata_schema', '{}'::jsonb),
    is_active = coalesce((v_snapshot->>'is_active')::boolean, true)
  where id = v_template_id;
  return v_template_id;
end
$$;

grant execute on function public.restore_compliance_template_version(uuid) to authenticated;

-- ── Survey (override row only — body restoration includes catalog override) ─

create or replace function public.restore_survey_template_version(p_version_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_template_id uuid;
begin
  select snapshot, template_id
    into v_snapshot, v_template_id
    from public.survey_template_versions
    where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id
      using errcode = 'P0002';
  end if;
  update public.survey_org_templates set
    name_override = v_snapshot->>'name_override',
    description_override = v_snapshot->>'description_override',
    body_override = v_snapshot->'body_override',
    is_active = coalesce((v_snapshot->>'is_active')::boolean, true),
    nav_pinned = coalesce((v_snapshot->>'nav_pinned')::boolean, false),
    cadence_hint = v_snapshot->>'cadence_hint',
    review_status = coalesce((v_snapshot->>'review_status')::public.compliance_review_status, 'draft')
  where id = v_template_id;
  return v_template_id;
end
$$;

grant execute on function public.restore_survey_template_version(uuid) to authenticated;

-- ── Documents ─────────────────────────────────────────────────────────────

create or replace function public.restore_document_template_version(p_version_id uuid)
returns text
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_template_id text;
begin
  select snapshot, template_id
    into v_snapshot, v_template_id
    from public.document_template_versions
    where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id
      using errcode = 'P0002';
  end if;
  update public.document_org_templates set
    label = v_snapshot->>'label',
    description = coalesce(v_snapshot->>'description', ''),
    category = coalesce(v_snapshot->>'category', 'guide'),
    legal_basis = coalesce(
      array(select jsonb_array_elements_text(v_snapshot->'legal_basis')),
      '{}'::text[]
    ),
    page_payload = coalesce(v_snapshot->'page_payload', '{}'::jsonb)
  where id = v_template_id;
  return v_template_id;
end
$$;

grant execute on function public.restore_document_template_version(uuid) to authenticated;

-- ── Learning ──────────────────────────────────────────────────────────────

create or replace function public.restore_learning_template_version(p_version_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_template_id uuid;
begin
  select snapshot, template_id
    into v_snapshot, v_template_id
    from public.learning_template_versions
    where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id
      using errcode = 'P0002';
  end if;
  update public.learning_courses set
    title = v_snapshot->>'title',
    description = v_snapshot->>'description',
    status = coalesce(v_snapshot->>'status', 'draft'),
    category_id = nullif(v_snapshot->>'category_id', '')::uuid
  where id = v_template_id;
  return v_template_id;
end
$$;

grant execute on function public.restore_learning_template_version(uuid) to authenticated;

-- ── Registers (org-owned types only — system rows have no version log) ───

create or replace function public.restore_register_template_version(p_version_id uuid)
returns text
language plpgsql
as $$
declare
  v_snapshot jsonb;
  v_template_id text;
begin
  select snapshot, template_id
    into v_snapshot, v_template_id
    from public.register_template_versions
    where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id
      using errcode = 'P0002';
  end if;
  update public.register_types set
    name = v_snapshot->>'name',
    description = v_snapshot->>'description',
    metadata_schema = coalesce(v_snapshot->'metadata_schema', '{"fields":[]}'::jsonb),
    regulation_ids = coalesce(
      array(select jsonb_array_elements_text(v_snapshot->'regulation_ids')),
      '{}'::text[]
    ),
    pack_slugs = coalesce(
      array(select jsonb_array_elements_text(v_snapshot->'pack_slugs')),
      '{}'::text[]
    ),
    is_active = coalesce((v_snapshot->>'is_active')::boolean, true),
    default_review_cadence_months = nullif(v_snapshot->>'default_review_cadence_months', '')::integer
  where id = v_template_id;
  return v_template_id;
end
$$;

grant execute on function public.restore_register_template_version(uuid) to authenticated;

comment on function public.restore_compliance_template_version(uuid) is
  'Copy a versions snapshot back into the live compliance template row. RLS-enforced.';
comment on function public.restore_survey_template_version(uuid) is
  'Copy a versions snapshot back into the live survey override row. RLS-enforced.';
comment on function public.restore_document_template_version(uuid) is
  'Copy a versions snapshot back into the live document template row. RLS-enforced.';
comment on function public.restore_learning_template_version(uuid) is
  'Copy a versions snapshot back into the live learning course row. RLS-enforced.';
comment on function public.restore_register_template_version(uuid) is
  'Copy a versions snapshot back into the live register type row. RLS-enforced.';
