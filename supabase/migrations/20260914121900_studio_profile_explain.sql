-- Studio Builder — studio_profile_explain(p_table) RPC.
--
-- Helper for scripts/studio-rls-profile.ts. Returns the EXPLAIN ANALYZE
-- plan for `select 1 from <table> limit 50` as text. Caller-only; the
-- function is platform-admin-gated to avoid leaking row count via the
-- plan output to a non-admin.
--
-- Spec: specs/studio-builder.md §9.2 (perf budget verification).

set local search_path = public, pg_catalog;

create or replace function public.studio_profile_explain(p_table text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_allowed text[] := array[
    'studio_revisions',
    'studio_packs',
    'studio_pack_drafts',
    'compliance_checklist_templates',
    'survey_org_templates',
    'document_org_templates',
    'meeting_org_templates',
    'register_types',
    'learning_courses',
    'dashboard_layouts'
  ];
  v_plan text := '';
  v_line text;
begin
  if not public.platform_is_admin() then
    raise exception 'Only platform admins can run RLS profiles.' using errcode = 'P0001';
  end if;
  if not (p_table = any (v_allowed)) then
    raise exception 'Table % is not in the studio-aware list.', p_table using errcode = 'P0001';
  end if;

  for v_line in
    execute format('explain (analyze, buffers, timing on, format text) select 1 from public.%I limit 50', p_table)
  loop
    v_plan := v_plan || v_line || E'\n';
  end loop;

  return v_plan;
end;
$fn$;

comment on function public.studio_profile_explain(text) is
  'Studio Builder Phase 3 — return EXPLAIN ANALYZE for a studio-aware table. Platform-admin gated. Used by scripts/studio-rls-profile.ts to validate spec §9.2 <10ms target.';

grant execute on function public.studio_profile_explain(text) to authenticated;
