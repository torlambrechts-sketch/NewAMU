-- Dashboard-realtime: legg task_items + hse_audit_log + cadence_plans
-- til i `supabase_realtime`-publikasjonen.
--
-- Uten denne migrasjonen blir useDashboardData()-subscriptionen i
-- /dashboard ren tomgang: Supabase Realtime broadcaster bare
-- postgres_changes-events for tabeller som finnes i publikasjonen.
-- Klienten oppretter kanalen og venter på events som aldri kommer.
--
-- Sikkerhet:
--   * RLS gjelder fortsatt på events — realtime-serveren filtrerer pre-
--     broadcast slik at klienter bare ser endringer på rader de allerede
--     ville se via SELECT-spørringer.
--   * Vi tar med kun de tre tabellene dashboardet faktisk lytter til —
--     ikke alle cadence_plan_*-child-tabellene, fordi de fyrer av i
--     samme transaksjon som cadence_plans/task_items og brukeren får
--     refetch-en uansett via parent-eventene.
--
-- Idempotent: ALTER PUBLICATION ADD TABLE feiler hvis tabellen allerede
-- er med, så vi wrapper hver i DO-blokker som sjekker først.

set local search_path = public, pg_catalog;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_items'
  ) then
    alter publication supabase_realtime add table public.task_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hse_audit_log'
  ) then
    alter publication supabase_realtime add table public.hse_audit_log;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cadence_plans'
  ) then
    alter publication supabase_realtime add table public.cadence_plans;
  end if;
end$$;
