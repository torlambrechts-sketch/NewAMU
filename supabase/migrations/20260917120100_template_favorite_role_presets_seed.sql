-- Role-default favourite presets — seed + provisioning triggers + backfill.
--
-- Gap closed: `template_favorites` (previous migration) gives a user a
-- per-user favourites list, but a brand-new user starts empty. This migration
-- supplies the "system starts with a sensible list per role" half:
--   1. Seeds `template_favorite_role_presets` — a curated starter set per
--      conceptual role (ansatt / verneombud / leder / admin).
--   2. Adds triggers so the set is provisioned automatically when a user
--      gains a role or joins an org — strictly additive, never destructive.
--   3. Backfills every existing (user, org) pair.
--
-- Template keys below are SYSTEM-template slugs/ids verified against the
-- shipped seed migrations. A key that no longer resolves is skipped silently
-- by `provision_favorite_defaults_for_user` — wrong/renamed keys degrade
-- gracefully rather than breaking provisioning.
--
-- Role keys map to role_definitions.slug (see favorite_role_keys_for_user):
-- a user holding the 'verneombud' role gets the verneombud set, an org admin
-- gets the admin set, everyone gets 'ansatt'. The 'leder' set is seeded ahead
-- of demand — it activates automatically if an org adds a 'leder' role.
--
-- Self-audit (Arbeidstilsynet POV): a verneombud now opens the product with
-- vernerunde, psykososial pulsmåling, stoffkartotek and avvik already at hand
-- (AML § 6-1 / IK-f § 5) instead of hunting the catalogue. Restrisiko
-- deferred: roles with no matching preset set get only the 'ansatt' baseline.

set local search_path = public, pg_catalog;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Seed the presets
-- ───────────────────────────────────────────────────────────────────────────
insert into public.template_favorite_role_presets (role_key, template_kind, template_key, position) values
  -- ansatt — baseline everyone gets: report a deviation, file a suggestion
  ('ansatt',     'task',       'avvik-standard',                10),
  ('ansatt',     'task',       'forslag',                       20),
  ('ansatt',     'compliance', 'avviksoppfolging-runde',        30),

  -- verneombud — the safety rep's daily surface (AML § 6-1)
  ('verneombud', 'compliance', 'vernerunde-standard',           10),
  ('verneombud', 'compliance', 'brannvernrunde',                20),
  ('verneombud', 'compliance', 'ergonomi-runde',                30),
  ('verneombud', 'compliance', 'stoffkartotek-runde',           40),
  ('verneombud', 'compliance', 'psykososial-pulsmaling',        50),
  ('verneombud', 'compliance', 'verneombud-arsrapport',         60),
  ('verneombud', 'survey',     'tpl-mobbing',                   70),
  ('verneombud', 'survey',     'tpl-hms-climate',               80),
  ('verneombud', 'document',   'tpl-sysdok-psykososialt',       90),
  ('verneombud', 'document',   'tpl-sysdok-risikovurdering',   100),
  ('verneombud', 'register',   'chemicals',                    110),
  ('verneombud', 'task',       'avvik-standard',               120),
  ('verneombud', 'task',       'avvik-alvorlig',               130),
  ('verneombud', 'task',       'nestenulykke',                 140),
  ('verneombud', 'task',       'risikovurdering-general',      150),
  ('verneombud', 'meeting',    'verneombud-mote',              160),

  -- leder — the line manager / AMU leader's surface
  ('leder',      'compliance', 'amu-arsrapport-sjekk',          10),
  ('leder',      'compliance', 'ik-forskriften-arsgjennomgang', 20),
  ('leder',      'compliance', 'arbeidsgivers-hms-opplaering',  30),
  ('leder',      'compliance', 'hms-maal-arsplan-sjekk',        40),
  ('leder',      'survey',     'tpl-enps',                      50),
  ('leder',      'survey',     'tpl-edmondson',                 60),
  ('leder',      'document',   'tpl-sysdok-internkontroll',     70),
  ('leder',      'document',   'tpl-hms-policy',                80),
  ('leder',      'register',   'external_suppliers',            90),
  ('leder',      'task',       'forbedringsprosjekt',          100),
  ('leder',      'task',       'tiltak-forebyggende',          110),
  ('leder',      'learning',   'aml-ledere',                   120),
  ('leder',      'meeting',    'amu-kvartalsmote-q1',          130),
  ('leder',      'meeting',    'drofting-likestilling',        140),
  ('leder',      'meeting',    'personalmote',                 150),

  -- admin — systems / compliance owner
  ('admin',      'compliance', 'ik-forskriften-arsgjennomgang', 10),
  ('admin',      'compliance', 'gdpr-arsgjennomgang',           20),
  ('admin',      'document',   'tpl-sysdok-internkontroll',     30),
  ('admin',      'register',   'gdpr_processing_activities',    40),
  ('admin',      'register',   'legal_compliance',              50),
  ('admin',      'task',       'oppgave-generell',              60),
  ('admin',      'meeting',    'amu-konstitueringsmote',        70)
on conflict (role_key, template_kind, template_key) do update
  set position = excluded.position;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Provisioning triggers — keep favourites topped up automatically
-- ───────────────────────────────────────────────────────────────────────────
-- New role assigned → provision that role's defaults for the user.
create or replace function public.template_favorites_provision_on_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
  from public.role_definitions where id = new.role_id;
  if v_org is not null then
    perform public.provision_favorite_defaults_for_user(new.user_id, v_org);
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_favorite_provision_tg on public.user_roles;
create trigger user_roles_favorite_provision_tg
  after insert on public.user_roles
  for each row execute function public.template_favorites_provision_on_role();

-- User joins / moves org → provision the new org's defaults.
create or replace function public.template_favorites_provision_on_org_join()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is not null
     and new.organization_id is distinct from old.organization_id then
    perform public.provision_favorite_defaults_for_user(new.id, new.organization_id);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_favorite_provision_tg on public.profiles;
create trigger profiles_favorite_provision_tg
  after update of organization_id on public.profiles
  for each row execute function public.template_favorites_provision_on_org_join();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Backfill existing users
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select id as user_id, organization_id
    from public.profiles
    where organization_id is not null
  loop
    perform public.provision_favorite_defaults_for_user(r.user_id, r.organization_id);
  end loop;
end;
$$;
