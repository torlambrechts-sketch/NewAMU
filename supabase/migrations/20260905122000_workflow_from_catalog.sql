-- Single-template installer.
--
-- provision_workflows_baseline_for_org (_121000) installs every template
-- in workflow_rule_catalog (optionally filtered by pack). That's right
-- for first-time provisioning but wrong for "Bruk denne malen" from the
-- LibraryPanel — there the user wants to install ONE template into their
-- org as an inactive workflow_rules row.
--
-- This RPC takes a single slug, copies the catalog row, and either
-- inserts a new workflow_rules (if no row with that slug exists in the
-- org) or returns the existing rule's id (so the UI can deep-link to
-- the canvas to edit it).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — én-klikks-installasjon
--   senker terskelen for å iverksette tiltak. Tidligere måtte admin
--   installere hele pakker.
--   Restrisiko deferred: bulk-import fra fil (planlagt fase 2).

create or replace function public.provision_workflow_from_catalog(
  p_org_id uuid,
  p_slug   text
)
returns table (
  rule_id  uuid,
  action   text  -- 'inserted' | 'exists'
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.workflow_rule_catalog%rowtype;
  v_existing_id uuid;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_org_id then
    raise exception 'Not allowed (cross-org)';
  end if;
  if not public.workflow_can_compose() then
    raise exception 'workflows.compose permission required';
  end if;

  select * into c
    from public.workflow_rule_catalog
   where slug = p_slug and is_published = true;
  if not found then
    raise exception 'Template % not found or unpublished', p_slug;
  end if;

  select id into v_existing_id
    from public.workflow_rules
   where organization_id = p_org_id and slug = p_slug
   limit 1;

  if v_existing_id is not null then
    rule_id := v_existing_id;
    action  := 'exists';
    return next;
    return;
  end if;

  insert into public.workflow_rules (
    organization_id, slug, name, description,
    source_module, trigger_on, trigger_type, trigger_event_name, schedule_cron,
    is_active, condition_json, actions_json,
    law_refs, frameworks, confidentiality_level,
    name_i18n, description_i18n,
    idempotency_template, catalog_slug, catalog_version,
    is_template, priority
  ) values (
    p_org_id, c.slug,
    coalesce(c.name_i18n->>'nb', c.slug),
    coalesce(c.description_i18n->>'nb', ''),
    c.source_module, c.trigger_on, c.trigger_type, c.trigger_event_name, c.schedule_cron,
    false,                          -- always inactive on install; user activates explicitly
    c.condition_json, c.actions_json,
    c.law_refs, c.frameworks, c.confidentiality_level,
    c.name_i18n, c.description_i18n,
    c.idempotency_template, c.slug, c.catalog_version,
    false, 0
  )
  returning id into v_new_id;

  rule_id := v_new_id;
  action  := 'inserted';
  return next;
end;
$$;

revoke all on function public.provision_workflow_from_catalog(uuid, text) from public;
grant execute on function public.provision_workflow_from_catalog(uuid, text) to authenticated;

comment on function public.provision_workflow_from_catalog(uuid, text) is
  'Single-template installer. Copies one workflow_rule_catalog row into workflow_rules for the calling org, returns the rule_id. If a rule with that slug already exists, returns its id with action=exists. Always installs is_active=false — activation is a separate step requiring workflows.activate (or _external for gov rules).';
