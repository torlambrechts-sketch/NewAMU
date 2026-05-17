-- workflow-tsa-tokens Storage bucket for RFC 3161 TimeStampToken bodies.
--
-- Long tokens (re-anchored periodically, multiple TSA chains stored together,
-- vendor-specific extensions) don't fit comfortably in a bytea column. The
-- workflow_evidence_anchors.tsa_token_storage_path points into this bucket.
--
-- Path convention:
--   <org_id>/<anchor_id>.tsr            org-scoped anchors
--   __platform__/<anchor_id>.tsr        platform-global anchors
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritet) + Arkivforskriften § 7
--   (langtids-bevaring av elektronisk arkivverdig materiale med autentisitet)
--   + eIDAS (kvalifisert tidsstempel som rettslig bevis). Tokens må overleve
--   selv om DB-backupen mistes — Storage gir uavhengig replikasjon.
--   Restrisiko deferred: kryptografisk hash-trampoline til en blockchain
--   eller annet ekstern tjenestes ankerpunkt er ute av scope; substrate
--   støtter Buypass / DigiCert / Difi-TSA via RFC 3161.

set local search_path = public, pg_catalog;

-- ── 1. Bucket ──────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('workflow-tsa-tokens', 'workflow-tsa-tokens', false)
on conflict (id) do nothing;

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- SELECT: org members for their own org's prefix; platform admins for the
--         __platform__ global prefix.
-- WRITE: service-role only (no policy → authenticated users denied).

drop policy if exists "workflow_tsa_tokens_select_org" on storage.objects;
create policy "workflow_tsa_tokens_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workflow-tsa-tokens'
    and (
      -- Org-scoped prefix matches the user's current org.
      (storage.foldername(name))[1] = public.current_org_id()::text
      or
      -- Platform-global prefix is readable by platform admins only.
      (
        (storage.foldername(name))[1] = '__platform__'
        and exists (
          select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
        )
      )
    )
  );

-- No INSERT/UPDATE/DELETE policy → only service-role can write tokens.

comment on table storage.buckets is
  'Project-level Storage buckets. workflow-tsa-tokens added by _20260907123600 for RFC 3161 TimeStampToken bodies referenced from workflow_evidence_anchors.';
