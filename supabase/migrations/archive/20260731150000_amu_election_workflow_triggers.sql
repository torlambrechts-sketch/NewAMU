-- Dispatch workflow db_events when election phase changes (amu_election module).

create or replace function public.trg_amu_elections_workflow_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_row := to_jsonb(new);

  if new.status = 'nomination' and old.status is distinct from 'nomination' then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'amu_election', 'ON_ELECTION_NOMINATION_OPEN', v_row
    );
  end if;

  if new.status = 'voting' and old.status is distinct from 'voting' then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'amu_election', 'ON_ELECTION_VOTING_OPEN', v_row
    );
  end if;

  if new.status = 'closed' and old.status is distinct from 'closed' then
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'amu_election', 'ON_ELECTION_CLOSED', v_row
    );
  end if;

  return new;
end;
$$;

drop trigger if exists amu_elections_workflow_status_tg on public.amu_elections;
create trigger amu_elections_workflow_status_tg
  after update of status on public.amu_elections
  for each row execute function public.trg_amu_elections_workflow_on_status();
