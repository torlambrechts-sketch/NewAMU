-- Norwegian compliance additions to inspection module tables.
-- Adds: location hierarchy, dual sign-off, risk matrix, soft-delete.
-- All ALTER TABLE...ADD COLUMN IF NOT EXISTS — safe to re-run.

-- ── inspection_locations: hierarchy + Norwegian verneombud assignment ─────

alter table public.inspection_locations
  add column if not exists parent_id uuid references public.inspection_locations (id) on delete set null,
  add column if not exists kind text not null default 'other',
  add column if not exists manager_id uuid references auth.users (id) on delete set null,
  add column if not exists safety_deputy_id uuid references auth.users (id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- ── inspection_templates: soft-delete ────────────────────────────────────

alter table public.inspection_templates
  add column if not exists deleted_at timestamptz;

-- ── inspection_rounds: dual sign-off (Internkontrollforskriften § 5) ─────
-- Requires both leder (manager) and verneombud (safety deputy) to sign.

alter table public.inspection_rounds
  add column if not exists manager_signed_at timestamptz,
  add column if not exists manager_signed_by uuid references auth.users (id) on delete set null,
  add column if not exists deputy_signed_at timestamptz,
  add column if not exists deputy_signed_by uuid references auth.users (id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- ── deviations: risk matrix (Sannsynlighet × Konsekvens, 1–5) ───────────
-- Satisfies Internkontrollforskriften § 5 — risk must be assessed per deviation.

alter table public.deviations
  add column if not exists risk_probability smallint check (risk_probability between 1 and 5),
  add column if not exists risk_consequence smallint check (risk_consequence between 1 and 5),
  add column if not exists deleted_at timestamptz;

-- Generated risk score (1–25) — readable in queries without re-computing
alter table public.deviations
  add column if not exists risk_score smallint
    generated always as (
      case
        when risk_probability is not null and risk_consequence is not null
        then risk_probability * risk_consequence
        else null
      end
    ) stored;

-- ── inspection_findings: soft-delete ─────────────────────────────────────

alter table public.inspection_findings
  add column if not exists deleted_at timestamptz;

-- ── Indexes ───────────────────────────────────────────────────────────────

create index if not exists inspection_locations_parent_idx
  on public.inspection_locations (parent_id) where parent_id is not null;

create index if not exists inspection_rounds_manager_signed_idx
  on public.inspection_rounds (organization_id, manager_signed_at)
  where manager_signed_at is not null;

create index if not exists inspection_rounds_deputy_signed_idx
  on public.inspection_rounds (organization_id, deputy_signed_at)
  where deputy_signed_at is not null;

create index if not exists deviations_risk_score_idx
  on public.deviations (organization_id, risk_score desc nulls last)
  where deleted_at is null;

-- ── Update sign-off function ──────────────────────────────────────────────
-- Allow signRound to record which role is signing.
-- Frontend calls with role='manager' or role='deputy'.

create or replace function public.sign_inspection_round(
  p_round_id uuid,
  p_role     text  -- 'manager' | 'deputy' | 'both'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'manager' or p_role = 'both' then
    update public.inspection_rounds
    set manager_signed_at = now(),
        manager_signed_by = auth.uid(),
        updated_at = now()
    where id = p_round_id
      and organization_id = public.current_org_id();
  end if;

  if p_role = 'deputy' or p_role = 'both' then
    update public.inspection_rounds
    set deputy_signed_at = now(),
        deputy_signed_by = auth.uid(),
        updated_at = now()
    where id = p_round_id
      and organization_id = public.current_org_id();
  end if;

  -- Mark as 'signed' only when both manager and deputy have signed
  update public.inspection_rounds
  set status = 'signed', updated_at = now()
  where id = p_round_id
    and organization_id = public.current_org_id()
    and manager_signed_at is not null
    and deputy_signed_at is not null
    and status <> 'signed';
end;
$$;

grant execute on function public.sign_inspection_round(uuid, text) to authenticated;
