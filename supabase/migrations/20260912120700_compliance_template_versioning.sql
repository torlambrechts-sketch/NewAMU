-- Phase 13: Compliance template versioning + diff (generic, all templates).
--
-- Coverage gap closed:
--   When AML is amended (or any compliance pack revised), the seed
--   migration replaces the in-place definition jsonb — leaving no audit
--   trail of what the rules looked like before, and no way for an org
--   to know which version they signed last year. Mirrors the
--   learning_course_versions shape so all template-versioning surfaces
--   feel consistent.
--
-- Design:
--   * `compliance_template_versions` — append-only snapshot table.
--     Every publish bumps version_major.version_minor and writes a
--     complete copy of the definition + metadata_schema + law_refs.
--     The `compliance_checklist_executions` row already stores
--     definition_snapshot at sign-time, so a signed execution can be
--     re-rendered identically even if the underlying version is later
--     replaced.
--   * `current_version_major / _minor` columns on templates so the UI
--     can show "v1.3" alongside the template name without joining the
--     versions table.
--   * `started_version_major / _minor` columns on executions track
--     which version the user started the walkthrough against. Lets us
--     answer "how many orgs signed v1.2 vs v1.3?" at audit time.
--   * `compliance_template_publish_version(...)` RPC — admins call this
--     when seeding a new version (e.g. yearly AML revision). Idempotent
--     by (slug, pack, version) so re-running the same migration is
--     safe.
--   * `compliance_template_version_diff(...)` RPC — returns added/
--     removed/modified items between two versions. Used by the admin
--     UI to show "what changed" at law-amendment time.
--
-- Self-audit:
--   * Pålegg-grunn addressed: AML § 3-1 + IK-f § 5 nr. 7 require
--     traceability. Versioned snapshots give the auditor proof that
--     "version X was active when execution Y signed".
--   * Append-only — no destructive ops. Old versions stay forever.
--   * Idempotent via on-conflict on (slug, pack, version_major,
--     version_minor).

set local search_path = public, pg_catalog;

-- ── 1. Versions table ────────────────────────────────────────────────────
create table if not exists public.compliance_template_versions (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  pack            public.compliance_pack not null,
  version_major   int not null,
  version_minor   int not null,
  name            text not null,
  description     text,
  definition      jsonb not null,
  metadata_schema jsonb not null default '{"fields":[]}'::jsonb,
  law_refs        text[] not null default '{}',
  changelog       text,
  published_at    timestamptz not null default now(),
  published_by    uuid references auth.users (id) on delete set null,
  unique (slug, pack, version_major, version_minor)
);

create index if not exists compliance_template_versions_slug_idx
  on public.compliance_template_versions (slug, pack, version_major desc, version_minor desc);

alter table public.compliance_template_versions enable row level security;

-- Read-only for any authenticated user — versions are platform metadata.
drop policy if exists ctv_select_all on public.compliance_template_versions;
create policy ctv_select_all on public.compliance_template_versions
  for select to authenticated using (true);

-- Write reserved to platform admins; seed migrations bypass via service role.
drop policy if exists ctv_write_admin on public.compliance_template_versions;
create policy ctv_write_admin on public.compliance_template_versions
  for all using (public.platform_is_admin()) with check (public.platform_is_admin());

comment on table public.compliance_template_versions is
  'Append-only snapshot of every published version of every compliance checklist template. Reconstruction source of truth when a signed execution needs to be re-rendered.';

-- ── 2. Current-version columns on templates + executions ─────────────────
alter table public.compliance_checklist_templates
  add column if not exists current_version_major int not null default 1;
alter table public.compliance_checklist_templates
  add column if not exists current_version_minor int not null default 0;

comment on column public.compliance_checklist_templates.current_version_major is
  'Major version of the currently-active definition. Bumped via compliance_template_publish_version.';

alter table public.compliance_checklist_executions
  add column if not exists started_version_major int;
alter table public.compliance_checklist_executions
  add column if not exists started_version_minor int;

comment on column public.compliance_checklist_executions.started_version_major is
  'Major version of the template active when this execution was created. Stable across template publishing; pair with definition_snapshot for full reproducibility.';

-- BEFORE INSERT trigger that snapshots the template's current version
-- onto the execution. Drops in alongside the existing
-- compliance_checklist_executions_before_insert_defaults trigger.
create or replace function public._exec_snapshot_template_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_major int; v_minor int;
begin
  if new.started_version_major is not null then return new; end if;
  select current_version_major, current_version_minor
    into v_major, v_minor
    from public.compliance_checklist_templates
    where id = new.template_id;
  new.started_version_major := coalesce(v_major, 1);
  new.started_version_minor := coalesce(v_minor, 0);
  return new;
end;
$$;

drop trigger if exists trg_exec_snapshot_template_version
  on public.compliance_checklist_executions;
create trigger trg_exec_snapshot_template_version
  before insert on public.compliance_checklist_executions
  for each row execute function public._exec_snapshot_template_version();

-- ── 3. Publish a new version ────────────────────────────────────────────
-- Snapshots the current template row into the versions table AND bumps
-- the template's current_version_*. Idempotent: re-running with the
-- same (slug, pack, major, minor) is a no-op (snapshot already exists).
create or replace function public.compliance_template_publish_version(
  p_slug          text,
  p_pack_slug     public.compliance_pack,
  p_version_major int,
  p_version_minor int,
  p_changelog     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src compliance_checklist_templates%rowtype;
  v_version_id uuid;
begin
  select * into v_src
  from public.compliance_checklist_templates
  where slug = p_slug
    and pack = p_pack_slug
    and is_system = true
    and deleted_at is null
  limit 1;

  if v_src.id is null then
    raise exception 'No template found for slug=% pack=%', p_slug, p_pack_slug;
  end if;

  insert into public.compliance_template_versions (
    slug, pack, version_major, version_minor,
    name, description, definition, metadata_schema, law_refs,
    changelog, published_by
  ) values (
    p_slug, p_pack_slug, p_version_major, p_version_minor,
    v_src.name, v_src.description, v_src.definition, v_src.metadata_schema, v_src.law_refs,
    p_changelog, auth.uid()
  )
  on conflict (slug, pack, version_major, version_minor) do update set
    name            = excluded.name,
    description     = excluded.description,
    definition      = excluded.definition,
    metadata_schema = excluded.metadata_schema,
    law_refs        = excluded.law_refs,
    changelog       = excluded.changelog
  returning id into v_version_id;

  -- Bump current pointer on every per-org row.
  update public.compliance_checklist_templates
  set current_version_major = p_version_major,
      current_version_minor = p_version_minor,
      updated_at = now()
  where slug = p_slug and pack = p_pack_slug;

  return v_version_id;
end;
$$;

comment on function public.compliance_template_publish_version(text, public.compliance_pack, int, int, text) is
  'Snapshots the current template definition into compliance_template_versions and bumps current_version on every per-org row. Idempotent by (slug, pack, version).';

grant execute on function public.compliance_template_publish_version(text, public.compliance_pack, int, int, text) to authenticated;

-- ── 4. Diff between two versions ─────────────────────────────────────────
-- Returns jsonb shape:
--   {
--     "added":    [{ "key":..., "prompt":..., "law_ref":...}, ...],
--     "removed":  [{ "key":..., "prompt":..., "law_ref":...}, ...],
--     "modified": [{ "key":..., "old": {...item}, "new": {...item}}, ...]
--   }
-- Items are matched on `item.key`. Modified means same key but different
-- prompt/law_ref/severity/help/resolutions hash.
create or replace function public.compliance_template_version_diff(
  p_slug          text,
  p_pack_slug     public.compliance_pack,
  p_from_major    int,
  p_from_minor    int,
  p_to_major      int,
  p_to_minor      int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from jsonb;
  v_to   jsonb;
  v_added   jsonb;
  v_removed jsonb;
  v_modified jsonb;
begin
  -- Flatten items[] from sections[] (or fall through to flat items) of
  -- each version's definition into a `{key → item}` map.
  with vfrom as (
    select definition from public.compliance_template_versions
    where slug = p_slug and pack = p_pack_slug
      and version_major = p_from_major and version_minor = p_from_minor
  ),
  vto as (
    select definition from public.compliance_template_versions
    where slug = p_slug and pack = p_pack_slug
      and version_major = p_to_major and version_minor = p_to_minor
  )
  select
    coalesce(
      (select jsonb_object_agg(item->>'key', item)
       from vfrom, jsonb_path_query(vfrom.definition, '$.sections[*].items[*]') item),
      coalesce(
        (select jsonb_object_agg(item->>'key', item)
         from vfrom, jsonb_array_elements(vfrom.definition->'items') item),
        '{}'::jsonb
      )
    ),
    coalesce(
      (select jsonb_object_agg(item->>'key', item)
       from vto, jsonb_path_query(vto.definition, '$.sections[*].items[*]') item),
      coalesce(
        (select jsonb_object_agg(item->>'key', item)
         from vto, jsonb_array_elements(vto.definition->'items') item),
        '{}'::jsonb
      )
    )
  into v_from, v_to;

  if v_from = '{}'::jsonb and v_to = '{}'::jsonb then
    raise exception 'No versions found for slug=% pack=%', p_slug, p_pack_slug;
  end if;

  -- Added: keys in v_to but not in v_from
  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_added
  from jsonb_each(v_to)
  where not (v_from ? key);

  -- Removed: keys in v_from but not in v_to
  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_removed
  from jsonb_each(v_from)
  where not (v_to ? key);

  -- Modified: keys in both, with different jsonb content
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'key', t.k,
      'old', v_from -> t.k,
      'new', v_to -> t.k
    )), '[]'::jsonb
  ) into v_modified
  from (
    select key as k from jsonb_each(v_from)
    where v_to ? key and v_to -> key <> v_from -> key
  ) t;

  return jsonb_build_object(
    'added', v_added,
    'removed', v_removed,
    'modified', v_modified
  );
end;
$$;

comment on function public.compliance_template_version_diff(text, public.compliance_pack, int, int, int, int) is
  'Returns added / removed / modified items between two versions of a compliance walkthrough template. Items keyed by item.key. Used by admin UI at law-amendment time.';

grant execute on function public.compliance_template_version_diff(text, public.compliance_pack, int, int, int, int) to authenticated;

-- ── 5. Seed v1.0 for the existing AML walkthrough ────────────────────────
-- Now that the table exists, publish the current AML definition as v1.0
-- so the diff machinery has a baseline for the next revision.
do $$
declare v_id uuid;
begin
  -- Only publish v1.0 if the AML template actually exists (avoids
  -- exceptions on a fresh DB where the seed migration hasn't run yet).
  if exists (
    select 1 from public.compliance_checklist_templates
    where slug = 'aml-fullgjennomgang' and pack = 'aml-amu' and is_system = true
  ) then
    v_id := public.compliance_template_publish_version(
      'aml-fullgjennomgang', 'aml-amu', 1, 0,
      'Initial baseline (Phase 1 seed + Phase 10 ref fixes).'
    );
    raise notice 'AML v1.0 published as version row %', v_id;
  end if;
end $$;
