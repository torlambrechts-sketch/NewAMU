-- compliance_layer · server-side framework_id guard on auditor token verify
--
-- Coverage gap closed:
--   The existing `compliance_auditor_token_verify(p_token)` RPC returns
--   any token regardless of which auditor surface is loading it. The
--   client-side check on `framework_id` (added in ControlsAuditorPage.tsx
--   + InternkontrollAuditorPage.tsx) is defence-in-depth, but a fix at
--   the RPC layer is stronger: a wrong-framework token returns no rows
--   instead of decrypted-and-rejected. Cheap to add as an overload that
--   takes an optional expected-framework parameter; the existing
--   parameterless caller keeps working.
--
-- Self-audit (Datatilsynet POV):
--   - GDPR Art. 32 (defence-in-depth): one less avenue for token-
--     metadata enumeration. A user with a 'controls' token who probes
--     `/auditor/internkontroll/<token>` previously triggered a full
--     server-side decrypt-and-return; now the RPC short-circuits at the
--     where-clause level.
--   - Backwards compatibility: existing callers (with no expected_framework
--     argument) get the unchanged behaviour. The Phase-2 auditor pages
--     pass the expected framework explicitly.
-- Restrisiko:
--   - Existing tokens minted before this migration still work; the
--     server-side guard is opt-in per call.

set local search_path = public, pg_catalog;

-- Drop the old signature first so the create-or-replace below can change
-- the result column set freely.
drop function if exists public.compliance_auditor_token_verify(text);

-- New canonical signature: optional expected_framework_id. When NULL the
-- behaviour mirrors the original (any framework). When set, the row is
-- only returned if framework_id matches exactly.
create or replace function public.compliance_auditor_token_verify(
  p_token                    text,
  p_expected_framework_id    text default null
)
returns table (
  framework_id text,
  scope_label  text,
  snapshot     jsonb,
  layout       jsonb,
  created_at   timestamptz,
  expires_at   timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
  select t.framework_id, t.scope_label, t.snapshot, t.layout, t.created_at, t.expires_at
  from public.compliance_auditor_tokens t
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at > now()
    and (
      p_expected_framework_id is null
      or t.framework_id = p_expected_framework_id
    )
  limit 1;
end;
$$;

revoke all on function public.compliance_auditor_token_verify(text, text) from public;
grant execute on function public.compliance_auditor_token_verify(text, text) to anon, authenticated;

comment on function public.compliance_auditor_token_verify(text, text) is
  'Resolve an auditor token to its frozen snapshot. When p_expected_framework_id is set, only tokens matching that framework_id are returned — adds server-side defence-in-depth against probing one auditor surface with another''s token. Returns no rows when the token is unknown, revoked, expired, or framework-mismatched. Anon-callable.';
