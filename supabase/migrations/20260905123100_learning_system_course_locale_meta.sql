-- Adds a `meta jsonb` bucket on learning_system_course_locales so locale-level
-- extension fields from the JSON bundle (lawRefs catalog, gamification badges,
-- milestones, schemaVersion etc.) survive a round trip without needing a new
-- column per field. The runtime resolver in useLearning.ts already reads the
-- locale row, so it can pick up `meta` and surface it on the Course type.
--
-- Updates learning_admin_upsert_system_course to write the new column.

alter table public.learning_system_course_locales
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.learning_system_course_locales.meta is
  'Locale-level extension fields (lawRefs[], badges[], milestones[], schemaVersion, …) stored as JSONB so authors can extend the schema without a migration per field.';

create or replace function public.learning_admin_upsert_system_course(
  p_id text,
  p_slug text,
  p_default_locale text,
  p_locales jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  loc jsonb;
  v_locale text;
  v_title text;
  v_description text;
  v_modules jsonb;
  v_meta jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  if p_id is null or btrim(p_id) = '' then
    raise exception 'system course id is required';
  end if;
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'system course slug is required';
  end if;
  if p_locales is null or jsonb_typeof(p_locales) <> 'array' or jsonb_array_length(p_locales) = 0 then
    raise exception 'system course must include at least one locale';
  end if;

  insert into public.learning_system_courses (id, slug, default_locale)
  values (
    p_id,
    p_slug,
    coalesce(nullif(p_default_locale, ''), 'nb')
  )
  on conflict (id) do update set
    slug = excluded.slug,
    default_locale = excluded.default_locale;

  for loc in select * from jsonb_array_elements(p_locales)
  loop
    v_locale := loc->>'locale';
    if v_locale is null or v_locale = '' then
      raise exception 'locale entry missing "locale"';
    end if;
    v_title := coalesce(loc->>'title', '');
    v_description := coalesce(loc->>'description', '');
    v_modules := coalesce(loc->'modules', '[]'::jsonb);
    if jsonb_typeof(v_modules) <> 'array' then
      raise exception 'locale "%": modules must be a JSON array', v_locale;
    end if;

    -- meta = the locale object stripped of structural fields. Everything
    -- the caller sent that isn't locale / title / description / modules
    -- lands here (lawRefs, badges, milestones, schemaVersion, …).
    v_meta := loc - 'locale' - 'title' - 'description' - 'modules';

    insert into public.learning_system_course_locales (
      system_course_id, locale, title, description, modules, meta
    ) values (
      p_id, v_locale, v_title, v_description, v_modules, v_meta
    )
    on conflict (system_course_id, locale) do update set
      title = excluded.title,
      description = excluded.description,
      modules = excluded.modules,
      meta = excluded.meta;
  end loop;
end;
$$;

grant execute on function public.learning_admin_upsert_system_course(text, text, text, jsonb) to authenticated;
