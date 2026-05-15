-- Phase B3 — DESTRUCTIVE: drop legacy whistleblowing + gdpr_breach tables.
--
-- VERIFICATION GATE: aborts if any legacy row failed to migrate.
--
-- The legacy public RPCs (public_submit_whistleblowing,
-- public_whistleblowing_status, public_whistleblowing_org_lookup) and
-- the column organizations.whistle_public_slug are dropped in a separate
-- migration in Phase F4 — they're still referenced by App.tsx routes
-- until Phase F1+D ships.

set local search_path = public, pg_catalog;

do $$
declare
  v_legacy_cnt int;
  v_new_cnt int;
  v_gdpr_legacy_cnt int;
  v_gdpr_new_cnt int;
begin
  select count(*) into v_legacy_cnt from public.whistleblowing_cases;
  select count(*) into v_new_cnt
    from public.alert_cases
    where access_key in (select access_key from public.whistleblowing_cases);
  if v_new_cnt < v_legacy_cnt then
    raise exception 'alert_cases is missing % rows from whistleblowing_cases; aborting drop', v_legacy_cnt - v_new_cnt;
  end if;

  select count(*) into v_gdpr_legacy_cnt from public.gdpr_breach_incidents;
  select count(*) into v_gdpr_new_cnt
    from public.alert_cases
    where id in (select id from public.gdpr_breach_incidents);
  if v_gdpr_new_cnt < v_gdpr_legacy_cnt then
    raise exception 'alert_cases is missing % rows from gdpr_breach_incidents; aborting drop', v_gdpr_legacy_cnt - v_gdpr_new_cnt;
  end if;

  raise notice 'verification ok: whistleblowing=%, gdpr_breach=%; dropping legacy tables', v_legacy_cnt, v_gdpr_legacy_cnt;
end $$;

-- Drop tables first — CASCADE removes the dependent triggers automatically.
-- Functions are dropped after, since they're now unreferenced.
drop table if exists public.whistleblowing_case_notes cascade;
drop table if exists public.whistleblowing_cases cascade;
drop table if exists public.gdpr_breach_incidents cascade;

drop function if exists public.whistleblowing_notes_no_mutation();
drop function if exists public.set_gdpr_breach_deadline();

-- Drop any auxiliary views built on the legacy tables (best-effort)
drop view if exists public.gdpr_breach_status_view cascade;
drop view if exists public.whistleblowing_status_view cascade;
