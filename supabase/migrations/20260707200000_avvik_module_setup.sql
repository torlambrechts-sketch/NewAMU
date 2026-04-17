-- Dedicated avvik (deviation) module setup:
-- 1. Immutable HSE audit log (fixes "Kunne ikke laste revisjonslogg" errors)
-- 2. assigned_to on deviations and inspection_findings
-- 3. BEFORE INSERT defaults trigger for deviations

-- ── 1. hse_audit_log (append-only, trigger-backed) ────────────────────────────

create table if not exists public.hse_audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  table_name      text not null,
  record_id       uuid not null,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by      uuid references auth.users (id) on delete set null,
  changed_at      timestamptz not null default now(),
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[]
);

create index if not exists hse_audit_log_org_table_idx
  on public.hse_audit_log (organization_id, table_name, changed_at desc);

create index if not exists hse_audit_log_record_idx
  on public.hse_audit_log (record_id, changed_at desc);

alter table public.hse_audit_log enable row level security;

create policy if not exists hse_audit_log_select
  on public.hse_audit_log for select to authenticated
  using (organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('hse.audit_read')));

create policy if not exists hse_audit_log_insert_system
  on public.hse_audit_log for insert to authenticated
  with check (organization_id = public.current_org_id());

grant select, insert on public.hse_audit_log to authenticated;

-- ── 2. Generic audit trigger function ────────────────────────────────────────

create or replace function public.hse_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changed_fields text[];
  v_old  jsonb := null;
  v_new  jsonb := null;
begin
  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select array_agg(key) into v_changed_fields
    from (
      select key from jsonb_each(v_old)
      where v_old->key is distinct from v_new->key
    ) changed;
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  end if;

  insert into public.hse_audit_log
    (organization_id, table_name, record_id, action, changed_by,
     old_data, new_data, changed_fields)
  values (
    coalesce((v_new->>'organization_id')::uuid, (v_old->>'organization_id')::uuid),
    TG_TABLE_NAME,
    coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
    TG_OP,
    auth.uid(),
    v_old,
    v_new,
    v_changed_fields
  );

  return coalesce(NEW, OLD);
end;
$$;

-- ── 3. Attach audit trigger to HSE tables ─────────────────────────────────────

drop trigger if exists inspection_rounds_audit_tg   on public.inspection_rounds;
drop trigger if exists inspection_findings_audit_tg on public.inspection_findings;
drop trigger if exists deviations_audit_tg           on public.deviations;

create trigger inspection_rounds_audit_tg
  after insert or update or delete on public.inspection_rounds
  for each row execute function public.hse_audit_trigger();

create trigger inspection_findings_audit_tg
  after insert or update or delete on public.inspection_findings
  for each row execute function public.hse_audit_trigger();

create trigger deviations_audit_tg
  after insert or update or delete on public.deviations
  for each row execute function public.hse_audit_trigger();

-- ── 4. Extra columns on deviations ───────────────────────────────────────────

alter table public.deviations
  add column if not exists assigned_to        uuid references auth.users (id) on delete set null,
  add column if not exists root_cause_analysis text,
  add column if not exists closed_at          timestamptz,
  add column if not exists closed_by          uuid references auth.users (id) on delete set null;

-- Auto-fill organization_id + created_by and record closed_at
create or replace function public.deviations_before_insert_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
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

drop trigger if exists deviations_before_insert_defaults_tg on public.deviations;
create trigger deviations_before_insert_defaults_tg
  before insert on public.deviations
  for each row execute function public.deviations_before_insert_defaults();

create or replace function public.deviations_before_update_closed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and (old.status is null or old.status <> 'closed') then
    new.closed_at := now();
    new.closed_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists deviations_before_update_closed_tg on public.deviations;
create trigger deviations_before_update_closed_tg
  before update on public.deviations
  for each row execute function public.deviations_before_update_closed();
