-- HR compliance extensions: richer discussion fields, signature RPCs, consultation timeline, org user listing.

-- ---------------------------------------------------------------------------
-- Extend hr_discussion_meetings
-- ---------------------------------------------------------------------------

alter table public.hr_discussion_meetings
  add column if not exists meeting_at timestamptz,
  add column if not exists topics_discussed text not null default '',
  add column if not exists legal_acknowledgements jsonb not null default '{}'::jsonb,
  add column if not exists employee_display_name text,
  add column if not exists manager_display_name text,
  add column if not exists union_display_name text;

comment on column public.hr_discussion_meetings.legal_acknowledgements is 'JSON flags e.g. {"no_termination_conclusion": true, "employee_copy_received": true}';

-- ---------------------------------------------------------------------------
-- Consultation timeline + metadata
-- ---------------------------------------------------------------------------

alter table public.hr_consultation_cases
  add column if not exists information_provided_at timestamptz,
  add column if not exists decision_summary text not null default '',
  add column if not exists aml_chapter_8_applies boolean not null default true;

create table if not exists public.hr_consultation_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.hr_consultation_cases (id) on delete cascade,
  event_type text not null check (event_type in (
    'case_created',
    'information_provided',
    'union_comment',
    'management_response',
    'participant_invited',
    'case_closed'
  )),
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hr_consult_events_case_idx on public.hr_consultation_events (case_id, created_at);

alter table public.hr_consultation_events enable row level security;

create policy "hr_consultation_events_select"
  on public.hr_consultation_events for select
  using (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_events.case_id
        and c.organization_id = public.current_org_id()
        and (
          public.hr_can_manage_consultation()
          or exists (select 1 from public.hr_consultation_participants p where p.case_id = c.id and p.user_id = auth.uid())
        )
    )
  );

create policy "hr_consultation_events_insert"
  on public.hr_consultation_events for insert
  with check (
    exists (
      select 1 from public.hr_consultation_cases c
      where c.id = hr_consultation_events.case_id
        and c.organization_id = public.current_org_id()
        and (
          public.hr_can_manage_consultation()
          or exists (select 1 from public.hr_consultation_participants p where p.case_id = c.id and p.user_id = auth.uid())
        )
    )
    and created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- List org users (for HR pickers — same org only)
-- ---------------------------------------------------------------------------

create or replace function public.hr_list_org_users()
returns table (user_id uuid, display_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email
  from public.profiles p
  where p.organization_id = public.current_org_id()
  order by p.display_name;
$$;

grant execute on function public.hr_list_org_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Discussion: typed signatures (name on record)
-- ---------------------------------------------------------------------------

create or replace function public.hr_discussion_sign(
  p_meeting_id uuid,
  p_role text,
  p_signer_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.hr_discussion_meetings%rowtype;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_signer_name is null or trim(p_signer_name) = '' then
    raise exception 'Signer name required';
  end if;
  select * into r from public.hr_discussion_meetings where id = p_meeting_id for update;
  if r.id is null then
    raise exception 'Not found';
  end if;
  if r.organization_id <> public.current_org_id() then
    raise exception 'Not allowed';
  end if;
  if r.status = 'locked' then
    raise exception 'Already locked';
  end if;

  if p_role = 'manager' then
    if r.manager_user_id <> auth.uid() and not public.hr_can_manage_discussion() then
      raise exception 'Not manager';
    end if;
    update public.hr_discussion_meetings
    set manager_signed_at = now_ts, manager_display_name = trim(p_signer_name), status = 'pending_signatures'
    where id = p_meeting_id;
  elsif p_role = 'employee' then
    if r.employee_user_id <> auth.uid() then
      raise exception 'Not employee';
    end if;
    update public.hr_discussion_meetings
    set employee_signed_at = now_ts, employee_display_name = trim(p_signer_name), status = 'pending_signatures'
    where id = p_meeting_id;
  elsif p_role = 'union' then
    if not r.union_rep_invited or r.union_rep_user_id is distinct from auth.uid() then
      raise exception 'Not union rep';
    end if;
    update public.hr_discussion_meetings
    set union_rep_signed_at = now_ts, union_display_name = trim(p_signer_name), status = 'pending_signatures'
    where id = p_meeting_id;
  else
    raise exception 'Invalid role';
  end if;
end;
$$;

grant execute on function public.hr_discussion_sign(uuid, text, text) to authenticated;

-- Lock: if union invited, require union signature
create or replace function public.hr_discussion_apply_lock(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.hr_discussion_meetings%rowtype;
  payload text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into r from public.hr_discussion_meetings where id = p_meeting_id for update;
  if r.id is null then
    raise exception 'Not found';
  end if;
  if r.organization_id <> public.current_org_id() then
    raise exception 'Not allowed';
  end if;
  if r.status = 'locked' then
    return;
  end if;
  if r.manager_signed_at is null or r.employee_signed_at is null then
    raise exception 'Manager and employee signatures required';
  end if;
  if r.union_rep_invited and r.union_rep_signed_at is null then
    raise exception 'Union representative signature required when invited';
  end if;
  payload := concat_ws('|',
    r.id::text,
    r.organization_id::text,
    coalesce(r.summary_text, ''),
    coalesce(r.topics_discussed, ''),
    r.manager_signed_at::text,
    r.employee_signed_at::text,
    coalesce(r.union_rep_signed_at::text, ''),
    coalesce(r.meeting_at::text, '')
  );
  update public.hr_discussion_meetings
  set
    status = 'locked',
    content_sha256 = encode(digest(convert_to(payload, 'UTF8'), 'sha256'), 'hex'),
    locked_at = now()
  where id = p_meeting_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consultation: record information + export helper (JSON protocol)
-- ---------------------------------------------------------------------------

create or replace function public.hr_consultation_record_information(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.hr_can_manage_consultation() then
    raise exception 'Not allowed';
  end if;
  update public.hr_consultation_cases
  set information_provided_at = coalesce(information_provided_at, now())
  where id = p_case_id and organization_id = public.current_org_id();

  insert into public.hr_consultation_events (case_id, event_type, body, created_by)
  values (p_case_id, 'information_provided', 'Informasjon til tillitsvalgte registrert.', auth.uid());
end;
$$;

grant execute on function public.hr_consultation_record_information(uuid) to authenticated;

create or replace function public.hr_consultation_protocol_json(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  parts jsonb;
  evs jsonb;
  coms jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into c from public.hr_consultation_cases where id = p_case_id;
  if c.id is null or c.organization_id <> public.current_org_id() then
    raise exception 'Not found';
  end if;
  if not (
    public.hr_can_manage_consultation()
    or exists (select 1 from public.hr_consultation_participants p where p.case_id = p_case_id and p.user_id = auth.uid())
  ) then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'role', p.role, 'invited_at', p.invited_at)), '[]'::jsonb)
  into parts
  from public.hr_consultation_participants p where p.case_id = p_case_id;

  select coalesce(jsonb_agg(jsonb_build_object('type', e.event_type, 'body', e.body, 'at', e.created_at, 'by', e.created_by) order by e.created_at), '[]'::jsonb)
  into evs
  from public.hr_consultation_events e where e.case_id = p_case_id;

  select coalesce(jsonb_agg(jsonb_build_object('author', cm.author_id, 'body', cm.body, 'at', cm.created_at) order by cm.created_at), '[]'::jsonb)
  into coms
  from public.hr_consultation_comments cm where cm.case_id = p_case_id;

  return jsonb_build_object(
    'title', c.title,
    'description', c.description,
    'status', c.status,
    'amlChapter8Applies', c.aml_chapter_8_applies,
    'informationProvidedAt', c.information_provided_at,
    'decisionSummary', c.decision_summary,
    'participants', parts,
    'timeline', evs,
    'comments', coms,
    'exportedAt', now()
  );
end;
$$;

grant execute on function public.hr_consultation_protocol_json(uuid) to authenticated;
