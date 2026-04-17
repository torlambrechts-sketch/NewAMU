-- Retention metadata on wiki_pages, reference categories, optional pg_cron reminders.

-- ---------------------------------------------------------------------------
-- 1. Reference table: retention categories with legal minimums
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_retention_categories (
  slug text primary key,
  label text not null,
  min_years int not null,
  max_years int,
  legal_refs text[] not null default '{}',
  description text
);

insert into public.wiki_retention_categories (slug, label, min_years, max_years, legal_refs, description) values
  ('hms_dokument', 'HMS-dokumentasjon', 5, null,
   array['IK-f §5', 'AML §18-8']::text[],
   'Risikovurderinger, avvikslogger, HMS-planer — oppbevares minimum 5 år'),
  ('personaldokument', 'Personaldokumenter', 5, null,
   array['AML §14-5', 'Regnskapsloven §2-7']::text[],
   'Arbeidsavtaler og lønnsdokumenter oppbevares minimum 5 år etter avsluttet arbeidsforhold'),
  ('opplaeringslogg', 'Opplæringslogg og HMS-kurs', 5, null,
   array['AML §3-2', 'Forskrift om organisering §3-18']::text[],
   'Dokumentasjon av HMS-opplæring for ledere og ansatte'),
  ('amu_protokoll', 'AMU-protokoller', 3, null,
   array['AML §7-4']::text[],
   'Referat fra AMU-møter oppbevares minimum 3 år (AML §7-4)'),
  ('varslingssak', 'Varslingssaker', 3, 5,
   array['AML §2A-6', 'GDPR Art. 5(1)(e)']::text[],
   'Minimum 3 år (Arbeidstilsynet-inspeksjon), maksimum 5 år (GDPR)'),
  ('personvern', 'GDPR-dokumentasjon', 3, null,
   array['GDPR Art. 30', 'Personopplysningsloven §2']::text[],
   'Behandlingsprotokoll og personvernerklæringer'),
  ('intern_prosedyre', 'Interne rutiner og prosedyrer', 1, null,
   array['IK-f §5']::text[],
   'Interne rutiner trenger ikke lang oppbevaring etter utfasing'),
  ('okonomidokument', 'Økonomidokumenter', 5, null,
   array['Regnskapsloven §2-7']::text[],
   'Regnskaps- og bilagskrav — typisk minimum 5 år'),
  ('ad_hoc', 'Uklassifisert', 1, null,
   array[]::text[],
   'Vurder klassifisering')
on conflict (slug) do update set
  label = excluded.label,
  min_years = excluded.min_years,
  max_years = excluded.max_years,
  legal_refs = excluded.legal_refs,
  description = excluded.description;

alter table public.wiki_retention_categories enable row level security;

drop policy if exists "wiki_retention_categories_select_authenticated" on public.wiki_retention_categories;
create policy "wiki_retention_categories_select_authenticated"
  on public.wiki_retention_categories for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2. wiki_pages: retention columns + generated scheduled_deletion_at
-- ---------------------------------------------------------------------------

alter table public.wiki_pages
  add column if not exists retention_category text references public.wiki_retention_categories (slug) on delete set null,
  add column if not exists retain_minimum_years int,
  add column if not exists retain_maximum_years int,
  add column if not exists archived_at timestamptz;

alter table public.wiki_pages drop column if exists scheduled_deletion_at;

alter table public.wiki_pages
  add column scheduled_deletion_at timestamptz generated always as (
    case
      when archived_at is not null and retain_maximum_years is not null
      then archived_at + make_interval(years => retain_maximum_years)
      else null
    end
  ) stored;

create index if not exists wiki_pages_scheduled_deletion_idx
  on public.wiki_pages (organization_id, scheduled_deletion_at)
  where scheduled_deletion_at is not null;

-- ---------------------------------------------------------------------------
-- 3. Enqueue 30-day deletion reminders (idempotent; called by pg_cron or manually)
-- ---------------------------------------------------------------------------

create or replace function public.wiki_retention_enqueue_deletion_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
begin
  insert into public.workflow_action_queue (
    organization_id,
    step_type,
    config_json,
    context_json,
    status,
    execute_after
  )
  select
    p.organization_id,
    'send_notification',
    jsonb_build_object(
      'title', 'Dokument nærmer seg slettedato',
      'body', 'Dokumentet «' || replace(p.title, '"', '''') || '» skal slettes om 30 dager (planlagt ' ||
        to_char(p.scheduled_deletion_at, 'YYYY-MM-DD') || ').'
    ),
    jsonb_build_object(
      'pageId', p.id,
      'deletionAt', p.scheduled_deletion_at,
      'kind', 'wiki_retention_deletion_30d'
    ),
    'pending',
    now()
  from public.wiki_pages p
  where p.scheduled_deletion_at is not null
    and p.scheduled_deletion_at >= (now() + interval '29 days')
    and p.scheduled_deletion_at <= (now() + interval '31 days')
    and not exists (
      select 1
      from public.workflow_action_queue q
      where q.organization_id = p.organization_id
        and q.step_type = 'send_notification'
        and q.status in ('pending', 'processing')
        and coalesce(q.context_json->>'kind', '') = 'wiki_retention_deletion_30d'
        and coalesce(q.context_json->>'pageId', '') = p.id
        and q.created_at > (now() - interval '40 days')
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.wiki_retention_enqueue_deletion_reminders() is
  'Queues send_notification rows for wiki pages whose scheduled_deletion_at is in ~30 days. Intended for weekly pg_cron.';

grant execute on function public.wiki_retention_enqueue_deletion_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Optional: pg_cron weekly job (Monday 08:00 UTC) — skip if extension missing
-- ---------------------------------------------------------------------------

do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'wiki_retention_deletion_reminders')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
exception
  when undefined_table then
    null;
  when undefined_function then
    null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'wiki_retention_deletion_reminders',
      '0 8 * * 1',
      $cmd$select public.wiki_retention_enqueue_deletion_reminders();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule wiki_retention_enqueue_deletion_reminders() externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule wiki_retention_enqueue_deletion_reminders() externally';
end
$cron$;
