-- Phase 12: Generic compliance walkthrough helpers.
--
-- The AML-specific provisioning + yearly-reminder functions encode the
-- slug 'aml-fullgjennomgang' three levels deep. As soon as a second
-- walkthrough template ships (ISO 45001, GDPR, åpenhetsloven, …) we
-- would have copy-pasted the same logic per pack. This migration
-- introduces two pack-agnostic helpers that take a `p_slug` parameter
-- and the existing AML-specific functions become thin wrappers, so
-- nothing that calls them today breaks while new templates plug in
-- via parameter only.
--
-- Self-audit:
--   * Idempotent: CREATE OR REPLACE on both new helpers + wrappers.
--   * The AML pg_cron schedule is unchanged (still calls the wrapper),
--     so existing infra continues to work.
--   * Future walkthrough templates just register their own pg_cron
--     job that calls `_compliance_walkthrough_check_due_orgs('iso-..',
--     'iso-45001')` — no PL/pgSQL duplication.

set local search_path = public, pg_catalog;

-- ── 1. Generic provisioning helper ───────────────────────────────────────
-- Copy-from-canonical pattern: finds an existing seeded row in any
-- other org and clones it into the target org. Works for any
-- walkthrough template seeded by the platform.
create or replace function public._provision_compliance_walkthrough(
  p_org_id   uuid,
  p_slug     text,
  p_pack_slug public.compliance_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src compliance_checklist_templates%rowtype;
begin
  select * into v_src
  from public.compliance_checklist_templates
  where slug = p_slug
    and pack = p_pack_slug
    and organization_id <> p_org_id
    and is_system = true
    and deleted_at is null
  limit 1;

  if v_src.id is null then
    raise notice 'No canonical % row to copy from; org % skipped', p_slug, p_org_id;
    return;
  end if;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    law_refs, is_active, nav_pinned, is_system, review_status,
    cadence_hint, metadata_schema
  ) values (
    p_org_id, p_pack_slug, p_slug,
    v_src.name, v_src.description, v_src.definition, v_src.law_refs,
    true, true, true,
    v_src.review_status, v_src.cadence_hint, v_src.metadata_schema
  )
  on conflict (organization_id, slug) do update set
    name             = excluded.name,
    description      = excluded.description,
    definition       = excluded.definition,
    law_refs         = excluded.law_refs,
    nav_pinned       = excluded.nav_pinned,
    is_system        = excluded.is_system,
    review_status    = excluded.review_status,
    cadence_hint     = excluded.cadence_hint,
    metadata_schema  = excluded.metadata_schema,
    updated_at       = now();
end;
$$;

comment on function public._provision_compliance_walkthrough(uuid, text, public.compliance_pack) is
  $c$Copy-from-canonical provisioner for any sectioned walkthrough
  template. Plug a new walkthrough into the per-org dispatcher by
  calling this with (org_id, slug, pack).$c$;

-- AML-specific wrapper — kept so the existing dispatcher continues to
-- compile. New walkthroughs should NOT add per-slug wrappers; they
-- should be dispatched directly with the generic helper.
create or replace function public._provision_compliance_aml_fullgjennomgang(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._provision_compliance_walkthrough(p_org_id, 'aml-fullgjennomgang', 'aml-amu');
end;
$$;

comment on function public._provision_compliance_aml_fullgjennomgang(uuid) is
  'Deprecated alias for _provision_compliance_walkthrough(p_org_id, ''aml-fullgjennomgang'', ''aml-amu''). Kept for dispatcher backward-compat.';

-- ── 2. Generic yearly-cadence reminder helper ────────────────────────────
-- Iterates orgs licensed for `p_pack_slug` and creates a reminder task
-- per org whose latest signed run of the named template is null OR
-- older than `p_max_age_months`. Idempotent per call via the same
-- source_item_key dedup pattern as the AML version.
create or replace function public._compliance_walkthrough_check_due_orgs(
  p_slug          text,
  p_pack_slug     public.compliance_pack,
  p_max_age_months int default 12
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_template_id uuid;
  v_template_name text;
  v_template_law_refs text[];
  v_task_law_refs text[];
  v_latest_signed_at timestamptz;
  v_already_open boolean;
  v_assignee uuid;
  v_assignee_name text;
  v_reminder_key text;
  v_created int := 0;
begin
  v_reminder_key := p_slug || '_periodic_reminder';

  for v_org_id in
    select organization_id
    from public.compliance_packs
    where slug = p_pack_slug and deleted_at is null and is_active = true
  loop
    select id, name, law_refs
      into v_template_id, v_template_name, v_template_law_refs
    from public.compliance_checklist_templates
    where organization_id = v_org_id
      and slug = p_slug
      and deleted_at is null and is_active = true
    limit 1;

    if v_template_id is null then continue; end if;

    -- Derive task law_refs from the template's own array (first 3 to
    -- keep the tag short but representative). Falls back to the AML
    -- IK-baseline only when the template has no law_refs at all.
    v_task_law_refs := coalesce(
      v_template_law_refs[1:3],
      array['AML § 3-1', 'IK-f § 5 nr. 7']::text[]
    );

    select max(signed_at) into v_latest_signed_at
    from public.compliance_checklist_executions
    where organization_id = v_org_id
      and template_id = v_template_id
      and status = 'signed'
      and archived_at is null and deleted_at is null;

    if v_latest_signed_at is not null
       and v_latest_signed_at > now() - make_interval(months => p_max_age_months) then
      continue;
    end if;

    select exists(
      select 1 from public.task_items
      where organization_id = v_org_id
        and source_category = 'compliance_checklist_item'
        and source_item_key = v_reminder_key
        and status not in ('done', 'closed', 'cancelled')
        and deleted_at is null
    ) into v_already_open;

    if v_already_open then continue; end if;

    v_assignee := null;
    v_assignee_name := null;
    begin
      select user_id, user_name into v_assignee, v_assignee_name
      from public.org_active_role_holders
      where organization_id = v_org_id
        and (role_slug ilike '%hms%ansvarlig%' or role_slug = 'hms_ansvarlig')
        and (valid_to is null or valid_to >= current_date)
      order by valid_from desc nulls last
      limit 1;
    exception when others then
      v_assignee := null;
      v_assignee_name := null;
    end;

    insert into public.task_items (
      organization_id, pack, title, description,
      priority, status, law_refs,
      source_category, source_type, source_id, source_item_key,
      assignee_user_id, assignee_name, due_date
    ) values (
      v_org_id, p_pack_slug,
      format('Periodisk gjennomgang forfaller — %s', v_template_name),
      case
        when v_latest_signed_at is null
        then format('Virksomheten har ingen signert «%s» ennå. Gjennomfør en ny gjennomgang for å oppfylle systematisk HMS-arbeid.', v_template_name)
        else format(
          'Siste signerte «%s» var %s — over %s måneder siden. Gjennomfør periodisk review.',
          v_template_name,
          to_char(v_latest_signed_at, 'DD. Mon YYYY'),
          p_max_age_months
        )
      end,
      'high', 'todo',
      v_task_law_refs,
      'compliance_checklist_item', 'compliance_checklist_item',
      v_template_id,
      v_reminder_key,
      v_assignee, v_assignee_name,
      (current_date + interval '30 days')::date
    );
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

comment on function public._compliance_walkthrough_check_due_orgs(text, public.compliance_pack, int) is
  $c$Generic periodic reminder for any walkthrough template. Iterates
  orgs licensed for p_pack_slug, finds the latest signed execution of
  p_slug, creates a high-priority task if older than p_max_age_months
  (or never signed). Idempotent via source_item_key dedup.$c$;

grant execute on function public._compliance_walkthrough_check_due_orgs(text, public.compliance_pack, int) to service_role;

-- AML-specific wrapper — pg_cron schedule registered in _120300 still
-- calls this name, so keep it. Internally just forwards to the generic.
create or replace function public._aml_fullgjennomgang_check_due_orgs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created int;
  v_aml_key text := 'aml-fullgjennomgang_periodic_reminder';
  v_legacy_key text := 'aml_fullgjennomgang_annual_reminder';
begin
  -- Backward-compat: dedup against BOTH the legacy and the new key so
  -- orgs that already have an open legacy reminder don't get a duplicate.
  -- We accomplish this by inspecting and short-circuiting before calling
  -- the generic helper.
  if exists (
    select 1 from public.task_items
    where source_category = 'compliance_checklist_item'
      and source_item_key = v_legacy_key
      and status not in ('done', 'closed', 'cancelled')
      and deleted_at is null
  ) then
    -- Backfill: rename legacy keys to the new key so future ticks match
    -- via the generic helper's dedup logic.
    update public.task_items
    set source_item_key = v_aml_key
    where source_category = 'compliance_checklist_item'
      and source_item_key = v_legacy_key
      and status not in ('done', 'closed', 'cancelled')
      and deleted_at is null;
  end if;

  v_created := public._compliance_walkthrough_check_due_orgs('aml-fullgjennomgang', 'aml-amu', 12);
  return v_created;
end;
$$;

comment on function public._aml_fullgjennomgang_check_due_orgs() is
  'Deprecated thin wrapper around _compliance_walkthrough_check_due_orgs. Kept so the existing pg_cron schedule continues to fire. Also migrates legacy source_item_key values from aml_fullgjennomgang_annual_reminder to aml-fullgjennomgang_periodic_reminder.';
