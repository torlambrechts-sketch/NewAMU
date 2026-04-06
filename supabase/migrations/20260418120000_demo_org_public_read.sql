-- Public demo tenant: fixed UUID, read + anonymous write for exploration without email login.
-- Enable Anonymous sign-in in Supabase Auth → Providers.

-- ---------------------------------------------------------------------------
-- Demo organization (9-digit orgnr satisfies existing format check)
-- ---------------------------------------------------------------------------

insert into public.organizations (id, organization_number, name, brreg_snapshot, onboarding_completed_at)
values (
  '00000000-0000-4000-a000-000000000001',
  '000000000',
  'Demo Virksomhet AS',
  '{}'::jsonb,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  onboarding_completed_at = coalesce(public.organizations.onboarding_completed_at, excluded.onboarding_completed_at);

-- ---------------------------------------------------------------------------
-- Roles & permissions for demo org (used by get_my_effective_permissions)
-- ---------------------------------------------------------------------------

insert into public.role_definitions (organization_id, slug, name, description, is_system)
values
  ('00000000-0000-4000-a000-000000000001', 'admin', 'Administrator', 'Demo — full tilgang', true),
  ('00000000-0000-4000-a000-000000000001', 'member', 'Medlem', 'Demo — standard', true)
on conflict (organization_id, slug) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, p.permission_key
from public.role_definitions rd
cross join (
  values
    ('users.invite'),
    ('users.manage'),
    ('roles.manage'),
    ('delegation.manage'),
    ('module.view.dashboard'),
    ('module.view.council'),
    ('module.view.members'),
    ('module.view.org_health'),
    ('module.view.hse'),
    ('module.view.internal_control'),
    ('module.view.tasks'),
    ('module.view.learning'),
    ('module.view.reports'),
    ('module.view.workflow'),
    ('module.view.hr_compliance'),
    ('documents.manage'),
    ('module.view.admin')
) as p(permission_key)
where rd.organization_id = '00000000-0000-4000-a000-000000000001'
  and rd.slug = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, p.permission_key
from public.role_definitions rd
cross join (
  values
    ('module.view.dashboard'),
    ('module.view.council'),
    ('module.view.members'),
    ('module.view.org_health'),
    ('module.view.hse'),
    ('module.view.internal_control'),
    ('module.view.tasks'),
    ('module.view.learning'),
    ('module.view.reports'),
    ('module.view.workflow'),
    ('module.view.hr_compliance')
) as p(permission_key)
where rd.organization_id = '00000000-0000-4000-a000-000000000001'
  and rd.slug = 'member'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seed org chart / groups payload (matches client demo seed shape)
-- ---------------------------------------------------------------------------

insert into public.org_module_payloads (organization_id, module_key, payload)
values (
  '00000000-0000-4000-a000-000000000001',
  'organisation',
  '{
    "settings": {
      "orgName": "Demo Virksomhet AS",
      "employeeCount": 8,
      "hasCollectiveAgreement": true,
      "collectiveAgreementName": "LO/NHO",
      "industrySector": "Kontor / tjenester"
    },
    "units": [
      {"id": "u-all", "name": "Hele organisasjonen", "kind": "division", "color": "#1a3d32", "parentId": null, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "u-tech", "name": "Teknologi", "kind": "department", "color": "#0284c7", "parentId": "u-all", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "u-people", "name": "Personal og HMS", "kind": "department", "color": "#7c3aed", "parentId": "u-all", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "u-ops", "name": "Drift og produksjon", "kind": "department", "color": "#d97706", "parentId": "u-all", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "u-dev", "name": "Development", "kind": "team", "color": "#0369a1", "parentId": "u-tech", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "u-design", "name": "Design", "kind": "team", "color": "#0891b2", "parentId": "u-tech", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"}
    ],
    "employees": [
      {"id": "e1", "name": "Anne Nilsen", "email": "anne@demo.atics.no", "phone": "+47 900 00 001", "jobTitle": "Administrerende direktør", "role": "Leder", "unitId": "u-all", "unitName": "Hele organisasjonen", "location": "Oslo", "employmentType": "permanent", "startDate": "2019-01-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e2", "name": "Bjørn Hansen", "email": "bjorn@demo.atics.no", "phone": "+47 900 00 002", "jobTitle": "Teknologidirektør (CTO)", "role": "Leder", "unitId": "u-tech", "unitName": "Teknologi", "reportsToId": "e1", "reportsToName": "Anne Nilsen", "location": "Oslo", "employmentType": "permanent", "startDate": "2020-03-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e3", "name": "Camilla Berg", "email": "camilla@demo.atics.no", "phone": "+47 900 00 003", "jobTitle": "HR- og HMS-sjef", "role": "Leder", "unitId": "u-people", "unitName": "Personal og HMS", "reportsToId": "e1", "reportsToName": "Anne Nilsen", "location": "Oslo", "employmentType": "permanent", "startDate": "2020-06-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e4", "name": "David Lund", "email": "david@demo.atics.no", "phone": "+47 900 00 004", "jobTitle": "Driftssjef", "role": "Leder", "unitId": "u-ops", "unitName": "Drift og produksjon", "reportsToId": "e1", "reportsToName": "Anne Nilsen", "location": "Bergen", "employmentType": "permanent", "startDate": "2021-01-15", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e5", "name": "Eva Strand", "email": "eva@demo.atics.no", "jobTitle": "Seniorutvikler", "role": "Fagansvarlig", "unitId": "u-dev", "unitName": "Development", "reportsToId": "e2", "reportsToName": "Bjørn Hansen", "location": "Oslo", "employmentType": "permanent", "startDate": "2021-08-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e6", "name": "Frode Moe", "email": "frode@demo.atics.no", "jobTitle": "Utvikler", "role": "Fagmedarbeider", "unitId": "u-dev", "unitName": "Development", "reportsToId": "e5", "reportsToName": "Eva Strand", "location": "Oslo", "employmentType": "permanent", "startDate": "2022-04-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e7", "name": "Guro Kvam", "email": "guro@demo.atics.no", "jobTitle": "UX-designer", "role": "Fagmedarbeider", "unitId": "u-design", "unitName": "Design", "reportsToId": "e2", "reportsToName": "Bjørn Hansen", "location": "Oslo", "employmentType": "permanent", "startDate": "2022-09-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "e8", "name": "Hanne Vik", "email": "hanne@demo.atics.no", "jobTitle": "HMS-koordinator", "role": "Verneombud", "unitId": "u-people", "unitName": "Personal og HMS", "reportsToId": "e3", "reportsToName": "Camilla Berg", "location": "Oslo", "employmentType": "permanent", "startDate": "2021-03-01", "active": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"}
    ],
    "groups": [
      {"id": "g-all", "name": "Alle ansatte", "description": "Hele virksomheten", "scope": {"kind": "all"}, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "g-tech", "name": "Teknologi-avdelingen", "description": "", "scope": {"kind": "units", "unitIds": ["u-tech"]}, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"},
      {"id": "g-hms", "name": "HMS-team", "description": "", "scope": {"kind": "units", "unitIds": ["u-people"]}, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"}
    ]
  }'::jsonb
)
on conflict (organization_id, module_key) do update set
  payload = excluded.payload,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RPC: attach anonymous JWT to demo org + admin role (JWT claim is_anonymous)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_demo_org_profile_for_anonymous()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo constant uuid := '00000000-0000-4000-a000-000000000001';
  v_uid uuid := auth.uid();
  r_admin uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is distinct from true then
    raise exception 'Demo tenant only for anonymous sessions';
  end if;

  insert into public.profiles (id, display_name, email, organization_id, is_org_admin)
  values (v_uid, 'Demo-besøkende', null, v_demo, true)
  on conflict (id) do update set
    organization_id = v_demo,
    is_org_admin = true,
    display_name = case
      when nullif(trim(public.profiles.display_name), '') is null then excluded.display_name
      else public.profiles.display_name
    end;

  select id into r_admin
  from public.role_definitions
  where organization_id = v_demo and slug = 'admin'
  limit 1;

  if r_admin is not null then
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (v_uid, r_admin, v_uid)
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.ensure_demo_org_profile_for_anonymous() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: allow any authenticated user (incl. anonymous) to read demo org rows
-- ---------------------------------------------------------------------------

drop policy if exists "organizations_select_demo_public" on public.organizations;
create policy "organizations_select_demo_public"
  on public.organizations for select
  to authenticated
  using (id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "departments_select_demo_public" on public.departments;
create policy "departments_select_demo_public"
  on public.departments for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "teams_select_demo_public" on public.teams;
create policy "teams_select_demo_public"
  on public.teams for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "locations_select_demo_public" on public.locations;
create policy "locations_select_demo_public"
  on public.locations for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "organization_members_select_demo_public" on public.organization_members;
create policy "organization_members_select_demo_public"
  on public.organization_members for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "org_module_payloads_select_demo_public" on public.org_module_payloads;
create policy "org_module_payloads_select_demo_public"
  on public.org_module_payloads for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

-- Anonymous demo users may upsert module JSON for the demo tenant only
drop policy if exists "org_module_payloads_write_demo_anon" on public.org_module_payloads;
create policy "org_module_payloads_write_demo_anon"
  on public.org_module_payloads for insert
  to authenticated
  with check (
    organization_id = '00000000-0000-4000-a000-000000000001'::uuid
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = true
  );

drop policy if exists "org_module_payloads_update_demo_anon" on public.org_module_payloads;
create policy "org_module_payloads_update_demo_anon"
  on public.org_module_payloads for update
  to authenticated
  using (
    organization_id = '00000000-0000-4000-a000-000000000001'::uuid
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = true
  )
  with check (
    organization_id = '00000000-0000-4000-a000-000000000001'::uuid
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = true
  );

-- RBAC metadata for get_my_effective_permissions (admin path lists all keys on role_permissions)
drop policy if exists "role_definitions_select_demo_public" on public.role_definitions;
create policy "role_definitions_select_demo_public"
  on public.role_definitions for select
  to authenticated
  using (organization_id = '00000000-0000-4000-a000-000000000001'::uuid);

drop policy if exists "role_permissions_select_demo_public" on public.role_permissions;
create policy "role_permissions_select_demo_public"
  on public.role_permissions for select
  to authenticated
  using (
    exists (
      select 1
      from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = '00000000-0000-4000-a000-000000000001'::uuid
    )
  );
