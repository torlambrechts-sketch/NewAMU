-- ISO IMS — provision backfill for existing orgs.
--
-- Ensures every existing organization has:
--   1. An organization_iso_settings row (active_standards defaults to {}).
--   2. ISO 27001 SoA rows provisioned via provision_iso_27001_soa_for_org()
--      for any org that already has iso-27001 pack active.
--
-- New orgs are handled at onboarding time; this migration is a one-shot
-- backfill so orgs that existed before the ISO IMS migrations are fully
-- set up. Idempotent: ON CONFLICT DO NOTHING / DO UPDATE.

set local search_path = public, pg_catalog;

-- 1. Ensure every org has an iso_settings row.
INSERT INTO organization_iso_settings (organization_id, active_standards)
SELECT
  o.id,
  ARRAY(
    SELECT cp.slug::text
    FROM compliance_packs cp
    WHERE cp.organization_id = o.id
      AND cp.slug IN ('iso-9001', 'iso-14001', 'iso-45001', 'iso-27001')
      AND cp.is_active = true
      AND cp.deleted_at IS NULL
  )
FROM organizations o
ON CONFLICT (organization_id) DO UPDATE
  SET active_standards = EXCLUDED.active_standards;

-- 2. Provision SoA for any org that has iso-27001 pack active.
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  FOR v_org_id IN
    SELECT o.id
    FROM organizations o
    JOIN compliance_packs cp ON cp.organization_id = o.id
    WHERE cp.slug = 'iso-27001'
      AND cp.is_active = true
      AND cp.deleted_at IS NULL
  LOOP
    PERFORM provision_iso_27001_soa_for_org(v_org_id);
  END LOOP;
END;
$$;
