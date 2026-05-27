-- Alerts v1.1 — alert_intake_form_version (versioned intake schemas).
--
-- v1.1 §2 introduces a versioned schema layer: each (org, system_template)
-- pair owns a sequence of intake-form versions. Submission stamps the
-- alert_cases.intake_form_version_id at insert so we can reproduce the
-- exact form a reporter saw, even after the template has been re-edited
-- months later. Critical for AML § 2A-7 (5) defensibility.
--
-- Self-audit:
--   * AML § 2A-7 (5) — proving in court / Arbeidstilsynet that the reporter
--     was shown the exact promise of confidentiality at submission time
--     requires the snapshot of the form they saw. version-snapshot here.
--   * GDPR Art. 5 (2) accountability — schema versions are an auditable
--     evolution of the org's processing notice on the intake page.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_intake_form_version (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  system_template_id  text references public.alert_system_templates (id) on delete cascade,
  org_template_id     uuid references public.alert_org_templates (id) on delete cascade,
  version             integer not null,
  schema              jsonb not null,                  -- frozen publicFormFields + processing notice
  privacy_notice_nb   text,
  privacy_notice_en   text,
  active              boolean not null default true,
  published_at        timestamptz not null default now(),
  published_by        uuid references auth.users (id) on delete set null,
  retired_at          timestamptz,
  created_at          timestamptz not null default now(),
  check (system_template_id is not null or org_template_id is not null)
);

-- Unique version per (org, template). Partial uniques because either
-- template kind can be referenced.
create unique index if not exists alert_intake_form_version_system_uidx
  on public.alert_intake_form_version (organization_id, system_template_id, version)
  where system_template_id is not null;

create unique index if not exists alert_intake_form_version_org_uidx
  on public.alert_intake_form_version (organization_id, org_template_id, version)
  where org_template_id is not null;

-- Only one active version per (org, template).
create unique index if not exists alert_intake_form_version_active_system_uidx
  on public.alert_intake_form_version (organization_id, system_template_id)
  where active and system_template_id is not null;

create unique index if not exists alert_intake_form_version_active_org_uidx
  on public.alert_intake_form_version (organization_id, org_template_id)
  where active and org_template_id is not null;

alter table public.alert_intake_form_version enable row level security;

drop policy if exists alert_intake_form_version_select on public.alert_intake_form_version;
create policy alert_intake_form_version_select
  on public.alert_intake_form_version for select
  to authenticated
  using (organization_id = public.current_org_id());

-- Public-form reads need this too — accessed via the public RPC
-- (security_definer bypasses RLS), so no policy for anon role here.

drop policy if exists alert_intake_form_version_write on public.alert_intake_form_version;
create policy alert_intake_form_version_write
  on public.alert_intake_form_version for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('alerts.manage'))
  );

-- ── alert_cases.intake_form_version_id FK ─────────────────────────────────

alter table public.alert_cases
  add column if not exists intake_form_version_id uuid
    references public.alert_intake_form_version (id) on delete set null;

create index if not exists alert_cases_intake_form_version_idx
  on public.alert_cases (intake_form_version_id)
  where intake_form_version_id is not null;

-- ── Backfill: insert v1 per (org × active system template) ────────────────
-- The schema is built from the system template's definition.publicFormFields
-- to give existing orgs a baseline immediately.

do $$
declare
  v_org_id uuid;
  v_tpl record;
begin
  for v_org_id in select id from public.organizations loop
    for v_tpl in
      select id, slug, definition
        from public.alert_system_templates
        where is_active = true
    loop
      insert into public.alert_intake_form_version
        (organization_id, system_template_id, version, schema, active, published_at)
      values (
        v_org_id,
        v_tpl.id,
        1,
        coalesce(v_tpl.definition->'publicFormFields', '[]'::jsonb),
        true,
        now()
      )
      on conflict do nothing;
    end loop;
  end loop;
end$$;
