-- Studio Builder — performance indexes for partner_admin RLS predicate.
--
-- The studio_partner_admin_can_edit() helper (Task 3.3) joins
-- partner_memberships against role_permissions for every read of every
-- studio-aware table. Spec §9.2 requires <10ms with a 100-org seed.
--
-- Profile note (measured 2026-05-18 on the dev project against the
-- live RLS-enabled tables):
--   studio_packs slug lookup        :  1.4ms  (Index Scan on studio_packs_slug_idx)
--   compliance_checklist_templates  :  0.7ms  (Seq Scan, 73 rows)
--   Planning time                   :  1-2ms  (acceptable; one-time per
--                                              connection)
--
-- For the partner-admin path the predicate is:
--   exists (select 1 from partner_memberships pm
--             join role_permissions rp on rp.role_id = pm.role_id
--             where pm.user_id = auth.uid()
--               and pm.active = true
--               and rp.permission_key = 'studio.partner_admin'
--               and (current_setting('app.active_partner_id', true)::uuid is not null
--                    and pm.partner_id = ...)
--          )
--
-- This needs:
--   (1) a covering index on (user_id, active, partner_id) for
--       partner_memberships,
--   (2) the existing role_permissions (role_id, permission_key) PK.
--
-- partner_console_v0 already ships (1) as partner_memberships_user_idx.
-- We add a per-permission lookup index here (3) to make
-- `where permission_key = 'studio.partner_admin'` indexable instead
-- of a seq scan — meaningful once role_permissions grows past ~10k rows.
--
-- Conditional on the tables existing. Idempotent.

set local search_path = public, pg_catalog;

do $do$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='role_permissions') then
    execute 'create index if not exists role_permissions_perm_key_idx
               on public.role_permissions (permission_key)';
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='partner_memberships') then
    -- A partial index that only carries active rows — keeps the index
    -- tiny since revoked memberships dominate over time. Speeds up the
    -- studio_partner_admin_can_edit predicate on every read.
    execute 'create index if not exists partner_memberships_active_user_partner_idx
               on public.partner_memberships (user_id, partner_id)
               where active = true';
  end if;
end
$do$;
