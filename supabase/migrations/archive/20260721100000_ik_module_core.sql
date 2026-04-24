-- ─────────────────────────────────────────────────────────
-- IK MODULE — CORE TABLES
-- Covers Pillars 1 (legal register), 2 (competence), 3 (roles/participation)
-- Laws: AML, BVL, ETL, FL, PKL + IK-forskriften § 5
-- ─────────────────────────────────────────────────────────

-- Pillar 1: Legal register
create table if not exists public.ik_legal_register (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  law_code      text not null,           -- 'AML'|'BVL'|'ETL'|'FL'|'PKL'
  paragraph     text not null,           -- e.g. '§ 3-1'
  title         text not null,
  description   text,
  applicable    boolean not null default true,
  deviation_note text,
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.ik_legal_register enable row level security;
create policy "org members read ik_legal_register"
  on public.ik_legal_register for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_legal_register"
  on public.ik_legal_register for all
  using (organization_id = public.current_org_id() and public.is_org_admin());
create index if not exists ik_legal_register_org_idx on public.ik_legal_register(organization_id);

-- Pillar 3a: Mandatory roles registry
create table if not exists public.ik_org_roles (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key      text not null,           -- 'verneombud'|'avp'|'bht'|'leder'|'hms_ansvarlig'
  display_name  text not null,
  law_basis     text not null,           -- 'AML § 6-1' etc.
  is_mandatory  boolean not null default true,
  assigned_to   uuid references auth.users(id),
  assigned_name text,
  valid_from    date,
  valid_until   date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (organization_id, role_key)
);
alter table public.ik_org_roles enable row level security;
create policy "org members read ik_org_roles"
  on public.ik_org_roles for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_org_roles"
  on public.ik_org_roles for all
  using (organization_id = public.current_org_id() and public.is_org_admin());

-- Pillar 2: Competence requirements
create table if not exists public.ik_competence_requirements (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key      text not null,           -- job role slug
  display_name  text not null,
  cert_name     text not null,           -- e.g. 'Kranførerbevis'
  law_basis     text,
  is_hard_gate  boolean not null default false, -- blocks SJA signing if expired
  validity_months int,                   -- null = no expiry
  created_at    timestamptz not null default now()
);
alter table public.ik_competence_requirements enable row level security;
create policy "org members read ik_competence_requirements"
  on public.ik_competence_requirements for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_competence_requirements"
  on public.ik_competence_requirements for all
  using (organization_id = public.current_org_id() and public.is_org_admin());

-- Pillar 2: Competence records (actual certifications held)
create table if not exists public.ik_competence_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_id  uuid not null references public.ik_competence_requirements(id) on delete cascade,
  user_id         uuid references auth.users(id),
  user_name       text not null,
  issued_at       date not null,
  expires_at      date,
  issuer          text,
  document_url    text,
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.ik_competence_records enable row level security;
create policy "org members read ik_competence_records"
  on public.ik_competence_records for select
  using (organization_id = public.current_org_id());
create policy "org admins manage ik_competence_records"
  on public.ik_competence_records for all
  using (organization_id = public.current_org_id() and public.is_org_admin());
create index if not exists ik_competence_records_org_idx on public.ik_competence_records(organization_id);
create index if not exists ik_competence_records_expires_idx on public.ik_competence_records(expires_at);
