-- Cadence — second round of fixes after review.
--
-- 1. Pack-enum cast: task_items.pack is type `task_pack`, not
--    `compliance_pack`. These are distinct enums (samme verdier, men
--    separate typer i Postgres). Cast via text for å unngå
--    42804-feilen vi traff i smoke-test.
--
-- 2. Idempotency guard: legg til en partial unique index på
--    task_items(source_type, source_id, template_slug) for cadence_plan
--    bridge-rader, slik at gjenkalling av cadence_plan_activate ikke
--    oppretter dupliserte task-rader. RPC-en bruker `on conflict do
--    nothing` så den fanger duplikatet i stedet for å feile.
--
-- 3. nav_pinned-default: cadence-tasks bør ikke vises i template-bibliotek
--    siden de er auto-generert. Ingen handling her — task_items har ikke
--    nav_pinned (kun task_org_templates har det).
--
-- Self-audit:
--   * Bug 1 (enum-mismatch) ble fanget i smoke-test, ikke i produksjon.
--   * Bug 2 (duplikate tasks) kunne oppstått hvis brukeren trykker
--     iverksett to ganger raskt etter hverandre på samme plan.
--   * Forrige migration's `on conflict do nothing` var en no-op uten
--     en passende unik nøkkel — nå har vi den.

set local search_path = public, pg_catalog;

-- ── 1. Partial unique index for cadence bridge tasks ─────────────────────

-- Én aktiv (deleted_at is null) task per (source_type, source_id, template_slug).
-- template_slug er 'cadence_m01', 'cadence_m04' osv. — unikt per (plan, modul).
create unique index if not exists task_items_cadence_bridge_uidx
  on public.task_items (source_id, template_slug)
  where source_type = 'cadence_plan' and deleted_at is null;

comment on index public.task_items_cadence_bridge_uidx is
  'Idempotency: én aktiv task_items-rad per (cadence_plan, modul). RPC cadence_plan_activate bruker on conflict do nothing.';

-- ── 2. Fix RPC: cast pack from compliance_pack til task_pack ────────────

create or replace function public.cadence_plan_activate(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_plan record;
  v_mod record;
  v_due date;
  v_task_id uuid;
  v_pack public.task_pack;
begin
  select * into v_plan
    from public.cadence_plans
    where id = p_plan_id
      and organization_id = public.current_org_id()
      and deleted_at is null;
  if not found then
    raise exception 'Cadence-plan ikke funnet eller utenfor organisasjonen.';
  end if;

  if not (public.is_org_admin() or v_plan.created_by = auth.uid()) then
    raise exception 'Mangler tilgang til å iverksette cadence-planen.';
  end if;

  -- Cast compliance_pack → task_pack via text. Begge enumer har
  -- samme verdier (aml-amu, iso-45001, iso-9001, iso-14001, iso-27001)
  -- men er distinkte Postgres-typer.
  v_pack := v_plan.pack::text::public.task_pack;

  update public.cadence_plans
    set status = 'active',
        activated_at = coalesce(activated_at, now()),
        wizard_step = 8
    where id = p_plan_id;

  for v_mod in
    select m.module_id, m.name, m.law_refs, m.cadence_hint, m.frequency, m.description, m.volume
      from public.cadence_plan_modules m
      where m.cadence_plan_id = p_plan_id
  loop
    v_due := (now() + interval '30 days')::date;

    insert into public.task_items (
      organization_id, title, description, priority, status, pack,
      source_type, source_id, law_refs, source_category, pdca_phase,
      template_slug, template_kind, due_date
    )
    values (
      v_plan.organization_id,
      v_mod.name,
      coalesce(v_mod.description, '') ||
        case when v_mod.frequency is not null then E'\n\nFrekvens: ' || v_mod.frequency else '' end ||
        case when v_mod.cadence_hint is not null then E'\nCadence: ' || v_mod.cadence_hint else '' end,
      'medium',
      'open',
      v_pack,
      'cadence_plan',
      v_plan.id,
      coalesce(v_mod.law_refs, '{}'::text[]),
      'general',
      'do',
      'cadence_' || lower(v_mod.module_id),
      'oppgave',
      v_due
    )
    on conflict (source_id, template_slug) where (source_type = 'cadence_plan' and deleted_at is null)
      do nothing
    returning id into v_task_id;
  end loop;

  return p_plan_id;
end;
$$;

revoke all on function public.cadence_plan_activate(uuid) from public;
grant execute on function public.cadence_plan_activate(uuid) to authenticated;

-- ── 3. Plan-rollback RPC: drop draft hvis brukeren avbryter midt i
--      iverksettelsen (TS-koden kaller denne hvis insert paragraphs/
--      modules/etc. feiler etter at planen er opprettet).

create or replace function public.cadence_plan_discard_draft(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_plan record;
begin
  select * into v_plan
    from public.cadence_plans
    where id = p_plan_id
      and organization_id = public.current_org_id()
      and deleted_at is null
      and status = 'draft';
  if not found then
    -- Stille no-op: enten finnes ikke planen, eller den er allerede
    -- aktiv (og skal ikke slettes via denne RPC-en).
    return;
  end if;

  if not (public.is_org_admin() or v_plan.created_by = auth.uid()) then
    raise exception 'Mangler tilgang til å forkaste cadence-utkastet.';
  end if;

  -- Soft-delete planen + alle child-rader (cascade via FK on delete).
  update public.cadence_plans
    set deleted_at = now()
    where id = p_plan_id;
end;
$$;

comment on function public.cadence_plan_discard_draft is
  'Soft-delete et draft cadence-utkast. Brukes som rollback hvis activate-flowen feiler midt i.';

revoke all on function public.cadence_plan_discard_draft(uuid) from public;
grant execute on function public.cadence_plan_discard_draft(uuid) to authenticated;
