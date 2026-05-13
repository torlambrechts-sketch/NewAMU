-- Auditor tokens — signed, scoped, read-only access for external
-- inspectors / auditors who don't have a tenant account.
--
-- Pattern: a row in workflow_auditor_tokens carries
--   * token_hash    — sha256 of the actual token (never stored plain)
--   * scope_filter  — { date_from, date_to, law_refs[], frameworks[] }
--                     applied at query time so the auditor can ONLY see
--                     the slice they were granted
--   * expires_at    — hard expiry
--   * revoked_at    — soft kill switch
--
-- The actual token is returned to the org admin once, who shares it with
-- the auditor (URL: /auditor/workflows?token=…). The auditor view edge
-- function checks the hash, applies the scope_filter, returns read-only
-- run + evidence rows for that slice.
--
-- Mirrors the auditor-token pattern named in specs/compliance-planner.md.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 18-7 — inspektør skal kunne
--   gjennomgå dokumentasjon på stedet. Personvern: minimaliserer ved å
--   scope-filtrere; auditor ser kun nødvendig dokumentasjon, ikke hele
--   loggen.
--   Restrisiko deferred: MFA på auditor-pålogging (Phase E sprint-3).

create extension if not exists pgcrypto with schema public;

create table if not exists public.workflow_auditor_tokens (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token_hash      text not null unique,
  label           text not null,                      -- human-readable: "Arbeidstilsynet Q1 2026"
  scope_filter    jsonb not null default '{}'::jsonb, -- { date_from, date_to, law_refs[], frameworks[] }
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  use_count       int not null default 0,
  metadata        jsonb not null default '{}'::jsonb
);

create index if not exists workflow_auditor_tokens_org_idx
  on public.workflow_auditor_tokens (organization_id, expires_at desc);

create index if not exists workflow_auditor_tokens_hash_idx
  on public.workflow_auditor_tokens (token_hash) where revoked_at is null;

alter table public.workflow_auditor_tokens enable row level security;

drop policy if exists "workflow_auditor_tokens_select_org" on public.workflow_auditor_tokens;
create policy "workflow_auditor_tokens_select_org"
  on public.workflow_auditor_tokens for select
  using (organization_id = public.current_org_id());

drop policy if exists "workflow_auditor_tokens_manage" on public.workflow_auditor_tokens;
create policy "workflow_auditor_tokens_manage"
  on public.workflow_auditor_tokens for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

-- Mint a new token. Returns BOTH the row id and the plain token so the
-- caller can show it to the user exactly once. After that the token is
-- only checkable via its hash.
create or replace function public.workflow_mint_auditor_token(
  p_organization_id uuid,
  p_label           text,
  p_scope_filter    jsonb default '{}'::jsonb,
  p_expires_in_days int   default 30
)
returns table (
  id    uuid,
  token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token  text;
  v_hash   text;
  v_id     uuid;
begin
  if not (public.is_org_admin() or public.user_has_permission('workflows.manage')) then
    raise exception 'workflow_mint_auditor_token: org_admin or workflows.manage required';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_organization_id then
    raise exception 'cross-org token mint denied';
  end if;

  -- 32 random bytes, base64url-encoded (≈ 43 chars). Enough entropy.
  v_token := encode(public.gen_random_bytes(32), 'base64');
  v_token := translate(v_token, '+/=', '-_'); -- to base64url-ish
  v_hash  := encode(public.digest(v_token, 'sha256'), 'hex');

  insert into public.workflow_auditor_tokens
    (organization_id, token_hash, label, scope_filter, expires_at, created_by)
  values
    (p_organization_id, v_hash, p_label, coalesce(p_scope_filter, '{}'::jsonb),
     now() + make_interval(days => p_expires_in_days), auth.uid())
  returning workflow_auditor_tokens.id into v_id;

  id := v_id;
  token := v_token;
  return next;
end;
$$;

grant execute on function public.workflow_mint_auditor_token(uuid, text, jsonb, int) to authenticated;

-- Verify a token (service-role only). Returns the token row + bumps
-- last_used_at / use_count. Returns null if invalid / expired / revoked.
create or replace function public.workflow_verify_auditor_token(p_token text)
returns table (
  id              uuid,
  organization_id uuid,
  label           text,
  scope_filter    jsonb,
  expires_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if current_user not in ('service_role','supabase_admin','postgres') then
    raise exception 'workflow_verify_auditor_token: caller must be service_role';
  end if;
  v_hash := encode(public.digest(p_token, 'sha256'), 'hex');

  update public.workflow_auditor_tokens
     set last_used_at = now(),
         use_count = use_count + 1
   where token_hash = v_hash
     and revoked_at is null
     and expires_at > now()
   returning
     workflow_auditor_tokens.id,
     workflow_auditor_tokens.organization_id,
     workflow_auditor_tokens.label,
     workflow_auditor_tokens.scope_filter,
     workflow_auditor_tokens.expires_at
   into id, organization_id, label, scope_filter, expires_at;

  if id is null then
    return;
  end if;
  return next;
end;
$$;

revoke all on function public.workflow_verify_auditor_token(text) from public;
grant execute on function public.workflow_verify_auditor_token(text) to service_role;

create or replace function public.workflow_revoke_auditor_token(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_org_admin() or public.user_has_permission('workflows.manage')) then
    raise exception 'workflow_revoke_auditor_token: org_admin or workflows.manage required';
  end if;
  update public.workflow_auditor_tokens
     set revoked_at = now()
   where id = p_id
     and organization_id = public.current_org_id();
end;
$$;

grant execute on function public.workflow_revoke_auditor_token(uuid) to authenticated;

comment on table public.workflow_auditor_tokens is
  'Signed scoped read-only tokens for external auditors. Token plaintext returned only at mint time; stored as sha256 hash. Scope filter applied at query time via the auditor view edge function.';
