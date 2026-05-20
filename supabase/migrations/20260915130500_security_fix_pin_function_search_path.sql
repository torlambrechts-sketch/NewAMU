-- Security hardening: pin search_path on every public function that lacked it.
--
-- Gap closed: 105 functions in the public schema had no `search_path` set,
-- so each inherited the caller's session search_path at execution time
-- (advisor: function_search_path_mutable). For SECURITY DEFINER functions
-- this is an escalation vector — a caller can prepend a schema they control
-- and shadow an unqualified object reference inside the function body.
--
-- Fix: pin search_path to a fixed, non-mutable value on all of them. The pin
-- is a superset of what the functions already resolve against (pg_catalog is
-- always implicit; public holds the app objects; extensions holds pgcrypto /
-- uuid-ossp; pg_temp last), so unqualified references behave exactly as
-- before — only the session-controlled mutability is removed. Cross-schema
-- references (auth.*, storage.*) are always fully qualified and unaffected.
--
-- Idempotent: only functions still lacking a search_path config are altered.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, extensions, pg_temp',
      r.sig
    );
  end loop;
end$$;
