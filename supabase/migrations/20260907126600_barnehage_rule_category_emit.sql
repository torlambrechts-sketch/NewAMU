-- Barnehage tilsynsbrev — category column + emit it in workflow payload.
--
-- Arbeidstilsynet / Statsforvalter self-audit:
--   Pålegg-grunn addressed: Barnehageloven § 30 (Statsforvalter-tilsyn).
--   The barnehage-30-tilsynsbrev rule (_126500) keys on
--   field_equals path=category value=barnehage_statsforvalter, but the
--   emit-trigger in _123900 only included source_type — the rule never
--   matched, leaving § 30-tilsynsbrev to fall through to the generic
--   triage flow. This migration adds a categorization column to the
--   uploads table and re-issues the emit trigger to include it.
--   Restrisiko deferred: existing rows have category=NULL and will not
--   match the rule until users back-fill via the detail page.

set local search_path = public, pg_catalog;

-- ── 1. Add nullable category column ───────────────────────────────────────

alter table public.tilsynsbrev_uploads
  add column if not exists category text;

comment on column public.tilsynsbrev_uploads.category is
  'Optional sub-categorization of the upload (orthogonal to source_type). Used by sector packs (barnehage_statsforvalter, helsetilsynet_tilsyn, …) to discriminate workflow rules. Existing rows are NULL; rules MUST tolerate the null path or use a more specific match.';

-- ── 2. Re-issue emit trigger to include category in payload ───────────────
-- Preserves everything else in trg_tilsynsbrev_workflow_emit; only the
-- jsonb_build_object call now includes `category`.

create or replace function public.trg_tilsynsbrev_workflow_emit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_event   text;
begin
  if TG_OP = 'INSERT' then
    v_event := 'ON_TILSYNSBREV_UPLOADED';
  elsif TG_OP = 'UPDATE'
        and new.parsed_status = 'parsed'
        and (old.parsed_status is distinct from 'parsed') then
    v_event := 'ON_TILSYNSBREV_PARSED';
  else
    return new;
  end if;

  perform set_config('app.workflow_confidentiality',
                     coalesce(new.confidentiality_level, 'restricted'), true);

  v_payload := jsonb_build_object(
    'id',                   new.id,
    'rowId',                new.id,
    'organization_id',      new.organization_id,
    'source_type',          new.source_type,
    'category',             new.category,
    'uploaded_at',          new.uploaded_at,
    'uploaded_by',          new.uploaded_by,
    'parsed_status',        new.parsed_status,
    'parser_kind',          new.parser_kind,
    'parser_version',       new.parser_version,
    'storage_path',         new.storage_path,
    'sha256_checksum',      new.sha256_checksum,
    'confidentiality_level', new.confidentiality_level,
    'parsed_payload',       coalesce(new.parsed_payload, '{}'::jsonb)
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'tilsynsbrev',
      v_event,
      v_payload
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others             then
      begin
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, null, 'tilsynsbrev', v_event,
          'failed',
          jsonb_build_object('upload_id', new.id, 'error', sqlerrm,
                             'stage', 'trg_tilsynsbrev_workflow_emit')
        );
      exception when undefined_table then null;
      end;
  end;

  return new;
end;
$$;

comment on function public.trg_tilsynsbrev_workflow_emit() is
  'Dispatcher: emits ON_TILSYNSBREV_UPLOADED on insert and ON_TILSYNSBREV_PARSED when parsed_status flips to ''parsed''. Payload includes category (added 2026-09-07 _126600) so sector packs like barnehage-30-tilsynsbrev can field_equals-match on it. Sets app.workflow_confidentiality GUC so downstream workflow_runs inherit the upload-row gate.';

do $$
begin
  raise notice 'tilsynsbrev_uploads.category added; emit trigger re-issued with category in payload.';
end
$$;
