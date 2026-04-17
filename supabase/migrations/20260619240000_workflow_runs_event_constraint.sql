-- Extend workflow_runs event check constraint to include db_event and other
-- trigger types added in migration 20260618150000_workflow_db_events.

alter table public.workflow_runs
  drop constraint if exists workflow_runs_event_check;

alter table public.workflow_runs
  add constraint workflow_runs_event_check
  check (event in (
    'payload_change',
    'wiki_published',
    'db_event',
    'schedule',
    'manual',
    'webhook_in'
  ));
