-- Register types — display metadata + user UI preferences.
--
-- The new /registers UI (Klarert Registre design) needs a handful of
-- presentation-layer attributes that don't fit the field-builder schema:
--
--   1. `icon`            — Lucide icon name for the directory tile + table row
--                          (FlaskConical, Activity, AlertTriangle, …)
--   2. `mandatory`       — Whether the register is lovpålagt. Drives the
--                          "Lovpålagt" pill + the compliance-status summary.
--   3. `sensitive`       — Sensitive data flag (shows a lock icon, opens up
--                          the "Sensitiv informasjon" banner on entry-detail).
--   4. `gdpr`            — Whether the register holds personal data. Drives
--                          the purple GDPR pill + GDPR banner.
--   5. `ownerRole`       — Canonical owner role label ("HMS-leder", "HR-leder").
--   6. `retentionLabel`  — Free-text lagringstid description.
--   7. `accessRules`     — Free-text access-rule lines (array). Shown in the
--                          "Lovverk og tilgang" panel on the detail page.
--   8. `legalLabels`     — Short legal-reference labels for the pill row
--                          ("AML § 4-5", "GDPR Art. 30"). Different from
--                          `regulation_ids` (those are taxonomy keys; these
--                          are render-ready badges).
--   9. `cmrField`        — For chemicals: which boolean field flags a
--                          CMR/special-category record. Used by the
--                          "krever Eksponeringsregister" callout.
--
-- All of this is presentation only — keeping it in a single jsonb avoids
-- splitting up a forest of optional columns. The field is read by the
-- new pages and is null/empty-tolerant: nothing breaks if it's missing.
--
-- A second small change: `profiles.ui_preferences jsonb` holds per-user
-- UI density / mode preferences. The new register page persists the
-- "Enkel / Avansert" choice here (database-first per task spec, no
-- localStorage).
--
-- Backfill: every shipped system register type gets its display_metadata
-- populated so the new UI renders correctly the moment the migration runs.
--
-- Idempotent. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. register_types.display_metadata ────────────────────────────────────

alter table public.register_types
  add column if not exists display_metadata jsonb not null default '{}'::jsonb;

comment on column public.register_types.display_metadata is
  $c$Presentation-layer attributes for the registers UI. Optional
  per-type bag with: icon (Lucide name), mandatory (bool), sensitive
  (bool), gdpr (bool), ownerRole (text), retentionLabel (text),
  accessRules (text[]), legalLabels (text[]), cmrField (text — key of
  the boolean field that flags a CMR record on chemicals).$c$;

-- studio_capture_revision() casts the text PK as UUID and fails on the
-- system slugs ('chemicals' etc.). Disable user triggers for the
-- backfill block; re-enable after.
alter table public.register_types disable trigger user;

-- ── 2. Backfill shipped system register types ─────────────────────────────

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'FlaskConical',
         'mandatory', true,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'HMS-leder',
         'retentionLabel', 'Permanent (utgåtte arkiveres for ettertiden)',
         'accessRules', jsonb_build_array(
           'Alle ansatte: lesetilgang',
           'Verneombud: full tilgang i sitt verneområde',
           'Hovedverneombud: hele virksomheten',
           'BHT: full tilgang'
         ),
         'legalLabels', jsonb_build_array(
           'Forskrift om utførelse av arbeid kap. 2',
           'AML § 4-5'
         ),
         'cmrField', 'cmr'
       )
 where id = 'chemicals' and organization_id is null;

-- Add a `cmr` boolean field to the chemicals metadata_schema so the
-- cmrField mechanism has a column to point at. Idempotent — we check
-- whether the field already exists before appending. The "krever
-- Eksponeringsregister" callout on the entry detail page reads it.
update public.register_types
   set metadata_schema = jsonb_set(
         metadata_schema,
         '{fields}',
         (metadata_schema->'fields') || jsonb_build_array(
           jsonb_build_object(
             'key', 'cmr',
             'label', 'CMR-stoff',
             'kind', 'boolean',
             'hint', 'Kreftfremkallende, mutagent eller reproduksjonsskadelig (Carc 1A/1B, Muta 1B, Repr 1B). Krever Eksponeringsregister iht. forskrift kap. 31.'
           )
         )
       )
 where id = 'chemicals'
   and organization_id is null
   and not exists (
     select 1
       from jsonb_array_elements(metadata_schema->'fields') f
      where f->>'key' = 'cmr'
   );

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Truck',
         'mandatory', false,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'Innkjøpssjef',
         'retentionLabel', '10 år etter avsluttet kontrakt',
         'accessRules', jsonb_build_array(
           'Innkjøp + leder: full tilgang',
           'Ansatte: lesetilgang',
           'Revisor: ved revisjon'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 9001 § 8.4',
           'Åpenhetsloven § 4',
           'Hvitvaskingsloven § 14'
         )
       )
 where id = 'external_suppliers' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Lock',
         'mandatory', true,
         'sensitive', true,
         'gdpr', true,
         'ownerRole', 'Personvernombud (DPO) / HR-leder',
         'retentionLabel', 'Permanent (oppdateres ved endringer)',
         'accessRules', jsonb_build_array(
           'Personvernombud + ledelse: full tilgang',
           'Datatilsynet: ved tilsyn'
         ),
         'legalLabels', jsonb_build_array(
           'GDPR Art. 30',
           'Personopplysningsloven § 1'
         )
       )
 where id = 'gdpr_processing_activities' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Target',
         'mandatory', true,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'HMS-leder',
         'retentionLabel', 'Permanent',
         'accessRules', jsonb_build_array(
           'HMS-leder + verneombud: full tilgang',
           'Avdelingsledere: sine områder',
           'AMU: sammendrag i møter'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 45001 § 6.1.2',
           'AML § 3-1',
           'IK-f § 5 nr. 6'
         )
       )
 where id = 'hira' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Leaf',
         'mandatory', false,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'Miljøansvarlig',
         'retentionLabel', 'Permanent',
         'accessRules', jsonb_build_array(
           'Miljøansvarlig + ledelse: full tilgang',
           'Operativ HMS: lesetilgang'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 14001 § 6.1.2'
         )
       )
 where id = 'environmental_aspects' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'BookOpen',
         'mandatory', true,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'KS-/HMS-leder',
         'retentionLabel', 'Permanent (oppdateres ved endringer)',
         'accessRules', jsonb_build_array(
           'KS/HMS: full tilgang',
           'Linjeledere: lesetilgang',
           'Revisor: full lesetilgang ved revisjon'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 14001 § 6.1.3',
           'ISO 45001 § 6.1.3',
           'AML § 3-1'
         )
       )
 where id = 'legal_compliance' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Database',
         'mandatory', false,
         'sensitive', true,
         'gdpr', true,
         'ownerRole', 'Sikkerhetsansvarlig',
         'retentionLabel', 'Permanent (oppdateres ved endringer)',
         'accessRules', jsonb_build_array(
           'Sikkerhetsansvarlig: full tilgang',
           'Eier av aktiva: les/skriv på sine egne',
           'Revisor ISO 27001: full lesetilgang'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 27001 A.5.9',
           'ISO 27001 A.8.1'
         )
       )
 where id = 'iso_asset_register' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'ShieldAlert',
         'mandatory', false,
         'sensitive', true,
         'gdpr', false,
         'ownerRole', 'Sikkerhetsansvarlig',
         'retentionLabel', 'Permanent',
         'accessRules', jsonb_build_array(
           'Sikkerhetsansvarlig + risikoeier: full tilgang',
           'Ledelsen: lesetilgang',
           'Intern revisjon: full lesetilgang'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 27001 § 6.1.2',
           'ISO 27001 § 6.1.3'
         )
       )
 where id = 'iso_risk_treatment' and organization_id is null;

update public.register_types
   set display_metadata = jsonb_build_object(
         'icon', 'Siren',
         'mandatory', true,
         'sensitive', false,
         'gdpr', false,
         'ownerRole', 'Beredskapsansvarlig',
         'retentionLabel', 'Permanent',
         'accessRules', jsonb_build_array(
           'Beredskapsansvarlig + ledelse: full tilgang',
           'Ansatte: lesetilgang',
           'Brannvesen: ved øvelse / hendelse'
         ),
         'legalLabels', jsonb_build_array(
           'ISO 14001 § 8.2',
           'ISO 45001 § 8.2'
         )
       )
 where id = 'emergency_preparedness' and organization_id is null;

alter table public.register_types enable trigger user;

-- ── 3. profiles.ui_preferences ────────────────────────────────────────────

alter table public.profiles
  add column if not exists ui_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.ui_preferences is
  $c$Per-user UI preferences (density, mode toggles, default views).
  Database-first source of truth — the new /registers page reads + writes
  this rather than localStorage so the choice follows the user across
  devices. Keys are namespaced by scope, e.g.:
    {
      "registers": { "mode": "advanced", "view": "bokser" }
    }
  Empty / missing keys fall back to scope defaults.$c$;

-- ── 4. Index to support cross-register record fetch by org ────────────────
--
-- The new analyse page (and the hub for the per-register stats) loads
-- all records for an org with `select * from register_records where
-- organization_id = $1 and deleted_at is null`. The existing
-- `register_records_org_type_idx` is on (org, type) which postgres
-- can still use for an org-only scan, but a dedicated org-only partial
-- index makes the hub feel snappy at 1k+ rows.

create index if not exists register_records_org_active_idx
  on public.register_records (organization_id, updated_at desc)
  where deleted_at is null;
