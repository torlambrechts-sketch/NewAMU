-- Alerts v1.1 — encrypted columns on alert_cases.
--
-- Adds bytea companions to the identity-bearing free-text columns so the
-- application can write ciphertext alongside (or instead of) plaintext.
-- Plaintext columns remain to keep v1.0 rows + UIs working during the
-- transition; new code writes the *_encrypted variant when an org has a
-- DEK row in alert_org_key, and reads via the helper
--   coalesce(decryptField(title_encrypted), title).
--
-- Self-audit:
--   * GDPR Art. 32 (1) (a) — krypterings-tiltak på persondata-bærende felt.
--   * AML § 2A-7 (5) — reporter_identifier_encrypted protects identity even
--     against direct DB access (e.g. backup compromise).
--
-- Lock trigger extension: the *_encrypted variants are immutable on the
-- same schedule as their plaintext counterparts.
--
-- Idempotent.

set local search_path = public, pg_catalog;

alter table public.alert_cases
  add column if not exists reporter_identifier_encrypted     bytea,
  add column if not exists reporter_identifier_key_version   integer,
  add column if not exists reporter_email_for_notification_hashed bytea,
  add column if not exists title_encrypted                   bytea,
  add column if not exists title_key_version                 integer,
  add column if not exists description_encrypted             bytea,
  add column if not exists description_key_version           integer;

comment on column public.alert_cases.reporter_identifier_encrypted is
  'XChaCha20-Poly1305 ciphertext of reporter_contact (email/phone). '
  'Storage format: version(1) || nonce(24) || ciphertext. Null when reporter is fully_anonymous.';

comment on column public.alert_cases.reporter_email_for_notification_hashed is
  'HMAC(email, org_dek) — non-reversible. Used to look up the reporter by '
  'email without storing the email itself. Null for non-email channels.';

comment on column public.alert_cases.title_encrypted is
  'XChaCha20-Poly1305 ciphertext of the user-supplied title. Plaintext title '
  'remains in the title column for legacy rows.';

comment on column public.alert_cases.description_encrypted is
  'XChaCha20-Poly1305 ciphertext of the user-supplied description.';

-- Lock trigger: encrypted columns immutable on the same contract as their
-- plaintext counterparts (identity → from-insert; title/description → post-close).
create or replace function public.alert_cases_lock_encrypted_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;

  -- Identity-bearing: immutable from insert.
  if new.reporter_identifier_encrypted is distinct from old.reporter_identifier_encrypted then
    raise exception 'reporter_identifier_encrypted is immutable on alert_cases (T2)'
      using errcode = 'check_violation';
  end if;
  if new.reporter_identifier_key_version is distinct from old.reporter_identifier_key_version then
    raise exception 'reporter_identifier_key_version is immutable on alert_cases'
      using errcode = 'check_violation';
  end if;
  if new.reporter_email_for_notification_hashed is distinct from old.reporter_email_for_notification_hashed then
    raise exception 'reporter_email_for_notification_hashed is immutable on alert_cases'
      using errcode = 'check_violation';
  end if;

  -- title_encrypted + description_encrypted immutable post-close.
  if old.closed_at is not null then
    if new.title_encrypted is distinct from old.title_encrypted then
      raise exception 'title_encrypted is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.description_encrypted is distinct from old.description_encrypted then
      raise exception 'description_encrypted is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists alert_cases_lock_encrypted_columns_tg on public.alert_cases;
create trigger alert_cases_lock_encrypted_columns_tg
  before update on public.alert_cases
  for each row execute function public.alert_cases_lock_encrypted_columns();

-- Lookup index over the HMAC, partial so it doesn't bloat for fully_anonymous rows.
create index if not exists alert_cases_reporter_email_hashed_idx
  on public.alert_cases (organization_id, reporter_email_for_notification_hashed)
  where reporter_email_for_notification_hashed is not null;
