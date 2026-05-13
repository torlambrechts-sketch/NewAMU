-- workflow_approvals: human-in-the-loop step that pauses the queue.
--
-- A workflow action with type 'request_approval' enqueues a row in
-- workflow_action_queue with status 'awaiting_approval' AND inserts a row
-- here describing who needs to decide. When the approver acts (via UI deep
-- link → RPC), workflow_decide_approval() flips the queue row to 'pending'
-- (approved) or 'done' with a failure note (rejected). An escalation cron
-- task scans for stale approvals and bumps approver_user_id to the
-- configured fallback role.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 4 — fordeling av ansvar.
--   AML § 7-2 + § 6-2 — vedtak fra AMU/verneombud kan kreve formell
--   bekreftelse før system iverksetter.
--   Restrisiko deferred: BankID-on-mobile-signing av godkjenninger
--   (Phase E). Inntil videre er det auth.uid()-knytning.

-- Extend the queue status enum to include the two new pause-states.
alter table public.workflow_action_queue
  drop constraint if exists workflow_action_queue_status_check;

alter table public.workflow_action_queue
  add constraint workflow_action_queue_status_check
  check (status in (
    'pending',
    'processing',
    'awaiting_approval',
    'awaiting_schedule',
    'done',
    'failed',
    'cancelled'
  ));

create index if not exists workflow_action_queue_paused_idx
  on public.workflow_action_queue (status, execute_after)
  where status in ('awaiting_approval','awaiting_schedule');

create table if not exists public.workflow_approvals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id         uuid not null references public.workflow_rules (id) on delete cascade,
  run_id          uuid references public.workflow_runs (id),
  queue_id        uuid references public.workflow_action_queue (id) on delete cascade,
  requested_at    timestamptz not null default now(),
  approver_role   text,                            -- 'hms_leder' | 'amu_leder' | 'daglig_leder' | 'verneombud' | …
  approver_user_id uuid references public.profiles (id),
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','expired','cancelled')),
  decided_at      timestamptz,
  decision_note   text,
  escalate_after  interval,
  escalated_at    timestamptz,
  escalated_to_role text,
  reminder_sent_at timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists workflow_approvals_org_status_idx
  on public.workflow_approvals (organization_id, status, requested_at);

create index if not exists workflow_approvals_rule_idx
  on public.workflow_approvals (rule_id, requested_at desc);

create index if not exists workflow_approvals_queue_idx
  on public.workflow_approvals (queue_id) where queue_id is not null;

drop trigger if exists workflow_approvals_set_updated_at on public.workflow_approvals;
create trigger workflow_approvals_set_updated_at
  before update on public.workflow_approvals
  for each row execute function public.set_updated_at();

alter table public.workflow_approvals enable row level security;

drop policy if exists "workflow_approvals_select_org" on public.workflow_approvals;
create policy "workflow_approvals_select_org"
  on public.workflow_approvals for select
  using (organization_id = public.current_org_id());

-- Only the assigned approver (or an org admin / fallback role) can decide.
-- Mutations go through workflow_decide_approval() — direct update is fine
-- too as long as the user is the approver, but we keep policy permissive
-- and let the function be the canonical path.
drop policy if exists "workflow_approvals_write" on public.workflow_approvals;
create policy "workflow_approvals_write"
  on public.workflow_approvals for all
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.activate')
      or approver_user_id = (select auth.uid())
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.activate')
      or approver_user_id = (select auth.uid())
    )
  );

-- RPC: approve / reject. Updates approval + flips queue row.
create or replace function public.workflow_decide_approval(
  p_approval_id uuid,
  p_decision    text,                 -- 'approved' | 'rejected'
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appr record;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'p_decision must be approved or rejected';
  end if;

  select * into v_appr
    from public.workflow_approvals
   where id = p_approval_id
   for update;

  if not found then
    raise exception 'Approval % not found', p_approval_id;
  end if;

  if v_appr.status <> 'pending' then
    raise exception 'Approval % is already %', p_approval_id, v_appr.status;
  end if;

  if v_appr.organization_id is distinct from public.current_org_id() then
    raise exception 'Cross-org approval not allowed';
  end if;

  -- Authorisation: the approver, an org admin, or someone with the
  -- workflows.activate permission can decide.
  if not (
    public.is_org_admin()
    or public.user_has_permission('workflows.activate')
    or v_appr.approver_user_id = v_uid
  ) then
    raise exception 'Not authorised to decide approval %', p_approval_id;
  end if;

  update public.workflow_approvals
     set status = p_decision,
         decided_at = now(),
         decision_note = p_note,
         approver_user_id = coalesce(approver_user_id, v_uid)
   where id = p_approval_id;

  -- Resume / cancel the queue row.
  if p_decision = 'approved' then
    update public.workflow_action_queue
       set status = 'pending',
           execute_after = now()
     where id = v_appr.queue_id
       and status = 'awaiting_approval';
  else
    update public.workflow_action_queue
       set status = 'cancelled',
           last_error = 'rejected by approver: ' || coalesce(p_note, '(no note)')
     where id = v_appr.queue_id
       and status = 'awaiting_approval';
  end if;
end;
$$;

grant execute on function public.workflow_decide_approval(uuid, text, text) to authenticated;

-- Escalation sweep: called by pg_cron. Bumps approver to escalated role
-- when older than escalate_after.
create or replace function public.workflow_escalate_stale_approvals()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update public.workflow_approvals
     set escalated_at = now(),
         metadata = metadata || jsonb_build_object(
           'escalation_at', now(),
           'original_approver_user_id', approver_user_id
         )
   where status = 'pending'
     and escalate_after is not null
     and escalated_at is null
     and requested_at + escalate_after <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.workflow_escalate_stale_approvals() to service_role;

-- pg_cron job: every 5 minutes.
do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_escalate_stale_approvals')
    loop perform cron.unschedule(r.jobid); end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_escalate_stale_approvals',
      '*/5 * * * *',
      $cmd$select public.workflow_escalate_stale_approvals();$cmd$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

comment on table public.workflow_approvals is
  'Human-in-the-loop step that pauses a workflow_action_queue row until an approver decides. Decided via workflow_decide_approval(); escalated by workflow_escalate_stale_approvals().';
