-- Alerts v1.1 — encrypted message bodies on alert_case_notes.
--
-- v1.0 notes stored body text in plaintext; v1.1 spec requires every message
-- body to be encrypted at the application layer. We add body_encrypted bytea
-- alongside, keeping legacy plaintext readable so existing notes still
-- surface. The append-only trigger on alert_case_notes still applies — we
-- don't relax it; we just add new columns that future inserts use.
--
-- Self-audit:
--   * GDPR Art. 32 (1) (a) — message bodies frequently carry the reporter's
--     own words; encrypt at rest.
--   * AML § 2A-7 (5) — body_encrypted closes the path where a DB dump could
--     reveal identity hints in message text.
--
-- Idempotent.

set local search_path = public, pg_catalog;

alter table public.alert_case_notes
  add column if not exists body_encrypted     bytea,
  add column if not exists body_key_version   integer;

comment on column public.alert_case_notes.body_encrypted is
  'XChaCha20-Poly1305 ciphertext of the note body. '
  'Storage: version(1) || nonce(24) || ciphertext.';

-- Either the plaintext or the ciphertext must be non-empty (allow body=''
-- only when body_encrypted is set).
alter table public.alert_case_notes
  alter column body drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alert_case_notes_body_not_empty_chk'
      and conrelid = 'public.alert_case_notes'::regclass
  ) then
    alter table public.alert_case_notes
      add constraint alert_case_notes_body_not_empty_chk
      check (
        (body is not null and length(body) > 0)
        or (body_encrypted is not null and octet_length(body_encrypted) > 0)
      );
  end if;
end$$;
