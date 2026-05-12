-- Fase 4 — GDPR individrettigheter (Art. 15-21) + databehandler-avtale (Art. 28)
--
-- Coverage:
--   1. gdpr_subject_requests — tabell for innsyns/sletting/portabilitet-
--      forespørsler med 30-dagers svarfrist (Art. 12 (3)).
--   2. gdpr_subject_requests_status_view for KPI-bruk.
--   3. (To nye templates legges også til via documentTemplates.ts)
--
-- Self-audit:
--   * 30-dagers-fristen er hard-coded GENERATED (received_at + 30 days).
--     Kan forlenges med 60 dager ved kompliserte saker (Art. 12 (3)), men
--     må kommuniseres til registrert innen den første 30-dagers-fristen.
--   * RLS: synlig for DPO + org-admin. Aldri for vanlige ansatte.
--   * Den registrertes egen forespørsel er bevisst IKKE knyttet til
--     auth-bruker — kan komme fra eks-ansatte eller eksterne.

set local search_path = public, pg_catalog;

create table if not exists public.gdpr_subject_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Mottak
  received_at timestamptz not null default now(),
  -- deadline_at settes via trigger (samme portabilitets-hensyn som
  -- gdpr_breach_incidents — se 20260903120100)
  deadline_at timestamptz not null,
  -- Kategorisering
  request_type text not null check (request_type in (
    'access',          -- Art. 15 innsyn
    'rectification',   -- Art. 16 retting
    'erasure',         -- Art. 17 sletting
    'restriction',     -- Art. 18 begrensning
    'portability',     -- Art. 20 dataportabilitet
    'objection',       -- Art. 21 innsigelse
    'consent_withdraw' -- Art. 7 (3) tilbaketrekk av samtykke
  )),
  -- Hvem forespør (kan være ansatt eller ekstern; ikke auth-bound)
  subject_name text not null,
  subject_email text,
  subject_employee_id uuid,    -- valgfri kobling til profile
  subject_identity_verified boolean not null default false,
  -- Innhold
  request_description text not null,
  scope text,                  -- 'all_data' | 'specific_systems' | 'specific_data_points'
  -- Behandling
  status text not null default 'received' check (status in (
    'received','identity_check','in_progress','partial_response','completed','denied','extended'
  )),
  assigned_to uuid references public.profiles(id) on delete set null,
  -- Svar
  response_at timestamptz,
  response_summary text,
  response_url text,           -- lenke til evt. eksport eller vedlegg
  denial_reason text,
  extension_reason text,
  extended_deadline_at timestamptz,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gsr_org_status_idx on public.gdpr_subject_requests (organization_id, status);
create index if not exists gsr_deadline_idx on public.gdpr_subject_requests (organization_id, deadline_at)
  where status in ('received','identity_check','in_progress','extended');

comment on table public.gdpr_subject_requests is
  'GDPR individrettigheter Art. 15-21. 30-dagers-frist settes via trigger ved insert.';

-- Trigger: set deadline_at = received_at + 30 days på insert (hard-coded).
create or replace function public.set_gdpr_subject_request_deadline()
returns trigger as $$
begin
  new.deadline_at := new.received_at + interval '30 days';
  return new;
end;
$$ language plpgsql;

drop trigger if exists gsr_set_deadline on public.gdpr_subject_requests;
create trigger gsr_set_deadline
  before insert on public.gdpr_subject_requests
  for each row execute function public.set_gdpr_subject_request_deadline();

drop trigger if exists gsr_set_updated_at on public.gdpr_subject_requests;
create trigger gsr_set_updated_at
  before update on public.gdpr_subject_requests
  for each row execute function public.set_updated_at();

alter table public.gdpr_subject_requests enable row level security;

drop policy if exists gsr_select_admin_or_dpo on public.gdpr_subject_requests;
create policy gsr_select_admin_or_dpo on public.gdpr_subject_requests
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_subject_requests.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_subject_requests.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  );

drop policy if exists gsr_modify_admin_or_dpo on public.gdpr_subject_requests;
create policy gsr_modify_admin_or_dpo on public.gdpr_subject_requests
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_subject_requests.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_subject_requests.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_subject_requests.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_subject_requests.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  );

-- ── View for dashboard-KPI ───────────────────────────────────────────────

create or replace view public.gdpr_subject_requests_status_view as
select
  organization_id,
  count(*) filter (where status in ('received','identity_check','in_progress','extended')) as active_count,
  count(*) filter (where status in ('received','identity_check','in_progress')
    and deadline_at < now()) as overdue_count,
  count(*) filter (where status in ('received','identity_check','in_progress')
    and deadline_at >= now() and deadline_at < now() + interval '7 days') as due_within_7d_count,
  count(*) filter (where status = 'completed') as completed_count,
  count(*) filter (where status = 'denied') as denied_count,
  count(*) filter (where status = 'extended') as extended_count,
  min(deadline_at) filter (where status in ('received','identity_check','in_progress','extended')) as nearest_deadline_at
from public.gdpr_subject_requests
group by organization_id;

comment on view public.gdpr_subject_requests_status_view is
  '30-dagers-fristen status per org. Brukes av compliance_company-dashboard.';
