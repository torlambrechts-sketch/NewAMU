-- i18n — locale RPCs (closes ROADMAP §9.7, partial).
--
-- 1. set_profile_locale(p_locale): the canonical way for a logged-in user to
--    change their interface language. The audit found no update RPC existed —
--    the in-app locale switcher could only change i18next for the session, it
--    never persisted to profiles.locale, so the choice was lost on the next
--    device/login. The frontend switcher now calls this RPC.
--
-- 2. handle_new_user(): the signup trigger hard-coded a ('nb','en') whitelist
--    for the locale from auth metadata. Widened to validate against the
--    app_locales registry so Swedish/Danish signups are accepted once those
--    locales are activated — no further change to this trigger needed.
--
-- The provisioning RPCs (provision_*_baseline_for_org) gaining a p_locale
-- parameter is the remaining §9.7 work — deferred to its own PR; they copy
-- the nb system content today, which is the correct default.
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn.

-- ── 1. set_profile_locale ───────────────────────────────────────────────────
create or replace function public.set_profile_locale(p_locale text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'set_profile_locale: not authenticated';
  end if;
  if not exists (
    select 1 from public.app_locales where code = p_locale and is_active
  ) then
    raise exception 'set_profile_locale: unknown or inactive locale %', p_locale;
  end if;
  update public.profiles set locale = p_locale where id = v_uid;
  return p_locale;
end;
$$;

comment on function public.set_profile_locale(text) is
  'Persists the calling user''s preferred UI language to profiles.locale. Validates against app_locales. Called by the in-app locale switcher.';

grant execute on function public.set_profile_locale(text) to authenticated;

-- ── 2. handle_new_user — widen the locale whitelist to app_locales ──────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_locale text;
begin
  meta_locale := nullif(lower(trim(coalesce(new.raw_user_meta_data->>'locale', ''))), '');
  if meta_locale is not null and not exists (
    select 1 from public.app_locales where code = meta_locale and is_active
  ) then
    meta_locale := null;
  end if;

  insert into public.profiles (id, display_name, email, locale)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1),
      'Bruker'
    ),
    new.email,
    coalesce(meta_locale, 'nb')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(
      nullif(trim(excluded.display_name), ''),
      nullif(trim(profiles.display_name), ''),
      profiles.display_name
    ),
    locale = coalesce(excluded.locale, profiles.locale);
  return new;
end;
$$;
