-- compliance_plan_items — closure plan for internkontroll gaps.
--
-- A small write-side table that binds a regelverk-paragraph to a
-- concrete tiltak (owner / status / due date). Created from the
-- paragraph inspector slide-over on the Internkontroll gap-analysis
-- page; surfaced as a count badge in the inspector and read by Phase 4's
-- auditor view (deferred).
--
-- Tasks bridge: when status is flipped to 'in_progress' and task_id is
-- null, the client-side hook creates a task row with
-- source_type='compliance_plan' and source_id=<plan_item.id> so action
-- becomes visible inside Oppgavestyring without a separate "convert"
-- step.
--
-- Self-revisjon (Arbeidstilsynet POV):
--  - AML § 3-1 nr. 4 + IK-f § 5 nr. 6: skriftlig oppfølging av tiltak —
--    plan_items er det skriftlige sporet.
--  - IK-f § 5 nr. 7: dokumentasjon for tilsyn — table is auditable + RLS-
--    scoped to org_id.
--  - AML § 18-1 ff: tilsynsmyndighet — frigir oss for å vise "hvor langt
--    er vi i lukkingen" til Arbeidstilsynet uten å lekke tvers virksomheter.
-- Restrisiko:
--  - Auditor-token-URL (eksternt visning for revisor) er Phase 4, deferred.
--  - Bi-direksjonell sync mellom task.status og plan_item.status er v2.
--    v1: når task lukkes, plan_item.status oppdateres ikke automatisk.

set local search_path = public, pg_catalog;

create table if not exists public.compliance_plan_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  law_ref         text not null,
  framework_id    text not null,
  title           text not null,
  description     text,
  owner_user_id   uuid references auth.users (id) on delete set null,
  status          text not null default 'planned'
    check (status in ('planned', 'in_progress', 'blocked', 'done')),
  start_at        date,
  due_at          date,
  milestone       text,
  task_id         uuid references public.task_items (id) on delete set null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists compliance_plan_items_org_idx
  on public.compliance_plan_items (organization_id, status, due_at)
  where deleted_at is null;

create index if not exists compliance_plan_items_law_ref_idx
  on public.compliance_plan_items (organization_id, law_ref)
  where deleted_at is null;

comment on column public.compliance_plan_items.law_ref is
  'Lovreferanse-streng (eks. "AML § 4-3"). Matches templates'' law_refs[] entries via exact string equality after `normalizeLawRef`.';
comment on column public.compliance_plan_items.framework_id is
  'Slug fra public.regulations.id (aml / ik-f / gdpr / apenhetsloven / iso-45001). Brukes for å filtrere planen per regelverk uten å parse law_ref.';
comment on column public.compliance_plan_items.task_id is
  'Når status flippes til in_progress og task_id er null, opprettes en task_items-rad med source_type="compliance_plan", source_id=<plan_item.id>. Klient-side mirror; v1 one-way.';

alter table public.compliance_plan_items enable row level security;

drop policy if exists compliance_plan_items_select_org on public.compliance_plan_items;
create policy compliance_plan_items_select_org
  on public.compliance_plan_items for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_plan_items_write_org on public.compliance_plan_items;
create policy compliance_plan_items_write_org
  on public.compliance_plan_items for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.compliance_plan_items_before_insert_defaults()
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

drop trigger if exists compliance_plan_items_before_insert_defaults_tg on public.compliance_plan_items;
create trigger compliance_plan_items_before_insert_defaults_tg
  before insert on public.compliance_plan_items
  for each row execute function public.compliance_plan_items_before_insert_defaults();

drop trigger if exists compliance_plan_items_set_updated_at on public.compliance_plan_items;
create trigger compliance_plan_items_set_updated_at
  before update on public.compliance_plan_items
  for each row execute function public.set_updated_at();
