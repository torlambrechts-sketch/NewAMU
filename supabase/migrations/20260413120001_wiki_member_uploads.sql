-- Allow any org member to add files/URLs to wiki folders (not only documents.manage)

drop policy if exists "wiki_space_items_insert_manage" on public.wiki_space_items;

create policy "wiki_space_items_insert_member"
  on public.wiki_space_items for insert
  with check (organization_id = public.current_org_id());

drop policy if exists "wiki_space_files_insert_own_org" on storage.objects;

create policy "wiki_space_files_insert_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wiki_space_files'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
