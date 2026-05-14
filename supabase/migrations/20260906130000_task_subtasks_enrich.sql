-- task_subtasks_enrich: add owner_name, priority, start_date to sub-tasks.
--
-- Gap closed: the relational TaskSubtask TS type already declared assigneeUserId
-- + dueDate (which exist in the table) but owner_name, priority, and start_date
-- were missing from both the schema and the UI. This migration adds them so the
-- sub-task form can carry the same core metadata as a full task_item.
--
-- All columns nullable — no existing rows broken, no provision fn needed.

alter table public.task_subtasks
  add column if not exists owner_name  text,
  add column if not exists priority    text
    constraint task_subtasks_priority_check
      check (priority in ('low', 'medium', 'high', 'critical')),
  add column if not exists start_date  date;

comment on column public.task_subtasks.owner_name is
  'Free-text owner/responsible name — mirrors task_items.owner_name pattern.';
comment on column public.task_subtasks.priority is
  'Optional priority: low | medium | high | critical.';
comment on column public.task_subtasks.start_date is
  'Optional planned start date. Pair with existing due_date for a date range.';
