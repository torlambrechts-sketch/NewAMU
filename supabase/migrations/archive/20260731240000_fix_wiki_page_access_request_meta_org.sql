-- wiki_page_access_request_meta used current_org_id() inside SECURITY DEFINER.
-- In that context the session org is often unset, so the function returned no rows
-- and the app could not show the access-request flow for deep-linked editors.

-- Remove old 1-arg and any prior 2-arg signature (idempotent).
drop function if exists public.wiki_page_access_request_meta(text);
drop function if exists public.wiki_page_access_request_meta(text, uuid);

create or replace function public.wiki_page_access_request_meta(
  p_page_id text,
  p_organization_id uuid default null
)
returns table (space_id text, title text)
language sql
stable
security definer
set search_path = public
as $$
  with resolved_org as (
    select coalesce(
      p_organization_id,
      (select pr.organization_id from public.profiles pr where pr.id = auth.uid() limit 1)
    ) as org_id
  )
  select p.space_id::text, p.title::text
  from public.wiki_pages p
  cross join resolved_org ro
  where p.id = p_page_id
    and ro.org_id is not null
    and p.organization_id = ro.org_id
  limit 1;
$$;

revoke all on function public.wiki_page_access_request_meta(text, uuid) from public;
grant execute on function public.wiki_page_access_request_meta(text, uuid) to authenticated;
