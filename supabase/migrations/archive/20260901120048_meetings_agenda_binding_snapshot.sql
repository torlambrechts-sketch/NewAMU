-- Meetings — agenda binding_snapshot jsonb column (H9a).
--
-- Why
--   Møteforberedelse-pakke. Each agenda item can carry an optional
--   `dataBinding` declaration in the template definition (e.g. {source:
--   'sick_leave_stats', window: 'last_quarter'}). When a meeting is
--   created from such a template, the resolver hook fans out to the
--   relevant module hooks (useHse, useInternalControl, etc.) and
--   renders a summary that is stored in `meeting_agenda_items.binding_
--   snapshot`. The snapshot becomes part of the protocol — frozen at
--   the moment of meeting prep, defensible at audit.
--
-- Strategy
--   Additive nullable jsonb column. No data migration. The resolver
--   hook + UI consumer follow in H9b/H9c; this commit only opens the
--   storage slot.
--
-- Shape (informally — Zod-validated client-side; passthrough at DB)
--   {
--     "source": "sick_leave_stats",
--     "window": "last_quarter",
--     "resolvedAt": "2026-05-11T10:00:00Z",
--     "summaryMarkdown": "...",
--     "dataRows": [ ... ]
--   }
--
-- Self-audit
--   Storing the resolved snapshot on the protocol artifact (not just
--   the template definition) means auditors can verify the numbers
--   were "true at the time the meeting prepared" — a defensible
--   compliance posture under Forskrift om org. ledelse documentation
--   expectations.

set local search_path = public, pg_catalog;

alter table public.meeting_agenda_items
  add column if not exists binding_snapshot jsonb;

comment on column public.meeting_agenda_items.binding_snapshot is
  'Resolved data binding payload for this agenda item — { source, '
  'window, resolvedAt, summaryMarkdown, dataRows? }. Populated by the '
  'useMeetingDataBindings resolver hook (H9b). Null when the template '
  'item has no dataBinding declaration.';

-- No index needed; binding_snapshot is read per-agenda-item alongside
-- the row, never queried across rows.
