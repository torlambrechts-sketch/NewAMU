-- Alerts v1.1 — formal state machine + snooze + case linking.
--
-- v1.0 status check accepted 6 values (received, triage, investigation,
-- internal_review, closed, dismissed). v1.1 spec defines 12:
--   received, triage, assigned, under_investigation,
--   awaiting_reporter_response, on_hold, decision, closed, rejected,
--   escalated, reopened, withdrawn
-- We widen the check constraint to accept the union of both sets so legacy
-- rows keep validating. New code uses the 12-value enum exclusively;
-- 'investigation' aliases 'under_investigation' and 'internal_review' aliases
-- 'decision' (queries that filter on either get both via the view in §3).
--
-- New columns on alert_cases:
--   snoozed_until    timestamptz nullable   (handler workflow §6)
--   snooze_reason    text nullable          (free-text for the inbox chip)
--   parent_case_id   uuid references alert_cases(id) (case linking §6)
--
-- New table: alert_workflow_transition (transition rule rows). Seeded with
-- default transitions per spec §3 state machine diagram. Org-scoped rows
-- (organization_id not null) can extend or restrict; system rows
-- (organization_id null) define the platform defaults.
--
-- Self-audit:
--   * AML § 2A-3 aktivitetsplikt — state machine encodes acknowledgement →
--     triage → assignment → investigation sequence with SLA clocks per state.
--   * GDPR Art. 33 (5) dokumentasjonsplikt — every transition writes a
--     timeline event (see _121400 audit hash chain migration).
--
-- Idempotent + additive.

set local search_path = public, pg_catalog;

-- ── 1. Widen status check ─────────────────────────────────────────────────

do $$
declare
  v_conname text;
begin
  -- Drop the existing check constraint if any.
  for v_conname in
    select conname from pg_constraint
    where conrelid = 'public.alert_cases'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%check%'
  loop
    execute format('alter table public.alert_cases drop constraint %I', v_conname);
  end loop;
end$$;

alter table public.alert_cases
  add constraint alert_cases_status_check
  check (status in (
    -- legacy v1.0 values (kept for backward compatibility)
    'received','triage','investigation','internal_review','closed','dismissed',
    -- v1.1 additions
    'assigned','under_investigation','awaiting_reporter_response','on_hold',
    'decision','rejected','escalated','reopened','withdrawn'
  ));

-- ── 2. Snooze + parent_case_id columns ────────────────────────────────────

alter table public.alert_cases
  add column if not exists snoozed_until  timestamptz;

alter table public.alert_cases
  add column if not exists snooze_reason  text;

alter table public.alert_cases
  add column if not exists parent_case_id uuid references public.alert_cases(id) on delete set null;

create index if not exists alert_cases_snoozed_idx
  on public.alert_cases (organization_id, snoozed_until)
  where snoozed_until is not null;

create index if not exists alert_cases_parent_case_idx
  on public.alert_cases (parent_case_id)
  where parent_case_id is not null;

-- ── 3. Lock trigger extension: parent_case_id mutable until close; snooze
--      always mutable; snoozed_until reset on close.
create or replace function public.alert_cases_lock_v11_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  -- parent_case_id immutable post-close.
  if old.closed_at is not null then
    if new.parent_case_id is distinct from old.parent_case_id then
      raise exception 'parent_case_id is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists alert_cases_lock_v11_columns_tg on public.alert_cases;
create trigger alert_cases_lock_v11_columns_tg
  before update on public.alert_cases
  for each row execute function public.alert_cases_lock_v11_columns();

-- ── 4. alert_workflow_transition table ────────────────────────────────────

create table if not exists public.alert_workflow_transition (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  from_state      text not null,
  to_state        text not null,
  allowed_roles   text[] not null default '{}',     -- e.g. {alerts.committee,alerts.dpo}
  preconditions   jsonb not null default '{}'::jsonb,
  side_effects    jsonb not null default '{}'::jsonb,
  sla_action      text not null default 'noop' check (sla_action in ('noop','start_feedback','start_interim','pause_feedback','stop_all')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, from_state, to_state)
);

create index if not exists alert_workflow_transition_lookup_idx
  on public.alert_workflow_transition (organization_id, from_state, to_state)
  where is_active = true;

alter table public.alert_workflow_transition enable row level security;

drop policy if exists alert_workflow_transition_select on public.alert_workflow_transition;
create policy alert_workflow_transition_select
  on public.alert_workflow_transition for select
  to authenticated
  using (organization_id is null or organization_id = public.current_org_id());

drop policy if exists alert_workflow_transition_write on public.alert_workflow_transition;
create policy alert_workflow_transition_write
  on public.alert_workflow_transition for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.manage'))
  );

drop trigger if exists alert_workflow_transition_set_updated_at on public.alert_workflow_transition;
create trigger alert_workflow_transition_set_updated_at
  before update on public.alert_workflow_transition
  for each row execute function public.set_updated_at();

-- ── 5. Seed default transitions (organization_id null = platform defaults) ─

insert into public.alert_workflow_transition
  (organization_id, from_state, to_state, allowed_roles, preconditions, side_effects, sla_action)
values
  (null, 'received', 'triage',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'noop'),
  (null, 'received', 'rejected',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresJustification":true}'::jsonb,
    '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb,
    'stop_all'),
  (null, 'triage', 'assigned',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresAssignedHandler":true,"requiresCoiDeclaration":true}'::jsonb,
    '{"emitTimeline":"assigned"}'::jsonb,
    'start_feedback'),
  (null, 'triage', 'rejected',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresJustification":true}'::jsonb,
    '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb,
    'stop_all'),
  (null, 'assigned', 'under_investigation',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  (null, 'under_investigation', 'awaiting_reporter_response',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'pause_feedback'),
  (null, 'awaiting_reporter_response', 'under_investigation',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.external_investigator'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  (null, 'under_investigation', 'on_hold',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresJustification":true}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'stop_all'),
  (null, 'on_hold', 'under_investigation',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  (null, 'under_investigation', 'decision',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresSeverity":true}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  (null, 'under_investigation', 'escalated',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated','alerts.board_escalation'],
    '{"requiresJustification":true}'::jsonb,
    '{"emitTimeline":"escalated"}'::jsonb,
    'noop'),
  (null, 'escalated', 'decision',
    array['alerts.committee_escalated','alerts.board_escalation'],
    '{"requiresSeverity":true}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  (null, 'decision', 'closed',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{"requiresClosingSummary":true,"requiresClosingOutcome":true,"requiresDecisionMemoFinalised":true}'::jsonb,
    '{"emitTimeline":"closed","stopClocks":true,"setClosedAt":true}'::jsonb,
    'stop_all'),
  (null, 'closed', 'reopened',
    array['alerts.committee_confidential','alerts.dpo','alerts.board_escalation'],
    '{"requiresJustification":true}'::jsonb,
    '{"emitTimeline":"reopened","clearClosedAt":true}'::jsonb,
    'start_interim'),
  (null, 'reopened', 'under_investigation',
    array['alerts.committee','alerts.committee_confidential','alerts.committee_escalated'],
    '{}'::jsonb,
    '{"emitTimeline":"state_changed"}'::jsonb,
    'start_interim'),
  -- Withdraw available from any open state (reporter-initiated). Seeded as
  -- explicit pairs for clarity; handler validates the source state.
  (null, 'received', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all'),
  (null, 'triage', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all'),
  (null, 'assigned', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all'),
  (null, 'under_investigation', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all'),
  (null, 'awaiting_reporter_response', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all'),
  (null, 'on_hold', 'withdrawn', array['reporter','alerts.dpo'],
    '{"requiresReporterConfirmation":true}'::jsonb, '{"emitTimeline":"state_changed","stopClocks":true}'::jsonb, 'stop_all')
on conflict (organization_id, from_state, to_state) do nothing;

-- ── 6. Legacy alias view: lets analyse-page filters that still reference
-- 'investigation' / 'internal_review' match 'under_investigation' / 'decision'.
create or replace view public.alert_cases_canonical_status as
  select c.*,
         case
           when c.status = 'investigation' then 'under_investigation'
           when c.status = 'internal_review' then 'decision'
           else c.status
         end as canonical_status
    from public.alert_cases c;

comment on view public.alert_cases_canonical_status is
  'Read-only projection mapping legacy v1.0 statuses to v1.1 canonical names. '
  'investigation→under_investigation, internal_review→decision.';

grant select on public.alert_cases_canonical_status to authenticated;
