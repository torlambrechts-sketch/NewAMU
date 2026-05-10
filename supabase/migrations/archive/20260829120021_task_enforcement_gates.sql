-- Task enforcement gates — DB-level compliance rules.
--
-- Coverage gaps closed:
--   AML § 5-2 + ISO 45001 § 10.2: avvik must complete the CAPA lifecycle
--     before being closed. Without enforcement, operators can close avvik
--     without documenting root cause or verifying effectiveness — creating
--     a paper trail that fails external audit.
--   AML § 5-1: Serious injuries/incidents must be reported to Arbeidstilsynet
--     within 24 hours. Automatic task creation ensures no report is missed.
--   ISO 45001 § 5.3 / IK-f § 5 nr. 3: Risikovurderinger krever uavhengig
--     gjennomgang (reviewer ≠ eier). DB-trigger sikrer at 'lukket' bare
--     settes hvis reviewer_user_id er utfylt og ≠ created_by.
--
-- Self-audit (Arbeidstilsynet POV):
--   Gate 1 (avvik): Pålegg-grunn AML § 5-2. Hard-gate = exception i DB;
--     organisasjoner kan senke til 'soft' (UI-advarsel) eller 'none'
--     (ingen sjekk) — dette loggføres i task_module_settings og er synlig
--     for revisor.
--   Gate 2 (AML § 5-1): Trigger oppretter oppgaven kun ved priority='critical'
--     og auto_arbeidstilsynet_task=true. Trigger-guard mot rekursjon via
--     template_kind-sjekk.
--   Gate 3 (risiko): requires_independent_review=true er default. Kan
--     deaktiveres av org-admin — endringen loggføres.
--   Restrisiko: Triggers leser task_module_settings; ny org uten settings
--     faller tilbake på DEFAULT (hard / true / true). Provision-funksjonen
--     sikrer at settings alltid eksisterer etter onboarding.

set local search_path = public, pg_catalog;

-- ── Gate 1: avvik/nestenulykke closure hard gate ──────────────────────────
--
-- Blocks setting status='closed' on avvik/nestenulykke items unless the item
-- previously reached 'effectiveness_verified' (full CAPA flow).
-- Org setting avvik_closure_gate='hard' enforces this at DB level;
-- 'soft' returns a WARNING (pg RAISE NOTICE); 'none' is a no-op.

create or replace function public.trg_task_avvik_closure_gate_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate text;
begin
  -- Only fires for avvik and nestenulykke template kinds
  if new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  -- Only fires when transitioning TO 'closed'
  if new.status <> 'closed' or old.status = 'closed' then
    return new;
  end if;

  -- Read org gate setting (default 'hard' if no row)
  select coalesce(s.avvik_closure_gate, 'hard')
    into v_gate
    from public.task_module_settings s
   where s.organization_id = new.organization_id;

  if v_gate is null then
    v_gate := 'hard';
  end if;

  if v_gate = 'none' then
    return new;
  end if;

  -- Previous status must have been effectiveness_verified (full CAPA loop)
  if old.status <> 'effectiveness_verified' then
    if v_gate = 'hard' then
      raise exception
        'AVVIK_CLOSURE_GATE_HARD: Avvik kan ikke lukkes uten at CAPA-flyten er fullført '
        '(effektivitetsverifikasjon mangler). Siste status var «%». '
        'Fullfør CAPA-flyten, eller endre avviksgaten til «soft» i innstillingene.',
        old.status
        using errcode = 'P0001';
    else
      -- soft: allow but log warning
      raise notice 'AVVIK_CLOSURE_GATE_SOFT: Avvik lukkes uten fullstendig CAPA-flyt (siste status: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists task_avvik_closure_gate_tg on public.task_items;
create trigger task_avvik_closure_gate_tg
  before update of status on public.task_items
  for each row execute function public.trg_task_avvik_closure_gate_fn();

-- ── Gate 2: AML § 5-1 auto-notification task ─────────────────────────────
--
-- When a critical avvik or nestenulykke is created and the org has
-- auto_arbeidstilsynet_task=true, inserts a linked notification task
-- ("Meldeplikt Arbeidstilsynet — AML § 5-1") with due date = NOW() +
-- arbeidstilsynet_notification_hours (default 24h).
--
-- Recursion guard: the inserted task has template_kind='oppgave', so the
-- trigger won't fire again for the notification task itself.

create or replace function public.trg_task_aml51_auto_notification_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto    boolean;
  v_hours   int;
  v_due_at  timestamptz;
begin
  -- Only fire for new critical avvik/nestenulykke
  if new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  if new.priority <> 'critical' then
    return new;
  end if;

  -- Read org setting
  select
    coalesce(s.auto_arbeidstilsynet_task, true),
    coalesce(s.arbeidstilsynet_notification_hours, 24)
  into v_auto, v_hours
  from public.task_module_settings s
  where s.organization_id = new.organization_id;

  -- Default to enabled if no settings row
  if v_auto is null then v_auto := true; end if;
  if v_hours is null then v_hours := 24; end if;

  if not v_auto then
    return new;
  end if;

  v_due_at := now() + (v_hours || ' hours')::interval;

  insert into public.task_items (
    organization_id,
    pack,
    title,
    description,
    status,
    priority,
    source_category,
    template_kind,
    template_slug,
    pdca_phase,
    parent_item_id,
    due_date,
    sla_due_at,
    created_by
  ) values (
    new.organization_id,
    new.pack,
    'Meldeplikt Arbeidstilsynet — AML § 5-1',
    'Alvorlig hendelse registrert. AML § 5-1 krever at Arbeidstilsynet varsles snarest, '
      'og senest innen ' || v_hours || ' timer. Benytt Altinn-skjema NAV 13-07.05.',
    'open',
    'critical',
    'general',
    'oppgave',
    'oppgave-generell',
    'do',
    new.id,
    v_due_at::date,
    v_due_at,
    new.created_by
  );

  return new;
end;
$$;

drop trigger if exists task_aml51_auto_notification_tg on public.task_items;
create trigger task_aml51_auto_notification_tg
  after insert on public.task_items
  for each row execute function public.trg_task_aml51_auto_notification_fn();

-- ── Gate 3: risiko independent reviewer gate ─────────────────────────────
--
-- When a risiko item is set to 'closed', verifies that:
--   1. reviewer_user_id is set
--   2. reviewer_user_id ≠ created_by (segregation of duties)
-- Controlled by task_module_settings.requires_independent_review.

create or replace function public.trg_task_risiko_reviewer_gate_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required boolean;
begin
  if new.template_kind <> 'risiko' then
    return new;
  end if;

  if new.status <> 'closed' or old.status = 'closed' then
    return new;
  end if;

  select coalesce(s.requires_independent_review, true)
    into v_required
    from public.task_module_settings s
   where s.organization_id = new.organization_id;

  if v_required is null then v_required := true; end if;

  if not v_required then
    return new;
  end if;

  if new.reviewer_user_id is null then
    raise exception
      'RISIKO_REVIEWER_GATE: Risikovurdering kan ikke lukkes uten at en uavhengig '
      'gjennomgang er dokumentert. Sett reviewer_user_id til en annen person enn eier.',
      using errcode = 'P0002';
  end if;

  if new.reviewer_user_id = new.created_by then
    raise exception
      'RISIKO_REVIEWER_GATE: Risikovurdering krever uavhengig gjennomgang — '
      'reviewer kan ikke være samme person som opprettet oppgaven (ISO 45001 § 5.3).',
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists task_risiko_reviewer_gate_tg on public.task_items;
create trigger task_risiko_reviewer_gate_tg
  before update of status on public.task_items
  for each row execute function public.trg_task_risiko_reviewer_gate_fn();
