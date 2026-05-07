-- Compliance hardening — gap C: AML §6-2 verneombud-role gate on signing.
--
-- Today, signing a compliance_checklist_executions row only requires
-- 'checklist.manage'. AML §6-2 implies that vernerunder and other
-- AML-pack checklists should be signed by the verneombud, not just any
-- HSE-leader. This migration enforces that at the trigger level.
--
-- Approach:
--   1. Add a per-pack flag `requires_verneombud_signing` so customers
--      can configure it per pack (default false; set true on AML rows
--      in this migration).
--   2. Helper function compliance_user_has_verneombud_role(user, org)
--      that joins user_roles to role_definitions filtered by slug.
--   3. Update the sign trigger to check the flag + helper when
--      transitioning to status='signed'. Rejects with a Norwegian
--      explanation that points the customer to RBAC admin if no one
--      has the role yet.
--   4. Seed a 'verneombud' role_definitions row for every existing
--      org (idempotent), so the role exists and customers can assign
--      users via the existing RBAC admin UI.
--
-- Rollout note: existing AML executions cannot be signed until at
-- least one user is assigned the verneombud role in the org. This is
-- the correct compliance posture; the error message tells the customer
-- exactly what to do. ISO 45001 pack is unaffected.

-- ── 1. Per-pack opt-in flag ──────────────────────────────────────────────

alter table public.compliance_packs
  add column if not exists requires_verneombud_signing boolean not null default false;

update public.compliance_packs
set requires_verneombud_signing = true
where slug = 'aml-amu';

-- ── 2. Helper: does user X hold the verneombud role for org Y? ──────────

create or replace function public.compliance_user_has_verneombud_role(
  p_user_id uuid,
  p_org_id  uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_definitions rd on rd.id = ur.role_id
    where ur.user_id = p_user_id
      and rd.organization_id = p_org_id
      and rd.slug = 'verneombud'
  );
$$;

revoke all on function public.compliance_user_has_verneombud_role(uuid, uuid)
  from public, anon;
grant execute on function public.compliance_user_has_verneombud_role(uuid, uuid)
  to authenticated, service_role;

-- ── 3. Seed 'verneombud' role definition for every existing org ──────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    insert into public.role_definitions (
      organization_id, slug, name, description, is_system
    ) values (
      v_org.id,
      'verneombud',
      'Verneombud',
      'Tillitsvalgt for arbeidsmiljøsaker (AML §6-2). Brukere med denne rollen kan signere AML-sjekklister (vernerunder, pulsmålinger, m.fl.).',
      true
    )
    on conflict (organization_id, slug) do nothing;
  end loop;
end $$;

-- ── 4. Update the sign trigger to enforce the gate ───────────────────────

create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def jsonb;
  v_pack_requires boolean;
begin
  -- Once signed, the row is permanently locked.
  if old.status = 'signed' then
    raise exception 'Execution % is signed; updates not permitted', old.id
      using errcode = 'check_violation';
  end if;

  -- pack and template_id are frozen for the lifetime of the execution.
  if new.pack <> old.pack then
    raise exception 'pack is immutable on compliance_checklist_executions';
  end if;
  if new.template_id <> old.template_id then
    raise exception 'template_id is immutable on compliance_checklist_executions';
  end if;

  -- Sign transition: snapshot definition + stamp signer.
  if new.status = 'signed' and old.status <> 'signed' then
    if new.signed_at is null then
      new.signed_at := now();
    end if;
    if new.signed_by is null then
      new.signed_by := auth.uid();
    end if;
    if new.definition_snapshot is null then
      select definition into v_def
      from public.compliance_checklist_templates
      where id = new.template_id;
      new.definition_snapshot := v_def;
    end if;

    -- Gap C: verneombud-role gate. If the pack opts in, verify the
    -- signer holds the verneombud role for this org. ISO and any
    -- pack with requires_verneombud_signing=false are skipped.
    select coalesce(p.requires_verneombud_signing, false)
    into v_pack_requires
    from public.compliance_packs p
    where p.organization_id = new.organization_id
      and p.slug = new.pack;

    if v_pack_requires
       and not public.compliance_user_has_verneombud_role(
                  new.signed_by, new.organization_id
                )
    then
      raise exception
        'Pakke "%" krever at signering utføres av en bruker med verneombud-rolle (AML §6-2). Tildel rollen via RBAC-administrasjon før signering.',
        new.pack
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;
