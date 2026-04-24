-- Access requests when a user lacks folder/document access (workflow for admins).

create table if not exists public.wiki_document_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource_type text not null check (resource_type in ('folder', 'document')),
  space_id text not null references public.wiki_spaces (id) on delete cascade,
  page_id text null references public.wiki_pages (id) on delete set null,
  title text not null,
  requester_id uuid not null references auth.users (id) on delete cascade,
  requester_name text not null,
  justification text not null,
  access_scope text not null default 'read' check (access_scope in ('read', 'edit')),
  duration text not null default 'session' check (duration in ('session', '7d', '30d', 'permanent')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewer_id uuid null references auth.users (id) on delete set null,
  reviewed_at timestamptz null,
  admin_note text null,
  created_at timestamptz not null default now()
);

create index if not exists wiki_doc_access_req_org_idx on public.wiki_document_access_requests (organization_id);
create index if not exists wiki_doc_access_req_org_status_idx on public.wiki_document_access_requests (organization_id, status);
create index if not exists wiki_doc_access_req_requester_idx on public.wiki_document_access_requests (requester_id);

comment on table public.wiki_document_access_requests is
  'Users request access to restricted wiki folders or documents; administrators review in Innstillinger.';

alter table public.wiki_document_access_requests enable row level security;

drop policy if exists "wiki_doc_access_req_select" on public.wiki_document_access_requests;
create policy "wiki_doc_access_req_select"
  on public.wiki_document_access_requests for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      requester_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  );

drop policy if exists "wiki_doc_access_req_insert" on public.wiki_document_access_requests;
create policy "wiki_doc_access_req_insert"
  on public.wiki_document_access_requests for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and requester_id = auth.uid()
  );

drop policy if exists "wiki_doc_access_req_update" on public.wiki_document_access_requests;
create policy "wiki_doc_access_req_update"
  on public.wiki_document_access_requests for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      (
        requester_id = auth.uid()
        and status = 'pending'
      )
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
      or public.user_has_permission('documents.edit')
    )
  )
  with check (organization_id = public.current_org_id());

drop policy if exists "wiki_doc_access_req_delete" on public.wiki_document_access_requests;
create policy "wiki_doc_access_req_delete"
  on public.wiki_document_access_requests for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      (requester_id = auth.uid() and status = 'pending')
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  );

-- Minimal metadata for access-request form when wiki_pages SELECT is denied (same org only).
create or replace function public.wiki_page_access_request_meta(p_page_id text)
returns table (space_id text, title text)
language sql
stable
security definer
set search_path = public
as $$
  select p.space_id::text, p.title::text
  from public.wiki_pages p
  where p.id = p_page_id
    and p.organization_id = public.current_org_id()
  limit 1;
$$;

revoke all on function public.wiki_page_access_request_meta(text) from public;
grant execute on function public.wiki_page_access_request_meta(text) to authenticated;
