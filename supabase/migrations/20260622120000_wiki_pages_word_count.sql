-- Approximate word count from JSON blocks (text fields only; ignores structure).

alter table public.wiki_pages
  add column if not exists word_count int
  generated always as (
    case
      when blocks is null then 0
      else greatest(
        0,
        (
          length(
            regexp_replace(blocks::text, '<[^>]+>|[^a-zA-ZÆØÅæøå0-9 ]', ' ', 'g')
          )
          - length(
            replace(
              regexp_replace(blocks::text, '<[^>]+>|[^a-zA-ZÆØÅæøå0-9 ]', ' ', 'g'),
              ' ',
              ''
            )
          )
        )
      )
    end
  ) stored;

comment on column public.wiki_pages.word_count is
  'Generated: approximate word count from blocks JSON (letters/digits/Nordic letters, space-separated).';
