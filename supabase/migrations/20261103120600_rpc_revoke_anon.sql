-- Revoke anon/PUBLIC execute on the new RPCs (review hardening)
--
-- Postgres grants EXECUTE to PUBLIC by default, so the H1-H3 RPCs were
-- callable by the anon role. Every one of them rejects auth.uid() is null,
-- so anon calls already failed — this aligns the grants with the intent
-- (defense in depth + clears the supabase advisor warnings for new code).
-- The project-wide debt on pre-existing functions is left for its own pass.

revoke execute on function public.okr_record_checkin(uuid, numeric, numeric, text, uuid) from public, anon;
revoke execute on function public.okr_snapshot_plan(uuid, text) from public, anon;
revoke execute on function public.meetings_action_item_to_task(uuid) from public, anon;
revoke execute on function public.functional_role_sync_permissions(uuid, uuid, text) from public, anon;
revoke execute on function public.functional_roles_reconcile_org(uuid) from public, anon;
revoke execute on function public.gdpr_export_my_data() from public, anon;
