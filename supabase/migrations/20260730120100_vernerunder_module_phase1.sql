-- Vernerunder module — tabeller, RLS, org-triggere, status-revisjon, arbeidsflyt-RPC
-- Kjører etter workflow_dispatch_db_event (2026061815…) og handlingsplan (20260730120000).

-- ── 0) App permission: vernerunder.manage (admin-rolle) ──────────────────────
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'vernerunder.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- ── 1) Kategorier og maler (org-scope) ────────────────────────────────────────
create table if not exists public.vernerunde_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name             text not null
);

create index if not exists vernerunde_categories_org_name_idx
  on public.vernerunde_categories (organization_id, name);

create table if not exists public.vernerunde_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  description      text
);

create index if not exists vernerunde_templates_org_name_idx
  on public.vernerunde_templates (organization_id, name);

create table if not exists public.vernerunde_template_items (
  id                 uuid primary key default gen_random_uuid(),
  template_id        uuid not null references public.vernerunde_templates (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  question_text     text not null,
  category_id        uuid references public.vernerunde_categories (id) on delete set null,
  position           int not null default 0
);

create index if not exists vernerunde_template_items_tmpl_pos_idx
  on public.vernerunde_template_items (template_id, position);

create index if not exists vernerunde_template_items_org_idx
  on public.vernerunde_template_items (organization_id, template_id);

-- Hovedvernerunde
create table if not exists public.vernerunder (
  id               uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title            text not null,
  status           text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'signed')),
  planned_date     date,
  template_id      uuid references public.vernerunde_templates (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists vernerunder_org_planned_idx
  on public.vernerunder (organization_id, planned_date desc nulls last);

-- Snapshotted checkpoints
create table if not exists public.vernerunde_checkpoints (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations (id) on delete cascade,
  vernerunde_id              uuid not null references public.vernerunder (id) on delete cascade,
  original_template_item_id  uuid,
  question_text              text not null,
  status                     text not null default 'ok'
    check (status in ('ok', 'deviation', 'not_applicable')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists vernerunde_checkpoints_round_idx
  on public.vernerunde_checkpoints (vernerunde_id, created_at);

-- Deltakere
create table if not exists public.vernerunde_participants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vernerunde_id   uuid not null references public.vernerunder (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null
    check (role in ('manager', 'safety_deputy', 'employee')),
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (vernerunde_id, user_id, role)
);

create index if not exists vernerunde_participants_org_idx
  on public.vernerunde_participants (organization_id, vernerunde_id);

-- Funn
create table if not exists public.vernerunde_findings (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  vernerunde_id    uuid not null references public.vernerunder (id) on delete cascade,
  checkpoint_id    uuid references public.vernerunde_checkpoints (id) on delete set null,
  category_id      uuid references public.vernerunde_categories (id) on delete set null,
  description      text not null,
  severity         text not null
    check (severity in ('low', 'medium', 'high', 'critical')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists vernerunde_findings_org_severity_idx
  on public.vernerunde_findings (organization_id, severity, created_at desc);

-- ── 2) Triggers: updated_at ───────────────────────────────────────────────────
drop trigger if exists vernerunder_set_updated_at on public.vernerunder;
create trigger vernerunder_set_updated_at
  before update on public.vernerunder
  for each row execute function public.set_updated_at();

drop trigger if exists vernerunde_checkpoints_set_updated_at on public.vernerunde_checkpoints;
create trigger vernerunde_checkpoints_set_updated_at
  before update on public.vernerunde_checkpoints
  for each row execute function public.set_updated_at();

drop trigger if exists vernerunde_findings_set_updated_at on public.vernerunde_findings;
create trigger vernerunde_findings_set_updated_at
  before update on public.vernerunde_findings
  for each row execute function public.set_updated_at();

-- ── 3) set_org_id / defaults (before insert) ──────────────────────────────────
create or replace function public.vernerunder_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists vernerunder_before_insert_tg on public.vernerunder;
create trigger vernerunder_before_insert_tg
  before insert on public.vernerunder
  for each row execute function public.vernerunder_before_insert();

create or replace function public.vernerunde_categories_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists vernerunde_categories_before_insert_tg on public.vernerunde_categories;
create trigger vernerunde_categories_before_insert_tg
  before insert on public.vernerunde_categories
  for each row execute function public.vernerunde_categories_before_insert();

create or replace function public.vernerunde_templates_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists vernerunde_templates_before_insert_tg on public.vernerunde_templates;
create trigger vernerunde_templates_before_insert_tg
  before insert on public.vernerunde_templates
  for each row execute function public.vernerunde_templates_before_insert();

create or replace function public.set_org_id_from_vernerunde_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select t.organization_id into v_org_id
  from public.vernerunde_templates t
  where t.id = new.template_id;
  if v_org_id is null then
    raise exception 'vernerunde_template not found for id %', new.template_id;
  end if;
  new.organization_id := v_org_id;
  return new;
end;
$$;

drop trigger if exists vernerunde_template_items_set_org_tg on public.vernerunde_template_items;
create trigger vernerunde_template_items_set_org_tg
  before insert or update on public.vernerunde_template_items
  for each row execute function public.set_org_id_from_vernerunde_template();

create or replace function public.set_org_id_from_vernerunder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select v.organization_id into v_org_id
  from public.vernerunder v
  where v.id = new.vernerunde_id;
  if v_org_id is null then
    raise exception 'vernerunder not found for id %', new.vernerunde_id;
  end if;
  new.organization_id := v_org_id;
  return new;
end;
$$;

drop trigger if exists vernerunde_checkpoints_set_org_tg on public.vernerunde_checkpoints;
create trigger vernerunde_checkpoints_set_org_tg
  before insert or update on public.vernerunde_checkpoints
  for each row execute function public.set_org_id_from_vernerunder();

drop trigger if exists vernerunde_participants_set_org_tg on public.vernerunde_participants;
create trigger vernerunde_participants_set_org_tg
  before insert or update on public.vernerunde_participants
  for each row execute function public.set_org_id_from_vernerunder();

drop trigger if exists vernerunde_findings_set_org_tg on public.vernerunde_findings;
create trigger vernerunde_findings_set_org_tg
  before insert or update on public.vernerunde_findings
  for each row execute function public.set_org_id_from_vernerunder();

-- ── 4) RLS: alle tabeller, filter organization_id + vernerunder.manage for skrivetilgang
create or replace function public.user_can_manage_vernerunder()
returns boolean
language sql
stable
as $$
  select public.is_org_admin() or public.user_has_permission('vernerunder.manage');
$$;

-- vernerunder
alter table public.vernerunder enable row level security;

drop policy if exists vernerunder_select on public.vernerunder;
create policy vernerunder_select on public.vernerunder
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunder_insert on public.vernerunder;
create policy vernerunder_insert on public.vernerunder
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
  );

drop policy if exists vernerunder_update on public.vernerunder;
create policy vernerunder_update on public.vernerunder
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and status not in ('completed', 'signed')
  )
  with check (organization_id = public.current_org_id());

drop policy if exists vernerunder_delete on public.vernerunder;
create policy vernerunder_delete on public.vernerunder
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and status = 'draft'
  );

grant select, insert, update, delete on public.vernerunder to authenticated;

-- Kategorier
alter table public.vernerunde_categories enable row level security;

drop policy if exists vernerunde_categories_select on public.vernerunde_categories;
create policy vernerunde_categories_select on public.vernerunde_categories
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_categories_write on public.vernerunde_categories;
create policy vernerunde_categories_write on public.vernerunde_categories
  for all to authenticated
  using (
    organization_id = public.current_org_id() and public.user_can_manage_vernerunder()
  )
  with check (
    organization_id = public.current_org_id() and public.user_can_manage_vernerunder()
  );

grant select, insert, update, delete on public.vernerunde_categories to authenticated;

-- Maler
alter table public.vernerunde_templates enable row level security;

drop policy if exists vernerunde_templates_select on public.vernerunde_templates;
create policy vernerunde_templates_select on public.vernerunde_templates
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_templates_write on public.vernerunde_templates;
create policy vernerunde_templates_write on public.vernerunde_templates
  for all to authenticated
  using (organization_id = public.current_org_id() and public.user_can_manage_vernerunder())
  with check (organization_id = public.current_org_id() and public.user_can_manage_vernerunder());

grant select, insert, update, delete on public.vernerunde_templates to authenticated;

-- Malpunkter
alter table public.vernerunde_template_items enable row level security;

drop policy if exists vernerunde_template_items_select on public.vernerunde_template_items;
create policy vernerunde_template_items_select on public.vernerunde_template_items
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_template_items_write on public.vernerunde_template_items;
create policy vernerunde_template_items_write on public.vernerunde_template_items
  for all to authenticated
  using (organization_id = public.current_org_id() and public.user_can_manage_vernerunder())
  with check (organization_id = public.current_org_id() and public.user_can_manage_vernerunder());

grant select, insert, update, delete on public.vernerunde_template_items to authenticated;

-- Barn av vernerunder: lås når status er ferdig/signert
create or replace function public.vernerunde_parent_mutable(p_vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vernerunder v
    where v.id = p_vid
      and v.organization_id = public.current_org_id()
      and v.status not in ('completed', 'signed')
  );
$$;

alter table public.vernerunde_checkpoints enable row level security;

drop policy if exists vernerunde_checkpoints_select on public.vernerunde_checkpoints;
create policy vernerunde_checkpoints_select on public.vernerunde_checkpoints
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_checkpoints_insert on public.vernerunde_checkpoints;
create policy vernerunde_checkpoints_insert on public.vernerunde_checkpoints
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

drop policy if exists vernerunde_checkpoints_update on public.vernerunde_checkpoints;
create policy vernerunde_checkpoints_update on public.vernerunde_checkpoints
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists vernerunde_checkpoints_delete on public.vernerunde_checkpoints;
create policy vernerunde_checkpoints_delete on public.vernerunde_checkpoints
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

grant select, insert, update, delete on public.vernerunde_checkpoints to authenticated;

-- Deltakere
alter table public.vernerunde_participants enable row level security;

drop policy if exists vernerunde_participants_select on public.vernerunde_participants;
create policy vernerunde_participants_select on public.vernerunde_participants
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_participants_insert on public.vernerunde_participants;
create policy vernerunde_participants_insert on public.vernerunde_participants
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

drop policy if exists vernerunde_participants_update on public.vernerunde_participants;
create policy vernerunde_participants_update on public.vernerunde_participants
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists vernerunde_participants_delete on public.vernerunde_participants;
create policy vernerunde_participants_delete on public.vernerunde_participants
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

grant select, insert, update, delete on public.vernerunde_participants to authenticated;

-- Funn
alter table public.vernerunde_findings enable row level security;

drop policy if exists vernerunde_findings_select on public.vernerunde_findings;
create policy vernerunde_findings_select on public.vernerunde_findings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists vernerunde_findings_insert on public.vernerunde_findings;
create policy vernerunde_findings_insert on public.vernerunde_findings
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

drop policy if exists vernerunde_findings_update on public.vernerunde_findings;
create policy vernerunde_findings_update on public.vernerunde_findings
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists vernerunde_findings_delete on public.vernerunde_findings;
create policy vernerunde_findings_delete on public.vernerunde_findings
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.user_can_manage_vernerunder()
    and public.vernerunde_parent_mutable(vernerunde_id)
  );

grant select, insert, update, delete on public.vernerunde_findings to authenticated;

-- ── 5) Revisjonslogg: hse_audit_trigger for alle; ekstra uforanderlig logg for status
drop trigger if exists vernerunder_audit_tg on public.vernerunder;
create trigger vernerunder_audit_tg
  after insert or update or delete on public.vernerunder
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_checkpoints_audit_tg on public.vernerunde_checkpoints;
create trigger vernerunde_checkpoints_audit_tg
  after insert or update or delete on public.vernerunde_checkpoints
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_participants_audit_tg on public.vernerunde_participants;
create trigger vernerunde_participants_audit_tg
  after insert or update or delete on public.vernerunde_participants
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_findings_audit_tg on public.vernerunde_findings;
create trigger vernerunde_findings_audit_tg
  after insert or update or delete on public.vernerunde_findings
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_categories_audit_tg on public.vernerunde_categories;
create trigger vernerunde_categories_audit_tg
  after insert or update or delete on public.vernerunde_categories
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_templates_audit_tg on public.vernerunde_templates;
create trigger vernerunde_templates_audit_tg
  after insert or update or delete on public.vernerunde_templates
  for each row execute function public.hse_audit_trigger();

drop trigger if exists vernerunde_template_items_audit_tg on public.vernerunde_template_items;
create trigger vernerunde_template_items_audit_tg
  after insert or update or delete on public.vernerunde_template_items
  for each row execute function public.hse_audit_trigger();

-- Statusendringer på vernerunder (hovedtabell) — særskilt spor for juridisk sporing
create or replace function public.trg_vernerunder_immutable_status_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.hse_audit_log
      (organization_id, table_name, record_id, action, changed_by, old_data, new_data, changed_fields)
    values (
      new.organization_id,
      'vernerunder_status',
      new.id,
      'INSERT',
      auth.uid(),
      null,
      jsonb_build_object('id', new.id, 'status', new.status, 'at', now()),
      array['status']::text[]
    );
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.hse_audit_log
      (organization_id, table_name, record_id, action, changed_by, old_data, new_data, changed_fields)
    values (
      new.organization_id,
      'vernerunder_status',
      new.id,
      'UPDATE',
      auth.uid(),
      to_jsonb(old) || jsonb_build_object('status', old.status),
      to_jsonb(new) || jsonb_build_object('status', new.status, 'at', now()),
      array['status']::text[]
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists vernerunder_immutable_status_audit_tg on public.vernerunder;
create trigger vernerunder_immutable_status_audit_tg
  after insert or update of status on public.vernerunder
  for each row execute function public.trg_vernerunder_immutable_status_audit();

-- Klient: dispatch til workflow_engine (polymorfe kilder, sjekker org)
create or replace function public.workflow_emit_vernerunder_event(
  p_event text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_src      text;
  v_fid      uuid;
  v_finding  jsonb;
  v_enriched jsonb;
begin
  if p_event is null or p_event = '' then
    raise exception 'p_event is required';
  end if;
  v_org := (p_payload->'row'->>'organization_id')::uuid;
  if v_org is null or v_org <> public.current_org_id() then
    raise exception 'Ugyldig organization_id for arbeidsflyt';
  end if;

  v_src := p_payload->>'source_module';
  v_fid := (p_payload->>'source_id')::uuid;
  if v_fid is null and p_payload->'row' is not null then
    v_fid := (p_payload->'row'->>'id')::uuid;
  end if;

  v_enriched := p_payload;
  if p_event in ('ON_FINDING_REGISTERED', 'ON_FINDING_UPDATED') and v_fid is not null then
    select to_jsonb(f) into v_finding
    from public.vernerunde_findings f
    where f.id = v_fid and f.organization_id = v_org;
    if v_finding is not null then
      v_enriched := v_finding
        || jsonb_build_object(
          'source_module', coalesce(v_src, 'vernerunder'),
          'source_id', v_fid::text
        );
    end if;
  end if;

  perform public.workflow_dispatch_db_event(v_org, 'vernerunder', p_event, v_enriched);
end;
$$;

revoke all on function public.workflow_emit_vernerunder_event(text, jsonb) from public;
grant execute on function public.workflow_emit_vernerunder_event(text, jsonb) to authenticated;
