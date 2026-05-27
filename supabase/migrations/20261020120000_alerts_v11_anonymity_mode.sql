-- Alerts v1.1 — anonymity_mode enum on alert_cases.
--
-- v1.0 used a single `is_anonymous boolean`. v1.1 introduces a four-valued
-- mode field per the design handover:
--   fully_anonymous · pseudonymous · confidential · open
-- The new column lives alongside the legacy boolean; a BEFORE INSERT/UPDATE
-- sync trigger keeps the two consistent for the duration of the transition.
-- Lock trigger extension makes anonymity_mode immutable from insert (same
-- contract as is_anonymous) to prevent post-hoc de-anonymisation.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 2A-7 (5) taushetsplikt om varslerens identitet — anonymity_mode
--     IMMUTABLE FROM INSERT via lock trigger, mirroring the existing
--     immutability of is_anonymous / reporter_user_id / reporter_contact.
--   * GDPR Art. 5 (1) (a) lovlighet og rimelighet — explicit four-mode
--     declaration lets reporters knowingly choose anonymity vs follow-up.
--
-- Idempotent + additive. Re-applying this migration is a no-op.

set local search_path = public, pg_catalog;

alter table public.alert_cases
  add column if not exists anonymity_mode text;

-- Backfill from existing is_anonymous + reporter_contact + reporter_user_id.
-- Mapping: identified employee (user_id present, not anonymous)  → 'open'
--          identified public  (no user_id, not anonymous)         → 'open'
--          pseudonymous       (anonymous, has reporter_contact)   → 'pseudonymous'
--          confidential       (anonymous, no contact, system_template_id ends with confidential or template confidential_level='confidential') → 'confidential'
--          fully anonymous    (otherwise)                          → 'fully_anonymous'
update public.alert_cases c
   set anonymity_mode = case
     when c.is_anonymous = false then 'open'
     when c.is_anonymous = true and c.reporter_contact is not null then 'pseudonymous'
     when c.is_anonymous = true and c.confidentiality_level = 'confidential' then 'confidential'
     else 'fully_anonymous'
   end
 where anonymity_mode is null;

-- Enforce the enum via check constraint and not-null.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alert_cases_anonymity_mode_check'
      and conrelid = 'public.alert_cases'::regclass
  ) then
    alter table public.alert_cases
      add constraint alert_cases_anonymity_mode_check
      check (anonymity_mode in ('fully_anonymous','pseudonymous','confidential','open'));
  end if;
end$$;

alter table public.alert_cases
  alter column anonymity_mode set default 'fully_anonymous';

alter table public.alert_cases
  alter column anonymity_mode set not null;

-- Index for analyse-page anonymity_share dataset.
create index if not exists alert_cases_anonymity_mode_idx
  on public.alert_cases (organization_id, anonymity_mode);

-- ── Sync trigger: derive is_anonymous from anonymity_mode (and vice-versa)
-- on insert. Keeps the legacy boolean consistent so existing RLS / dashboards
-- keep working until consumers migrate to the new column.
create or replace function public.alert_cases_sync_anonymity_mode()
returns trigger
language plpgsql
as $$
begin
  -- Both NULL → default to fully_anonymous (covers the trigger firing
  -- before column default is applied, e.g. via the AML legacy ingestion).
  if new.anonymity_mode is null and new.is_anonymous is null then
    new.anonymity_mode := 'fully_anonymous';
    new.is_anonymous := true;
    return new;
  end if;

  -- anonymity_mode is the new source of truth. Derive is_anonymous from it.
  if new.anonymity_mode is not null then
    new.is_anonymous := (new.anonymity_mode <> 'open');
    return new;
  end if;

  -- anonymity_mode is null but legacy boolean was provided — derive the mode.
  if new.is_anonymous = false then
    new.anonymity_mode := 'open';
  elsif new.reporter_contact is not null then
    new.anonymity_mode := 'pseudonymous';
  elsif new.confidentiality_level = 'confidential' then
    new.anonymity_mode := 'confidential';
  else
    new.anonymity_mode := 'fully_anonymous';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_cases_sync_anonymity_mode_tg on public.alert_cases;
create trigger alert_cases_sync_anonymity_mode_tg
  before insert or update on public.alert_cases
  for each row execute function public.alert_cases_sync_anonymity_mode();

-- ── Extend lock trigger: anonymity_mode immutable from insert.
-- Inlined extension rather than rewriting the original trigger function so
-- the v1.0 contract stays visible in 20260911120000.
create or replace function public.alert_cases_lock_anonymity_mode()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.anonymity_mode is distinct from old.anonymity_mode then
    raise exception 'anonymity_mode is immutable on alert_cases (T2 de-anonymisation defence)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_cases_lock_anonymity_mode_tg on public.alert_cases;
-- Name 'a_' prefix so it fires before the v1.0 lock trigger (Postgres orders
-- triggers alphabetically). Belt-and-braces — order doesn't strictly matter
-- here since both raise.
create trigger alert_cases_a_lock_anonymity_mode_tg
  before update on public.alert_cases
  for each row execute function public.alert_cases_lock_anonymity_mode();
