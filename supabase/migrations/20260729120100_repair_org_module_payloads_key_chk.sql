-- Repair: org_module_payloads_key_chk must list every module_key in use, including
-- report_builder, workplace_reporting, workplace_dashboard, inspection, plus
-- internkontroll_settings. (Earlier ik_annual_review_core.sql used too short a list.)
-- Idempotent: safe if constraint already correct.

alter table public.org_module_payloads drop constraint if exists org_module_payloads_key_chk;

alter table public.org_module_payloads add constraint org_module_payloads_key_chk check (
  module_key in (
    'internal_control',
    'hse',
    'org_health',
    'representatives',
    'tasks',
    'organisation',
    'cost_settings',
    'workspace',
    'report_builder',
    'workplace_reporting',
    'workplace_dashboard',
    'inspection',
    'internkontroll_settings'
  )
);
