-- Full-text search for wiki pages (title, summary, block text as plain text).
-- SECURITY INVOKER on search RPC so existing wiki_pages RLS applies.

alter table public.wiki_pages
  add column if not exists search_blocks_plain text
  generated always as (
    regexp_replace(
      regexp_replace(coalesce(blocks::text, ''), '<[^>]+>', ' ', 'g'),
      '\s+',
      ' ',
      'g'
    )
  ) stored;

alter table public.wiki_pages
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'norwegian',
      coalesce(title, '')
        || ' '
        || coalesce(summary, '')
        || ' '
        || coalesce(search_blocks_plain, '')
    )
  ) stored;

create index if not exists wiki_pages_search_vector_idx
  on public.wiki_pages using gin (search_vector);

create index if not exists wiki_pages_org_search_idx
  on public.wiki_pages (organization_id);

drop function if exists public.search_wiki_pages(uuid, text, int);

create or replace function public.search_wiki_pages(
  p_organization_id uuid,
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  status text,
  space_id uuid,
  updated_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.summary,
    p.status::text,
    p.space_id,
    p.updated_at,
    ts_rank(p.search_vector, websearch_to_tsquery('norwegian', p_query))::real as rank
  from public.wiki_pages p
  where p.organization_id = p_organization_id
    and length(trim(p_query)) >= 2
    and p.search_vector @@ websearch_to_tsquery('norwegian', p_query)
  order by rank desc, p.updated_at desc
  limit greatest(1, least(p_limit, 50));
$$;

grant execute on function public.search_wiki_pages(uuid, text, int) to authenticated;
