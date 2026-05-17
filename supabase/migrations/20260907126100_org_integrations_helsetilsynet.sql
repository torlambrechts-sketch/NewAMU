-- Extend org_integrations.kind + gov_notifications_outbox.kind for the
-- helsesektor regulators: Statens helsetilsyn (spes.helsetjl. § 3-3) og
-- UKOM (hol. § 12-3 a). Begge mottar i dag varsler via melde.no / e-post —
-- ingen Maskinporten/Altinn-flyt — så wizard'en lagrer kontakt-info +
-- melding-template og outbox-rader fanges opp av eksisterende manual_*
-- triage-flyt (_125700).

-- ── 1. org_integrations.kind — utvid CHECK med 'helsetilsynet' + 'ukom' ──
-- Idempotent: vi henter den nåværende CHECK-listen via pg_get_constraintdef
-- og legger til de to nye verdiene uten å nullstille noe annet.

do $$
declare
  v_constraint_exists boolean;
begin
  select exists (
    select 1
      from pg_constraint
     where conrelid = 'public.org_integrations'::regclass
       and conname  = 'org_integrations_kind_check'
  ) into v_constraint_exists;

  if v_constraint_exists then
    alter table public.org_integrations
      drop constraint org_integrations_kind_check;
  end if;

  alter table public.org_integrations
    add constraint org_integrations_kind_check
    check (kind in (
      'bankid',
      'eco_online',
      'altinn',
      'lovdata_pro',
      'feide',
      'regint',
      'datatilsynet',
      'nav',
      'helsetilsynet',   -- Statens helsetilsyn — spes.helsetjl. § 3-3, manuell e-melding
      'ukom'             -- Statens undersøkelseskommisjon helse/omsorg — hol. § 12-3 a
    ));
end$$;

comment on constraint org_integrations_kind_check
  on public.org_integrations is
  'Allowed integration kinds. helsetilsynet/ukom added 2026-09-07: ingen API hos regulator — wizard lagrer kontakt-info + melding-template, dispatch går via gov_notifications_outbox manual_* triage-flyt.';

-- ── 2. gov_notifications_outbox.kind — utvid CHECK med to nye manual_* ──
-- Speiler _121000-mønsteret (idempotent drop+add). Disse to verdiene lar
-- helsetilsynet-build-melding edge-funksjonen sette inn rader som
-- GovOutboxPage triage-UI plukker opp automatisk.

do $$
declare
  v_constraint_def text;
begin
  select pg_get_constraintdef(oid) into v_constraint_def
    from pg_constraint
   where conrelid = 'public.gov_notifications_outbox'::regclass
     and conname  = 'gov_notifications_outbox_kind_check';

  if v_constraint_def is not null then
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
      'manual_arbeidstilsynet_submission',
      'manual_helsetilsynet_submission',  -- spes.helsetjl. § 3-3 + helsepers.l. § 17
      'manual_ukom_submission'            -- hol. § 12-3 a + spes.helsetjl. § 3-3 a
    ));
end$$;

comment on constraint gov_notifications_outbox_kind_check
  on public.gov_notifications_outbox is
  'Allowed outbox kinds. manual_helsetilsynet_submission + manual_ukom_submission added 2026-09-07 — helsesektor har ingen regulator-API, så dispatchen blir manuell triage via samme awaiting_human-flyt.';
