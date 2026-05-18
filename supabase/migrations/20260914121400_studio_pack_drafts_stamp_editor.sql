-- Studio Builder — stamp last_edited_by on studio_pack_drafts.
--
-- Phase 3.4 added a revoked_grace_until column + an after-update trigger
-- on partner_memberships that stamps the column for every draft authored
-- by the revoked user. That trigger reads last_edited_by — but no path
-- in the codebase actually populates that column today. This migration
-- closes the loop with a BEFORE INSERT/UPDATE trigger that stamps
-- auth.uid() automatically.
--
-- Idempotent: drop-and-recreate trigger.

set local search_path = public, pg_catalog;

create or replace function public.studio_pack_drafts_stamp_editor()
returns trigger
language plpgsql
as $fn$
begin
  -- Stamp on INSERT and any UPDATE that doesn't already carry a value
  -- (so a backfill migration can set it explicitly without being
  -- overwritten on the next save).
  new.last_edited_by := coalesce(new.last_edited_by, auth.uid());
  new.last_edited_at := now();
  return new;
end;
$fn$;

drop trigger if exists studio_pack_drafts_stamp_editor on public.studio_pack_drafts;
create trigger studio_pack_drafts_stamp_editor
  before insert or update on public.studio_pack_drafts
  for each row
  execute function public.studio_pack_drafts_stamp_editor();
