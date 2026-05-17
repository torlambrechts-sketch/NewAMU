-- Shared test fixtures for the pgTAP suite. Loaded once by run.sh before
-- the numbered test files. All helpers are idempotent — re-running this
-- file against a stateful DB must not error.

create extension if not exists pgtap with schema public;

-- ---------------------------------------------------------------------------
-- setup_test_org(slug) → uuid
-- Inserts a synthetic organization (random 9-digit orgnr derived from md5
-- of the slug so the same slug yields the same row across runs) and
-- returns its id. Idempotent via on conflict.
-- ---------------------------------------------------------------------------
create or replace function public.setup_test_org(p_slug text)
returns uuid
language plpgsql
as $$
declare
  v_id     uuid;
  v_orgnr  text;
begin
  v_orgnr := lpad((abs(hashtext('pgtap:' || p_slug)) % 1000000000)::text, 9, '0');
  insert into public.organizations (organization_number, name)
  values (v_orgnr, 'pgtap:' || p_slug)
  on conflict (organization_number) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- setup_test_user(email, org_id) → uuid
-- Inserts an auth.users row (bypasses Supabase Auth — we only need the
-- FK target) and a matching public.profiles row, sets the org-id GUC so
-- current_org_id() resolves correctly in subsequent statements.
-- ---------------------------------------------------------------------------
create or replace function public.setup_test_user(p_email text, p_org_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_uid uuid;
begin
  v_uid := md5('pgtap:user:' || p_email)::uuid;

  -- auth.users is owned by the supabase_auth_admin role; the test DB
  -- has a permissive owner so a direct insert works. If running against
  -- a hardened DB, swap this for `auth.admin_create_user`.
  insert into auth.users (id, email, instance_id, aud, role)
  values (
    v_uid, p_email,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated'
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, display_name)
  values (v_uid, p_org_id, 'pgtap:' || p_email)
  on conflict (id) do update set organization_id = excluded.organization_id;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('app.current_org_id',    p_org_id::text, true);
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- assume_role(role_name) — wraps `set local role` so tests can flip
-- between `postgres`, `service_role`, `authenticated`, `anon`.
-- ---------------------------------------------------------------------------
create or replace function public.assume_role(p_role text)
returns void
language plpgsql
as $$
begin
  execute format('set local role %I', p_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- with_permission(key, user, org) — grants a permission_key to a user
-- via role_permissions. Creates an ad-hoc role per (org, key) pair so
-- granting/revoking is cheap and side-effect-free.
-- ---------------------------------------------------------------------------
create or replace function public.with_permission(
  p_key  text,
  p_user uuid,
  p_org  uuid
)
returns void
language plpgsql
as $$
declare
  v_role_id uuid;
  v_slug    text := 'pgtap-' || replace(p_key, '.', '-');
begin
  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values (p_org, v_slug, v_slug, 'pgtap fixture role', false)
  on conflict (organization_id, slug) do update set name = excluded.name
  returning id into v_role_id;

  insert into public.role_permissions (role_id, permission_key)
  values (v_role_id, p_key)
  on conflict (role_id, permission_key) do nothing;

  insert into public.user_roles (user_id, role_id)
  values (p_user, v_role_id)
  on conflict (user_id, role_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- cleanup() — drops every pgtap fixture by name prefix. Safe to call
-- from a teardown step or at the top of run.sh.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup()
returns void
language plpgsql
as $$
begin
  delete from public.user_roles ur
   using public.role_definitions rd
   where ur.role_id = rd.id and rd.slug like 'pgtap-%';
  delete from public.role_permissions rp
   using public.role_definitions rd
   where rp.role_id = rd.id and rd.slug like 'pgtap-%';
  delete from public.role_definitions where slug like 'pgtap-%';
  delete from public.profiles where display_name like 'pgtap:%';
  delete from auth.users where email like '%@pgtap.test';
  delete from public.organizations where name like 'pgtap:%';
end;
$$;
