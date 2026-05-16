-- Phase 13.5 second supervisor pass: derive reminder task law_refs from
-- template instead of hardcoding AML's.
--
-- Original _compliance_walkthrough_check_due_orgs() hardcoded
-- ARRAY['AML § 3-1', 'IK-f § 5 nr. 7'] on every reminder task —
-- correct for AML but wrong for a future ISO 45001 / GDPR walkthrough.
-- Tasks for those packs should carry the corresponding pack's law_refs
-- so dashboards (paragraph grid, tasks analytics, gap-and-audit
-- planner) tag them correctly.
--
-- Fix: pull law_refs from the template's own column (first 3) and fall
-- back to AML's only when the template is unexpectedly empty.

set local search_path = public, pg_catalog;

create or replace function public._compliance_walkthrough_check_due_orgs(
  p_slug          text,
  p_pack_slug     public.compliance_pack,
  p_max_age_months int default 12
)
returns int language plpgsql security definer set search_path = public as $$
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
    select organization_id from public.compliance_packs
    where slug = p_pack_slug and deleted_at is null and is_active = true
  loop
    select id, name, law_refs
      into v_template_id, v_template_name, v_template_law_refs
    from public.compliance_checklist_templates
    where organization_id = v_org_id and slug = p_slug
      and deleted_at is null and is_active = true
    limit 1;
    if v_template_id is null then continue; end if;

    v_task_law_refs := coalesce(
      v_template_law_refs[1:3],
      array['AML § 3-1', 'IK-f § 5 nr. 7']::text[]
    );

    select max(signed_at) into v_latest_signed_at
    from public.compliance_checklist_executions
    where organization_id = v_org_id and template_id = v_template_id
      and status = 'signed' and archived_at is null and deleted_at is null;

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

    v_assignee := null; v_assignee_name := null;
    begin
      select user_id, user_name into v_assignee, v_assignee_name
      from public.org_active_role_holders
      where organization_id = v_org_id
        and (role_slug ilike '%hms%ansvarlig%' or role_slug = 'hms_ansvarlig')
        and (valid_to is null or valid_to >= current_date)
      order by valid_from desc nulls last limit 1;
    exception when others then
      v_assignee := null; v_assignee_name := null;
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
          v_template_name, to_char(v_latest_signed_at, 'DD. Mon YYYY'), p_max_age_months
        )
      end,
      'high', 'todo',
      v_task_law_refs,
      'compliance_checklist_item', 'compliance_checklist_item',
      v_template_id, v_reminder_key,
      v_assignee, v_assignee_name,
      (current_date + interval '30 days')::date
    );
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

comment on function public._compliance_walkthrough_check_due_orgs(text, public.compliance_pack, int) is
  'Generic periodic reminder for any walkthrough template. Task law_refs derived from template.law_refs[1:3].';
