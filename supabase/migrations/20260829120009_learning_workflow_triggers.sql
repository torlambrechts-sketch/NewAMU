-- learning_course_progress workflow DB triggers
-- Closes gap: e-learning completions and certificates had no workflow hooks.
-- Enables rules like "kurs fullført → opprett oppgave" or
-- "sertifikat utstedt → varsle leder".
--
-- Events added: ON_COURSE_STARTED, ON_COURSE_COMPLETED, ON_CERTIFICATE_ISSUED
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-4 — opplæring dokumentert og etterprøvbar.
--   Automated escalation when mandatory courses remain incomplete.
--   Restrisiko deferred: ON_COURSE_FAILED (no passing_score column yet on progress).

-- ── ON_COURSE_STARTED ─────────────────────────────────────────────────────────

create or replace function public.trg_learning_progress_workflow_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fire on INSERT only (a new progress row = course started)
  if TG_OP = 'INSERT' then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'learning', 'ON_COURSE_STARTED', to_jsonb(NEW)
    );
  end if;
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
  if NEW.completed_at is not null
     and (OLD.completed_at is null or TG_OP = 'INSERT') then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'learning', 'ON_COURSE_COMPLETED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists learning_progress_workflow_completed_tg on public.learning_course_progress;
create trigger learning_progress_workflow_completed_tg
  after insert or update of completed_at on public.learning_course_progress
  for each row execute function public.trg_learning_progress_workflow_completed();

-- ── ON_CERTIFICATE_ISSUED ─────────────────────────────────────────────────────
-- Fires when certificate_issued_at transitions NULL → value.

create or replace function public.trg_learning_progress_workflow_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.certificate_issued_at is not null
     and (OLD.certificate_issued_at is null or TG_OP = 'INSERT') then
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'learning', 'ON_CERTIFICATE_ISSUED', to_jsonb(NEW)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists learning_progress_workflow_certificate_tg on public.learning_course_progress;
create trigger learning_progress_workflow_certificate_tg
  after insert or update of certificate_issued_at on public.learning_course_progress
  for each row execute function public.trg_learning_progress_workflow_certificate();
