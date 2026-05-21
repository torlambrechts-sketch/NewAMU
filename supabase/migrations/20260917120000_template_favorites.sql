-- Per-user favorite templates — cross-module.
--
-- Gap closed: a user works daily from a small, role-specific subset of the
-- template catalogue (a verneombud lives in vernerunder + psykososial
-- pulsmåling; a leder in drøftingsmøter). Until now the only curation signal
-- was `nav_pinned`, which is ORG-GLOBAL — one admin's pin is everyone's pin.
-- There was no per-user "this is mine" marker and no role-based starting set.
--
-- Fix: `template_favorites` — one row per (user, template) across all seven
-- template-shipping modules (compliance / survey / document / register /
-- learning / task / meeting). Polymorphic by design: template primary keys
-- are heterogeneous (uuid, text-slug, composite) so a single `template_ref
-- text` avoids seven join tables. No FK to the template rows — a deleted
-- template simply fails to resolve and is filtered out by the read path
-- (templates use soft-delete, so dangling refs are rare).
--
-- `template_favorite_role_presets` is the system-level "starter list": which
-- templates a given role normally wants favourited. `provision_favorite_
-- defaults_for_user` resolves a user's roles, maps each preset's stable
-- `template_key` (slug) to the concrete per-org `template_ref`, and inserts
-- with `source = 'role_default'`. Provisioning is strictly ADDITIVE —
-- `on conflict do nothing` — so it never disturbs a user's manual choices,
-- and re-running it after a role change only tops up the new role's set.
--
-- Ownership / RLS mirrors `dashboard_layouts`: org-scoped + `auth.uid()`.

set local search_path = public, pg_catalog;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. template_favorites — the per-user list
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.template_favorites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  /** Which module the template belongs to. */
  template_kind   text not null check (template_kind in
                    ('compliance','survey','document','register','learning','task','meeting')),
  /** Stringified primary key of the template row as the module's UI sees it.
   *  compliance → per-org compliance_checklist_templates.id (uuid);
   *  survey/document/register/meeting → system catalog id (text);
   *  task → task_template_catalog.id (uuid); learning → learning_system_courses.id. */
  template_ref    text not null,
  /** Sort order within (user, kind) — drives the "Mine favoritter" page. */
  position        integer not null default 0,
  /** 'user' = explicitly starred; 'role_default' = seeded by provisioning. */
  source          text not null default 'user' check (source in ('user','role_default')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id, template_kind, template_ref)
);

create index if not exists template_favorites_user_idx
  on public.template_favorites (organization_id, user_id, template_kind, position);

alter table public.template_favorites enable row level security;

drop policy if exists template_favorites_select on public.template_favorites;
create policy template_favorites_select
  on public.template_favorites for select
  using (organization_id = public.current_org_id() and user_id = auth.uid());

drop policy if exists template_favorites_write on public.template_favorites;
create policy template_favorites_write
  on public.template_favorites for all
  using (organization_id = public.current_org_id() and user_id = auth.uid())
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

-- Fill org + user from session when the client omits them.
create or replace function public.template_favorites_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists template_favorites_before_insert_tg on public.template_favorites;
create trigger template_favorites_before_insert_tg
  before insert on public.template_favorites
  for each row execute function public.template_favorites_before_insert();

grant select, insert, update, delete on public.template_favorites to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. template_favorite_role_presets — the role-based starter lists
-- ───────────────────────────────────────────────────────────────────────────
-- role_key is the conceptual role, NOT a role_definitions.slug — orgs only
-- seed 'admin'/'member' as real role rows, while 'verneombud'/'leder' are
-- derived from AMU membership. `favorite_role_keys_for_user` is the single
-- place that maps a user to this enumeration.
create table if not exists public.template_favorite_role_presets (
  id            uuid primary key default gen_random_uuid(),
  role_key      text not null check (role_key in
                  ('ansatt','verneombud','leder','admin')),
  template_kind text not null check (template_kind in
                  ('compliance','survey','document','register','learning','task','meeting')),
  /** Stable slug/id of a SYSTEM template — resolved per-org at provision time. */
  template_key  text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (role_key, template_kind, template_key)
);

alter table public.template_favorite_role_presets enable row level security;

drop policy if exists template_favorite_role_presets_read on public.template_favorite_role_presets;
create policy template_favorite_role_presets_read
  on public.template_favorite_role_presets for select
  to authenticated using (true);

grant select on public.template_favorite_role_presets to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. favorite_role_keys_for_user — map a user to conceptual role keys
-- ───────────────────────────────────────────────────────────────────────────
-- Best-effort and additive: 'ansatt' for everyone, plus whatever the org's
-- data supports. AMU employee-side membership is the closest stable proxy
-- for verneombud / vernetjeneste; leader / deputy_leader for 'leder'.
create or replace function public.favorite_role_keys_for_user(p_user uuid, p_org uuid)
returns text[]
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select array(
    select distinct k from (
      select 'ansatt'::text as k
      union all
      select 'admin' where exists (
        select 1 from public.profiles pr
        where pr.id = p_user and pr.organization_id = p_org and pr.is_org_admin
      ) or exists (
        select 1 from public.user_roles ur
        join public.role_definitions rd on rd.id = ur.role_id
        where ur.user_id = p_user and rd.organization_id = p_org and rd.slug = 'admin'
      )
      union all
      select 'verneombud' where exists (
        select 1 from public.amu_members m
        where m.user_id = p_user and m.organization_id = p_org
          and m.active and m.side = 'employee'
      )
      union all
      select 'leder' where exists (
        select 1 from public.amu_members m
        where m.user_id = p_user and m.organization_id = p_org
          and m.active and m.role in ('leader','deputy_leader')
      )
    ) roles
  );
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. provision_favorite_defaults_for_user — seed role-default favourites
-- ───────────────────────────────────────────────────────────────────────────
-- Resolves the user's role keys, walks the matching presets, maps each
-- stable template_key to a concrete template_ref present in this org, and
-- inserts with source='role_default'. Idempotent + additive: never touches
-- existing rows (manual or previously-seeded). Returns rows inserted.
create or replace function public.provision_favorite_defaults_for_user(p_user uuid, p_org uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_roles    text[];
  v_preset   record;
  v_ref      text;
  v_inserted integer := 0;
begin
  if p_user is null or p_org is null then
    return 0;
  end if;

  v_roles := public.favorite_role_keys_for_user(p_user, p_org);
  if v_roles is null or array_length(v_roles, 1) is null then
    return 0;
  end if;

  for v_preset in
    select p.template_kind, p.template_key, min(p.position) as position
    from public.template_favorite_role_presets p
    where p.role_key = any(v_roles)
    group by p.template_kind, p.template_key
  loop
    v_ref := null;

    if v_preset.template_kind = 'compliance' then
      select id::text into v_ref from public.compliance_checklist_templates
        where organization_id = p_org and slug = v_preset.template_key
        limit 1;
    elsif v_preset.template_kind = 'survey' then
      select id::text into v_ref from public.survey_template_catalog
        where id = v_preset.template_key
        limit 1;
    elsif v_preset.template_kind = 'document' then
      select id::text into v_ref from public.document_system_templates
        where id = v_preset.template_key
        limit 1;
    elsif v_preset.template_kind = 'register' then
      select id::text into v_ref from public.register_types
        where id = v_preset.template_key
          and (organization_id is null or organization_id = p_org)
        limit 1;
    elsif v_preset.template_kind = 'learning' then
      select id::text into v_ref from public.learning_system_courses
        where slug = v_preset.template_key
        limit 1;
    elsif v_preset.template_kind = 'task' then
      select id::text into v_ref from public.task_template_catalog
        where slug = v_preset.template_key
        limit 1;
    elsif v_preset.template_kind = 'meeting' then
      select id::text into v_ref from public.meeting_system_templates
        where id = v_preset.template_key
        limit 1;
    end if;

    if v_ref is not null then
      insert into public.template_favorites
        (organization_id, user_id, template_kind, template_ref, position, source)
      values
        (p_org, p_user, v_preset.template_kind, v_ref,
         coalesce(v_preset.position, 0), 'role_default')
      on conflict (organization_id, user_id, template_kind, template_ref) do nothing;
      if found then
        v_inserted := v_inserted + 1;
      end if;
    end if;
  end loop;

  return v_inserted;
end;
$$;

-- Self-service entry point — used by the "Bruk rolleforslag" button and by
-- the favourites hook when a user has no favourites yet.
create or replace function public.apply_favorite_role_defaults()
returns integer
language sql
security definer
set search_path = public, pg_catalog
as $$
  select public.provision_favorite_defaults_for_user(auth.uid(), public.current_org_id());
$$;

revoke all on function public.favorite_role_keys_for_user(uuid, uuid) from public, anon;
revoke all on function public.provision_favorite_defaults_for_user(uuid, uuid) from public, anon;
revoke all on function public.apply_favorite_role_defaults() from public, anon;
grant execute on function public.apply_favorite_role_defaults() to authenticated;
