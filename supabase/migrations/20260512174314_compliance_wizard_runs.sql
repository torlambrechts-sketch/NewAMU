-- Compliance Studio — resumable wizard runs.
--
-- Coverage:
--   1. compliance_wizard_runs — én rad per (organization, wizard_key)
--      som lagrer current_step + payload-jsonb mellom økter.
--      Lar bruker forlate og fortsette en wizard senere uten å miste
--      tidligere svar.
--   2. RLS — bare medlemmer av organisasjonen kan lese/skrive,
--      og en bruker ser bare runs hen selv har startet.
--
-- Self-audit (Arbeidstilsynet POV):
--   * Wizard-payload kan inneholde personnavn/avdelinger som er
--     fortrolige — derfor RLS på user_id, ikke bare organization_id.
--   * Sletting fjerner arbeid som ikke er overført til moduler ennå
--     (provisjoneringen skjer per-trinn via onAdvance). Det er
--     forsvarlig: kun pågående draft-arbeid forsvinner, ikke
--     publiserte rutiner.
--   * Indeks på (organization_id, wizard_key) for rask lookup når
--     Studio-siden laster status for hele wizard-katalogen.

set local search_path = public, pg_catalog;

create table if not exists public.compliance_wizard_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Identifier for the wizard definition (eks. 'compliance.hms_grunnmur').
  wizard_key text not null,
  -- 0-basert. NULL betyr ikke-startet — vi setter heller en rad ved
  -- første interaksjon, så NULL skal ikke forekomme i praksis.
  current_step int not null default 0 check (current_step >= 0),
  -- Wizard-svar — én jsonb-blob med { fieldId: value }.
  payload jsonb not null default '{}'::jsonb,
  -- Når wizardens siste trinn har fullført. NULL = pågående.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, wizard_key)
);

comment on table public.compliance_wizard_runs is
  'Resumable Compliance-Studio wizard state per (org, user, wizard).';
comment on column public.compliance_wizard_runs.payload is
  'JSON-objekt { fieldId: string|boolean } samlet over alle trinn.';
comment on column public.compliance_wizard_runs.wizard_key is
  'Stabil identifier for wizard-definisjonen, eks. ''compliance.hms_grunnmur''.';

create index if not exists compliance_wizard_runs_org_wizard_idx
  on public.compliance_wizard_runs (organization_id, wizard_key);
create index if not exists compliance_wizard_runs_user_idx
  on public.compliance_wizard_runs (user_id);

-- Auto-oppdater updated_at ved enhver endring.
create or replace function public.touch_compliance_wizard_runs()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_compliance_wizard_runs
  on public.compliance_wizard_runs;
create trigger trg_touch_compliance_wizard_runs
  before update on public.compliance_wizard_runs
  for each row execute function public.touch_compliance_wizard_runs();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.compliance_wizard_runs enable row level security;

drop policy if exists wizard_runs_select_self on public.compliance_wizard_runs;
create policy wizard_runs_select_self on public.compliance_wizard_runs
  for select using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = compliance_wizard_runs.organization_id
    )
  );

drop policy if exists wizard_runs_insert_self on public.compliance_wizard_runs;
create policy wizard_runs_insert_self on public.compliance_wizard_runs
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = compliance_wizard_runs.organization_id
    )
  );

drop policy if exists wizard_runs_update_self on public.compliance_wizard_runs;
create policy wizard_runs_update_self on public.compliance_wizard_runs
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists wizard_runs_delete_self on public.compliance_wizard_runs;
create policy wizard_runs_delete_self on public.compliance_wizard_runs
  for delete using (user_id = auth.uid());
