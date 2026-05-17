-- Tilsynsbrev storage RLS — join confidentiality gate to storage.objects.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (1) c (integritet og
--   konfidensialitet av personopplysninger ved lagring) + AML § 2A-7 (5)
--   (varslingssaker — taushetsplikt). _123900 gated only on bucket_id +
--   first-segment-uuid == current_org_id() — any org-medlem som kjente
--   storage_path kunne kalle createSignedUrl og hoppe over confidentiality_
--   level-gaten på tilsynsbrev_uploads. Denne migrasjonen joiner storage-
--   policyen til parent-raden så samme gate brukes begge steder.
--   Restrisiko deferred: signed URLs (60 s) som allerede er gitt ut før
--   denne migrasjonen er gyldige til de utløper — den korte TTL-en
--   begrenser eksponering, men en operatør bør invalidere bucket via
--   admin UI hvis en konkret lekkasje er mistenkt.

set local search_path = public, pg_catalog;

-- Drop the lax policy (idempotent — covers both the original name and any
-- prior re-creation under this name).
drop policy if exists tilsynsbrev_storage_read on storage.objects;

create policy tilsynsbrev_storage_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tilsynsbrev'
    and nullif(split_part(name, '/', 1), '')::uuid = public.current_org_id()
    and exists (
      select 1
        from public.tilsynsbrev_uploads u
       where u.storage_path = storage.objects.name
         and u.organization_id = public.current_org_id()
         and (
           u.confidentiality_level = 'standard'
           or u.uploaded_by = (select auth.uid())
           or public.user_has_permission_strict('tilsynsbrev.view_confidential')
         )
    )
  );

comment on policy tilsynsbrev_storage_read on storage.objects is
  'Storage-read for tilsynsbrev bucket. Joins to tilsynsbrev_uploads by storage_path so the confidentiality_level gate from _123900 applies to signed-URL downloads too — without this join, any org member with the path could createSignedUrl() and bypass the strict-permission gate.';
