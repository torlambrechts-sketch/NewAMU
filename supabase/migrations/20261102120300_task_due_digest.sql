-- Task due-date digest substrate (H2.5)
--
-- Gap closed: tasks rotted silently — the only automated nudge in the system
-- was the Arbeidstilsynet escalation for critical avvik. The tasks-due-digest
-- edge function (cron) emails assignees/owners when a task approaches its
-- due date and again when it goes overdue. This column tracks which stage a
-- task has been notified at so a daily cron never repeats the same nudge:
--   0 = never notified · 1 = approaching (≤3 days) sent · 2 = overdue sent
--
-- Self-audit (Arbeidstilsynet POV): frister på HMS-tiltak følges nå opp
-- automatisk (IK-f § 5 nr. 7 — rutiner for å avdekke og rette opp avvik).
-- Restrisiko: a task whose due date is moved later keeps its stage (no
-- re-arm); the digest treats stage monotonically by design — re-arming on
-- due-date change is a follow-up trigger if users ask for it.

alter table public.task_items
  add column if not exists due_notified_stage int not null default 0
    check (due_notified_stage between 0 and 2);

comment on column public.task_items.due_notified_stage is
  'Due-digest progress: 0 never, 1 approaching-notice sent, 2 overdue-notice '
  'sent. Written only by the tasks-due-digest edge function (service role).';

-- The digest scan: open tasks with a due date that have not exhausted both
-- notification stages.
create index if not exists task_items_due_digest_idx
  on public.task_items (organization_id, due_date)
  where due_date is not null
    and deleted_at is null
    and status not in ('closed', 'cancelled')
    and due_notified_stage < 2;
