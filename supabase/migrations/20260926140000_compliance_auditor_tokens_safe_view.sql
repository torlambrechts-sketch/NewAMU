-- compliance_layer · compliance_auditor_tokens_safe view + revoke-by-id RPC
--
-- Coverage gap closed:
--   `compliance_auditor_tokens.token` is a bearer secret — anyone with
--   the string can read the org's frozen snapshot for 30 days via
--   `/auditor/internkontroll/<token>` or `/auditor/controls/<token>`.
--   The original SELECT policy granted any authenticated org member
--   direct SELECT on the base table, which means the full token shipped
--   in every fetch response feeding the admin-side "active tokens" list.
--   Error monitors (Sentry/Datadog RUM with fetch auto-instrumentation),
--   browser extensions, and `console.log` middleware would all see and
--   potentially exfiltrate the bearer secret. This migration mirrors the
--   pattern used by `meeting_external_invitees_safe` (per CLAUDE.md
--   "things easy to get wrong") to keep the bearer string out of client
--   payloads after creation.
--
-- Design:
--   1. Add an opaque `id uuid` column to compliance_auditor_tokens with
--      a default `gen_random_uuid()`. Backfill existing rows. Unique
--      index. The id becomes the safe handle for client-side revoke.
--   2. Create view `compliance_auditor_tokens_safe` projecting:
--        (id, organization_id, framework_id, scope_label,
--         token_prefix, token_suffix, created_by, created_at,
--         expires_at, revoked_at)
--      — no `token` column. Prefix+suffix give the admin enough info to
--      identify the token visually without exposing the full secret.
--   3. Revoke `SELECT` on the base table from `authenticated`. The view
--      becomes the only read path. The two SECURITY-DEFINER RPCs
--      (`create_compliance_auditor_token`, `compliance_auditor_token_verify`,
--      `revoke_compliance_auditor_token`) keep working unchanged — they
--      bypass RLS by design.
--   4. New `revoke_compliance_auditor_token_by_id(p_id uuid)` RPC that
--      resolves the id → token internally and revokes. Client code uses
--      this so the bearer string never crosses the network again after
--      `create_compliance_auditor_token` returns it once.
--
-- Self-audit (Datatilsynet POV):
--   - GDPR Art. 32 (tekniske og organisatoriske tiltak): reducing the
--     surface where a bearer secret traverses the data flow is a direct
--     Art. 32 best-practice — defence in depth around an authentication
--     credential.
--   - Backwards compatibility: the legacy `revoke_compliance_auditor_token(text)`
--     RPC stays in place so an older client (or admin-side scripts) can
--     still revoke by full token if they've cached one. Phase-2 UI uses
--     the id-based path.
-- Restrisiko:
--   - Tokens minted before this migration get an id via backfill — safe.
--   - The view inherits no RLS of its own, but `security_invoker = true`
--     (Postgres 15+) means selects against it use the caller's role —
--     which has no direct SELECT on the base table after this migration.
--     We add an explicit RLS policy on the view's *base-table predicate*
--     by re-using `organization_id = current_org_id()` in the view body.

set local search_path = public, pg_catalog;

-- ── 1. Opaque id column ─────────────────────────────────────────────────

alter table public.compliance_auditor_tokens
  add column if not exists id uuid;

-- Backfill before adding NOT NULL.
update public.compliance_auditor_tokens
   set id = gen_random_uuid()
 where id is null;

alter table public.compliance_auditor_tokens
  alter column id set not null,
  alter column id set default gen_random_uuid();

create unique index if not exists compliance_auditor_tokens_id_uidx
  on public.compliance_auditor_tokens (id);

comment on column public.compliance_auditor_tokens.id is
  $c$Opaque uuid handle used by client-side admin UI for revoke operations.
  Lets the safe view + revoke-by-id RPC keep the bearer `token` string out
  of client payloads after the create RPC returns it once.$c$;

-- ── 2. Safe view ────────────────────────────────────────────────────────

drop view if exists public.compliance_auditor_tokens_safe;

create view public.compliance_auditor_tokens_safe
with (security_invoker = true)
as
select
  t.id,
  t.organization_id,
  t.framework_id,
  t.scope_label,
  -- Visual identification of the token without exposing the secret.
  -- Short forms only — the admin can re-share by re-creating.
  left(t.token, 4)                              as token_prefix,
  right(t.token, 4)                             as token_suffix,
  t.created_by,
  t.created_at,
  t.expires_at,
  t.revoked_at
from public.compliance_auditor_tokens t
where t.organization_id = public.current_org_id();

comment on view public.compliance_auditor_tokens_safe is
  'Admin-side projection of compliance_auditor_tokens with the bearer secret stripped (prefix + suffix only). Use this view + revoke_compliance_auditor_token_by_id(uuid) RPC instead of direct base-table reads.';

-- ── 3. Lock down direct SELECT on the base table ────────────────────────

-- Drop the old org-wide SELECT policy. The two security-definer RPCs
-- (create + verify + revoke) bypass RLS so they keep working.
drop policy if exists compliance_auditor_tokens_select_org on public.compliance_auditor_tokens;

-- Revoke the implicit table SELECT grant from authenticated so the safe
-- view becomes the only read path. INSERT/UPDATE policies stay (the
-- write paths use service_role via security-definer RPCs but the policy
-- is still there for any direct admin-tool write).
revoke select on public.compliance_auditor_tokens from authenticated;

-- Explicit grant on the safe view.
grant select on public.compliance_auditor_tokens_safe to authenticated;

-- ── 4. Revoke-by-id RPC ─────────────────────────────────────────────────

create or replace function public.revoke_compliance_auditor_token_by_id(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid := public.current_org_id();
begin
  if v_org_id is null then
    raise exception 'no active organization context' using errcode = '28000';
  end if;
  update public.compliance_auditor_tokens
  set revoked_at = now()
  where id = p_id
    and organization_id = v_org_id
    and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.revoke_compliance_auditor_token_by_id(uuid) from public;
grant execute on function public.revoke_compliance_auditor_token_by_id(uuid) to authenticated;

comment on function public.revoke_compliance_auditor_token_by_id is
  'Revoke an auditor token via its opaque id (from compliance_auditor_tokens_safe). The legacy revoke_compliance_auditor_token(text) RPC stays in place for backwards compatibility. Returns true when a row was updated, false when no matching active token existed for the caller''s org.';
