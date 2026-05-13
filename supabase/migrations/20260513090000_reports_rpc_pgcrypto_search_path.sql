-- pgcrypto lives in the `extensions` schema on Supabase. The reporting
-- RPCs (publish_report, republish_report, redeem_share_token, and
-- publish_dashboard_as_report) had `search_path = public, pg_catalog`
-- pinned, so calls to gen_random_bytes / crypt / gen_salt failed at
-- runtime with `function gen_random_bytes(integer) does not exist`.
-- Add `extensions` to each function's search_path.
--
-- Surgical: alter function only flips the search_path, no body restate
-- needed — keeps the RPC signatures + grants intact. Fresh installs
-- still get the original migration first; this one runs after.

alter function public.publish_report(uuid, integer, jsonb, text, timestamptz)
  set search_path = public, extensions, pg_catalog;

alter function public.republish_report(uuid, integer, jsonb, text, timestamptz, boolean)
  set search_path = public, extensions, pg_catalog;

alter function public.redeem_share_token(text, text)
  set search_path = public, extensions, pg_catalog;

alter function public.publish_dashboard_as_report(uuid, text, text, jsonb, text, timestamptz)
  set search_path = public, extensions, pg_catalog;
