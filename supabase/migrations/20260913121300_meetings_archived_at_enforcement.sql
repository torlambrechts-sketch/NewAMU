-- Meetings · enforce `archived_at` as a true soft-delete marker.
--
-- Why
--   The column has lived on `public.meetings` since 20260901120000 but
--   nothing enforces it. Archived meetings remain queryable, mutable, and
--   indistinguishable from active ones unless every caller remembers to
--   add `archived_at is null` — which they don't (verified by grep).
--
--   Two enforcements:
--   1. BEFORE UPDATE trigger refuses mutation of an archived row except
--      for the act of un-archiving (NEW.archived_at IS NULL).
--   2. Child-table writes refuse INSERT/UPDATE/DELETE when the parent
--      meeting is archived — same shape as the existing confidentiality
--      RLS predicates (transitive enforcement).
--
--   Soft-delete vs hard-delete: archive is reversible. Hard delete still
--   cascades via FK; this trigger only blocks mid-state writes.
--
-- Self-audit (Arbeidstilsynet POV)
--   GDPR Art. 5 (1)(d) — data accuracy. An archived meeting that can
--   still be mutated isn't really archived. This closes that gap.

set local search_path = public, pg_catalog;

create or replace function public.meeting_block_writes_when_archived()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  -- Allow the un-archive itself (NEW.archived_at IS NULL) and the
  -- archive event itself (OLD.archived_at IS NULL). Block everything
  -- else when OLD.archived_at IS NOT NULL.
  if tg_op = 'UPDATE'
     and old.archived_at is not null
     and new.archived_at is not null then
    raise exception 'Meeting % is archived (archived_at=%); writes blocked. Un-archive first.',
      old.id, old.archived_at
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' and old.archived_at is not null then
    -- DELETE on archived is fine — hard-delete proceeds.
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_block_writes_when_archived_tg on public.meetings;
create trigger meeting_block_writes_when_archived_tg
  before update on public.meetings
  for each row
  execute function public.meeting_block_writes_when_archived();

-- Trigger composition note: Postgres fires BEFORE triggers in alphabetical
-- order by trigger name. Active BEFORE UPDATE triggers on `meetings`:
--   1. `meeting_block_writes_when_archived_tg`  (this one)
--   2. `meetings_before_update_defaults_tg`     (sign-lock, archive/20260901120000)
--   3. `meetings_set_updated_at`
-- The archive trigger fires FIRST, so any write to an archived row aborts
-- before the sign-lock has a chance to evaluate. Archive takes precedence
-- over sign. Archiving a signed meeting is allowed because the sign-lock
-- trigger does NOT block changes to `archived_at` (verify in the source).
-- Un-archiving an archived row passes the archive trigger (NEW.archived_at
-- IS NULL branch) and then runs through the sign-lock normally.

comment on function public.meeting_block_writes_when_archived() is
  'BEFORE UPDATE trigger: blocks mutation of archived meeting rows. Un-archiving (set archived_at = null) is still allowed.';

-- Child-table protection: refuse writes when the parent meeting is
-- archived. We extend each child table''s existing write policy by
-- adding an `and m.archived_at is null` clause via a stricter
-- replacement. The select policy is unchanged — archived data remains
-- readable for audit purposes.
--
-- Confidentiality cascade is preserved: the original policies use
-- `exists (select 1 from public.meetings m where m.id = meeting_id)`
-- with no inline confidentiality predicate, relying on Postgres RLS
-- to cascade the parent `meetings_select` confidentiality guard
-- through the EXISTS subquery. The new policies use the same pattern
-- plus the archive predicate — no regression on confidentiality
-- enforcement.

drop policy if exists meeting_agenda_items_write on public.meeting_agenda_items;
create policy meeting_agenda_items_write
  on public.meeting_agenda_items for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_attendees_write on public.meeting_attendees;
create policy meeting_attendees_write
  on public.meeting_attendees for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_decisions_write on public.meeting_decisions;
create policy meeting_decisions_write
  on public.meeting_decisions for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_action_items_write on public.meeting_action_items;
create policy meeting_action_items_write
  on public.meeting_action_items for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_signatures_write on public.meeting_signatures;
create policy meeting_signatures_write
  on public.meeting_signatures for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );
