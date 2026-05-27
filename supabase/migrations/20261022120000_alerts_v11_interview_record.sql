-- Alerts v1.1 — alert_interview (structured interview record).
--
-- v1.1 §6: every interview with an accused / witness / external party
-- gets a structured row capturing interviewers, date, location, channel,
-- consent statement, recording flag, questions + notes-per-question,
-- decisions, next steps. Editable for 24 hours after creation; locked
-- thereafter (corrections via append-only follow-up rows).
--
-- Self-audit:
--   * Forvaltningsloven § 11 a (kontradiksjon) — accused interviews
--     documented with consent + a structured next-step record.
--   * AML § 2A-7 (5) — witness identity protected via encryption.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_interview (
  id                          uuid primary key default gen_random_uuid(),
  case_id                     uuid not null references public.alert_cases (id) on delete cascade,
  organization_id             uuid not null references public.organizations (id) on delete cascade,
  interviewee_kind            text not null check (interviewee_kind in ('accused','witness','external','reporter')),
  interviewee_accused_id      uuid references public.alert_accused (id) on delete set null,
  interviewee_witness_id      uuid references public.alert_witness (id) on delete set null,
  interviewers                uuid[] not null default '{}',
  interview_at                timestamptz not null,
  location                    text,
  channel                     text not null check (channel in ('in_person','phone','video','written')),
  consent_statement_encrypted bytea,
  consent_key_version         integer,
  consent_received_at         timestamptz,
  recording                   boolean not null default false,
  recording_storage_path      text,
  questions                   jsonb not null default '[]'::jsonb,
  notes_encrypted             bytea,
  notes_key_version           integer,
  decisions_encrypted         bytea,
  decisions_key_version       integer,
  next_steps_encrypted        bytea,
  next_steps_key_version      integer,
  finalised_at                timestamptz,
  finalised_by                uuid references auth.users (id) on delete set null,
  created_by                  uuid references auth.users (id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists alert_interview_case_idx
  on public.alert_interview (case_id, interview_at desc);

create index if not exists alert_interview_accused_idx
  on public.alert_interview (interviewee_accused_id)
  where interviewee_accused_id is not null;

create index if not exists alert_interview_witness_idx
  on public.alert_interview (interviewee_witness_id)
  where interviewee_witness_id is not null;

alter table public.alert_interview enable row level security;

drop policy if exists alert_interview_select on public.alert_interview;
create policy alert_interview_select
  on public.alert_interview for select
  to authenticated
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
  );

drop policy if exists alert_interview_write on public.alert_interview;
create policy alert_interview_write
  on public.alert_interview for all
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
      or public.user_has_permission('alerts.external_investigator')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
      or public.user_has_permission('alerts.external_investigator')
    )
  );

-- Lock 24h after creation OR on finalise.
create or replace function public.alert_interview_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id then
    raise exception 'alert_interview.case_id is immutable' using errcode = 'check_violation';
  end if;
  if old.finalised_at is not null
     or old.created_at < now() - interval '24 hours' then
    -- Permit only the read-side fields (none here) — every column locked.
    if new is distinct from old then
      raise exception 'alert_interview is locked after finalisation or 24h post-creation; create a follow-up row'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists alert_interview_before_update_lock_tg on public.alert_interview;
create trigger alert_interview_before_update_lock_tg
  before update on public.alert_interview
  for each row execute function public.alert_interview_before_update_lock();

drop trigger if exists alert_interview_set_updated_at on public.alert_interview;
create trigger alert_interview_set_updated_at
  before update on public.alert_interview
  for each row execute function public.set_updated_at();

-- Now that alert_interview exists, fix the FK on alert_witness.interview_step_id.
alter table public.alert_witness
  drop constraint if exists alert_witness_interview_step_fk;
alter table public.alert_witness
  add constraint alert_witness_interview_step_fk
    foreign key (interview_step_id) references public.alert_interview (id)
    on delete set null
    deferrable initially deferred;
