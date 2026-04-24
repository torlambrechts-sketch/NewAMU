-- Prefer full_name from signup metadata, then display_name, for profiles.display_name

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1),
      'Bruker'
    ),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(
      nullif(trim(excluded.display_name), ''),
      nullif(trim(profiles.display_name), ''),
      profiles.display_name
    );
  return new;
end;
$$;
