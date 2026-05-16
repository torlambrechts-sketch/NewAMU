-- compliance_template_versions — append-only snapshot log so admins can
-- see what changed on a template and (in a future RPC) restore a prior
-- version. Triggered on UPDATE of `compliance_checklist_templates` when
-- any of name / description / definition / metadata_schema actually
-- changes. The trigger captures the *new* row state — restoring a
-- version becomes "copy snapshot back into the live row" which a
-- follow-up RPC will expose. Today the table is read-only from the UI.
--
-- Scoped to compliance only — survey / documents / learning / registers
-- each need their own snapshot table because the canonical content
-- column is named differently per table.
--
-- Self-audit (Arbeidstilsynet POV): closes the «kan dere vise hva som
-- ble endret og når?» gap that came up in the compliance audit
-- preparation. Restrisiko (deferred): UI for restore lives in a
-- follow-up commit because it needs careful RLS + RPC design.

create table if not exists public.compliance_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.compliance_checklist_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists compliance_template_versions_tpl_idx
  on public.compliance_template_versions (template_id, created_at desc);
create index if not exists compliance_template_versions_org_idx
  on public.compliance_template_versions (organization_id, created_at desc);

alter table public.compliance_template_versions enable row level security;

drop policy if exists compliance_template_versions_select on public.compliance_template_versions;
create policy compliance_template_versions_select
  on public.compliance_template_versions for select
  using (organization_id = public.current_org_id());

-- No insert/update/delete policies for end users — the trigger does
-- the writing with security_definer privileges.

create or replace function public.compliance_template_snapshot_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Skip when nothing meaningful changed (avoids snapshot churn from
  -- toggling is_active or nav_pinned).
  if old.name is not distinct from new.name
     and old.description is not distinct from new.description
     and old.definition::text is not distinct from new.definition::text
     and coalesce(old.metadata_schema::text, '') is not distinct from coalesce(new.metadata_schema::text, '')
  then
    return new;
  end if;
  insert into public.compliance_template_versions
    (template_id, organization_id, snapshot, changed_by)
  values (
    new.id,
    new.organization_id,
    jsonb_build_object(
      'name', new.name,
      'description', new.description,
      'definition', new.definition,
      'metadata_schema', coalesce(new.metadata_schema, '{}'::jsonb),
      'is_active', new.is_active,
      'updated_at', new.updated_at
    ),
    auth.uid()
  );
  return new;
end
$fn$;

drop trigger if exists compliance_template_snapshot on public.compliance_checklist_templates;
create trigger compliance_template_snapshot
  after update on public.compliance_checklist_templates
  for each row execute function public.compliance_template_snapshot_fn();

comment on table public.compliance_template_versions is
  'Append-only snapshot of compliance template state on each meaningful update. UI reads via /admin/templates → Historikk; restore RPC pending.';
