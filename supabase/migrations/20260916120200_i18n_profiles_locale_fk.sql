-- i18n foundation (3/6) — profiles.locale becomes an FK to app_locales.
--
-- Replaces the inline CHECK (locale in ('nb','en')) on profiles.locale with a
-- foreign key into the app_locales registry. Non-destructive: every existing
-- 'nb'/'en' value already satisfies the FK. After this, adding Swedish/Danish
-- never again touches the profiles table — it is one INSERT into app_locales.
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn.

alter table public.profiles
  drop constraint if exists profiles_locale_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_locale_fk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_fk
      foreign key (locale) references public.app_locales (code);
  end if;
end $$;

comment on column public.profiles.locale is
  'Preferred UI language; FK to app_locales(code). Drives the i18next active language for this account.';
