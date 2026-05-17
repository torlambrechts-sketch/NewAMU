-- Tasks: add confidentiality_level + strict-permission gate.
--
-- tilsynsbrev_create_task_for_paragraph (parser substrate, _123900) spawns
-- a public.tasks row from a tilsynsbrev_uploads row whose confidentiality
-- defaults to 'restricted'. Without an equivalent column on tasks the
-- body of a confidential tilsynsbrev (named ansatte, avvik-utdrag) leaks
-- through into a task that is visible to every org member.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 18-6 (sporbarhet av tilsynssaker uten
--   sideeffekt-leakage), GDPR Art. 32 (need-to-know-prinsipp på person-
--   opplysninger ekstrahert fra tilsynsbrev), IK-f § 5 nr. 7 (segregation
--   of duties: HMS-leder/varslingsutvalg trenger tilgang — øvrig org
--   skal ikke se identifiserbare detaljer).
--   Restrisiko deferred: eksisterende oppgaver beholder default 'standard'
--   (RLS-policy uendret for dem). Det er bevisst — vi vil ikke at en
--   forward-migration retroaktivt skjuler oppgaver som er forutsetning
--   for dagens drift. Operatør kan bulk-flagge etter inspeksjon.

set local search_path = public, pg_catalog;

-- ── 1. Column ────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists confidentiality_level text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'tasks_confidentiality_level_chk'
       and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_confidentiality_level_chk
      check (confidentiality_level in ('standard','restricted','confidential'));
  end if;
end$$;

comment on column public.tasks.confidentiality_level is
  'Task-row confidentiality. ''standard'' (default) = org-wide visible; ''restricted'' = creator + tasks.view_confidential; ''confidential'' = same gate, used for sensitive tilsynssaker/personalsaker. Mirrors workflow_runs.confidentiality_level.';

-- ── 2. Partial index — fast RLS filter for restricted/confidential rows ─
-- Most tasks are 'standard'; the partial index keeps RLS predicate
-- evaluation cheap when scanning a busy org.
create index if not exists tasks_org_confidential_idx
  on public.tasks (organization_id, confidentiality_level, created_at desc)
  where confidentiality_level in ('restricted','confidential');

-- ── 3. RLS policies — strict-permission gate ────────────────────────────
-- Mirror the workflow_runs pattern (_120200_workflow_confidentiality_strict):
-- creator can always see their own; everyone else needs the explicit
-- 'tasks.view_confidential' permission (no is_org_admin shortcut).

drop policy if exists "tasks_select_org" on public.tasks;
create policy "tasks_select_org"
  on public.tasks for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
      or public.user_has_permission_strict('tasks.view_confidential')
    )
  );

-- Write policy: split — INSERT only requires org membership (so workflow
-- automation can stamp the row with confidentiality_level=restricted);
-- UPDATE/DELETE gated identically to SELECT so a normal org-member
-- can't redact a restricted row they shouldn't see.
drop policy if exists "tasks_write_org" on public.tasks;

drop policy if exists "tasks_insert_org" on public.tasks;
create policy "tasks_insert_org"
  on public.tasks for insert
  with check (organization_id = public.current_org_id());

drop policy if exists "tasks_update_org" on public.tasks;
create policy "tasks_update_org"
  on public.tasks for update
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
      or public.user_has_permission_strict('tasks.view_confidential')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
      or public.user_has_permission_strict('tasks.view_confidential')
    )
  );

drop policy if exists "tasks_delete_org" on public.tasks;
create policy "tasks_delete_org"
  on public.tasks for delete
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = (select auth.uid())
      or public.user_has_permission_strict('tasks.view_confidential')
    )
  );

-- ── 4. Re-issue tilsynsbrev_create_task_for_paragraph to propagate ──────
-- confidentiality_level from the parent tilsynsbrev_uploads row.

create or replace function public.tilsynsbrev_create_task_for_paragraph(
  p_paragraph_id    uuid,
  p_assignee_user_id uuid default null,
  p_due_at          timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para  record;
  v_org   uuid;
  v_due   timestamptz;
  v_task  uuid;
  v_conf  text;
begin
  select p.*, u.organization_id as org_id, u.source_type,
         u.confidentiality_level as src_conf
    into v_para
    from public.tilsynsbrev_extracted_paragraphs p
    join public.tilsynsbrev_uploads u on u.id = p.upload_id
   where p.id = p_paragraph_id;

  if not found then
    raise exception 'paragraph % not found', p_paragraph_id;
  end if;

  v_org := v_para.org_id;
  if v_org <> public.current_org_id() then
    raise exception 'cross-org access denied';
  end if;
  if not public.user_has_permission('tilsynsbrev.upload') then
    raise exception 'permission denied: tilsynsbrev.upload required';
  end if;

  -- Frist: caller-override > paragraph-deadline > +14d default.
  v_due  := coalesce(p_due_at, v_para.deadline_at, now() + interval '14 days');
  -- Propagate confidentiality from upload row; fall back to 'restricted'
  -- (tilsynssaker default in _123900) if for some reason the source is null.
  v_conf := coalesce(v_para.src_conf, 'restricted');
  if v_conf not in ('standard','restricted','confidential') then
    v_conf := 'restricted';
  end if;

  insert into public.tasks (
    organization_id, source, source_id, title, description,
    assigned_to, due_at, status, priority, created_by,
    confidentiality_level
  ) values (
    v_org,
    'tilsynsbrev',
    v_para.upload_id,
    format('Pålegg: %s', v_para.paragraph_ref),
    coalesce(
      'Tilsynsbrev fra ' || v_para.source_type || E'.\n\n' ||
        coalesce(v_para.excerpt, '(ingen sitat-utdrag)') ||
        E'\n\nReferanse: ' || v_para.paragraph_ref,
      'Pålegg fra tilsynsbrev'
    ),
    p_assignee_user_id,
    v_due,
    'todo',
    case when v_para.severity in ('pålegg','tvangsmulkt') then 'high' else 'normal' end,
    auth.uid(),
    v_conf
  )
  returning id into v_task;

  update public.tilsynsbrev_extracted_paragraphs
     set linked_task_id = v_task,
         status         = case when status = 'open' then 'addressed' else status end
   where id = p_paragraph_id;

  return v_task;
end;
$$;

revoke all on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz) from public;
grant execute on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz)
  to authenticated, service_role;

comment on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz) is
  'Oppretter task fra ekstrahert paragraf. Propagerer confidentiality_level fra tilsynsbrev_uploads slik at restricted/confidential tilsynssaker ikke leakes til hele org. Setter linked_task_id + flytter status til ''addressed''.';
