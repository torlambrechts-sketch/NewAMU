-- gov_notifications_outbox — pending external deliveries for the gov
-- worker.
--
-- compliance_notifications (archive/_20260904120100) is user-targeted
-- (recipient_user_id, category enum, read/dismissed lifecycle). The gov
-- outbox is regulator-targeted (no internal recipient) so it needs its
-- own shape — same reason we didn't piggy-back on org_module_payloads.
--
-- One row per outbound message. The gov-outbox-worker edge function
-- (drained every 5 minutes by workflow_gov_outbox_tick) sets
-- resolved_at on success; on failure increments attempt_count and
-- stores last_error.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiserte meldinger må
--   kunne re-prøves og spores. Tidligere blanding mot
--   compliance_notifications brøt skjemaet med ikke-godkjente kategorier.
--   Restrisiko deferred: per-org rate-limiting på outbox-utlevering
--   (Phase E sprint-2).

create table if not exists public.gov_notifications_outbox (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            text not null check (kind in (
                    'datatilsynet_breach',
                    'nav_sykefravar_outbox',
                    'ldo_export_pending',
                    'datatilsynet_manual_send_required'
                  )),
  payload         jsonb not null default '{}'::jsonb,
  run_id          uuid references public.workflow_runs (id),
  rule_id         uuid references public.workflow_rules (id) on delete set null,
  resolved_at     timestamptz,
  attempt_count   int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists gov_outbox_pending_idx
  on public.gov_notifications_outbox (kind, created_at)
  where resolved_at is null;

create index if not exists gov_outbox_org_idx
  on public.gov_notifications_outbox (organization_id, created_at desc);

drop trigger if exists gov_outbox_set_updated_at on public.gov_notifications_outbox;
create trigger gov_outbox_set_updated_at
  before update on public.gov_notifications_outbox
  for each row execute function public.set_updated_at();

alter table public.gov_notifications_outbox enable row level security;

drop policy if exists "gov_outbox_select_org" on public.gov_notifications_outbox;
create policy "gov_outbox_select_org"
  on public.gov_notifications_outbox for select
  using (organization_id = public.current_org_id());

-- Only service-role / org_admin can write.
drop policy if exists "gov_outbox_manage" on public.gov_notifications_outbox;
create policy "gov_outbox_manage"
  on public.gov_notifications_outbox for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

comment on table public.gov_notifications_outbox is
  'Pending external regulator deliveries. Drained by gov-outbox-worker every 5 min. resolved_at NULL = pending, NOT NULL = sent.';
