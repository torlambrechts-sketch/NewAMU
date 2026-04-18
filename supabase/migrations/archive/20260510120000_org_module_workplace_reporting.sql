-- Persist internal workplace reporting cases (Ny sak) alongside other org module JSON.

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
    'workplace_reporting'
  )
);
