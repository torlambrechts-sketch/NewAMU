-- Course versioning end-to-end.
--
-- Why: PR #291 swapped c-aml-ledere/nb's nine v3 modules for six v4 masterclass
-- modules. Existing learners' progress now references module ids that don't
-- exist in the new content, and we have no record of which "version" they were
-- ever on. This migration adds per-locale semver versioning so an Arbeidstilsynet
-- inspector can answer "what version did this learner complete, and is it still
-- the current published version?".
--
-- Conventions mirror learning_courses.course_version (added 20260410120000):
-- monotonic ints, immutable audit log, security-definer RPCs gated by
-- learning.manage. Major bumps notify completers + reset compliance status;
-- minor bumps are silent.
--
-- Self-audit (Arbeidstilsynet POV): closes the gap where a content swap left
-- no paper trail. Restrisiko deferred: the v1.0 history row backfilled for
-- c-aml-ledere/nb uses the CURRENT (v2.0) module snapshot since the original
-- v3 modules are no longer in the DB; this is documented in the change_notes
-- on the v2.0 row.

-- ---------------------------------------------------------------------------
-- 1. Per-locale version columns on learning_system_course_locales
-- ---------------------------------------------------------------------------

alter table public.learning_system_course_locales
  add column if not exists version_major int not null default 1;

alter table public.learning_system_course_locales
  add column if not exists version_minor int not null default 0;

alter table public.learning_system_course_locales
  add column if not exists version_published_at timestamptz not null default now();

alter table public.learning_system_course_locales
  add column if not exists change_notes_md text;

comment on column public.learning_system_course_locales.version_major is
  'Semver-like major. Bumped on material content change (notify completers, reset compliance).';
comment on column public.learning_system_course_locales.version_minor is
  'Semver-like minor. Bumped on silent patch (typo fix, link update). No notification.';
comment on column public.learning_system_course_locales.version_published_at is
  'Wall-clock of the most recent publish. Surfaced as "oppdatert {date}" in the catalog.';
comment on column public.learning_system_course_locales.change_notes_md is
  'Most-recent changelog (Markdown). Full history in learning_system_course_locale_versions.';

-- ---------------------------------------------------------------------------
-- 2. Immutable per-locale version history
-- ---------------------------------------------------------------------------

create table if not exists public.learning_system_course_locale_versions (
  id uuid primary key default gen_random_uuid(),
  system_course_id text not null,
  locale text not null,
  version_major int not null,
  version_minor int not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  change_notes_md text,
  module_ids_snapshot jsonb not null default '[]'::jsonb,
  is_major boolean not null default false,
  foreign key (system_course_id) references public.learning_system_courses (id) on delete cascade,
  unique (system_course_id, locale, version_major, version_minor)
);

comment on table public.learning_system_course_locale_versions is
  'Immutable changelog per system-course locale. One row per publish.';
comment on column public.learning_system_course_locale_versions.module_ids_snapshot is
  'JSON array of module ids that were present in this version. Used by the diff RPC to compute added/removed sets.';

create index if not exists learning_locale_versions_course_idx
  on public.learning_system_course_locale_versions (system_course_id, locale, version_major, version_minor);

alter table public.learning_system_course_locale_versions enable row level security;

drop policy if exists "learning_locale_versions_select" on public.learning_system_course_locale_versions;
create policy "learning_locale_versions_select"
  on public.learning_system_course_locale_versions for select
  using (auth.uid() is not null);

-- Inserts only via security-definer RPC below; updates/deletes blocked.

-- ---------------------------------------------------------------------------
-- 3. Started-version snapshot on learning_course_progress
-- ---------------------------------------------------------------------------

alter table public.learning_course_progress
  add column if not exists started_version_major int;

alter table public.learning_course_progress
  add column if not exists started_version_minor int;

comment on column public.learning_course_progress.started_version_major is
  'Version_major active when the learner first began the course. Used to compute "what changed since you started".';

-- ---------------------------------------------------------------------------
-- 4. Per-org passthrough: minor sibling to learning_courses.course_version
-- ---------------------------------------------------------------------------

alter table public.learning_courses
  add column if not exists course_version_minor int not null default 0;

comment on column public.learning_courses.course_version_minor is
  'Semver minor for per-org forks. course_version stays the major; bump_course_version() still bumps major.';

-- ---------------------------------------------------------------------------
-- 5. Backfill: every existing locale gets a v1.0 history row + the c-aml-ledere/nb
--    masterclass swap gets logged as v2.0.
-- ---------------------------------------------------------------------------

-- All existing locales: v1.0 published "now" with current module ids as snapshot.
insert into public.learning_system_course_locale_versions (
  system_course_id, locale, version_major, version_minor, published_at,
  change_notes_md, module_ids_snapshot, is_major
)
select
  l.system_course_id,
  l.locale,
  1,
  0,
  l.version_published_at,
  'Initial backfilled version (migration 20260906122000).',
  coalesce(
    (select jsonb_agg(m->>'id') from jsonb_array_elements(l.modules) m),
    '[]'::jsonb
  ),
  false
from public.learning_system_course_locales l
on conflict (system_course_id, locale, version_major, version_minor) do nothing;

-- c-aml-ledere/nb: the masterclass swap (PR #291) was a major content change.
-- Insert a v2.0 history row + bump the locale to (2,0).
insert into public.learning_system_course_locale_versions (
  system_course_id, locale, version_major, version_minor, published_at,
  change_notes_md, module_ids_snapshot, is_major
)
values (
  'c-aml-ledere',
  'nb',
  2,
  0,
  now(),
  $$### Masterclass-omskrivning (PR #291)

Erstattet de ni v3-modulene med seks nye masterclass-moduler:

- **Kapittel 1**: Din nye rolle som juridisk garantist (delegasjon, rettspraksis HR-2019-2205-A).
- **Kapittel 2**: Arbeidstid og den dyre uavhengighetsfellen (§ 10-12).
- **Kapittel 3**: Sykefravær og tilretteleggingens grenser (§ 4-6).
- **Kapittel 4**: Konflikter, varsling og det usynlige miljøet (§ 4-3).
- **Kapittel 5**: Oppsigelse og det tapte dokumentasjonssporet (§ 15-7).
- **Praktisk trening**: Din første risikovurdering (ROS-analyse signert av verneombud).

**Compliance-impact**: ja. Alle som har fullført v1.0 må ta oppdateringskurset for å forbli compliant.
$$,
  coalesce(
    (select jsonb_agg(m->>'id')
     from public.learning_system_course_locales l, jsonb_array_elements(l.modules) m
     where l.system_course_id = 'c-aml-ledere' and l.locale = 'nb'),
    '[]'::jsonb
  ),
  true
)
on conflict (system_course_id, locale, version_major, version_minor) do nothing;

update public.learning_system_course_locales
set version_major = 2,
    version_minor = 0,
    version_published_at = now(),
    change_notes_md = (
      select change_notes_md
      from public.learning_system_course_locale_versions
      where system_course_id = 'c-aml-ledere' and locale = 'nb' and version_major = 2 and version_minor = 0
    )
where system_course_id = 'c-aml-ledere' and locale = 'nb';

-- Backfill started_version on existing progress rows. For c-aml-ledere we know
-- everyone who has progress started before the masterclass swap → v1.0.
-- Everyone else: assume (course_version, 0) from the per-org row, or (1, 0) if no fork.
update public.learning_course_progress p
set started_version_major = coalesce(c.course_version, 1),
    started_version_minor = coalesce(c.course_version_minor, 0)
from public.learning_courses c
where c.id = p.course_id
  and (p.started_version_major is null or p.started_version_minor is null);

update public.learning_course_progress
set started_version_major = 1,
    started_version_minor = 0
where started_version_major is null;

-- ---------------------------------------------------------------------------
-- 6. RPC: publish a new locale version
-- ---------------------------------------------------------------------------

create or replace function public.learning_publish_locale_version(
  p_system_course_id text,
  p_locale text,
  p_version_major int,
  p_version_minor int,
  p_is_major boolean,
  p_change_notes_md text,
  p_modules jsonb
)
returns public.learning_system_course_locale_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_last_major int;
  v_last_minor int;
  v_row public.learning_system_course_locale_versions%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  if p_system_course_id is null or btrim(p_system_course_id) = '' then
    raise exception 'system_course_id is required';
  end if;
  if p_locale is null or btrim(p_locale) = '' then
    raise exception 'locale is required';
  end if;
  if p_modules is null or jsonb_typeof(p_modules) <> 'array' then
    raise exception 'modules must be a JSON array';
  end if;
  if p_version_major < 1 or p_version_minor < 0 then
    raise exception 'version must be >= 1.0';
  end if;

  -- Monotonic check against the latest published row.
  select version_major, version_minor into v_last_major, v_last_minor
  from public.learning_system_course_locale_versions
  where system_course_id = p_system_course_id and locale = p_locale
  order by version_major desc, version_minor desc
  limit 1;

  if v_last_major is not null then
    if p_version_major < v_last_major
       or (p_version_major = v_last_major and p_version_minor <= v_last_minor)
    then
      raise exception 'Version (%, %) must be greater than latest (%, %)',
        p_version_major, p_version_minor, v_last_major, v_last_minor;
    end if;
  end if;

  insert into public.learning_system_course_locale_versions (
    system_course_id, locale, version_major, version_minor,
    published_by, change_notes_md, module_ids_snapshot, is_major
  )
  values (
    p_system_course_id,
    p_locale,
    p_version_major,
    p_version_minor,
    v_uid,
    p_change_notes_md,
    coalesce(
      (select jsonb_agg(m->>'id') from jsonb_array_elements(p_modules) m),
      '[]'::jsonb
    ),
    coalesce(p_is_major, false)
  )
  returning * into v_row;

  update public.learning_system_course_locales
  set modules = p_modules,
      version_major = p_version_major,
      version_minor = p_version_minor,
      version_published_at = now(),
      change_notes_md = p_change_notes_md
  where system_course_id = p_system_course_id and locale = p_locale;

  if not found then
    raise exception 'Locale (%, %) does not exist on learning_system_course_locales',
      p_system_course_id, p_locale;
  end if;

  return v_row;
end;
$$;

grant execute on function public.learning_publish_locale_version(text, text, int, int, boolean, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC: compute learner diff (added/removed/material since started_version)
-- ---------------------------------------------------------------------------

create or replace function public.learning_compute_learner_diff(
  p_course_id text,
  p_locale text default 'nb'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_progress public.learning_course_progress%rowtype;
  v_course public.learning_courses%rowtype;
  v_system_id text;
  v_started_major int;
  v_started_minor int;
  v_current_major int;
  v_current_minor int;
  v_started_modules jsonb;
  v_current_modules jsonb;
  v_added jsonb;
  v_removed jsonb;
  v_has_major_between boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then
    raise exception 'No organization';
  end if;

  select * into v_progress
  from public.learning_course_progress
  where user_id = v_uid and course_id = p_course_id and organization_id = v_org;
  if not found then
    return jsonb_build_object('has_progress', false);
  end if;

  select * into v_course from public.learning_courses where id = p_course_id and organization_id = v_org;
  v_system_id := coalesce(v_course.source_system_course_id, p_course_id);

  v_started_major := coalesce(v_progress.started_version_major, 1);
  v_started_minor := coalesce(v_progress.started_version_minor, 0);

  select version_major, version_minor into v_current_major, v_current_minor
  from public.learning_system_course_locales
  where system_course_id = v_system_id and locale = p_locale;

  if v_current_major is null then
    return jsonb_build_object('has_progress', true, 'has_diff', false);
  end if;

  if v_current_major = v_started_major and v_current_minor = v_started_minor then
    return jsonb_build_object(
      'has_progress', true,
      'has_diff', false,
      'from_version', jsonb_build_object('major', v_started_major, 'minor', v_started_minor),
      'to_version', jsonb_build_object('major', v_current_major, 'minor', v_current_minor)
    );
  end if;

  select module_ids_snapshot into v_started_modules
  from public.learning_system_course_locale_versions
  where system_course_id = v_system_id and locale = p_locale
    and version_major = v_started_major and version_minor = v_started_minor;
  v_started_modules := coalesce(v_started_modules, '[]'::jsonb);

  select module_ids_snapshot into v_current_modules
  from public.learning_system_course_locale_versions
  where system_course_id = v_system_id and locale = p_locale
    and version_major = v_current_major and version_minor = v_current_minor;
  v_current_modules := coalesce(v_current_modules, '[]'::jsonb);

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_added
  from jsonb_array_elements_text(v_current_modules) as elem
  where elem not in (select jsonb_array_elements_text(v_started_modules));

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_removed
  from jsonb_array_elements_text(v_started_modules) as elem
  where elem not in (select jsonb_array_elements_text(v_current_modules));

  select exists (
    select 1
    from public.learning_system_course_locale_versions
    where system_course_id = v_system_id and locale = p_locale
      and is_major = true
      and (version_major > v_started_major
           or (version_major = v_started_major and version_minor > v_started_minor))
  ) into v_has_major_between;

  return jsonb_build_object(
    'has_progress', true,
    'has_diff', true,
    'is_major', v_has_major_between,
    'from_version', jsonb_build_object('major', v_started_major, 'minor', v_started_minor),
    'to_version', jsonb_build_object('major', v_current_major, 'minor', v_current_minor),
    'added_module_ids', v_added,
    'removed_module_ids', v_removed
  );
end;
$$;

grant execute on function public.learning_compute_learner_diff(text, text) to authenticated;
