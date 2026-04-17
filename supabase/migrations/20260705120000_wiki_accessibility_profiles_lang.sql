-- WCAG-related: profile reading preferences + wiki page language.

alter table public.profiles
  add column if not exists doc_font_size text not null default 'normal'
    check (doc_font_size in ('normal', 'large', 'xlarge')),
  add column if not exists doc_high_contrast boolean not null default false;

comment on column public.profiles.doc_font_size is 'Documents module base font scale: normal | large | xlarge.';
comment on column public.profiles.doc_high_contrast is 'When true, documents UI applies stronger contrast (client filter).';

alter table public.wiki_pages
  add column if not exists lang text not null default 'nb';

alter table public.wiki_pages
  drop constraint if exists wiki_pages_lang_check;

alter table public.wiki_pages
  add constraint wiki_pages_lang_check check (lang in ('nb', 'nn', 'en'));

comment on column public.wiki_pages.lang is 'Primary language of page content (Bokmål, Nynorsk, English).';

alter table public.wiki_page_versions
  add column if not exists lang text;

alter table public.wiki_page_versions
  drop constraint if exists wiki_page_versions_lang_check;

alter table public.wiki_page_versions
  add constraint wiki_page_versions_lang_check check (lang is null or lang in ('nb', 'nn', 'en'));
