-- task_items kind-gates: NULL template_kind fix (review finding)
--
-- Gap closed: three trigger functions guard on template_kind with
-- NULL-unsafe predicates — `not in ('avvik','nestenulykke')` and
-- `<> 'risiko'` both evaluate to NULL (not true) for tasks WITHOUT a
-- template kind, so the early-return is skipped and the gate logic runs for
-- plain tasks. Every task created from /planlegging has template_kind NULL,
-- so the hard avvik/risiko gates blocked closing ordinary tasks with
-- misleading errors, and a NULL-kind critical task would have spawned a
-- spurious Arbeidstilsynet notification. Found by the post-implementation
-- DB test suite when closing a generic test task tripped both gates.
--
-- Self-audit: each gate's own comment says it fires ONLY for its kinds —
-- this restores that intent with NULL-safe guards. Enforcement for actual
-- avvik/nestenulykke/risiko is unchanged. Restrisiko: none — strictly
-- narrows each gate to its documented scope.

create or replace function public.trg_task_avvik_closure_gate_fn()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_gate text;
begin
  -- Only fires for avvik and nestenulykke template kinds. NULL-safe:
  -- a task without template_kind is a generic task, never CAPA-gated.
  if new.template_kind is null
     or new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  if new.status <> 'closed' or old.status = 'closed' then
    return new;
  end if;

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

  if old.status <> 'effectiveness_verified' then
    if v_gate = 'hard' then
      raise exception
        'AVVIK_CLOSURE_GATE_HARD: Avvik kan ikke lukkes uten at CAPA-flyten er fullført '
        '(effektivitetsverifikasjon mangler). Siste status var «%». '
        'Fullfør CAPA-flyten, eller endre avviksgaten til «soft» i innstillingene.',
        old.status
        using errcode = 'P0001';
    else
      raise notice 'AVVIK_CLOSURE_GATE_SOFT: Avvik lukkes uten fullstendig CAPA-flyt (siste status: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.trg_task_risiko_reviewer_gate_fn()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_required boolean;
begin
  -- NULL-safe: a task without template_kind is never the risiko kind.
  if new.template_kind is distinct from 'risiko' then
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
      'gjennomgang er dokumentert. Sett reviewer_user_id til en annen person enn eier.'
      using errcode = 'P0002';
  end if;

  if new.reviewer_user_id = new.created_by then
    raise exception
      'RISIKO_REVIEWER_GATE: Risikovurdering krever uavhengig gjennomgang — '
      'reviewer kan ikke være samme person som opprettet oppgaven (ISO 45001 § 5.3).'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

create or replace function public.trg_task_aml51_auto_notification_fn()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auto    boolean;
  v_hours   int;
  v_due_at  timestamptz;
begin
  -- Only fire for new critical avvik/nestenulykke. NULL-safe: a task
  -- without template_kind must never spawn an Arbeidstilsynet task.
  if new.template_kind is null
     or new.template_kind not in ('avvik', 'nestenulykke') then
    return new;
  end if;

  if new.priority <> 'critical' then
    return new;
  end if;

  select
    coalesce(s.auto_arbeidstilsynet_task, true),
    coalesce(s.arbeidstilsynet_notification_hours, 24)
  into v_auto, v_hours
  from public.task_module_settings s
  where s.organization_id = new.organization_id;

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
      || 'og senest innen ' || v_hours || ' timer. Benytt Altinn-skjema NAV 13-07.05.',
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
