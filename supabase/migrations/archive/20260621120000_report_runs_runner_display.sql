-- Who ran the report: denormalized display name for UI (no extra join in client).

alter table public.report_runs add column if not exists runner_display_name text;

update public.report_runs r
set runner_display_name = coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email::text), ''), 'Bruker')
from public.profiles p
where p.id = r.user_id
  and (r.runner_display_name is null or r.runner_display_name = '');

create or replace function public.report_runs_set_runner_display()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email::text), ''), 'Bruker')
  into v_name
  from public.profiles p
  where p.id = NEW.user_id;
  NEW.runner_display_name := coalesce(v_name, 'Bruker');
  return NEW;
end;
$$;

drop trigger if exists report_runs_set_runner_display_trg on public.report_runs;
create trigger report_runs_set_runner_display_trg
  before insert on public.report_runs
  for each row execute function public.report_runs_set_runner_display();

comment on column public.report_runs.runner_display_name is
  'Snapshot of runner display name at insert time (from profiles).';
