-- Per-grant capability flags for folder RBAC (read / write / archive, etc.).
-- Existing rows become read-only at grant level (can_read true, other flags false),
-- matching prior behaviour where grants only gated SELECT on wiki_pages.

alter table public.wiki_space_access_grants
  add column if not exists can_read boolean not null default true;

alter table public.wiki_space_access_grants
  add column if not exists can_create boolean not null default false;

alter table public.wiki_space_access_grants
  add column if not exists can_write boolean not null default false;

alter table public.wiki_space_access_grants
  add column if not exists can_archive boolean not null default false;

alter table public.wiki_space_access_grants
  add column if not exists can_delete boolean not null default false;

comment on column public.wiki_space_access_grants.can_read is
  'When true, this grant contributes to viewing pages in the folder (client + future RLS).';
comment on column public.wiki_space_access_grants.can_write is
  'When true, this grant contributes to editing pages in the folder (application-level gate).';
comment on column public.wiki_space_access_grants.can_archive is
  'When true, this grant contributes to archiving pages in the folder (application-level gate).';
