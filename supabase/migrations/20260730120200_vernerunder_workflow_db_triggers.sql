-- Vernerunder: db_event for arbeidsflyt (workflow_dispatch_db_event)
-- Hendelser: ON_VERNERUNDE_PLANNED, ON_VERNERUNDE_COMPLETED, ON_FINDING_REGISTERED

-- Planlagt dato satt (ny runde med dato, eller dato fylt inn senere)
create or replace function public.trg_vernerunder_workflow_planned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and NEW.planned_date is not null then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'vernerunder', 'ON_VERNERUNDE_PLANNED', to_jsonb(NEW)
    );
  elsif TG_OP = 'UPDATE' and NEW.planned_date is not null
    and (OLD.planned_date is null or OLD.planned_date is distinct from NEW.planned_date) then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'vernerunder', 'ON_VERNERUNDE_PLANNED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists vernerunder_workflow_planned_tg on public.vernerunder;
create trigger vernerunder_workflow_planned_tg
  after insert or update of planned_date on public.vernerunder
  for each row execute function public.trg_vernerunder_workflow_planned();

-- Fullført
create or replace function public.trg_vernerunder_workflow_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'completed'
     and (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and (OLD.status is distinct from NEW.status))) then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'vernerunder', 'ON_VERNERUNDE_COMPLETED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists vernerunder_workflow_completed_tg on public.vernerunder;
create trigger vernerunder_workflow_completed_tg
  after insert or update of status on public.vernerunder
  for each row execute function public.trg_vernerunder_workflow_completed();

-- Funn opprettet
create or replace function public.trg_vernerunde_findings_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'vernerunder', 'ON_FINDING_REGISTERED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists vernerunde_findings_workflow_tg on public.vernerunde_findings;
create trigger vernerunde_findings_workflow_tg
  after insert on public.vernerunde_findings
  for each row execute function public.trg_vernerunde_findings_workflow();
