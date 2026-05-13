-- provision_workflows_baseline_for_org(org_id, pack?): install workflow
-- templates from workflow_rule_catalog as inactive workflow_rules.
--
-- Mirrors the pattern from provision_compliance_baseline_for_org +
-- provision_survey_baseline_for_org. Per-tenant rows live in
-- workflow_rules (with catalog_slug + catalog_version pointing back) so
-- bug fixes to a baseline ship via:
--   1) updating workflow_rule_catalog (catalog_version bumped)
--   2) UI surface "an update is available" — admin opts in
--
-- The function never overwrites is_active or org-customised actions —
-- it only fills in fields that are missing or carry the original
-- catalog values (detected via catalog_version match).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — systematisk vedlikehold av
--   tiltak. AML § 3-1 — dokumenterte rutiner skal være tilgjengelige
--   for alle ansatte fra dag én.
--   Restrisiko deferred: bulk re-apply på tvers av alle organisasjoner
--   (platform-admin-funksjon) kommer i Phase D.

create or replace function public.provision_workflows_baseline_for_org(
  p_org_id uuid,
  p_pack   text default null,
  p_activate_immediately boolean default false
)
returns table (
  installed_slug   text,
  installed_action text   -- 'inserted' | 'updated' | 'skipped'
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_existing public.workflow_rules%rowtype;
  v_action text;
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

  for c in
    select *
      from public.workflow_rule_catalog
     where is_published = true
       and (p_pack is null or pack = p_pack)
     order by slug
  loop
    select *
      into v_existing
      from public.workflow_rules
     where organization_id = p_org_id
       and slug = c.slug
     limit 1;

    if v_existing.id is null then
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
        case when p_activate_immediately and not c.contains_gov_action then true else false end,
        c.condition_json, c.actions_json,
        c.law_refs, c.frameworks, c.confidentiality_level,
        c.name_i18n, c.description_i18n,
        c.idempotency_template, c.slug, c.catalog_version,
        true, 0
      );
      v_action := 'inserted';

    elsif v_existing.catalog_version = c.catalog_version then
      -- Already up-to-date.
      v_action := 'skipped';

    else
      -- Bring forward catalog metadata (law_refs, frameworks, name_i18n,
      -- description_i18n, confidentiality_level) without overwriting org-
      -- customised condition_json/actions_json/is_active.
      update public.workflow_rules
         set law_refs           = c.law_refs,
             frameworks         = c.frameworks,
             confidentiality_level = c.confidentiality_level,
             name_i18n          = c.name_i18n,
             description_i18n   = c.description_i18n,
             idempotency_template = c.idempotency_template,
             catalog_version    = c.catalog_version,
             updated_at         = now()
       where id = v_existing.id;
      v_action := 'updated';
    end if;

    installed_slug := c.slug;
    installed_action := v_action;
    return next;
  end loop;
end;
$$;

revoke all on function public.provision_workflows_baseline_for_org(uuid, text, boolean) from public;
grant execute on function public.provision_workflows_baseline_for_org(uuid, text, boolean) to authenticated;

comment on function public.provision_workflows_baseline_for_org(uuid, text, boolean) is
  'Installs / updates workflow templates from workflow_rule_catalog for the given org. Never overwrites org-customised actions or is_active. Pack filter optional. Returns per-slug action (inserted/updated/skipped).';
