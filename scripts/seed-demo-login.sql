-- Reproducible demo login for E2E verification (run manually against a dev DB,
-- e.g. via the Supabase SQL editor). NOT placed in supabase/migrations so it
-- never auto-seeds a known-password admin into production.
--
-- Creates demo@klarert.app / DemoStrategy!2026 as an org admin of
-- "Pundit Invest AS" (the org carrying the seeded Strategy v2 worked data).
-- Idempotent. Note the empty-string token columns: GoTrue cannot scan NULL.
do $$
declare
  v_uid uuid := 'd3000000-0000-4000-a000-000000000001';
  v_org uuid := (select id from public.organizations where name = 'Pundit Invest AS' limit 1);
  v_email text := 'demo@klarert.app';
  v_pwd text := 'DemoStrategy!2026';
begin
  if v_org is null then raise notice 'Pundit Invest AS not found; aborting'; return; end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pwd, extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Demo Strateg"}'::jsonb,
    '', '', '', '', '', '', '', ''
  )
  on conflict (id) do update set
    encrypted_password = excluded.encrypted_password, email_confirmed_at = now(), updated_at = now();

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now())
  on conflict do nothing;

  insert into public.profiles (id, organization_id, display_name, email, is_org_admin)
  values (v_uid, v_org, 'Demo Strateg', v_email, true)
  on conflict (id) do update set organization_id = excluded.organization_id, is_org_admin = true;

  insert into public.organization_members (id, organization_id, display_name, email)
  values (v_uid, v_org, 'Demo Strateg', v_email) on conflict do nothing;
end $$;
