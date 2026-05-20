-- i18n foundation (6/6) — server-side locale resolution helper.
--
-- Single canonical implementation of the locale fallback contract so every
-- module and edge function resolves identically (the learning module today
-- hand-rolls a double LEFT JOIN with a hard-coded ('nb','en') whitelist).
--
-- Contract: resolve_locale(requested, row_default) returns the first ACTIVE
-- app_locale among [requested, row_default], else 'nb'. Callers join their
-- `<table>_locales` table on this code and coalesce to the row default for
-- columns that lack a translation. The org-default link in the chain is
-- applied by the caller (it passes the org default as `requested` when the
-- user has no explicit preference).
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn.

create or replace function public.resolve_locale(
  p_requested   text,
  p_row_default text default 'nb'
)
returns text
language sql
stable
as $$
  select coalesce(
    (select code from public.app_locales where code = p_requested   and is_active),
    (select code from public.app_locales where code = p_row_default and is_active),
    'nb'
  );
$$;

comment on function public.resolve_locale(text, text) is
  'Locale resolution helper: first active app_locale among the requested locale and the row default, else nb. Server-side counterpart to the frontend locale picker.';

grant execute on function public.resolve_locale(text, text) to authenticated;
grant execute on function public.resolve_locale(text, text) to service_role;
