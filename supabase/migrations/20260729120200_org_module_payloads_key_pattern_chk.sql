-- Replace org_module_payloads_key_chk: fixed IN (…) lists keep breaking when
-- orgs already have payload rows with keys not in the list (or new keys are
-- added in app before migration runs). Enforce a stable key format instead.

alter table public.org_module_payloads drop constraint if exists org_module_payloads_key_chk;

alter table public.org_module_payloads add constraint org_module_payloads_key_chk check (module_key ~ '^[a-z][a-z0-9_]*$');
