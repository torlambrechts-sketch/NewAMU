-- Role compliance — fase 1 + 2 (specs/role-compliance-architecture.md)
--
-- Coverage:
--   FASE 1:
--     - Skjema-utvidelser: required_for_roles[] på 5 modul-tabeller,
--       pluss splitt av wiki_pages-acknowledgement i ack vs sign
--     - View role_compliance_requirements_view (UNION ALL fra moduler)
--     - Tabell org_role_requirement_instances (materialiserte instanser)
--     - Funksjon materialize_requirements_for_assignment + trigger
--     - Initial seeding av rolle-mappinger basert på krav-inventory
--   FASE 2:
--     - Funksjon reconcile_role_requirements med kompletterings-
--       deteksjon (joiner learning_progress, wiki_compliance_receipts,
--       bankid_signatures)
--     - Indekser for ytelse
--     - RLS-policies
--
-- Self-audit:
--   * Modul-tabeller får default '{}'::text[] — eksisterende data uberørt
--   * Trigger er insert-only; cleanup ved valid_to settes håndteres av
--     reconcile (markerer som 'waived' med begrunnelse)
--   * Reconcile er idempotent — kan kjøres flere ganger uten skade
--   * Backfill kjører for alle aktive tildelinger

set local search_path = public, pg_catalog;

-- ── 1. Skjema-utvidelser på modul-tabeller ───────────────────────────────

-- Læring
alter table public.learning_courses
  add column if not exists required_for_roles text[] not null default '{}';
alter table public.learning_system_courses
  add column if not exists required_for_roles text[] not null default '{}';

comment on column public.learning_courses.required_for_roles is
  'Funksjonelle rolle-slugs som SKAL ha bestått kurset. Brukes av role_compliance_requirements_view + auto-tildelings-trigger.';

-- Dokumenter — split i acknowledgement vs signatur
alter table public.wiki_pages
  add column if not exists required_ack_roles text[] not null default '{}',
  add column if not exists required_signature_roles text[] not null default '{}';

comment on column public.wiki_pages.required_ack_roles is
  'Rolle-slugs som SKAL kvittere på denne siden (kvitterings­spor i wiki_compliance_receipts).';
comment on column public.wiki_pages.required_signature_roles is
  'Rolle-slugs som SKAL signere denne siden (signatur-spor i bankid_signatures).';

-- Survey
alter table public.survey_template_catalog
  add column if not exists required_for_roles text[] not null default '{}';

-- Møter
alter table public.meeting_system_templates
  add column if not exists required_attendee_roles text[] not null default '{}';

-- ROS
alter table public.ros_templates
  add column if not exists required_signature_roles text[] not null default '{}';

-- ── 2. View: role_compliance_requirements_view ───────────────────────────

create or replace view public.role_compliance_requirements_view as
-- Læring — system courses (deler til alle org via fork-mekanismen)
select
  o.id as organization_id,
  unnest(sc.required_for_roles) as role_slug,
  'course'::text as requirement_kind,
  sc.id::text as resource_id,
  coalesce(scl.title, sc.slug) as resource_label,
  array_to_string(sc.law_refs::text[], ', ') as hjemmel,
  null::int as recurrence_months,
  90 as due_after_assignment_days,
  'high' as severity
from public.learning_system_courses sc
cross join public.organizations o
left join public.learning_system_course_locales scl
  on scl.system_course_id = sc.id and scl.locale = 'nb'
where array_length(sc.required_for_roles, 1) > 0

union all

-- Læring — org-spesifikke kurs
select
  c.organization_id, unnest(c.required_for_roles),
  'course', c.id::text, c.title,
  array_to_string(coalesce(c.law_refs, '[]'::jsonb)::text[]::text[], ', '),
  c.recertification_months, 90, 'high'
from public.learning_courses c
where array_length(c.required_for_roles, 1) > 0

union all

-- Dokumenter — acknowledgement
select
  p.organization_id, unnest(p.required_ack_roles),
  'document_ack', p.id::text, p.title,
  null::text,
  case
    when p.revision_interval_months is not null and p.revision_interval_months < 999
      then p.revision_interval_months
    else null
  end,
  30, 'medium'
from public.wiki_pages p
where p.status = 'published'
  and array_length(p.required_ack_roles, 1) > 0

union all

-- Dokumenter — signatur
select
  p.organization_id, unnest(p.required_signature_roles),
  'document_sign', p.id::text, p.title,
  null::text, null::int, null::int, 'high'
from public.wiki_pages p
where p.status = 'published'
  and array_length(p.required_signature_roles, 1) > 0

union all

-- Survey
select
  o.id as organization_id,
  unnest(t.required_for_roles),
  'survey_response',
  t.id::text,
  t.name,
  t.law_ref,
  null::int, 60, 'medium'
from public.survey_template_catalog t
cross join public.organizations o
where t.is_system = true
  and array_length(t.required_for_roles, 1) > 0;

comment on view public.role_compliance_requirements_view is
  'Aggregert krav per (org, rolle, kilde). Brukes av materialiserings-funksjon + compliance-dashboard.';

-- ── 3. Tabell: org_role_requirement_instances ────────────────────────────

create table if not exists public.org_role_requirement_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.org_functional_role_assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_slug text not null,
  requirement_kind text not null check (requirement_kind in (
    'course','document_ack','document_sign','meeting_invite',
    'survey_response','checklist_item','task_owner','ros_signature'
  )),
  resource_id text not null,
  resource_label text not null,
  hjemmel text,
  status text not null default 'pending' check (status in (
    'pending','in_progress','completed','overdue','waived','superseded'
  )),
  severity text default 'medium' check (severity in ('low','medium','high','critical')),
  due_at timestamptz,
  completed_at timestamptz,
  evidence_url text,
  last_evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  notes text,
  unique (assignment_id, requirement_kind, resource_id)
);

create index if not exists orri_org_status_idx on public.org_role_requirement_instances (organization_id, status);
create index if not exists orri_user_status_idx on public.org_role_requirement_instances (user_id, status, due_at);
create index if not exists orri_role_status_idx on public.org_role_requirement_instances (organization_id, role_slug, status);
create index if not exists orri_kind_idx on public.org_role_requirement_instances (organization_id, requirement_kind);

comment on table public.org_role_requirement_instances is
  'Materialiserte krav-instanser. Én rad per (rolle-tildeling × krav). Created av trigger; oppdatert av reconcile.';

alter table public.org_role_requirement_instances enable row level security;

drop policy if exists orri_select_self_or_admin on public.org_role_requirement_instances;
create policy orri_select_self_or_admin on public.org_role_requirement_instances
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = org_role_requirement_instances.organization_id
        and p.is_org_admin = true
    )
  );

drop policy if exists orri_modify_admin on public.org_role_requirement_instances;
create policy orri_modify_admin on public.org_role_requirement_instances
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = org_role_requirement_instances.organization_id
        and p.is_org_admin = true
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = org_role_requirement_instances.organization_id
        and p.is_org_admin = true
    )
  );

-- ── 4. Materialiserings-funksjon + trigger ───────────────────────────────

create or replace function public.materialize_requirements_for_assignment(p_assignment_id uuid)
returns int as $$
declare
  v_count int := 0;
  v_assignment record;
  v_req record;
  v_due timestamptz;
begin
  select * into v_assignment from public.org_functional_role_assignments where id = p_assignment_id;
  if v_assignment is null then return 0; end if;
  if v_assignment.valid_to is not null and v_assignment.valid_to < current_date then return 0; end if;

  for v_req in
    select * from public.role_compliance_requirements_view
    where organization_id = v_assignment.organization_id
      and role_slug = v_assignment.role_slug
  loop
    v_due := case
      when v_req.due_after_assignment_days is not null
        then (v_assignment.valid_from + (v_req.due_after_assignment_days || ' days')::interval)::timestamptz
      else null
    end;

    insert into public.org_role_requirement_instances (
      organization_id, assignment_id, user_id, role_slug,
      requirement_kind, resource_id, resource_label, hjemmel,
      due_at, severity, status
    ) values (
      v_assignment.organization_id, v_assignment.id, v_assignment.user_id, v_assignment.role_slug,
      v_req.requirement_kind, v_req.resource_id, v_req.resource_label, v_req.hjemmel,
      v_due, coalesce(v_req.severity, 'medium'), 'pending'
    )
    on conflict (assignment_id, requirement_kind, resource_id) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;

create or replace function public.trg_materialize_on_assignment()
returns trigger as $$
begin
  perform public.materialize_requirements_for_assignment(new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists functional_role_assignment_materialize on public.org_functional_role_assignments;
create trigger functional_role_assignment_materialize
  after insert on public.org_functional_role_assignments
  for each row execute function public.trg_materialize_on_assignment();

-- ── 5. Reconcile-funksjon med kompletterings-deteksjon (fase 2) ──────────

create or replace function public.reconcile_role_requirements(p_org_id uuid default null)
returns table(materialized int, completed int, overdued int, superseded int) as $$
declare
  v_materialized int := 0;
  v_completed int := 0;
  v_overdued int := 0;
  v_superseded int := 0;
  v_assignment record;
begin
  -- (a) Materialiser manglende krav for alle aktive tildelinger
  for v_assignment in
    select id from public.org_functional_role_assignments
    where (p_org_id is null or organization_id = p_org_id)
      and (valid_to is null or valid_to >= current_date)
  loop
    v_materialized := v_materialized + public.materialize_requirements_for_assignment(v_assignment.id);
  end loop;

  -- (b) Marker fullført — kurs (join learning_progress)
  with updated as (
    update public.org_role_requirement_instances i
    set status = 'completed',
        completed_at = lp.completed_at,
        last_evaluated_at = now()
    from public.learning_progress lp
    where i.requirement_kind = 'course'
      and i.status in ('pending','in_progress','overdue')
      and lp.user_id = i.user_id
      and lp.course_id = i.resource_id
      and lp.completed_at is not null
      and (p_org_id is null or i.organization_id = p_org_id)
    returning 1
  )
  select count(*) into v_completed from updated;

  -- (c) Marker fullført — dokument ack (join wiki_compliance_receipts)
  with updated as (
    update public.org_role_requirement_instances i
    set status = 'completed',
        completed_at = r.acknowledged_at,
        last_evaluated_at = now()
    from public.wiki_compliance_receipts r
    where i.requirement_kind = 'document_ack'
      and i.status in ('pending','in_progress','overdue')
      and r.user_id = i.user_id
      and r.page_id = i.resource_id
      and (p_org_id is null or i.organization_id = p_org_id)
    returning 1
  )
  select v_completed + count(*) into v_completed from updated;

  -- (d) Marker fullført — dokument sign (join bankid_signatures)
  with updated as (
    update public.org_role_requirement_instances i
    set status = 'completed',
        completed_at = bs.signed_at,
        evidence_url = bs.id::text,
        last_evaluated_at = now()
    from public.bankid_signatures bs
    where i.requirement_kind = 'document_sign'
      and i.status in ('pending','in_progress','overdue')
      and bs.signer_user_id = i.user_id
      and bs.page_id = i.resource_id
      and bs.status = 'completed'
      and (p_org_id is null or i.organization_id = p_org_id)
    returning 1
  )
  select v_completed + count(*) into v_completed from updated;

  -- (e) Marker overdue
  with updated as (
    update public.org_role_requirement_instances
    set status = 'overdue', last_evaluated_at = now()
    where status in ('pending','in_progress')
      and due_at is not null and due_at < now()
      and (p_org_id is null or organization_id = p_org_id)
    returning 1
  )
  select count(*) into v_overdued from updated;

  -- (f) Marker superseded — krav som ikke lenger finnes i kilde-view
  with updated as (
    update public.org_role_requirement_instances i
    set status = 'superseded', last_evaluated_at = now()
    where status in ('pending','in_progress','overdue')
      and not exists (
        select 1 from public.role_compliance_requirements_view v
        where v.organization_id = i.organization_id
          and v.role_slug = i.role_slug
          and v.requirement_kind = i.requirement_kind
          and v.resource_id = i.resource_id
      )
      and (p_org_id is null or organization_id = p_org_id)
    returning 1
  )
  select count(*) into v_superseded from updated;

  -- (g) Marker waived — krav for tildelinger som er utløpt
  update public.org_role_requirement_instances i
  set status = 'waived',
      notes = coalesce(notes || ' | ', '') || 'Tildeling utløpt ' || a.valid_to,
      last_evaluated_at = now()
  from public.org_functional_role_assignments a
  where i.assignment_id = a.id
    and a.valid_to is not null and a.valid_to < current_date
    and i.status in ('pending','in_progress','overdue')
    and (p_org_id is null or i.organization_id = p_org_id);

  return query select v_materialized, v_completed, v_overdued, v_superseded;
end;
$$ language plpgsql security definer;

-- ── 6. Initial seeding av rolle-mappinger ────────────────────────────────
-- Basert på specs/aml-requirements-inventory.md

-- Kurs → roller
update public.learning_system_courses set required_for_roles =
  array['daglig_leder','linje_leder'] where id = 'c-40-timers-hms';
update public.learning_system_courses set required_for_roles =
  array['verneombud','hoved_verneombud'] where id = 'c-verneombud-40t';
update public.learning_system_courses set required_for_roles =
  array['amu_leder','amu_medlem','amu_sekretar'] where id = 'c-amu-grunnopplaering';
update public.learning_system_courses set required_for_roles =
  array['daglig_leder','linje_leder','hr_leder','hms_koordinator','verneombud','hoved_verneombud',
        'amu_leder','amu_medlem','amu_sekretar','tillitsvalgt','bht_kontakt','brannvern_leder',
        'forstehjelp_ansvarlig','dpo','varslings_mottak']
  where id = 'c-aml-arbeidstaker';
update public.learning_system_courses set required_for_roles =
  array['linje_leder','hr_leder'] where id = 'c-aml-ledere';
update public.learning_system_courses set required_for_roles =
  array['linje_leder','hr_leder','daglig_leder'] where id = 'c-aml-13-likestilling';
update public.learning_system_courses set required_for_roles =
  array['linje_leder','hr_leder','hoved_verneombud','amu_leder'] where id = 'c-aml-endring';

-- ── 7. Backfill — materialiser krav for eksisterende tildelinger ─────────

do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.org_functional_role_assignments
    where (valid_to is null or valid_to >= current_date)
  loop
    perform public.materialize_requirements_for_assignment(v_id);
  end loop;
end $$;

-- Kjør initiell reconcile for å detektere kompletterte instanser
select public.reconcile_role_requirements(null);

-- ── 8. View: kompakt status per (org, rolle) for dashboard-bruk ──────────

create or replace view public.role_compliance_status_view as
select
  i.organization_id,
  i.role_slug,
  count(*) as total_requirements,
  count(*) filter (where i.status = 'completed') as completed,
  count(*) filter (where i.status = 'pending') as pending,
  count(*) filter (where i.status = 'in_progress') as in_progress,
  count(*) filter (where i.status = 'overdue') as overdue,
  count(*) filter (where i.status = 'waived') as waived,
  count(distinct i.user_id) as unique_users,
  array_agg(distinct i.requirement_kind) as kinds_present
from public.org_role_requirement_instances i
group by i.organization_id, i.role_slug;

comment on view public.role_compliance_status_view is
  'Aggregert status per rolle for dashboard-KPI-bruk.';
