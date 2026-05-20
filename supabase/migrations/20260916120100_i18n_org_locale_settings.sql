-- i18n foundation (2/6) — organization language settings.
--
-- Adds the org-level language layer the i18n audit found missing: a default
-- locale (drives new members' UI language and the content-resolution fallback)
-- and the set of locales a tenant exposes in its switchers. Both columns
-- default to Norwegian-only, so every existing tenant is unchanged after this
-- migration — no behaviour shift until an org opts into more languages.
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn.

alter table public.organizations
  add column if not exists default_locale text not null default 'nb';

alter table public.organizations
  add column if not exists supported_locales text[] not null default array['nb']::text[];

-- FK added separately so it is idempotent and survives re-runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_default_locale_fk'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_default_locale_fk
      foreign key (default_locale) references public.app_locales (code);
  end if;
end $$;

comment on column public.organizations.default_locale is
  'Org default UI/content language; the org-level link in the locale resolution chain (requested -> org default -> row default -> nb).';
comment on column public.organizations.supported_locales is
  'Locales this tenant exposes to its users in switchers. Every entry must exist in app_locales.';
