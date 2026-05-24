-- Hook internal_packs into the append-only audit log that powers
-- Admin → Audit-logg. Same hse_audit_trigger() that already covers
-- inspection_rounds / inspection_findings / deviations etc.
--
-- Compliance requirement: AML § 5-1 (dokumentasjon av HMS-arbeid)
-- and IK-f § 5 nr. 8 (sporbarhet) require that administrative
-- changes to template packs are recoverable from an audit trail.
-- Without this trigger, "Hvem opprettet pakken AML-Bergen?" cannot
-- be answered during an Arbeidstilsynet inspection.

drop trigger if exists internal_packs_audit_tg on public.internal_packs;
create trigger internal_packs_audit_tg
  after insert or update or delete on public.internal_packs
  for each row execute function public.hse_audit_trigger();
