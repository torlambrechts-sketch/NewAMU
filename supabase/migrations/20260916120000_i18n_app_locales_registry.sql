-- i18n foundation (1/6) — global locale registry.
--
-- Closes the "no canonical list of supported app languages" gap. Locale
-- validity was previously a hard-coded CHECK (locale in ('nb','en')) duplicated
-- across profiles, the learning RPCs and handle_new_user(). This table turns
-- the supported-language set into data, not schema: activating Swedish/Danish
-- later becomes one INSERT, with no migration touching constraints.
--
-- Self-audit (Arbeidstilsynet POV): not a compliance-content migration — no
-- pålegg-grunn addressed. Pure infrastructure for the multi-language initiative.

create table if not exists public.app_locales (
  code          text primary key,
  label         text not null,
  english_label text not null default '',
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.app_locales is
  'Canonical registry of UI/content locales the app supports. Referenced by FK from profiles.locale, organizations.default_locale and every *_locales sidecar table.';
comment on column public.app_locales.code is
  'ISO-style short language code (nb, en, sv, da).';
comment on column public.app_locales.label is
  'Native-language display name shown in locale switchers.';
comment on column public.app_locales.is_active is
  'When false the locale is hidden from switchers but existing rows referencing it stay valid.';

insert into public.app_locales (code, label, english_label, sort_order) values
  ('nb', 'Norsk bokmål', 'Norwegian', 1),
  ('en', 'English',      'English',   2)
on conflict (code) do update set
  label         = excluded.label,
  english_label = excluded.english_label,
  sort_order    = excluded.sort_order;

alter table public.app_locales enable row level security;

drop policy if exists app_locales_select_all on public.app_locales;
create policy app_locales_select_all
  on public.app_locales for select
  using (true);
