-- pgcrypto lives in the `extensions` schema on Supabase; the workflow
-- functions that call digest() / gen_random_bytes() had search_path = public
-- only, so those calls failed with "function public.digest(text, unknown)
-- does not exist". Mirror the same fix applied to reporting RPCs in
-- 20260513090000_reports_rpc_pgcrypto_search_path.sql.
--
-- Surgical: alter function only — no body restate, signatures + grants intact.

alter function public.trg_workflow_runs_seal()
  set search_path = public, extensions, pg_catalog;

alter function public.workflow_record_evidence(uuid, uuid, uuid, text, text, text, bigint, text, text, text[], text[], jsonb)
  set search_path = public, extensions, pg_catalog;

alter function public.workflow_mint_auditor_token(uuid, text, jsonb, int)
  set search_path = public, extensions, pg_catalog;

alter function public.workflow_verify_auditor_token(text)
  set search_path = public, extensions, pg_catalog;
