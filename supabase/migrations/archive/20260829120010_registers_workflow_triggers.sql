-- register_records workflow DB triggers
-- Closes gap: custom register rows had no workflow hooks.
-- Enables rules like "ny kjemikaliepost → opprett SJA-oppgave".
--
-- Events added: ON_REGISTER_RECORD_CREATED, ON_REGISTER_RECORD_UPDATED
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-forskriften § 5 nr. 7 — overvåking og
--   gjennomgang. Automatic routing when register entries are created or
--   updated ensures real-time traceability.
--   Restrisiko deferred: ON_REGISTER_RECORD_DELETED (soft-delete events
--   require deleted_at trigger — deferred to v1.1).

-- Wrapped in DO block: if the table doesn't exist yet (fresh installs
-- before register module is provisioned) the block exits cleanly.

do $$
begin

  -- ── ON_REGISTER_RECORD_CREATED ──────────────────────────────────────────────

  create or replace function public.trg_register_records_workflow_created()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  begin
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'registers', 'ON_REGISTER_RECORD_CREATED', to_jsonb(NEW)
    );
    return NEW;
  end;
  $fn$;

  drop trigger if exists register_records_workflow_created_tg on public.register_records;
  create trigger register_records_workflow_created_tg
    after insert on public.register_records
    for each row execute function public.trg_register_records_workflow_created();

  -- ── ON_REGISTER_RECORD_UPDATED ──────────────────────────────────────────────

  create or replace function public.trg_register_records_workflow_updated()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  begin
    perform public.workflow_dispatch_db_event(
      NEW.organization_id, 'registers', 'ON_REGISTER_RECORD_UPDATED', to_jsonb(NEW)
    );
    return NEW;
  end;
  $fn$;

  drop trigger if exists register_records_workflow_updated_tg on public.register_records;
  create trigger register_records_workflow_updated_tg
    after update on public.register_records
    for each row execute function public.trg_register_records_workflow_updated();

exception
  when undefined_table then
    raise notice 'register_records table not yet present — skipping workflow triggers';
end;
$$;
