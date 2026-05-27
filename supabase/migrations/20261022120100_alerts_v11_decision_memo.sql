-- Alerts v1.1 — alert_decision_memo (decision memo template).
--
-- v1.1 §6: every closing decision is captured in an internal-only memo
-- with five sections (facts, evidence_weighed, rules, conclusion, basis).
-- Finalisation locks the memo; the state-machine transition decision →
-- closed requires a finalised memo.
--
-- Self-audit:
--   * Forvaltningsloven § 25 — krav til skriftlig begrunnelse for vedtak.
--   * GDPR Art. 5 (2) accountability — decision memo is the evidence the
--     committee can show in an audit.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_decision_memo (
  id                       uuid primary key default gen_random_uuid(),
  case_id                  uuid not null unique references public.alert_cases (id) on delete cascade,
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  facts_encrypted          bytea,
  evidence_weighed_encrypted bytea,
  rules_encrypted          bytea,
  conclusion_encrypted     bytea,
  basis_encrypted          bytea,
  key_version              integer not null default 1,
  drafted_by               uuid references auth.users (id) on delete set null,
  drafted_at               timestamptz not null default now(),
  finalised_at             timestamptz,
  finalised_by             uuid references auth.users (id) on delete set null,
  updated_at               timestamptz not null default now()
);

create index if not exists alert_decision_memo_case_idx on public.alert_decision_memo (case_id);

alter table public.alert_decision_memo enable row level security;

drop policy if exists alert_decision_memo_select on public.alert_decision_memo;
create policy alert_decision_memo_select
  on public.alert_decision_memo for select
  to authenticated
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id and c.organization_id = public.current_org_id()
    )
  );

drop policy if exists alert_decision_memo_write on public.alert_decision_memo;
create policy alert_decision_memo_write
  on public.alert_decision_memo for all
  using (
    exists (
      select 1 from public.alert_cases c
      where c.id = case_id and c.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
    )
  )
  with check (organization_id = public.current_org_id());

-- Finalised memos are immutable.
create or replace function public.alert_decision_memo_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id then
    raise exception 'alert_decision_memo.case_id is immutable' using errcode = 'check_violation';
  end if;
  if old.finalised_at is not null and new is distinct from old then
    raise exception 'alert_decision_memo is locked after finalisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_decision_memo_before_update_lock_tg on public.alert_decision_memo;
create trigger alert_decision_memo_before_update_lock_tg
  before update on public.alert_decision_memo
  for each row execute function public.alert_decision_memo_before_update_lock();

drop trigger if exists alert_decision_memo_set_updated_at on public.alert_decision_memo;
create trigger alert_decision_memo_set_updated_at
  before update on public.alert_decision_memo
  for each row execute function public.set_updated_at();

-- Helper used by state-machine precondition: requiresDecisionMemoFinalised.
create or replace function public.alerts_case_has_finalised_memo(p_case_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.alert_decision_memo
    where case_id = p_case_id and finalised_at is not null
  );
$$;

revoke all on function public.alerts_case_has_finalised_memo(uuid) from public, anon;
grant execute on function public.alerts_case_has_finalised_memo(uuid) to authenticated, service_role;
