-- Alerts v1.1 — per-message attachment binding.
--
-- v1.0 attachments belonged to the case directly. v1.1 §2 allows binding
-- an attachment to a specific message (note) so the timeline shows files
-- in the context they were shared. Existing case-level attachments keep
-- note_id NULL.
--
-- Self-audit:
--   * GDPR Art. 5 (1) (d) accuracy — knowing which message an attachment
--     accompanied helps reconstruct the conversation in DSAR responses.
--
-- Idempotent.

set local search_path = public, pg_catalog;

alter table public.alert_case_attachments
  add column if not exists note_id uuid references public.alert_case_notes (id) on delete set null;

create index if not exists alert_case_attachments_note_idx
  on public.alert_case_attachments (note_id)
  where note_id is not null;

-- Partial unique: same hash can appear only once per message (prevents
-- duplicate uploads from a flaky network retry).
create unique index if not exists alert_case_attachments_note_hash_uidx
  on public.alert_case_attachments (note_id, sha256_hex)
  where note_id is not null and sha256_hex is not null and is_redacted = false;
