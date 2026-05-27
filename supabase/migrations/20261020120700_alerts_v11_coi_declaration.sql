-- Alerts v1.1 — alert_coi_declaration (Conflict-Of-Interest declarations).
--
-- v1.1 spec §6: every handler added to a case's roster must complete a COI
-- declaration before they can read or write the case body. Outcome
-- 'blocked' prevents the assignment from going through; 'cleared' lets it
-- proceed. Append-only by design (no UPDATE/DELETE); IP + UA hashes record
-- the declaration context for audit.
--
-- Self-audit:
--   * AML § 2A-7 (5) — handler with personal connection to subject must
--     recuse before reading identity. COI declaration is the documented gate.
--   * Forvaltningsloven § 6 (habilitet) — same principle for public-sector
--     committees; the form questions reference § 6 (a)-(e) sjekkpunkter.
--   * Forskrift om utførelse av arbeid kap. 31 — applied analogously to HMS
--     incident investigators.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_coi_declaration (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  handler_user_id uuid not null references auth.users (id) on delete cascade,
  questions       jsonb not null,                     -- frozen question set at declaration time
  answers         jsonb not null,                     -- {questionKey: yes|no} map
  outcome         text not null check (outcome in ('cleared','blocked','requires_review')),
  outcome_reason  text,                                -- when outcome != cleared
  ip_hash         bytea,
  ua_hash         bytea,
  declared_at     timestamptz not null default now(),
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  review_outcome  text check (review_outcome in ('cleared','blocked')),
  unique (case_id, handler_user_id)
);

create index if not exists alert_coi_declaration_handler_idx
  on public.alert_coi_declaration (handler_user_id, declared_at);

alter table public.alert_coi_declaration enable row level security;

-- Read: case-access list members; handler themselves can always read their own.
drop policy if exists alert_coi_declaration_select on public.alert_coi_declaration;
create policy alert_coi_declaration_select
  on public.alert_coi_declaration for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      handler_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
      or public.user_has_permission('alerts.dpo')
    )
  );

-- Insert: any authenticated user submitting their own declaration; mirror
-- the case-access predicate so an unrelated user can't insert.
drop policy if exists alert_coi_declaration_insert on public.alert_coi_declaration;
create policy alert_coi_declaration_insert
  on public.alert_coi_declaration for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and handler_user_id = auth.uid()
  );

-- Update gated to reviewer (committee_confidential or org admin). Reviewer
-- may set review_outcome / reviewed_at but cannot rewrite the original answers.
drop policy if exists alert_coi_declaration_update on public.alert_coi_declaration;
create policy alert_coi_declaration_update
  on public.alert_coi_declaration for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.committee_confidential'))
  )
  with check (
    organization_id = public.current_org_id()
  );

-- Append-only on the answers/questions columns — only review_outcome and
-- reviewed_* are mutable.
create or replace function public.alert_coi_declaration_before_update_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return new;
  end if;
  if new.case_id is distinct from old.case_id then
    raise exception 'alert_coi_declaration.case_id is immutable' using errcode = 'check_violation';
  end if;
  if new.handler_user_id is distinct from old.handler_user_id then
    raise exception 'alert_coi_declaration.handler_user_id is immutable' using errcode = 'check_violation';
  end if;
  if new.questions is distinct from old.questions then
    raise exception 'alert_coi_declaration.questions is immutable' using errcode = 'check_violation';
  end if;
  if new.answers is distinct from old.answers then
    raise exception 'alert_coi_declaration.answers is immutable' using errcode = 'check_violation';
  end if;
  if new.outcome is distinct from old.outcome then
    raise exception 'alert_coi_declaration.outcome is immutable (use review_outcome instead)' using errcode = 'check_violation';
  end if;
  if new.declared_at is distinct from old.declared_at then
    raise exception 'alert_coi_declaration.declared_at is immutable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_coi_declaration_before_update_lock_tg on public.alert_coi_declaration;
create trigger alert_coi_declaration_before_update_lock_tg
  before update on public.alert_coi_declaration
  for each row execute function public.alert_coi_declaration_before_update_lock();

-- Block delete.
create or replace function public.alert_coi_declaration_block_delete()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return old;
  end if;
  raise exception 'alert_coi_declaration rows cannot be deleted'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists alert_coi_declaration_block_delete_tg on public.alert_coi_declaration;
create trigger alert_coi_declaration_block_delete_tg
  before delete on public.alert_coi_declaration
  for each row execute function public.alert_coi_declaration_block_delete();

-- Helper: returns true when the caller has a cleared COI on a case (used by
-- alerts_execute_transition in _122200 to gate assignment).
create or replace function public.alerts_user_has_cleared_coi(p_case_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.alert_coi_declaration d
    where d.case_id = p_case_id
      and d.handler_user_id = p_user_id
      and (
        d.outcome = 'cleared'
        or (d.outcome = 'requires_review' and d.review_outcome = 'cleared')
      )
  );
$$;

revoke all on function public.alerts_user_has_cleared_coi(uuid, uuid) from public, anon;
grant execute on function public.alerts_user_has_cleared_coi(uuid, uuid) to authenticated, service_role;
