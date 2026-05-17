-- workflow retention / kassasjonsregler.
--
-- Arkivloven §6 — dokumentasjon skal bevares så lenge den har rettslig
-- eller administrativ verdi. GDPR Art. 5(1)(e) — lagringsbegrensning,
-- personopplysninger skal slettes når formålet er oppnådd. Riksrevisjons-
-- prinsipper anbefaler 7-årsretensjon for offentlig-relaterte
-- transaksjoner. AML §3-1 stiller krav til dokumentasjonsplikt for HMS-
-- prosesser. Restrisiko: legacy organisasjoner uten eksplisitt
-- retain-innstilling får default 11 år (7 år Riksrevisjon + 4 år
-- sikkerhetsbuffer for varslings- og personskade-saker som typisk får
-- foreldelsesfrist > 7 år).

-- ---------------------------------------------------------------------------
-- 1. Per-row retention horizon. NULL means "inherit org default at write
--    time"; the AFTER-INSERT triggers stamp a concrete value so the
--    purge tick can decide without re-reading the org row.
-- ---------------------------------------------------------------------------
alter table public.workflow_runs
  add column if not exists retain_until timestamptz;

alter table public.workflow_run_evidence
  add column if not exists retain_until timestamptz;

create index if not exists workflow_runs_retain_idx
  on public.workflow_runs (retain_until)
  where retain_until is not null;

create index if not exists workflow_run_evidence_retain_idx
  on public.workflow_run_evidence (retain_until)
  where retain_until is not null;

comment on column public.workflow_runs.retain_until is
  'Hard kassasjons-horisont (Arkivloven §6 / GDPR Art. 5(1)(e)). NULL only on legacy rows; new rows are stamped by trg_workflow_runs_apply_retention. Purge tick moves rows to workflow_runs_archive after this point.';
comment on column public.workflow_run_evidence.retain_until is
  'Mirrors the parent run''s retain_until at write time. Allows evidence to be purged in lock-step with the run.';

-- ---------------------------------------------------------------------------
-- 2. Org-level retention setting. Default 11 years; bounded to a sensible
--    operational range (1-50). Tenants can adjust via admin UI.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists workflow_retention_years int;

do $$
begin
  -- Apply default + check constraint defensively (works whether the column
  -- existed already or was just added). The constraint name lets us drop
  -- and recreate it on schema iterations without conflict.
  alter table public.organizations
    alter column workflow_retention_years set default 11;

  update public.organizations
     set workflow_retention_years = 11
   where workflow_retention_years is null;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'organizations_workflow_retention_years_check'
  ) then
    alter table public.organizations
      add constraint organizations_workflow_retention_years_check
      check (workflow_retention_years between 1 and 50);
  end if;
end
$$;

comment on column public.organizations.workflow_retention_years is
  'How many years workflow_runs / workflow_run_evidence for this org are retained before purge tick archives them. Default 11 (Riksrevisjon 7 + buffer 4).';

-- ---------------------------------------------------------------------------
-- 3. Stamp retain_until on new runs.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_apply_retention_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_years int;
begin
  if new.retain_until is not null then
    return new;
  end if;

  select coalesce(workflow_retention_years, 11)
    into v_years
    from public.organizations
   where id = new.organization_id;

  if v_years is null then
    v_years := 11;
  end if;

  update public.workflow_runs
     set retain_until = new.created_at + (v_years || ' years')::interval
   where id = new.id
     and retain_until is null;

  return null;  -- AFTER trigger; ignored
end;
$$;

drop trigger if exists workflow_runs_apply_retention on public.workflow_runs;
create trigger workflow_runs_apply_retention
  after insert on public.workflow_runs
  for each row execute function public.workflow_apply_retention_defaults();

-- ---------------------------------------------------------------------------
-- 4. Stamp evidence rows from the parent run.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_apply_evidence_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
  v_years int;
begin
  if new.retain_until is not null then
    return new;
  end if;

  select retain_until
    into v_until
    from public.workflow_runs
   where id = new.run_id;

  if v_until is null then
    select coalesce(workflow_retention_years, 11)
      into v_years
      from public.organizations
     where id = new.organization_id;
    v_until := new.created_at + (coalesce(v_years, 11) || ' years')::interval;
  end if;

  update public.workflow_run_evidence
     set retain_until = v_until
   where id = new.id
     and retain_until is null;

  return null;
end;
$$;

drop trigger if exists workflow_run_evidence_apply_retention on public.workflow_run_evidence;
create trigger workflow_run_evidence_apply_retention
  after insert on public.workflow_run_evidence
  for each row execute function public.workflow_apply_evidence_retention();

-- ---------------------------------------------------------------------------
-- 5. Archive tables. Same shape as the live tables, plus archived_at.
--    We use create-table-if-not-exists with `like ... including all` so
--    column additions to the live tables don't silently desync — the
--    archive will simply lack the new column until a follow-up migration
--    adds it (caught at insert time).
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_runs_archive (
  like public.workflow_runs including defaults including constraints,
  archived_at timestamptz not null default now()
);

create table if not exists public.workflow_run_evidence_archive (
  like public.workflow_run_evidence including defaults including constraints,
  archived_at timestamptz not null default now()
);

create index if not exists workflow_runs_archive_org_idx
  on public.workflow_runs_archive (organization_id, archived_at desc);
create index if not exists workflow_run_evidence_archive_run_idx
  on public.workflow_run_evidence_archive (run_id);

alter table public.workflow_runs_archive enable row level security;
alter table public.workflow_run_evidence_archive enable row level security;

-- Archive is read-only to clients (purge function writes via security definer).
drop policy if exists "workflow_runs_archive_select" on public.workflow_runs_archive;
create policy "workflow_runs_archive_select"
  on public.workflow_runs_archive for select
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission_strict('workflows.view_confidential')
  );

drop policy if exists "workflow_runs_archive_no_write" on public.workflow_runs_archive;
create policy "workflow_runs_archive_no_write"
  on public.workflow_runs_archive for all
  using (false)
  with check (false);

drop policy if exists "workflow_run_evidence_archive_select" on public.workflow_run_evidence_archive;
create policy "workflow_run_evidence_archive_select"
  on public.workflow_run_evidence_archive for select
  using (
    organization_id = public.current_org_id()
    and public.user_has_permission_strict('workflows.view_confidential')
  );

drop policy if exists "workflow_run_evidence_archive_no_write" on public.workflow_run_evidence_archive;
create policy "workflow_run_evidence_archive_no_write"
  on public.workflow_run_evidence_archive for all
  using (false)
  with check (false);

comment on table public.workflow_runs_archive is
  'Cold-storage of workflow_runs whose retain_until has elapsed. Written by workflow_retention_purge_tick() — Arkivloven §6 preservation while live table stays small.';
comment on table public.workflow_run_evidence_archive is
  'Cold-storage of workflow_run_evidence beyond retain_until. The Merkle chain remains verifiable because chain_root_checksum is preserved.';

-- ---------------------------------------------------------------------------
-- 6. Purge tick. Moves expired live rows to archive, then deletes from
--    live. Designed to be idempotent and resumable (each iteration is a
--    self-contained DELETE..RETURNING into INSERT). SECURITY DEFINER so
--    it can write to the immutable evidence table and the otherwise-
--    write-locked archive.
-- ---------------------------------------------------------------------------
create or replace function public.workflow_retention_purge_tick(
  p_batch_size int default 500
)
returns table (
  archived_runs     bigint,
  archived_evidence bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs_count     bigint := 0;
  v_evidence_count bigint := 0;
begin
  -- 6a. Evidence rows whose own retain_until has elapsed OR whose parent
  --     run is about to be purged. Evidence is moved first so the run-
  --     deletion doesn't trip the immutability trigger via cascade.
  with expired_evidence as (
    select e.*
      from public.workflow_run_evidence e
     where (
       e.retain_until is not null and e.retain_until < now()
     )
     or e.run_id in (
       select id from public.workflow_runs
        where retain_until is not null and retain_until < now()
     )
     limit p_batch_size
  ),
  archived as (
    insert into public.workflow_run_evidence_archive
      select e.*, now() as archived_at from expired_evidence e
    returning id
  )
  select count(*) into v_evidence_count from archived;

  -- Temporarily bypass the BEFORE-DELETE immutability trigger on the live
  -- evidence table. session_replication_role = replica disables row-level
  -- triggers (but not RLS) for this statement only.
  if v_evidence_count > 0 then
    perform set_config('session_replication_role', 'replica', true);
    delete from public.workflow_run_evidence
     where id in (select id from public.workflow_run_evidence_archive
                   where archived_at > now() - interval '1 minute');
    perform set_config('session_replication_role', 'origin', true);
  end if;

  -- 6b. Now move expired runs.
  with expired_runs as (
    select r.*
      from public.workflow_runs r
     where r.retain_until is not null and r.retain_until < now()
     limit p_batch_size
  ),
  archived as (
    insert into public.workflow_runs_archive
      select r.*, now() as archived_at from expired_runs r
    returning id
  )
  select count(*) into v_runs_count from archived;

  if v_runs_count > 0 then
    delete from public.workflow_runs
     where id in (select id from public.workflow_runs_archive
                   where archived_at > now() - interval '1 minute');
  end if;

  archived_runs     := v_runs_count;
  archived_evidence := v_evidence_count;
  return next;
end;
$$;

revoke all on function public.workflow_retention_purge_tick(int) from public;
grant execute on function public.workflow_retention_purge_tick(int) to service_role;

comment on function public.workflow_retention_purge_tick(int) is
  'Archives + deletes workflow_runs/evidence past retain_until. Run by pg_cron at 03:00 quarterly. Manual invocation requires service_role.';

-- ---------------------------------------------------------------------------
-- 7. pg_cron schedule — only if the extension is available.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule any prior entry with the same name (idempotent).
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'workflow_retention_purge_tick';

    perform cron.schedule(
      'workflow_retention_purge_tick',
      '0 3 1 1,4,7,10 *',
      $cron$ select public.workflow_retention_purge_tick(500); $cron$
    );
    raise notice 'workflow_retention_purge_tick scheduled quarterly via pg_cron';
  else
    raise notice 'pg_cron not installed — workflow_retention_purge_tick must be invoked manually by ops';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 8. Critical FK fix: organizations on delete CASCADE -> RESTRICT.
--    Without this, dropping a tenant silently shreds the workflow audit
--    trail — direct Arkivloven §6 + GDPR Art. 5(1)(e) breach (the data
--    has not yet reached its retain_until). Operators must explicitly
--    purge/archive workflow data before deleting an org.
-- ---------------------------------------------------------------------------
do $fk$
declare
  v_runs_fk     text;
  v_evidence_fk text;
begin
  -- Resolve the actual FK constraint name dynamically (handles default
  -- and non-default names equally). organization_id on each table.
  select c.conname into v_runs_fk
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'workflow_runs'
     and c.contype = 'f'
     and exists (
       select 1
         from unnest(c.conkey) as ck
         join pg_attribute a
           on a.attrelid = c.conrelid
          and a.attnum   = ck
        where a.attname = 'organization_id'
     );

  if v_runs_fk is not null then
    execute format(
      'alter table public.workflow_runs drop constraint %I',
      v_runs_fk
    );
  end if;
  -- (Re)create with RESTRICT, idempotent via the IF NOT EXISTS dance below.
  if not exists (
    select 1 from pg_constraint
     where conname = 'workflow_runs_organization_id_fkey_restrict'
  ) then
    alter table public.workflow_runs
      add constraint workflow_runs_organization_id_fkey_restrict
      foreign key (organization_id)
      references public.organizations (id)
      on delete restrict;
  end if;

  select c.conname into v_evidence_fk
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'workflow_run_evidence'
     and c.contype = 'f'
     and exists (
       select 1
         from unnest(c.conkey) as ck
         join pg_attribute a
           on a.attrelid = c.conrelid
          and a.attnum   = ck
        where a.attname = 'organization_id'
     );

  if v_evidence_fk is not null then
    execute format(
      'alter table public.workflow_run_evidence drop constraint %I',
      v_evidence_fk
    );
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'workflow_run_evidence_organization_id_fkey_restrict'
  ) then
    alter table public.workflow_run_evidence
      add constraint workflow_run_evidence_organization_id_fkey_restrict
      foreign key (organization_id)
      references public.organizations (id)
      on delete restrict;
  end if;
end
$fk$;

-- ---------------------------------------------------------------------------
-- 9. Backfill retain_until for pre-existing rows so the purge tick has
--    a concrete horizon to compare against (otherwise old rows linger
--    forever with NULL).
-- ---------------------------------------------------------------------------
do $backfill$
declare
  v_runs    bigint;
  v_ev      bigint;
begin
  with upd as (
    update public.workflow_runs r
       set retain_until = r.created_at
                        + (coalesce(o.workflow_retention_years, 11) || ' years')::interval
      from public.organizations o
     where o.id = r.organization_id
       and r.retain_until is null
    returning 1
  )
  select count(*) into v_runs from upd;

  with upd as (
    update public.workflow_run_evidence e
       set retain_until = coalesce(
             (select retain_until from public.workflow_runs r where r.id = e.run_id),
             e.created_at + (coalesce(o.workflow_retention_years, 11) || ' years')::interval
           )
      from public.organizations o
     where o.id = e.organization_id
       and e.retain_until is null
    returning 1
  )
  select count(*) into v_ev from upd;

  raise notice 'workflow retention backfill: % runs / % evidence rows stamped', v_runs, v_ev;
end
$backfill$;

do $$
begin
  raise notice 'workflow retention policy installed (FK -> on delete restrict, archive + purge tick ready)';
end
$$;
