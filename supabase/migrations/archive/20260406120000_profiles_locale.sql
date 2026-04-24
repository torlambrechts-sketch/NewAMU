-- UI locale preference (database-driven; extend app i18n to match).

alter table public.profiles
  add column if not exists locale text not null default 'nb';

-- Allow only known app locales; add new values when the app supports more languages.
alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('nb', 'en'));

comment on column public.profiles.locale is 'Preferred UI language (ISO-style short code: nb, en).';

-- New signups: optional locale from auth metadata
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
  if meta_locale is not null and meta_locale not in ('nb', 'en') then
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
