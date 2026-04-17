-- Full-text search (Norwegian), manual ordering, pinned pages on home

alter table public.wiki_pages
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'norwegian',
      coalesce(title, '') || ' ' || coalesce(summary, '')
    )
  ) stored;

create index if not exists wiki_pages_search_idx
  on public.wiki_pages using gin (search_vector);

alter table public.wiki_pages
  add column if not exists sort_order int not null default 0;

alter table public.wiki_pages
  add column if not exists is_pinned boolean not null default false;

create index if not exists wiki_pages_space_sort_idx
  on public.wiki_pages (organization_id, space_id, sort_order);

create index if not exists wiki_pages_org_pinned_idx
  on public.wiki_pages (organization_id, is_pinned)
  where is_pinned = true;

comment on column public.wiki_pages.search_vector is 'Generated: Norwegian FTS on title + summary.';
comment on column public.wiki_pages.sort_order is 'Manual ordering within a space (lower first).';
comment on column public.wiki_pages.is_pinned is 'Pinned pages appear on documents home.';
