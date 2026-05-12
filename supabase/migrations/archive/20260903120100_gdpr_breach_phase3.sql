-- Fase 3 — GDPR brudd-prosedyre (Art. 33-34) + tilsyns-eksport-RPC
--
-- Coverage:
--   1. gdpr_breach_incidents — tabell for å spore bruddhendelser med
--      hard-coded 72-timers-frist for varsling til Datatilsynet.
--   2. RPC public.compliance_company_audit_export — gir compliance
--      officer en flat eksport-tabell egnet for CSV/PDF til
--      Arbeidstilsynet.
--   3. Foreslår mal-felt for kommende tpl-brudd-prosedyre.
--
-- Self-audit:
--   * 72-timers-fristen er ufravikelig (Art. 33 (1)) — derfor lagres
--     reported_at som timestamptz og deadline_at beregnes som
--     detected_at + 72 hours via GENERATED column.
--   * Sensitive felt (kategorier, antall berørte) er fortroligst — RLS
--     begrenser til org-admin + DPO-rolle.
--   * Tilsyns-eksport security_definer slik at compliance officer kan
--     få full snapshot uten å trenge select på alle moduler.

set local search_path = public, pg_catalog;

-- ── 1. gdpr_breach_incidents ─────────────────────────────────────────────

create table if not exists public.gdpr_breach_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Tidslinje
  detected_at timestamptz not null default now(),
  -- deadline_at beregnes via trigger (GENERATED-uttrykk med tz-aritmetikk er ikke
  -- alltid akseptert som immutable; trigger gir samme garanti + er portabelt).
  deadline_at timestamptz not null,
  reported_to_datatilsynet_at timestamptz,
  reported_to_subjects_at timestamptz,
  resolved_at timestamptz,
  -- Klassifisering
  severity text not null check (severity in ('low','medium','high','critical')),
  breach_type text not null check (breach_type in (
    'confidentiality',     -- uautorisert tilgang
    'integrity',           -- endring/korrupsjon
    'availability',        -- tap/utilgjengelighet
    'combined'             -- flere typer
  )),
  -- Beskrivelse (begrenset, sensitiv)
  title text not null,
  description text not null,
  affected_categories text[] not null default '{}',     -- 'helse','økonomi','identitet','kontakt','adferd'
  affected_subjects_estimate int,                       -- antall berørte personer
  affected_subjects_actual int,                         -- når kjent
  -- Konsekvens-vurdering
  risk_assessment text,
  mitigation_actions text,
  -- Ansvarlig
  reporter_user_id uuid references public.profiles(id) on delete set null,
  dpo_user_id uuid references public.profiles(id) on delete set null,
  -- Status
  status text not null default 'detected' check (status in (
    'detected','investigating','reported','resolved','dismissed'
  )),
  -- Datatilsynet-referanser
  datatilsynet_reference text,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gbi_org_status_idx on public.gdpr_breach_incidents (organization_id, status);
create index if not exists gbi_deadline_idx on public.gdpr_breach_incidents (organization_id, deadline_at)
  where status in ('detected','investigating');

comment on table public.gdpr_breach_incidents is
  'GDPR Art. 33 brudd-register. 72-timers-fristen er stored generated column.';

-- Trigger: set deadline_at = detected_at + 72 hours på insert.
-- Hard-coded slik at fristen ikke kan endres etter at hendelsen er opprettet.
create or replace function public.set_gdpr_breach_deadline()
returns trigger as $$
begin
  new.deadline_at := new.detected_at + interval '72 hours';
  return new;
end;
$$ language plpgsql;

drop trigger if exists gbi_set_deadline on public.gdpr_breach_incidents;
create trigger gbi_set_deadline
  before insert on public.gdpr_breach_incidents
  for each row execute function public.set_gdpr_breach_deadline();

drop trigger if exists gbi_set_updated_at on public.gdpr_breach_incidents;
create trigger gbi_set_updated_at
  before update on public.gdpr_breach_incidents
  for each row execute function public.set_updated_at();

alter table public.gdpr_breach_incidents enable row level security;

drop policy if exists gbi_select_admin_or_dpo on public.gdpr_breach_incidents;
create policy gbi_select_admin_or_dpo on public.gdpr_breach_incidents
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_breach_incidents.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_breach_incidents.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  );

drop policy if exists gbi_modify_admin_or_dpo on public.gdpr_breach_incidents;
create policy gbi_modify_admin_or_dpo on public.gdpr_breach_incidents
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_breach_incidents.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_breach_incidents.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = gdpr_breach_incidents.organization_id
        and p.is_org_admin = true
    )
    or exists (
      select 1 from public.org_functional_role_assignments a
      where a.organization_id = gdpr_breach_incidents.organization_id
        and a.user_id = auth.uid()
        and a.role_slug = 'dpo'
        and (a.valid_to is null or a.valid_to >= current_date)
    )
  );

-- ── 2. View: bruddstatus per org for dashboard-bruk ──────────────────────

create or replace view public.gdpr_breach_status_view as
select
  organization_id,
  count(*) filter (where status = 'detected') as detected_count,
  count(*) filter (where status = 'investigating') as investigating_count,
  count(*) filter (where status = 'reported') as reported_count,
  count(*) filter (where status = 'resolved') as resolved_count,
  count(*) filter (where status in ('detected','investigating') and deadline_at < now())
    as overdue_count,
  count(*) filter (where status in ('detected','investigating')
    and deadline_at >= now() and deadline_at < now() + interval '24 hours')
    as due_within_24h_count,
  min(deadline_at) filter (where status in ('detected','investigating')) as nearest_deadline_at
from public.gdpr_breach_incidents
group by organization_id;

comment on view public.gdpr_breach_status_view is
  '72-timers-status per org. Brukes av compliance_company-dashboard.';

-- ── 3. RPC: tilsyns-eksport ──────────────────────────────────────────────
--
-- Returnerer flat tabell egnet for CSV-eksport til Arbeidstilsynet.
-- Hver rad er ett krav med rolle, innehaver, status, hjemmel.

create or replace function public.compliance_company_audit_export(p_org_id uuid)
returns table(
  role_slug text,
  role_label text,
  user_name text,
  user_email text,
  requirement_kind text,
  resource_label text,
  hjemmel text,
  status text,
  severity text,
  due_at timestamptz,
  completed_at timestamptz,
  evidence_url text
) as $$
  select
    i.role_slug,
    fr.label,
    p.display_name,
    p.email,
    i.requirement_kind,
    i.resource_label,
    i.hjemmel,
    i.status,
    i.severity,
    i.due_at,
    i.completed_at,
    i.evidence_url
  from public.org_role_requirement_instances i
  join public.functional_roles fr on fr.slug = i.role_slug
  left join public.profiles p on p.id = i.user_id
  where i.organization_id = p_org_id
  order by i.role_slug, p.display_name, i.requirement_kind, i.resource_label;
$$ language sql security definer stable;

comment on function public.compliance_company_audit_export is
  'Tilsyns-eksport. Flat tabell for CSV/PDF. SECURITY DEFINER — krever org-admin-call eller call gjennom RLS-policy.';

revoke all on function public.compliance_company_audit_export(uuid) from public;
grant execute on function public.compliance_company_audit_export(uuid) to authenticated;
