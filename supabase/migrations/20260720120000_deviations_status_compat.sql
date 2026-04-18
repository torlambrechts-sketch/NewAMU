-- Allow both Norwegian workflow statuses and legacy English literals on deviations
-- (some code paths still insert 'open'; HSE migration moved rows to Norwegian only).

alter table public.deviations drop constraint if exists deviations_status_check;

alter table public.deviations
  add constraint deviations_status_check check (status in (
    'rapportert',
    'under_behandling',
    'tiltak_iverksatt',
    'lukket',
    'open',
    'in_progress',
    'closed'
  ));
