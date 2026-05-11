-- Drop wiki_page_block_locks now that the block-based editor is retired.
-- The TipTap workbench at /reference-edit is the single document editor;
-- it relies on page-level Supabase Realtime presence (no DB table needed)
-- so the table, its RLS policies, and its indexes are dead weight. Locks
-- in this table were 5-minute TTL records that auto-expired anyway —
-- dropping the table loses no enduring data.
--
-- We keep the 'lock_overridden' enum value on wiki_audit_ledger so any
-- historical override entries written by the previous editor remain
-- valid; adding harmless action keys to the check constraint is cheap
-- and reverting it would require backfilling historical rows.

drop trigger if exists wiki_page_block_locks_anything on public.wiki_page_block_locks;
drop table if exists public.wiki_page_block_locks cascade;
