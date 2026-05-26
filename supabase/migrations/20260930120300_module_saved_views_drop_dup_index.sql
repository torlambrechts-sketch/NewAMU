-- The original module_saved_views migration added two indexes covering
-- the same column set: a manual btree
--   module_saved_views_org_module_idx (organization_id, module_slug, name)
-- and the auto-generated unique-constraint index
--   module_saved_views_organization_id_module_slug_name_key
--   on the same columns.
--
-- The unique constraint's index alone serves the same queries (lookup
-- by org + module slug, plus dedup on name). Drop the manual btree to
-- save the write-amplification cost on every INSERT/UPDATE.

drop index if exists public.module_saved_views_org_module_idx;
