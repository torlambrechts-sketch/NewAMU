-- Cadence — eksplisitt revoke from anon på begge RPC-er.
--
-- Supabase tildeler default EXECUTE til både anon og authenticated på
-- nye funksjoner i public-schema (en konsekvens av PostgREST-eksponering).
-- Selve sikkerhetssjekken i funksjonene fanger anon-kall (current_org_id()
-- returnerer NULL → exception), men advisorene flagger dette.
-- Eksplisitt REVOKE FROM anon stenger angrepsflaten på edge-nivå.
--
-- Self-audit:
--   * Cadence-iverksettelse er en arbeidsgiveroppgave — anonyme klienter
--     skal aldri kunne kalle den.
--   * `cadence_plan_discard_draft` skal også gates til authenticated, både
--     fordi den kan slette utkast og fordi den inneholder en is_org_admin()-
--     sjekk som ikke er meningsfull for anon.
--   * Trigger-funksjonen `cadence_plans_before_insert_defaults` er en
--     BEFORE INSERT-trigger, ikke en RPC — den kan ikke kalles direkte.
--     Vi REVOKE-er likevel for å tilfredsstille advisor og være konsistent.

set local search_path = public, pg_catalog;

revoke execute on function public.cadence_plan_activate(uuid) from anon;
revoke execute on function public.cadence_plan_discard_draft(uuid) from anon;
revoke execute on function public.cadence_plans_before_insert_defaults() from anon;
revoke execute on function public.cadence_plans_before_insert_defaults() from public;
