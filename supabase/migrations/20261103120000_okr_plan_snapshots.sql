-- OKR plan snapshots (H3.1)
--
-- Gap closed: plan edits overwrote silently — no way to show an auditor (or
-- yourself) "what we aimed for vs what we achieved". okr_plan_snapshots
-- stores the full plan tree as jsonb; okr_snapshot_plan() builds it
-- server-side, and a trigger snapshots automatically whenever the plan's
-- status changes (draft → active → archived).
--
-- Self-audit (Arbeidstilsynet POV): dated, immutable evidence that HMS goals
-- were set, tracked and revised (IK-f § 5 nr. 7). Restrisiko: snapshots are
-- not diffed automatically (UI renders one snapshot read-only); the
-- quarterly auto-snapshot rides the recommended OKR-innsjekk cadence task
-- rather than a dedicated scheduler.
--
-- usage:
--   select okr_snapshot_plan('<plan_id>', 'manual');

create table if not exists public.okr_plan_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.okr_plans(id) on delete cascade,
  -- 'manual' | 'status_change' | (free text for future automation)
  reason          text not null default 'manual',
  snapshot        jsonb not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on column public.okr_plan_snapshots.snapshot is
  'Full plan tree at snapshot time: { plan: {title, description, legal_basis, '
  'horizon, status, sponsor_name, facilitator_name}, objectives: [{ord_label, '
  'objective, why, law_ref, owner_name, health, progress, keyResults: [{kr, '
  'unit, target, current_value, confidence, invert, progress_mode, '
  'owner_name}]}], raci: [{role_label, person_label, r, a, c, i}] }';

create index if not exists okr_plan_snapshots_plan_idx
  on public.okr_plan_snapshots (plan_id, created_at desc);

create index if not exists okr_plan_snapshots_org_idx
  on public.okr_plan_snapshots (organization_id, created_at desc);

alter table public.okr_plan_snapshots enable row level security;

-- Read for the whole org; writes ONLY through the security-definer RPC /
-- trigger (no insert/update/delete policies) — history must be append-only
-- and tamper-evident.
drop policy if exists okr_plan_snapshots_select_org on public.okr_plan_snapshots;
create policy okr_plan_snapshots_select_org
  on public.okr_plan_snapshots for select
  using (organization_id = public.current_org_id());

create or replace function public.okr_snapshot_plan(
  p_plan_id uuid,
  p_reason text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_snapshot jsonb;
  v_id uuid;
begin
  select organization_id into v_org from public.okr_plans where id = p_plan_id;
  if v_org is null then
    raise exception 'Plan ikke funnet.';
  end if;
  -- When called by a user (not the trigger), require same-org membership.
  if auth.uid() is not null and v_org <> public.current_org_id() then
    raise exception 'Planen tilhører ikke din organisasjon.';
  end if;

  select jsonb_build_object(
    'plan', jsonb_build_object(
      'title', p.title,
      'description', p.description,
      'legal_basis', p.legal_basis,
      'horizon', p.horizon,
      'status', p.status,
      'sponsor_name', p.sponsor_name,
      'facilitator_name', p.facilitator_name
    ),
    'objectives', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ord_label', o.ord_label,
          'objective', o.objective,
          'why', o.why,
          'law_ref', o.law_ref,
          'owner_name', o.owner_name,
          'health', o.health,
          'progress', o.progress,
          'keyResults', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'kr', k.kr,
                'unit', k.unit,
                'target', k.target,
                'current_value', k.current_value,
                'confidence', k.confidence,
                'invert', k.invert,
                'progress_mode', k.progress_mode,
                'owner_name', k.owner_name
              ) order by k.position
            )
            from public.okr_key_results k where k.objective_id = o.id
          ), '[]'::jsonb)
        ) order by o.position
      )
      from public.okr_objectives o where o.plan_id = p.id
    ), '[]'::jsonb),
    'raci', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'role_label', r.role_label,
          'person_label', r.person_label,
          'r', r.is_responsible,
          'a', r.is_accountable,
          'c', r.is_consulted,
          'i', r.is_informed
        ) order by r.position
      )
      from public.okr_raci r where r.plan_id = p.id
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.okr_plans p
  where p.id = p_plan_id;

  insert into public.okr_plan_snapshots
    (organization_id, plan_id, reason, snapshot, created_by)
  values (v_org, p_plan_id, coalesce(nullif(trim(p_reason), ''), 'manual'), v_snapshot, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.okr_snapshot_plan(uuid, text) to authenticated;

-- Auto-snapshot on status transitions (draft → active → archived) — these
-- are the governance moments an auditor asks about.
create or replace function public.okr_plan_snapshot_on_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.okr_snapshot_plan(new.id, 'status_change');
  return new;
end;
$$;

drop trigger if exists okr_plan_snapshot_on_status on public.okr_plans;
create trigger okr_plan_snapshot_on_status
  after update of status on public.okr_plans
  for each row
  when (old.status is distinct from new.status)
  execute function public.okr_plan_snapshot_on_status();
