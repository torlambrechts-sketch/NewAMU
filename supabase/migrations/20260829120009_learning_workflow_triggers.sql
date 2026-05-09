-- learning_course_progress + learning_certificates workflow DB triggers
-- Closes gap: e-learning completions and certificates had no workflow hooks.
-- Enables rules like "kurs fullført → opprett oppgave" or
-- "sertifikat utstedt → varsle leder".
--
-- Events added:
--   ON_COURSE_STARTED     → learning_course_progress INSERT
--   ON_COURSE_COMPLETED   → learning_course_progress UPDATE (completed_at NULL→value)
--   ON_CERTIFICATE_ISSUED → learning_certificates INSERT (separate table)
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-4 — opplæring dokumentert og etterprøvbar.
--   Automated escalation when mandatory courses remain incomplete.

-- ── ON_COURSE_STARTED ─────────────────────────────────────────────────────────

create or replace function public.trg_learning_progress_workflow_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'learning', 'ON_COURSE_STARTED', to_jsonb(NEW)
  );
  return NEW;
end;
$$;

drop trigger if exists learning_progress_workflow_started_tg on public.learning_course_progress;
create trigger learning_progress_workflow_started_tg
  after insert on public.learning_course_progress
  for each row execute function public.trg_learning_progress_workflow_started();

-- ── ON_COURSE_COMPLETED ───────────────────────────────────────────────────────
-- Guard: completed_at transitions NULL → value.

create or replace function public.trg_learning_progress_workflow_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.completed_at is not null and OLD.completed_at is null then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'learning', 'ON_COURSE_COMPLETED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists learning_progress_workflow_completed_tg on public.learning_course_progress;
create trigger learning_progress_workflow_completed_tg
  after update of completed_at on public.learning_course_progress
  for each row execute function public.trg_learning_progress_workflow_completed();

-- ── ON_CERTIFICATE_ISSUED ─────────────────────────────────────────────────────
-- Fires on INSERT into learning_certificates (the dedicated certificate table).

create or replace function public.trg_learning_certificates_workflow_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'learning', 'ON_CERTIFICATE_ISSUED', to_jsonb(NEW)
  );
  return NEW;
end;
$$;

drop trigger if exists learning_certificates_workflow_issued_tg on public.learning_certificates;
create trigger learning_certificates_workflow_issued_tg
  after insert on public.learning_certificates
  for each row execute function public.trg_learning_certificates_workflow_issued();
