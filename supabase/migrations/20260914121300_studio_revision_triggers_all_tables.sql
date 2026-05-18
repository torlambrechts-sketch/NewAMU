-- Studio Builder — attach studio_capture_revision() to every studio-aware
-- authoring table.
--
-- Task 0.1 wired the trigger on compliance_checklist_templates as the
-- smoke-test surface. Phase 1 ships preset mutators that also write to:
--
--   - surveys                       (survey scope presets)
--   - survey_org_templates          (survey advanced)
--   - wiki_pages                    (documents scope presets)
--   - document_org_templates        (documents advanced)
--   - learning_courses              (learning scope presets)
--   - meetings                      (meetings scope presets)
--   - meeting_org_templates         (meetings advanced)
--   - register_types                (registers scope presets)
--   - dashboard_layouts             (dashboards scope presets)
--
-- This migration extends the trigger to all of them so every studio-
-- mediated write leaves an audit row. Tables are wrapped in
-- `pg_tables`-existence checks because some shipped as part of recent
-- modules and not every env has every one applied.
--
-- The trigger function already honours `app.studio_skip_revisions` GUC
-- (Task 0.1), so bulk paths (provision_*_baseline_for_org, pack
-- imports) still write 0 revision rows.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 (avviksbehandling) — every
--   change to compliance authoring is captured for traceability.
--   AML § 18-1 (tilsyn) — auditors get a tamper-evident change log of
--   what the org's admins did and when.
--   Restrisiko deferred: none — additive trigger only.
--
-- Idempotent.

set local search_path = public, pg_catalog;

do $do$
declare
  v_attachments text[][] := array[
    array['surveys',                  'survey',     'campaign'],
    array['survey_org_templates',     'survey',     'template'],
    array['wiki_pages',               'documents',  'page'],
    array['document_org_templates',   'documents',  'template'],
    array['learning_courses',         'learning',   'course'],
    array['meetings',                 'meetings',   'meeting'],
    array['meeting_org_templates',    'meetings',   'template'],
    array['register_types',           'registers',  'type'],
    array['dashboard_layouts',        'dashboards', 'layout']
  ];
  v_row text[];
  v_table text;
  v_scope text;
  v_kind text;
  v_trigger_name text;
begin
  foreach v_row slice 1 in array v_attachments
  loop
    v_table  := v_row[1];
    v_scope  := v_row[2];
    v_kind   := v_row[3];
    v_trigger_name := 'trg_studio_revisions_' || v_table;

    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = v_table) then
      execute format('drop trigger if exists %I on public.%I', v_trigger_name, v_table);
      execute format(
        'create trigger %I
           after insert or update or delete on public.%I
           for each row execute function public.studio_capture_revision(%L, %L)',
        v_trigger_name, v_table, v_scope, v_kind
      );
    else
      raise notice '[studio_revision_triggers] table %s missing — skipping', v_table;
    end if;
  end loop;
end
$do$;
