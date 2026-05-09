-- Task project evidence — bevissamling per prosjekt for revisor.
--
-- Coverage gap closed:
--   IK-f § 5 nr. 1 krever at virksomheten kan dokumentere
--   internkontrollarbeidet skriftlig. task_project_evidence gir en
--   strukturert bevislogg per prosjekt — filer, koblinger til
--   sjekklister, undersøkelser, registerposter og notater.
--   Revideringspakken (task_export_tokens) eksporterer denne
--   tabellen som en del av revisjonsdokumentasjonen.
--
-- Self-audit (Arbeidstilsynet POV):
--   Bevislinker er polymorfiske (kind + external_ref_table/id) slik at
--   eksisterende artefakter (checklist_executions, survey_responses,
--   register_records) kan knyttes til et prosjekt uten å duplisere data.
--   File_url peker til Supabase Storage — URL-en er signet og tidsbegrenset
--   på klientsiden; selve raden lagrer kun stien.
--   Restrisiko: det finnes ingen automatisk validering av at
--   external_ref_id faktisk eksisterer i external_ref_table.
--   Applikasjonen er ansvarlig for integritetssjekken.

set local search_path = public, pg_catalog;

create table if not exists public.task_project_evidence (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.task_projects (id) on delete cascade,
  -- Bevistype — styrer ikon og visning i bevisloggen
  kind            text not null default 'note'
    check (kind in ('file', 'checklist_execution', 'survey_response', 'register_record', 'note')),
  label           text not null,
  -- Polymorf kobling til eksisterende artefakt (nullable for file/note)
  external_ref_table text,
  external_ref_id    uuid,
  -- Storage-sti for opplastede filer (ikke signert URL — signeres av klienten)
  file_path       text,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Konsistenssjekk: fil-bevis krever file_path; artefakt-bevis krever ref
  check (
    (kind = 'file' and file_path is not null)
    or (kind in ('checklist_execution', 'survey_response', 'register_record')
        and external_ref_table is not null and external_ref_id is not null)
    or kind = 'note'
  )
);

create index if not exists task_project_evidence_project_kind_idx
  on public.task_project_evidence (project_id, kind, created_at desc);

create index if not exists task_project_evidence_org_idx
  on public.task_project_evidence (organization_id, created_at desc);

alter table public.task_project_evidence enable row level security;

drop policy if exists task_project_evidence_select_org on public.task_project_evidence;
create policy task_project_evidence_select_org
  on public.task_project_evidence for select
  using (organization_id = public.current_org_id());

drop policy if exists task_project_evidence_write_org on public.task_project_evidence;
create policy task_project_evidence_write_org
  on public.task_project_evidence for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_project_evidence_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_project_evidence_before_insert_defaults_tg on public.task_project_evidence;
create trigger task_project_evidence_before_insert_defaults_tg
  before insert on public.task_project_evidence
  for each row execute function public.task_project_evidence_before_insert_defaults();
