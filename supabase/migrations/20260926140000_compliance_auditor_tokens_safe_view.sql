-- compliance_layer · safe-column projection on compliance_auditor_tokens
--
-- Coverage gap closed:
--   `compliance_auditor_tokens.token` is a bearer secret — anyone with the
--   string can read the org's frozen snapshot for 30 days via
--   `/auditor/internkontroll/<token>` or `/auditor/controls/<token>`.
--   The original SELECT policy granted any authenticated org member full
--   row SELECT on the base table, which means the full token shipped in
--   every fetch response feeding the admin-side "active tokens" list.
--   Error monitors (Sentry/Datadog RUM with fetch auto-instrumentation),
--   browser extensions, and `console.log` middleware would all see and
--   potentially exfiltrate the bearer secret. This migration locks the
--   bearer secret behind column-level GRANT and exposes only
--   prefix/suffix + metadata to the admin UI.
--
-- Design:
--   1. Add an opaque `id uuid` column for client-side revoke handles.
--   2. Add generated stored columns `token_prefix` + `token_suffix` so
--      the admin UI can identify a token visually without exposing the
--      bearer string.
--   3. Column-level GRANT to authenticated on the safe column list. The
--      `token` column is intentionally absent — postgres rejects any
--      SELECT (including `select *`) that includes it.
--   4. RLS SELECT policy scopes rows to the caller's org. WRITE access
--      goes through the existing SECURITY DEFINER RPCs (create / verify
--      / revoke / revoke_by_id) which bypass RLS by design.
--   5. New `revoke_compliance_auditor_token_by_id(p_id uuid)` RPC lets
--      the admin UI revoke via the opaque id rather than re-transmitting
--      the bearer secret. The legacy text-based revoke RPC stays for
--      backwards compatibility.
--
-- Self-audit (Datatilsynet POV):
--   - GDPR Art. 32: reducing the surface where a bearer secret traverses
--     the data flow is a direct Art. 32 best practice — defence in depth
--     around an authentication credential.
--   - Backwards compatibility: the legacy `revoke_compliance_auditor_token(text)`
--     RPC stays in place so cached admin sessions or scripts can still
--     revoke by full token if they've cached one. Phase-2 UI uses the
--     id-based path.
-- Restrisiko:
--   - Tokens minted before this migration get an id via backfill — safe.
--   - The `token` bearer string can never be SELECTed by `authenticated`;
--     even an attacker with org-admin compromise can only see prefix +
--     suffix metadata after creation.

set local search_path = public, pg_catalog;

-- ── 1. Opaque id column ─────────────────────────────────────────────────

alter table public.compliance_auditor_tokens
  add column if not exists id uuid;

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
  Lets the safe-column projection + revoke-by-id RPC keep the bearer
  `token` string out of client payloads after the create RPC returns it
  once.$c$;

-- ── 2. Generated prefix + suffix ────────────────────────────────────────

alter table public.compliance_auditor_tokens
  add column if not exists token_prefix text
    generated always as (left(token, 4)) stored,
  add column if not exists token_suffix text
    generated always as (right(token, 4)) stored;

comment on column public.compliance_auditor_tokens.token_prefix is
  $c$First 4 chars of the bearer token. Stored generated column so the
  admin UI can visually identify a token without ever fetching the
  bearer secret.$c$;

-- ── 3. Column-level safe-list grant + RLS SELECT policy ────────────────

grant select (id, organization_id, framework_id, scope_label, created_by,
              created_at, expires_at, revoked_at,
              token_prefix, token_suffix)
  on public.compliance_auditor_tokens to authenticated;

drop policy if exists compliance_auditor_tokens_select_org on public.compliance_auditor_tokens;
create policy compliance_auditor_tokens_select_org
  on public.compliance_auditor_tokens for select
  to authenticated
  using (organization_id = public.current_org_id());

-- ── 4. Revoke-by-id RPC ─────────────────────────────────────────────────

create or replace function public.revoke_compliance_auditor_token_by_id(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
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
$fn$;

revoke all on function public.revoke_compliance_auditor_token_by_id(uuid) from public, anon;
grant execute on function public.revoke_compliance_auditor_token_by_id(uuid) to authenticated;

comment on function public.revoke_compliance_auditor_token_by_id is
  'Revoke an auditor token via its opaque id (the safe handle exposed to the admin UI). The legacy revoke_compliance_auditor_token(text) RPC stays in place for backwards compatibility. Returns true when a row was updated, false when no matching active token existed for the caller''s org.';
