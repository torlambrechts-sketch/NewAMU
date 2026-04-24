-- Profile: optional contact fields + avatar URL; storage for user avatars (public read, own-folder write).

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists job_title text;

comment on column public.profiles.avatar_url is 'Public URL to avatar in profile_avatars bucket (or external HTTPS URL).';
comment on column public.profiles.phone is 'Optional work phone for directory display.';
comment on column public.profiles.job_title is 'Optional job title override for UI.';

insert into storage.buckets (id, name, public)
values ('profile_avatars', 'profile_avatars', true)
on conflict (id) do nothing;

-- Authenticated users may upload/update/delete only under their user id folder
drop policy if exists "profile_avatars_insert_own" on storage.objects;
create policy "profile_avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'profile_avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_avatars_update_own" on storage.objects;
create policy "profile_avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'profile_avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_avatars_delete_own" on storage.objects;
create policy "profile_avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'profile_avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (URLs are unguessable; folder still scoped on write)
drop policy if exists "profile_avatars_select_public" on storage.objects;
create policy "profile_avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'profile_avatars');
