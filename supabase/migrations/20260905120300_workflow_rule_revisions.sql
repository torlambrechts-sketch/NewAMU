-- workflow_rule_revisions: append-only mutation log for workflow_rules.
--
-- Until this migration, workflow_rules had updated_at but no prior-version
-- record. For a Drata/Vanta-style compliance posture the auditor needs to
-- prove "this rule was already in place at time T" — and to see who
-- changed it, when, and to what.
--
-- A BEFORE-UPDATE trigger snapshots the OLD row into workflow_rule_revisions
-- before mutation. The table is insert-only; RLS denies updates and deletes
-- so an admin can't rewrite history.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — overvåking + § 5 nr. 8 —
--   gjennomgang og oppdatering. Krever sporbar endringshistorikk.
--   Restrisiko deferred: hash-chain på revisjoner kommer i Phase D
--   (workflow_run_evidence har Merkle-kjeden i denne sprinten).

create table if not exists public.workflow_rule_revisions (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid not null references public.workflow_rules (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  prev_name         text not null,
  prev_description  text not null,
  prev_is_active    boolean not null,
  prev_condition    jsonb not null,
  prev_actions      jsonb not null,
  prev_law_refs     text[] not null default '{}',
  prev_frameworks   text[] not null default '{}',
  prev_confidentiality_level text,
  prev_catalog_slug text,
  prev_catalog_version int,
  changed_by        uuid references public.profiles (id),
  changed_at        timestamptz not null default now(),
  change_reason     text,
  diff_summary      text   -- short human-readable summary, optional
);

create index if not exists workflow_rule_revisions_rule_idx
  on public.workflow_rule_revisions (rule_id, changed_at desc);

create index if not exists workflow_rule_revisions_org_idx
  on public.workflow_rule_revisions (organization_id, changed_at desc);

alter table public.workflow_rule_revisions enable row level security;

-- Org members can read their own org's revisions (subject to confidentiality
-- on the parent rule).
drop policy if exists "workflow_rule_revisions_select_org" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_select_org"
  on public.workflow_rule_revisions for select
  using (organization_id = public.current_org_id());

-- Only the trigger (via security definer) inserts. No user-level write.
drop policy if exists "workflow_rule_revisions_no_user_write" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_no_user_write"
  on public.workflow_rule_revisions for insert
  with check (false);

-- Deny update + delete unconditionally — immutable audit log.
drop policy if exists "workflow_rule_revisions_no_update" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_no_update"
  on public.workflow_rule_revisions for update
  using (false);

drop policy if exists "workflow_rule_revisions_no_delete" on public.workflow_rule_revisions;
create policy "workflow_rule_revisions_no_delete"
  on public.workflow_rule_revisions for delete
  using (false);

-- BEFORE UPDATE trigger on workflow_rules: snapshot OLD into revisions.
create or replace function public.trg_workflow_rules_log_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary text;
begin
  -- Skip noise: pure metadata bumps (last_reviewed_at / next_review_due) don't
  -- need a revision row. The auditor cares about definition + activation.
  if  new.name        is not distinct from old.name
  and new.description is not distinct from old.description
  and new.is_active   is not distinct from old.is_active
  and new.condition_json is not distinct from old.condition_json
  and new.actions_json   is not distinct from old.actions_json
  and new.law_refs    is not distinct from old.law_refs
  and new.frameworks  is not distinct from old.frameworks
  and new.confidentiality_level is not distinct from old.confidentiality_level
  then
    return new;
  end if;

  v_summary := case
    when new.is_active is distinct from old.is_active then
      case when new.is_active then 'rule_activated' else 'rule_deactivated' end
    when new.actions_json is distinct from old.actions_json then 'actions_changed'
    when new.condition_json is distinct from old.condition_json then 'condition_changed'
    when new.law_refs is distinct from old.law_refs then 'law_refs_changed'
    else 'definition_changed'
  end;

  insert into public.workflow_rule_revisions (
    rule_id, organization_id,
    prev_name, prev_description, prev_is_active,
    prev_condition, prev_actions,
    prev_law_refs, prev_frameworks, prev_confidentiality_level,
    prev_catalog_slug, prev_catalog_version,
    changed_by, changed_at, diff_summary
  ) values (
    old.id, old.organization_id,
    old.name, old.description, old.is_active,
    old.condition_json, old.actions_json,
    coalesce(old.law_refs, '{}'),
    coalesce(old.frameworks, '{}'),
    old.confidentiality_level,
    old.catalog_slug, old.catalog_version,
    auth.uid(), now(), v_summary
  );

  return new;
end;
$$;

drop trigger if exists workflow_rules_log_revision on public.workflow_rules;
create trigger workflow_rules_log_revision
  before update on public.workflow_rules
  for each row execute function public.trg_workflow_rules_log_revision();

comment on table public.workflow_rule_revisions is
  'Append-only mutation log of workflow_rules. Trigger-fed by trg_workflow_rules_log_revision; user-level INSERT/UPDATE/DELETE denied by RLS.';
