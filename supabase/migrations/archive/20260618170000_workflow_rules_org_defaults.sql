-- Auto-fill organization_id on workflow_rules insert so the component
-- does not need to pass it explicitly (mirrors inspection_rounds pattern).

create or replace function public.workflow_rules_before_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_rules_before_insert_defaults_tg on public.workflow_rules;
create trigger workflow_rules_before_insert_defaults_tg
  before insert on public.workflow_rules
  for each row execute function public.workflow_rules_before_insert_defaults();

-- Same pattern for workflow_steps

create or replace function public.workflow_steps_before_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_steps_before_insert_defaults_tg on public.workflow_steps;
create trigger workflow_steps_before_insert_defaults_tg
  before insert on public.workflow_steps
  for each row execute function public.workflow_steps_before_insert_defaults();
