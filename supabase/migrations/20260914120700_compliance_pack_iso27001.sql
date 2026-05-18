-- Studio Builder Phase 2b — extend compliance_pack enum with iso-27001.
--
-- Standalone migration because Postgres won't let a new enum value be
-- used in the same transaction it's added (ERROR: unsafe use of new
-- value of enum type). _120800_iso27001_starter_pack.sql consumes the
-- value once this migration has committed.
--
-- Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'compliance_pack' and e.enumlabel = 'iso-27001'
  ) then
    alter type public.compliance_pack add value 'iso-27001';
  end if;
end $$;
