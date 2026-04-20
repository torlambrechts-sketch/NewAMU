-- Repair: replace brittle enum-style CHECK on module_key (failed when any row
-- had a key not in the list) with a format rule: single snake_case identifier.

alter table public.org_module_payloads drop constraint if exists org_module_payloads_key_chk;

alter table public.org_module_payloads add constraint org_module_payloads_key_chk check (module_key ~ '^[a-z][a-z0-9_]*$');
