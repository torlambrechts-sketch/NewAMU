-- Add uniqueness constraint to workflow_rule_revisions.
-- revision_number must be unique per rule so the history tab renders
-- a clean ordered list without duplicate entries caused by concurrent
-- editor sessions or a client-side counter reset.
-- Idempotent: uses IF NOT EXISTS via do-block to avoid re-run failure.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_rule_revisions_rule_revision_uniq'
  ) then
    alter table public.workflow_rule_revisions
      add constraint workflow_rule_revisions_rule_revision_uniq
      unique (rule_id, revision_number);
  end if;
end $$;
