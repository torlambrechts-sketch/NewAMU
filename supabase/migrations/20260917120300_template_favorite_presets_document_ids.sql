-- Correct the document preset keys to real document_system_templates ids.
--
-- The verneombud / leder / admin document presets seeded in
-- 20260917120100 used legacy `tpl-sysdok-*` slugs. The live
-- document_system_templates uses stable uuid-form ids, so those presets
-- resolved to nothing. This adds the uuid-keyed rows alongside the legacy
-- ones — `provision_favorite_defaults_for_user` resolves whichever id
-- actually exists on a given deployment and skips the rest, so both this
-- database and any install still on the slug ids are covered.
--
-- Then re-runs the additive backfill so existing users pick up the
-- document favourite that now resolves (admins gain "Systematisk
-- internkontroll"; verneombud/leder gain theirs once those roles exist).

set local search_path = public, pg_catalog;

insert into public.template_favorite_role_presets (role_key, template_kind, template_key, position) values
  -- 102 = Psykososialt arbeidsmiljø, 101 = Risikovurdering, 107 = Systematisk internkontroll
  ('verneombud', 'document', '00000000-d000-4000-a000-000000000102',  90),
  ('verneombud', 'document', '00000000-d000-4000-a000-000000000101', 100),
  ('leder',      'document', '00000000-d000-4000-a000-000000000107',  70),
  ('admin',      'document', '00000000-d000-4000-a000-000000000107',  30)
on conflict (role_key, template_kind, template_key) do update
  set position = excluded.position;

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
