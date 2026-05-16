-- AML fullgjennomgang — yearly cadence reminder.
--
-- Coverage gap closed:
--   The walkthrough is meant to run yearly (cadence_hint = 'arlig'),
--   but nothing actively pushed orgs to repeat. Without a reminder,
--   the signed gjennomgang silently rots — a typical pålegg-grunn at
--   Arbeidstilsynet inspection.
--
--   This migration adds:
--     1. SQL function `_aml_fullgjennomgang_check_due_orgs()` that
--        iterates every AML-licensed org, finds the latest signed
--        execution per (org, template), and emits a `task_items` row
--        when the last signature is null OR older than 12 months —
--        IF an open reminder task doesn't already exist (idempotent
--        per cron tick).
--     2. pg_cron job — 1st of each month at 08:00 — that calls the
--        function. Same defensive pattern as workflow_approvals:
--        guard with `if exists pg_extension pg_cron`, unschedule any
--        prior version before re-scheduling so re-running this
--        migration is safe.
--     3. workflow_system_rules row purely for transparency — the
--        Admin > System tab lists every active rule, this surfaces
--        the cadence so an admin understands WHERE the reminder
--        task came from.
--
-- Self-audit (Arbeidstilsynet POV):
--   * Pålegg-grunn addressed: AML § 3-1 (systematisk HMS) + IK-f § 5
--     nr. 7 (periodisk gjennomgang). Yearly cadence is the standard
--     interpretation; a tighter cadence (kvartalsvis) is bransje-
--     spesifikt og ligger på den nye plan-spec'en.
--   * Idempotent: open reminder tasks are detected by source_item_key
--     match so the function is safe to call hourly if needed.
--   * No data destruction; new column-less work; only INSERT into
--     task_items via existing path with the new enum value.

set local search_path = public, pg_catalog;

-- ── 1. Per-org reminder function ──────────────────────────────────────────
create or replace function public._aml_fullgjennomgang_check_due_orgs()
returns int  -- number of reminder tasks created on this tick
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_template_id uuid;
  v_latest_signed_at timestamptz;
  v_already_open boolean;
  v_assignee uuid;
  v_assignee_name text;
  v_created int := 0;
begin
  for v_org_id in
    select organization_id
    from public.compliance_packs
    where slug = 'aml-amu'
      and deleted_at is null
      and is_active = true
  loop
    -- Locate this org's walkthrough template (set up by the provision helper).
    select id into v_template_id
    from public.compliance_checklist_templates
    where organization_id = v_org_id
      and slug = 'aml-fullgjennomgang'
      and deleted_at is null
      and is_active = true
    limit 1;

    if v_template_id is null then
      continue; -- org licensed AML but never got the template seeded
    end if;

    -- Latest signed execution, ignoring archived rows.
    select max(signed_at) into v_latest_signed_at
    from public.compliance_checklist_executions
    where organization_id = v_org_id
      and template_id = v_template_id
      and status = 'signed'
      and archived_at is null
      and deleted_at is null;

    -- Due when never signed OR last signature > 12 months old.
    if v_latest_signed_at is not null
       and v_latest_signed_at > now() - interval '12 months' then
      continue;
    end if;

    -- Skip if an open reminder task already exists.
    select exists(
      select 1 from public.task_items
      where organization_id = v_org_id
        and source_category = 'compliance_checklist_item'
        and source_item_key = 'aml_fullgjennomgang_annual_reminder'
        and status not in ('done', 'closed', 'cancelled')
        and deleted_at is null
    ) into v_already_open;

    if v_already_open then
      continue;
    end if;

    -- Try to find an HMS-ansvarlig role holder for default assignee.
    -- org_active_role_holders is a view that joins user_roles +
    -- role_definitions; nullable result is fine — task is then unassigned
    -- and an admin can pick it up from the Tasks module.
    v_assignee := null;
    v_assignee_name := null;
    begin
      select user_id, user_name into v_assignee, v_assignee_name
      from public.org_active_role_holders
      where organization_id = v_org_id
        and (role_slug ilike '%hms%ansvarlig%' or role_slug = 'hms_ansvarlig')
        and (valid_to is null or valid_to >= current_date)
      order by valid_from desc nulls last
      limit 1;
    exception when others then
      v_assignee := null;
      v_assignee_name := null;
    end;

    insert into public.task_items (
      organization_id, pack, title, description,
      priority, status, law_refs,
      source_category, source_type, source_id, source_item_key,
      assignee_user_id, assignee_name, due_date
    ) values (
      v_org_id, 'aml-amu',
      'Årlig AML-fullgjennomgang forfaller',
      case
        when v_latest_signed_at is null
        then 'Virksomheten har ingen signert AML-fullgjennomgang ennå. Gjennomfør en ny gjennomgang for å oppfylle systematisk HMS-arbeid etter AML § 3-1.'
        else format(
          'Siste signerte AML-fullgjennomgang var %s — over 12 måneder siden. Gjennomfør årlig review for å lukke loopen på AML § 3-1 + IK-f § 5 nr. 7.',
          to_char(v_latest_signed_at, 'DD. Mon YYYY')
        )
      end,
      'high', 'todo',
      array['AML § 3-1', 'IK-f § 5 nr. 7']::text[],
      'compliance_checklist_item', 'compliance_checklist_item',
      v_template_id,
      'aml_fullgjennomgang_annual_reminder',
      v_assignee, v_assignee_name,
      (current_date + interval '30 days')::date
    );
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

comment on function public._aml_fullgjennomgang_check_due_orgs() is
  $c$Iterates AML-licensed orgs and creates an open reminder task
  per org whose latest signed aml-fullgjennomgang is null or > 12
  months old. Idempotent per cron tick via source_item_key
  ('aml_fullgjennomgang_annual_reminder') dedup. Called by pg_cron
  monthly; can also be invoked manually for testing.$c$;

grant execute on function public._aml_fullgjennomgang_check_due_orgs() to service_role;

-- ── 2. pg_cron schedule — 1st of each month at 08:00 ──────────────────────
-- Idempotent: unschedule any prior version first.
do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'aml_fullgjennomgang_yearly_reminder')
    loop perform cron.unschedule(r.jobid); end loop;
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'aml_fullgjennomgang_yearly_reminder',
      '0 8 1 * *',
      $cmd$select public._aml_fullgjennomgang_check_due_orgs();$cmd$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

-- ── 3. workflow_system_rules row — visibility in Admin > System tab ──────
-- This row exists for transparency; the actual work is done by the
-- pg_cron + function above. The action is `log_only` because the rule
-- machinery would re-do the same work the function does, and we want
-- a single source of truth.
insert into public.workflow_system_rules (
  slug, framework, category, category_order, subcategory,
  description, rationale, source_module, trigger_type, trigger_event_name,
  schedule_cron, trigger_on, condition_json, actions_json, law_refs,
  frameworks, pdca_phase, enabled, notes
) values (
  'aml-3-1-fullgjennomgang-yearly',
  'AML',
  'Kap. 3 — Virkemidler i arbeidsmiljøarbeidet',
  3,
  'AML § 3-1 — Årlig fullgjennomgang av AML',
  'Månedlig sjekk: orgs hvis siste signerte AML-fullgjennomgang er > 12 mnd. (eller mangler) får en høyprioritets oppgave til HMS-ansvarlig.',
  'AML § 3-1 + IK-forskriften § 5 nr. 7 krever periodisk gjennomgang av HMS-rutinene. Uten en aktiv påminnelse risikerer org å «glemme» den årlige reviewen og dermed bryte internkontrollkravet.',
  'compliance_checklist',
  'schedule',
  null,
  '0 8 1 * *',
  'both',
  '{"match":"always"}'::jsonb,
  '[{"type":"log_only","note":"Kjøres ut av båndet av _aml_fullgjennomgang_check_due_orgs() via pg_cron."}]'::jsonb,
  array['AML § 3-1', 'IK-f § 5 nr. 7']::text[],
  array['aml-amu']::text[],
  'check',
  true,
  'Faktisk arbeid skjer i _aml_fullgjennomgang_check_due_orgs(). System-tab viser regelen for transparens.'
)
on conflict (slug) do update set
  description = excluded.description,
  rationale = excluded.rationale,
  schedule_cron = excluded.schedule_cron,
  actions_json = excluded.actions_json,
  law_refs = excluded.law_refs,
  notes = excluded.notes,
  updated_at = now();
