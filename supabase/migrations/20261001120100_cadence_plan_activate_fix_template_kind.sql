-- Fix cadence_plan_activate to use the valid task_items.template_kind value.
--
-- The check constraint task_items_template_kind_check accepts:
--   'oppgave' | 'avvik' | 'nestenulykke' | 'tiltak' | 'risiko' | 'forslag' | 'sykefravær'
-- The initial migration used 'task' which fails the check; use 'oppgave'
-- (general HMS-task) for cadence-genererte oppgaver.

set local search_path = public, pg_catalog;

create or replace function public.cadence_plan_activate(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_plan record;
  v_mod record;
  v_due date;
  v_task_id uuid;
begin
  select * into v_plan
    from public.cadence_plans
    where id = p_plan_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    raise exception 'Cadence-plan ikke funnet eller utenfor organisasjonen.';
  end if;

  if not (public.is_org_admin() or v_plan.created_by = auth.uid()) then
    raise exception 'Mangler tilgang til å iverksette cadence-planen.';
  end if;

  update public.cadence_plans
    set status = 'active',
        activated_at = coalesce(activated_at, now()),
        wizard_step = 8
    where id = p_plan_id;

  for v_mod in
    select m.module_id, m.name, m.law_refs, m.cadence_hint, m.frequency, m.description, m.volume
      from public.cadence_plan_modules m
      where m.cadence_plan_id = p_plan_id
  loop
    v_due := (now() + interval '30 days')::date;

    insert into public.task_items (
      organization_id, title, description, priority, status, pack,
      source_type, source_id, law_refs, source_category, pdca_phase,
      template_slug, template_kind, due_date
    )
    values (
      v_plan.organization_id,
      v_mod.name,
      coalesce(v_mod.description, '') ||
        case when v_mod.frequency is not null then E'\n\nFrekvens: ' || v_mod.frequency else '' end ||
        case when v_mod.cadence_hint is not null then E'\nCadence: ' || v_mod.cadence_hint else '' end,
      'medium',
      'open',
      v_plan.pack,
      'cadence_plan',
      v_plan.id,
      coalesce(v_mod.law_refs, '{}'::text[]),
      'general',
      'do',
      'cadence_' || lower(v_mod.module_id),
      'oppgave',
      v_due
    )
    on conflict do nothing
    returning id into v_task_id;
  end loop;

  return p_plan_id;
end;
$$;

revoke all on function public.cadence_plan_activate(uuid) from public;
grant execute on function public.cadence_plan_activate(uuid) to authenticated;
