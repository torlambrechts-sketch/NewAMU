-- Fase 5 sprint 2 — Compliance notifications + auto-enroll + cron-log
--
-- Coverage:
--   C3) compliance_notifications-tabell + scan-funksjon for å detektere
--       nye/forfalt/kritiske krav og opprette varsler
--   C5) Auto-enroll i learning_progress når funksjonell rolle tildeles
--   D1) Utvider reconcile_role_requirements til å logge til cron_run_log
--
-- Self-audit:
--   * Notifikasjoner per-bruker — RLS sikrer at hver bruker bare ser egne
--   * Severity-skala matcher org_role_requirement_instances
--   * Idempotent — samme situasjon → samme notification_key, ikke dobbelt
--   * Auto-enroll oppretter learning_progress for course-krav slik at de
--     vises i brukerens «Mine kurs» — uten å fjerne progress hvis tildeling
--     fjernes (historikk bevares)

set local search_path = public, pg_catalog;

-- ── 1. compliance_notifications ──────────────────────────────────────────

create table if not exists public.compliance_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  -- Kategorisering
  category text not null check (category in (
    'requirement_assigned',     -- nytt krav opprettet
    'requirement_due_soon',     -- forfaller < 14 dager
    'requirement_overdue',      -- forfalt
    'breach_active',            -- aktivt GDPR-brudd som krever oppmerksomhet
    'breach_overdue',           -- 72-timers-fristen brutt
    'subject_request_due_soon', -- individrett-forespørsel < 7 dager til frist
    'subject_request_overdue',  -- 30-dagers-fristen brutt
    'general'                   -- annet
  )),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  title text not null,
  body text,
  -- Lenke for å hoppe direkte til ressursen
  link_url text,
  -- Stabil nøkkel for å unngå duplikater (eks: 'orri:<instance_id>:due_soon')
  notification_key text not null,
  -- Lifecycle
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  email_sent_at timestamptz,
  unique (recipient_user_id, notification_key)
);

create index if not exists cn_recipient_unread_idx
  on public.compliance_notifications (recipient_user_id, created_at desc)
  where read_at is null and dismissed_at is null;

create index if not exists cn_org_severity_idx
  on public.compliance_notifications (organization_id, severity, created_at desc);

comment on table public.compliance_notifications is
  'In-app + e-post-varsler om compliance-krav. notification_key sikrer idempotens — samme situasjon varsler bare én gang.';

alter table public.compliance_notifications enable row level security;

drop policy if exists cn_select_self on public.compliance_notifications;
create policy cn_select_self on public.compliance_notifications
  for select using (recipient_user_id = auth.uid());

drop policy if exists cn_update_self on public.compliance_notifications;
create policy cn_update_self on public.compliance_notifications
  for update using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- Insert tillates av service_role (edge function); ingen client-insert

-- ── 2. Scan-funksjon — detekterer situasjoner og oppretter varsler ───────

create or replace function public.scan_and_create_compliance_notifications(p_org_id uuid default null)
returns table(created_count int, org_id uuid) as $$
declare
  v_count int := 0;
  v_org_id uuid;
  v_inst record;
  v_breach record;
  v_subject record;
begin
  -- (a) Nye krav-instanser opprettet siste 24 t
  for v_inst in
    select i.id, i.organization_id, i.user_id, i.role_slug, i.resource_label,
           i.severity, i.due_at, i.requirement_kind
    from public.org_role_requirement_instances i
    where (p_org_id is null or i.organization_id = p_org_id)
      and i.created_at > now() - interval '24 hours'
      and i.status in ('pending','in_progress')
  loop
    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key
    ) values (
      v_inst.organization_id, v_inst.user_id, 'requirement_assigned',
      coalesce(v_inst.severity, 'medium'),
      'Nytt compliance-krav tildelt',
      format('Du har fått nytt krav: %s (%s) som %s', v_inst.resource_label, v_inst.requirement_kind, v_inst.role_slug),
      '/overview/compliance-min',
      'orri:' || v_inst.id::text || ':assigned'
    )
    on conflict (recipient_user_id, notification_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- (b) Krav som forfaller < 14 dager
  for v_inst in
    select i.id, i.organization_id, i.user_id, i.role_slug, i.resource_label,
           i.severity, i.due_at
    from public.org_role_requirement_instances i
    where (p_org_id is null or i.organization_id = p_org_id)
      and i.status in ('pending','in_progress')
      and i.due_at is not null
      and i.due_at > now()
      and i.due_at < now() + interval '14 days'
  loop
    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key
    ) values (
      v_inst.organization_id, v_inst.user_id, 'requirement_due_soon',
      'high',
      'Compliance-krav forfaller snart',
      format('%s forfaller %s', v_inst.resource_label, to_char(v_inst.due_at, 'DD.MM.YYYY')),
      '/overview/compliance-min',
      'orri:' || v_inst.id::text || ':due_soon'
    )
    on conflict (recipient_user_id, notification_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- (c) Forfalt krav
  for v_inst in
    select i.id, i.organization_id, i.user_id, i.role_slug, i.resource_label,
           i.severity, i.due_at
    from public.org_role_requirement_instances i
    where (p_org_id is null or i.organization_id = p_org_id)
      and i.status = 'overdue'
  loop
    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key
    ) values (
      v_inst.organization_id, v_inst.user_id, 'requirement_overdue',
      'critical',
      'FORFALT compliance-krav',
      format('%s er forfalt — handle nå', v_inst.resource_label),
      '/overview/compliance-min',
      'orri:' || v_inst.id::text || ':overdue:' || to_char(now(), 'YYYYMMDD')
    )
    on conflict (recipient_user_id, notification_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- (d) GDPR-brudd over 72t — varsle alle med DPO-rolle og org-admin
  for v_breach in
    select b.id, b.organization_id, b.title
    from public.gdpr_breach_incidents b
    where (p_org_id is null or b.organization_id = p_org_id)
      and b.status in ('detected','investigating')
      and b.deadline_at < now()
  loop
    -- DPO + admin på org
    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key
    )
    select v_breach.organization_id, p.id, 'breach_overdue', 'critical',
      'GDPR-brudd over 72t — Art. 33 brutt',
      format('Brudd "%s" har overskredet 72-timers-fristen. Datatilsynet må varsles UMIDDELBART.', v_breach.title),
      '/admin?tab=gdpr_breach',
      'breach:' || v_breach.id::text || ':overdue'
    from public.profiles p
    where p.organization_id = v_breach.organization_id
      and (p.is_org_admin = true or exists (
        select 1 from public.org_functional_role_assignments a
        where a.organization_id = v_breach.organization_id
          and a.user_id = p.id
          and a.role_slug = 'dpo'
          and (a.valid_to is null or a.valid_to >= current_date)
      ))
    on conflict (recipient_user_id, notification_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- (e) GDPR subject requests over 30 dager
  for v_subject in
    select s.id, s.organization_id, s.subject_name, s.request_type
    from public.gdpr_subject_requests s
    where (p_org_id is null or s.organization_id = p_org_id)
      and s.status in ('received','identity_check','in_progress')
      and s.deadline_at < now()
  loop
    insert into public.compliance_notifications (
      organization_id, recipient_user_id, category, severity,
      title, body, link_url, notification_key
    )
    select v_subject.organization_id, p.id, 'subject_request_overdue', 'critical',
      'Individrett-forespørsel over frist',
      format('Forespørsel fra %s (%s) har overskredet 30-dagers-fristen.', v_subject.subject_name, v_subject.request_type),
      '/admin?tab=gdpr_subject_requests',
      'gsr:' || v_subject.id::text || ':overdue'
    from public.profiles p
    where p.organization_id = v_subject.organization_id
      and (p.is_org_admin = true or exists (
        select 1 from public.org_functional_role_assignments a
        where a.organization_id = v_subject.organization_id
          and a.user_id = p.id
          and a.role_slug = 'dpo'
          and (a.valid_to is null or a.valid_to >= current_date)
      ))
    on conflict (recipient_user_id, notification_key) do nothing;
    v_count := v_count + 1;
  end loop;

  return query select v_count, p_org_id;
end;
$$ language plpgsql security definer;

comment on function public.scan_and_create_compliance_notifications is
  'Skanner krav-instanser, brudd og individrett-forespørsler og oppretter varsler. Idempotent via unique notification_key.';

-- ── 3. Auto-enroll i learning_progress ved rolle-tildeling ────────────────
--
-- C5: når et kurs-krav materialiseres, opprett tilhørende learning_progress-
-- rad slik at kurset vises i brukerens «Mine kurs». Eksisterende
-- materialize_requirements_for_assignment utvides.

create or replace function public.materialize_requirements_for_assignment(p_assignment_id uuid)
returns int as $$
declare
  v_count int := 0;
  v_assignment record;
  v_req record;
  v_due timestamptz;
  v_course_uuid uuid;
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

    -- C5: Auto-enroll i learning_progress for course-krav
    if v_req.requirement_kind = 'course' then
      -- resource_id er course-id; sjekk om kurset eksisterer i org
      -- (system_course bruker fork-mekanismen; vi enroller bare i org-kurs)
      begin
        v_course_uuid := v_req.resource_id::uuid;
        insert into public.learning_course_progress (user_id, course_id, started_at)
        select v_assignment.user_id, v_req.resource_id, null
        where exists (
          select 1 from public.learning_courses
          where id = v_req.resource_id
            and organization_id = v_assignment.organization_id
        )
        on conflict (user_id, course_id) do nothing;
      exception when others then
        -- Kurs-id er ikke UUID (kan være system_course-id som tekst);
        -- ignore — system-kurs blir tilgjengelig via fork-mekanismen.
        null;
      end;
    end if;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;

-- ── 4. Cron-logging wrapper for reconcile ─────────────────────────────────

create or replace function public.reconcile_with_logging(p_org_id uuid default null)
returns table(materialized int, completed int, overdued int, superseded int, notifications_created int) as $$
declare
  v_start timestamptz := clock_timestamp();
  v_result record;
  v_notif record;
  v_total_notif int := 0;
  v_org_id uuid;
begin
  -- Kjør reconcile
  select * into v_result from public.reconcile_role_requirements(p_org_id);

  -- Kjør notification-scan (samler per org)
  if p_org_id is not null then
    select created_count into v_total_notif
    from public.scan_and_create_compliance_notifications(p_org_id);
  else
    for v_org_id in select id from public.organizations loop
      select created_count into v_notif
      from public.scan_and_create_compliance_notifications(v_org_id);
      v_total_notif := v_total_notif + coalesce(v_notif.created_count, 0);
    end loop;
  end if;

  -- Logg til cron_run_log
  insert into public.cron_run_log (function_name, organization_id, status, duration_ms, result)
  values (
    'reconcile_with_logging',
    p_org_id,
    'success',
    extract(milliseconds from clock_timestamp() - v_start)::int,
    jsonb_build_object(
      'materialized', v_result.materialized,
      'completed', v_result.completed,
      'overdued', v_result.overdued,
      'superseded', v_result.superseded,
      'notifications_created', v_total_notif
    )
  );

  return query select v_result.materialized, v_result.completed, v_result.overdued, v_result.superseded, v_total_notif;
exception when others then
  insert into public.cron_run_log (function_name, organization_id, status, duration_ms, error_message)
  values (
    'reconcile_with_logging',
    p_org_id,
    'error',
    extract(milliseconds from clock_timestamp() - v_start)::int,
    sqlerrm
  );
  raise;
end;
$$ language plpgsql security definer;

comment on function public.reconcile_with_logging is
  'Wrapper rundt reconcile_role_requirements + scan_and_create_compliance_notifications med audit-logging til cron_run_log. Hovedinngang for nattlig cron.';

-- ── 5. Backfill — opprett varsler for eksisterende situasjoner ───────────

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform public.scan_and_create_compliance_notifications(v_org_id);
  end loop;
end $$;
