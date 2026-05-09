-- Task projects — prosjektbasert planlegging og bevissamling.
--
-- Coverage gap closed:
--   AML § 3-1 og IK-f § 5 nr. 1 krever at virksomheten har et
--   dokumentert internkontrollsystem. Prosjekter gir en strukturert
--   ramme for å planlegge, gjennomføre og dokumentere et
--   forbedringssyklus (PDCA) — f.eks. et risikovurderingsprosjekt
--   eller en avviksoppfølgingssyklus.
--
-- Self-audit (Arbeidstilsynet POV):
--   Hvert prosjekt bærer law_refs (tekstarray) → direkte sporbarhet
--   til hvilke paragrafkrav prosjektet adresserer.
--   Prosjektstatus (active/closed/archived) + timestamps gir
--   fullstendig livsløpssporing. Leder-FK sikrer ansvarliggjøring.
--   Restrisiko: prosjekter er per-org; delingsmekanisme for
--   revisor er dekket av task_export_tokens (M-7).

set local search_path = public, pg_catalog;

create table if not exists public.task_projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pack            public.task_pack not null default 'aml-amu',
  title           text not null,
  description     text not null default '',
  -- PDCA-tavle er standard for AML; kanban og waterfall tilbys for fleksibilitet
  methodology     text not null default 'pdca'
    check (methodology in ('kanban', 'pdca', 'waterfall')),
  status          text not null default 'active'
    check (status in ('active', 'closed', 'archived')),
  start_date      date,
  end_date        date,
  -- Paragrafkrav prosjektet adresserer, f.eks. ['AML § 3-1', 'IK-f § 5 nr. 6']
  law_refs        text[] not null default '{}'::text[],
  lead_user_id    uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_projects_org_pack_status_idx
  on public.task_projects (organization_id, pack, status, created_at desc)
  where deleted_at is null;

create index if not exists task_projects_law_refs_idx
  on public.task_projects using gin (law_refs);

alter table public.task_projects enable row level security;

drop policy if exists task_projects_select_org on public.task_projects;
create policy task_projects_select_org
  on public.task_projects for select
  using (organization_id = public.current_org_id());

drop policy if exists task_projects_write_org on public.task_projects;
create policy task_projects_write_org
  on public.task_projects for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_projects_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_projects_before_insert_defaults_tg on public.task_projects;
create trigger task_projects_before_insert_defaults_tg
  before insert on public.task_projects
  for each row execute function public.task_projects_before_insert_defaults();

drop trigger if exists task_projects_set_updated_at on public.task_projects;
create trigger task_projects_set_updated_at
  before update on public.task_projects
  for each row execute function public.set_updated_at();

drop trigger if exists task_projects_audit_tg on public.task_projects;
create trigger task_projects_audit_tg
  after insert or update or delete on public.task_projects
  for each row execute function public.hse_audit_trigger();
