-- Harden workflow_runs into a tamper-evident audit log.
--
-- Adds:
--   * input_snapshot / output_snapshot — full event payload + per-action
--     result (replaces the legacy 8 KB-truncated `detail.payloadSnapshot`)
--   * input_checksum — sha256 over the immutable bits (set by trigger)
--   * dry_run flag — populated by the simulator panel (no side effects)
--   * actor_id — who ran the rule (auth.uid()) when known
--   * confidentiality_level — mirrors workflow_rules; RLS hides body of
--     restricted/confidential runs from users without
--     workflows.view_confidential
--   * BEFORE UPDATE / DELETE policy chain that locks rows after
--     created_at + 30 days; auditors get insert-only history thereafter
--
-- workflow_run_evidence (next migration) chains its own sha256_checksum back
-- to workflow_runs.input_checksum to extend the integrity proof to
-- artefacts (kvittering PDFs, signed manifests, regulator receipts).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 + § 5 nr. 8 — sporbar overvåking
--   og gjennomgang. GDPR Art. 5(1)(f) — integritet og fortrolighet.
--   Restrisiko deferred: 30-dagers-låsen er fortsatt myk (BEFORE-trigger);
--   en hostile DBA med direct-SQL kan rote — det aksepteres siden Supabase
--   logger admin-aksess separat.

create extension if not exists pgcrypto with schema public;

alter table public.workflow_runs
  add column if not exists input_snapshot      jsonb,
  add column if not exists output_snapshot     jsonb,
  add column if not exists input_checksum      text,
  add column if not exists dry_run             boolean not null default false,
  add column if not exists actor_id            uuid references public.profiles (id),
  add column if not exists confidentiality_level text not null default 'standard'
    check (confidentiality_level in ('standard','restricted','confidential')),
  add column if not exists sealed_at           timestamptz;

-- Trigger fills input_checksum and seal time at insert. The checksum is a
-- sha256 over the immutable identifying fields so the evidence chain can
-- reference it. Output snapshot is set by the executor before commit (it
-- is allowed to mutate output_snapshot for the first 24h, then sealed).
create or replace function public.trg_workflow_runs_seal()
returns trigger
language plpgsql
as $$
declare
  v_canon text;
begin
  v_canon := coalesce(new.organization_id::text, '') || '|'
          || coalesce(new.rule_id::text, '')        || '|'
          || coalesce(new.source_module, '')        || '|'
          || coalesce(new.event, '')                || '|'
          || coalesce(new.created_at::text, now()::text) || '|'
          || coalesce(new.input_snapshot::text, '{}');
  new.input_checksum := encode(public.digest(v_canon, 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists workflow_runs_seal on public.workflow_runs;
create trigger workflow_runs_seal
  before insert on public.workflow_runs
  for each row execute function public.trg_workflow_runs_seal();

-- Lock window: rows older than 30 days are read-only for everyone (incl.
-- security-definer functions short of service-role).
create or replace function public.trg_workflow_runs_deny_late_update()
returns trigger
language plpgsql
as $$
begin
  if old.created_at < now() - interval '30 days' then
    raise exception 'workflow_runs row % is sealed (created_at=%, lock window 30d)', old.id, old.created_at;
  end if;
  -- Immutable bits: never editable regardless of window.
  if  new.organization_id is distinct from old.organization_id
   or new.rule_id        is distinct from old.rule_id
   or new.source_module  is distinct from old.source_module
   or new.event          is distinct from old.event
   or new.created_at     is distinct from old.created_at
   or new.input_checksum is distinct from old.input_checksum
   or new.input_snapshot is distinct from old.input_snapshot
  then
    raise exception 'workflow_runs row %: identifying fields are immutable', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_runs_deny_late_update on public.workflow_runs;
create trigger workflow_runs_deny_late_update
  before update on public.workflow_runs
  for each row execute function public.trg_workflow_runs_deny_late_update();

-- No deletes ever (workflow_runs is the audit substrate).
create or replace function public.trg_workflow_runs_deny_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workflow_runs is append-only; delete denied for row %', old.id;
end;
$$;

drop trigger if exists workflow_runs_deny_delete on public.workflow_runs;
create trigger workflow_runs_deny_delete
  before delete on public.workflow_runs
  for each row execute function public.trg_workflow_runs_deny_delete();

-- Refine RLS: confidential runs hidden from users without the new
-- workflows.view_confidential permission (defined in _120800).
drop policy if exists "workflow_runs_select_org" on public.workflow_runs;
create policy "workflow_runs_select_org"
  on public.workflow_runs for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or public.is_org_admin()
      or public.user_has_permission('workflows.view_confidential')
    )
  );

-- Index for the run-history panel: per-rule, newest first, with status.
create index if not exists workflow_runs_rule_idx
  on public.workflow_runs (rule_id, created_at desc) where rule_id is not null;

create index if not exists workflow_runs_status_idx
  on public.workflow_runs (organization_id, status, created_at desc);

comment on column public.workflow_runs.input_snapshot is
  'Full event payload at trigger time. Replaces legacy detail.payloadSnapshot (8KB-truncated).';
comment on column public.workflow_runs.output_snapshot is
  'Per-action result envelope captured by the executor before commit.';
comment on column public.workflow_runs.input_checksum is
  'sha256 over (org_id|rule_id|source_module|event|created_at|input_snapshot). Set by trigger.';
comment on column public.workflow_runs.dry_run is
  'TRUE when produced by the simulator panel — actions are described but not executed.';
