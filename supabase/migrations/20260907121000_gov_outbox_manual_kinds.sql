-- gov_notifications_outbox — extend kind CHECK with manual-triage rows.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: GDPR Art. 44 (Schrems-II) — regulator
--   notifications containing personopplysninger were previously routed
--   via SendGrid (US relay) when Altinn wasn't configured. The fix is
--   to queue a human-triage row instead. This constraint update lets
--   us insert kinds 'manual_datatilsynet_submission',
--   'manual_ldo_export' and 'manual_arbeidstilsynet_submission' so the
--   admin-inbox path stays inside Norway/EØS.
--   Restrisiko deferred: admin UI to drain the awaiting_human queue
--   (tracked in roadmap §workflow.audit, not this PR).

do $$
declare
  v_constraint text;
begin
  select pg_get_constraintdef(oid) into v_constraint
  from pg_constraint
  where conrelid = 'public.gov_notifications_outbox'::regclass
    and conname = 'gov_notifications_outbox_kind_check';

  if v_constraint is not null then
    alter table public.gov_notifications_outbox
      drop constraint gov_notifications_outbox_kind_check;
  end if;

  alter table public.gov_notifications_outbox
    add constraint gov_notifications_outbox_kind_check
    check (kind in (
      'datatilsynet_breach',
      'nav_sykefravar_outbox',
      'ldo_export_pending',
      'datatilsynet_manual_send_required',
      'manual_datatilsynet_submission',
      'manual_ldo_export',
      'manual_arbeidstilsynet_submission'
    ));
end$$;

comment on constraint gov_notifications_outbox_kind_check
  on public.gov_notifications_outbox is
  'Allowed outbox kinds. manual_* rows are human-triage (no auto-send) — see gov-outbox-worker awaiting_human path. Extended 2026-09-07 to remove SendGrid transit (GDPR Art. 44).';
