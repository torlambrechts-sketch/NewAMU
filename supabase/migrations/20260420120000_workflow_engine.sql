-- Workflow automation: rules on org JSON modules + wiki publish; execution log; optional task creation.
-- Skip recursion when updating tasks from workflow via set_config('app.workflow_skip', ...).

-- ---------------------------------------------------------------------------
-- Rules & runs
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  /** org_module_payloads.module_key — which JSON module this rule watches */
  source_module text not null,
  trigger_on text not null default 'update' check (trigger_on in ('insert', 'update', 'both')),
  is_active boolean not null default false,
  /** e.g. {"match":"array_any","path":"incidents","where":{"severity":"critical"}} or {"match":"always"} */
  condition_json jsonb not null default '{"match":"always"}'::jsonb,
  /** [{"type":"create_task","title":"...","assignee":"...","dueInDays":1,"module":"hse","sourceType":"hse_incident","description":""}] */
  actions_json jsonb not null default '[]'::jsonb,
  priority int not null default 0,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists workflow_rules_org_active_idx
  on public.workflow_rules (organization_id, is_active) where is_active = true;

drop trigger if exists workflow_rules_set_updated_at on public.workflow_rules;
create trigger workflow_rules_set_updated_at
  before update on public.workflow_rules
  for each row execute function public.set_updated_at();

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid references public.workflow_rules (id) on delete set null,
  source_module text not null,
  event text not null check (event in ('payload_change', 'wiki_published')),
  status text not null default 'completed' check (status in ('completed', 'skipped', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_runs_org_idx on public.workflow_runs (organization_id, created_at desc);

alter table public.workflow_rules enable row level security;
alter table public.workflow_runs enable row level security;

create policy "workflow_rules_select_org"
  on public.workflow_rules for select
  using (organization_id = public.current_org_id());

create policy "workflow_rules_write_manage"
  on public.workflow_rules for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

create policy "workflow_runs_select_org"
  on public.workflow_runs for select
  using (organization_id = public.current_org_id());

create policy "workflow_runs_insert_system"
  on public.workflow_runs for insert
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Condition + action helpers
-- ---------------------------------------------------------------------------

create or replace function public.workflow_payload_matches_condition(
  p_condition jsonb,
  p_new jsonb,
  p_old jsonb,
  p_trigger text
)
returns boolean
language plpgsql
immutable
as $$
declare
  m text;
  p text;
  w jsonb;
  arr jsonb;
  el jsonb;
begin
  m := coalesce(p_condition->>'match', 'always');
  if m = 'always' then
    return true;
  end if;
  if m = 'array_any' then
    p := p_condition->>'path';
    w := p_condition->'where';
    if p is null or w is null then
      return false;
    end if;
    arr := p_new #> string_to_array(p, '.');
    if arr is null or jsonb_typeof(arr) <> 'array' then
      return false;
    end if;
    for el in select * from jsonb_array_elements(arr)
    loop
      if w = '{}'::jsonb or w is null then
        return true;
      end if;
      if el @> w then
        return true;
      end if;
    end loop;
    return false;
  end if;
  if m = 'field_equals' then
    p := p_condition->>'path';
    if p is null then
      return false;
    end if;
    return (p_new #>> string_to_array(p, '.')) = (p_condition->>'value');
  end if;
  return false;
end;
$$;

/** Append a Kanban task to org_module_payloads tasks module (JSON). */
create or replace function public.workflow_append_task(
  p_org_id uuid,
  p_task jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur jsonb;
  tasks jsonb;
  audit jsonb;
  new_payload jsonb;
  aid text;
begin
  perform set_config('app.workflow_skip', 'on', true);

  select coalesce(payload, '{"tasks":[],"auditLog":[]}'::jsonb) into cur
  from public.org_module_payloads
  where organization_id = p_org_id and module_key = 'tasks'
  for update;

  aid := gen_random_uuid()::text;
  tasks := coalesce(cur->'tasks', '[]'::jsonb) || jsonb_build_array(p_task);
  audit := coalesce(cur->'auditLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', aid,
    'at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'action', 'workflow_task',
    'taskId', p_task->>'id',
    'message', 'Oppgave opprettet av arbeidsflyt'
  ));
  new_payload := jsonb_set(jsonb_set(cur, '{tasks}', tasks, true), '{auditLog}', audit, true);

  insert into public.org_module_payloads (organization_id, module_key, payload)
  values (p_org_id, 'tasks', new_payload)
  on conflict (organization_id, module_key) do update set
    payload = excluded.payload,
    updated_at = now();

  perform set_config('app.workflow_skip', 'off', true);
exception when others then
  perform set_config('app.workflow_skip', 'off', true);
  raise;
end;
$$;

create or replace function public.workflow_execute_actions(
  p_org_id uuid,
  p_rule_id uuid,
  p_actions jsonb,
  p_context jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  tid text;
  title text;
  descr text;
  assignee text;
  due_days int;
  mod text;
  src text;
  due text;
  t jsonb;
begin
  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    if a->>'type' = 'create_task' then
      tid := coalesce(a->>'id', gen_random_uuid()::text);
      title := coalesce(a->>'title', 'Arbeidsflyt-oppgave');
      descr := coalesce(a->>'description', '');
      assignee := coalesce(a->>'assignee', 'Ansvarlig');
      due_days := coalesce((a->>'dueInDays')::int, 7);
      mod := coalesce(a->>'module', 'hse');
      src := coalesce(a->>'sourceType', 'hse_incident');
      due := (current_date + (due_days || ' days')::interval)::date::text;
      t := jsonb_build_object(
        'id', tid,
        'title', title,
        'description', descr,
        'status', 'todo',
        'assignee', assignee,
        'ownerRole', coalesce(a->>'ownerRole', 'HMS'),
        'dueDate', due,
        'createdAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'module', mod,
        'sourceType', src,
        'sourceId', p_context->>'sourceId',
        'sourceLabel', coalesce(a->>'sourceLabel', 'Arbeidsflyt'),
        'requiresManagementSignOff', coalesce((a->>'requiresManagementSignOff')::boolean, false)
      );
      perform public.workflow_append_task(p_org_id, t);
    elsif a->>'type' = 'log_only' then
      null;
    end if;
  end loop;
end;
$$;

create or replace function public.workflow_on_org_module_payload_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  skip text;
  r record;
  ev text;
  payload_new jsonb;
  payload_old jsonb;
  ctx jsonb;
begin
  skip := current_setting('app.workflow_skip', true);
  if skip = 'on' then
    return NEW;
  end if;

  if tg_op = 'INSERT' then
    payload_new := NEW.payload;
    payload_old := '{}'::jsonb;
    ev := 'insert';
  else
    payload_new := NEW.payload;
    payload_old := OLD.payload;
    ev := 'update';
  end if;

  for r in
    select *
    from public.workflow_rules
    where organization_id = NEW.organization_id
      and source_module = NEW.module_key
      and is_active = true
    order by priority desc, created_at
  loop
    if r.trigger_on = 'insert' and ev = 'update' then
      continue;
    end if;
    if r.trigger_on = 'update' and ev = 'insert' then
      continue;
    end if;

    if not public.workflow_payload_matches_condition(r.condition_json, payload_new, payload_old, ev) then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, NEW.module_key, 'payload_change', 'skipped', jsonb_build_object('reason', 'condition_not_met'));
      continue;
    end if;

    ctx := jsonb_build_object(
      'module', NEW.module_key,
      'sourceId', NEW.organization_id::text,
      'payloadSnapshot', left(payload_new::text, 8000)
    );

    begin
      perform public.workflow_execute_actions(NEW.organization_id, r.id, r.actions_json, ctx);
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        NEW.organization_id,
        r.id,
        NEW.module_key,
        'payload_change',
        'completed',
        jsonb_build_object('actions', jsonb_array_length(coalesce(r.actions_json, '[]'::jsonb)))
      );
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (
        NEW.organization_id,
        r.id,
        NEW.module_key,
        'payload_change',
        'failed',
        jsonb_build_object('error', sqlerrm)
      );
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists workflow_org_payload_aiud on public.org_module_payloads;
create trigger workflow_org_payload_aiud
  after insert or update on public.org_module_payloads
  for each row execute function public.workflow_on_org_module_payload_change();

-- Wiki: published minutes → optional notification task / log
create or replace function public.workflow_on_wiki_page_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  ctx jsonb;
begin
  if tg_op <> 'UPDATE' then
    return NEW;
  end if;
  if NEW.status <> 'published' or OLD.status = 'published' then
    return NEW;
  end if;

  for r in
    select *
    from public.workflow_rules
    where organization_id = NEW.organization_id
      and source_module = 'wiki_published'
      and is_active = true
    order by priority desc
  loop
    ctx := jsonb_build_object('pageId', NEW.id, 'title', NEW.title);
    begin
      perform public.workflow_execute_actions(NEW.organization_id, r.id, r.actions_json, ctx);
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'completed', ctx);
    exception when others then
      insert into public.workflow_runs (organization_id, rule_id, source_module, event, status, detail)
      values (NEW.organization_id, r.id, 'wiki_published', 'wiki_published', 'failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists workflow_wiki_published on public.wiki_pages;
create trigger workflow_wiki_published
  after update on public.wiki_pages
  for each row execute function public.workflow_on_wiki_page_published();

-- Scheduled escalations (premium): store rows; Edge Function / cron polls due_at
create table if not exists public.workflow_scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid references public.workflow_rules (id) on delete cascade,
  run_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists workflow_sched_org_run_idx
  on public.workflow_scheduled_actions (organization_id, run_at)
  where status = 'pending';

alter table public.workflow_scheduled_actions enable row level security;

create policy "workflow_sched_select_org"
  on public.workflow_scheduled_actions for select
  using (organization_id = public.current_org_id());

create policy "workflow_sched_manage"
  on public.workflow_scheduled_actions for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

-- Permission keys
insert into public.role_permissions (role_id, permission_key)
select rd.id, k
from public.role_definitions rd
cross join (values ('workflows.manage'), ('module.view.workflow')) as v(k)
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.workflow'
from public.role_definitions rd
where rd.slug = 'member'
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed inactive compliance templates (AML / IK-f) — admin enables per org
-- ---------------------------------------------------------------------------

create or replace function public.workflow_seed_compliance_templates(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if (select organization_id from public.profiles where id = auth.uid()) is distinct from p_org_id then
    raise exception 'Not allowed';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('workflows.manage')) then
    raise exception 'Not allowed';
  end if;

  insert into public.workflow_rules (
    organization_id, slug, name, description, source_module, trigger_on, is_active, condition_json, actions_json, is_template
  ) values
  (
    p_org_id,
    'aml_52_critical_incident',
    'AML § 5-2 — Alvorlig personskade',
    'Ved kritisk hendelse: oppgave til Arbeidstilsyn (24 t) og varsling.',
    'hse',
    'both',
    false,
    '{"match":"array_any","path":"incidents","where":{"severity":"critical"}}'::jsonb,
    '[
      {"type":"create_task","title":"Melde til Arbeidstilsynet (AML § 5-2)","description":"Bekreft at melding er sendt innen 24 timer.","assignee":"HMS / leder","dueInDays":1,"module":"hse","sourceType":"hse_incident","sourceLabel":"AML § 5-2","ownerRole":"HMS"},
      {"type":"create_task","title":"Varsle verneombud og leder","description":"Umiddelbar varsling ved kritisk hendelse.","assignee":"Verneombud","dueInDays":0,"module":"hse","sourceType":"hse_incident","sourceLabel":"Varsling"}
    ]'::jsonb,
    true
  ),
  (
    p_org_id,
    'sick_leave_followup',
    'Sykefravær — oppfølgingsplan (ca. 4 uker)',
    'Oppretter påminnelse om oppfølgingsplan når sykefravær registreres.',
    'hse',
    'both',
    false,
    '{"match":"array_any","path":"sickLeaveCases","where":{}}'::jsonb,
    '[
      {"type":"create_task","title":"Utkast til oppfølgingsplan (innen 4 uker)","description":"Jfr. AML § 4-6 — plan for tilbakeføring.","assignee":"Nærmeste leder","dueInDays":25,"module":"hse","sourceType":"nav_report","sourceLabel":"Sykefravær"}
    ]'::jsonb,
    true
  ),
  (
    p_org_id,
    'whistle_received',
    'Varsling — bekreftelse mottatt',
    'Oppgave til varslingsmottak ved ny sak (ikke e-post — bruk Edge Function for kryptert varsel i produksjon).',
    'internal_control',
    'both',
    false,
    '{"match":"array_any","path":"whistleCases","where":{"status":"received"}}'::jsonb,
    '[
      {"type":"create_task","title":"Varsling mottatt — bekreftelse og triage","description":"Send bekreftelse til varsler (sikker kanal) og start triage.","assignee":"Varslingsmottak","dueInDays":1,"module":"general","sourceType":"manual","sourceLabel":"Varsling AML 2A"}
    ]'::jsonb,
    true
  ),
  (
    p_org_id,
    'amu_minutes_published',
    'AMU — synliggjøring (AML § 7-2)',
    'Når wiki-side publiseres: påminnelse om å dele referat (Slack/Teams kobles via Edge Function).',
    'wiki_published',
    'update',
    false,
    '{"match":"always"}'::jsonb,
    '[
      {"type":"create_task","title":"Del AMU-referat til alle ansatte","description":"Publiser lenke i felles kanal / intranett (AML § 7-2).","assignee":"AMU-leder","dueInDays":3,"module":"council","sourceType":"council_meeting","sourceLabel":"Synliggjøring"}
    ]'::jsonb,
    true
  )
  on conflict (organization_id, slug) do nothing;
  select count(*)::int into n from public.workflow_rules where organization_id = p_org_id and is_template = true;
  return n;
end;
$$;

grant execute on function public.workflow_seed_compliance_templates(uuid) to authenticated;
