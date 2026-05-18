-- Auditor token snapshot mechanism for Internkontroll.
--
-- Spec §5.3 calls for a signed-URL share that lets an external revisor
-- view a frozen snapshot of the gap matrix + plan items without
-- creating a user account. This migration ships the minimum viable
-- substrate: a table, two security-definer RPCs (create + verify), and
-- the RLS+grant plumbing that keeps direct table reads locked down so
-- all access happens through the verify RPC.
--
-- Design choice — snapshot-in-token (not live-query):
--  - When the admin clicks "Del med revisor", the client posts the
--    currently-rendered datasets + layout (the snapshot) to the
--    create RPC, which stores them on the token row.
--  - The verify RPC returns the stored snapshot + layout.
--  - Auditor always sees the state at share-time; the org can keep
--    iterating without leaking new data, and revocation is just
--    setting revoked_at.
--
-- Defaults:
--  - 30-day expiry (overridable per call, max 365 days at RPC level).
--  - One token per (org, framework) is fine; share by re-creating to
--    refresh the snapshot.
--
-- Self-revisjon (Datatilsynet + Arbeidstilsynet POV):
--  - GDPR Art. 32: token-URLer er kryptografisk uforutsigbare
--    (gen_random_bytes 24 bytes / base64url). Revokerbare når som helst.
--  - IK-f § 5 nr. 7: revisor-visning er et "tilsynsbevis" — frozen
--    snapshot sikrer at det er nøyaktig det orgen viste på dato X.
-- Restrisiko:
--  - Token-listing for admin (slik at man ser hvilke tokens som er
--    aktive) er en oppfølgings-PR. v1 admin må huske / regenerere.

set local search_path = public, pg_catalog;

-- ── 1. Schema ───────────────────────────────────────────────────────────

create table if not exists public.compliance_auditor_tokens (
  token            text primary key,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  framework_id     text not null,
  scope_label      text not null,
  snapshot         jsonb not null,
  layout           jsonb not null,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  revoked_at       timestamptz
);

create index if not exists compliance_auditor_tokens_org_idx
  on public.compliance_auditor_tokens (organization_id, expires_at)
  where revoked_at is null;

comment on table public.compliance_auditor_tokens is
  'Time-bound, revocable share-tokens that grant an external auditor a frozen view of the internkontroll gap matrix. Direct reads are locked; access happens through compliance_auditor_token_verify().';

alter table public.compliance_auditor_tokens enable row level security;

-- Read policy: only the creating org's admins can see their own tokens.
-- Anonymous access is *not* granted on the table; the verify RPC reads
-- as security definer.
drop policy if exists compliance_auditor_tokens_select_org on public.compliance_auditor_tokens;
create policy compliance_auditor_tokens_select_org
  on public.compliance_auditor_tokens for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists compliance_auditor_tokens_write_org on public.compliance_auditor_tokens;
create policy compliance_auditor_tokens_write_org
  on public.compliance_auditor_tokens for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ── 2. RPC: create token ────────────────────────────────────────────────

create or replace function public.create_compliance_auditor_token(
  p_framework_id text,
  p_scope_label  text,
  p_snapshot     jsonb,
  p_layout       jsonb,
  p_expires_in_days int default 30
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid := public.current_org_id();
  v_token  text;
  v_expires int := least(greatest(coalesce(p_expires_in_days, 30), 1), 365);
begin
  if v_org_id is null then
    raise exception 'no active organization context' using errcode = '28000';
  end if;
  if p_framework_id is null or trim(p_framework_id) = '' then
    raise exception 'framework_id required' using errcode = '22023';
  end if;
  if p_snapshot is null or p_layout is null then
    raise exception 'snapshot and layout required' using errcode = '22023';
  end if;

  -- 24-byte cryptographically-random token, base64url-encoded → 32 chars.
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.compliance_auditor_tokens (
    token, organization_id, framework_id, scope_label,
    snapshot, layout, created_by, expires_at
  ) values (
    v_token, v_org_id, p_framework_id, p_scope_label,
    p_snapshot, p_layout, auth.uid(),
    now() + (v_expires::text || ' days')::interval
  );

  return v_token;
end;
$$;

revoke all on function public.create_compliance_auditor_token(text, text, jsonb, jsonb, int) from public;
grant execute on function public.create_compliance_auditor_token(text, text, jsonb, jsonb, int) to authenticated;

comment on function public.create_compliance_auditor_token is
  'Mint a time-bound auditor token bound to the current org. Returns the token string; the caller composes the share URL.';

-- ── 3. RPC: verify token (anon-callable) ────────────────────────────────

create or replace function public.compliance_auditor_token_verify(p_token text)
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
  limit 1;
end;
$$;

revoke all on function public.compliance_auditor_token_verify(text) from public;
grant execute on function public.compliance_auditor_token_verify(text) to anon, authenticated;

comment on function public.compliance_auditor_token_verify is
  'Resolve an auditor token to its frozen snapshot. Returns no rows when the token is unknown, revoked, or expired. Anon-callable.';

-- ── 4. RPC: revoke token ────────────────────────────────────────────────

create or replace function public.revoke_compliance_auditor_token(p_token text)
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
  where token = p_token
    and organization_id = v_org_id
    and revoked_at is null;
  return found;
end;
$$;

revoke all on function public.revoke_compliance_auditor_token(text) from public;
grant execute on function public.revoke_compliance_auditor_token(text) to authenticated;
